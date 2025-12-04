# graph/workflow.py
"""
LangGraph Workflow Definition

This replaces MultiAgentOrchestrator with a declarative graph.
"""

from langgraph.graph import StateGraph, END
from .state import OrchestratorState
from .nodes import (
    analyze_intent_node,
    select_strategy_node,
    generate_actions_node,
    writer_node,
    critic_node,
    merge_results_node
)


def should_use_critic(state: OrchestratorState) -> str:
    """Route based on strategy and enable_critic flag"""
    strategy = state.get("strategy")
    enable_critic = state.get("enable_critic", True)
    
    if strategy == "cluster" and enable_critic:
        return "critic"
    return "merge"


def should_revise(state: OrchestratorState) -> str:
    """Route based on critic approval"""
    if state.get("critic_approved", False):
        return "merge"
    
    iteration = state.get("iteration", 0) or 0
    max_iterations = state.get("max_iterations", 3) or 3
    
    if iteration >= max_iterations:
        print(f"⚠️ [Workflow] Max iterations ({max_iterations}) reached")
        return "merge"
    
    return "revise"


def needs_action(state: OrchestratorState) -> str:
    """Check if we have actions to execute"""
    actions = state.get("actions", []) or []
    intent = state.get("intent", {}) or {}
    error = state.get("error")
    
    # If there's an error, skip to merge
    if error:
        return "merge"
    
    # Some intents don't need action execution
    intent_type = intent.get("intent", "")
    if intent_type in ["general_chat", "clarify"]:
        return "merge"
    
    if len(actions) > 0:
        return "execute"
    
    return "merge"


def build_orchestrator_graph() -> StateGraph:
    """
    Build the orchestrator workflow graph.
    
    Flow:
    1. analyze_intent → Understand what user wants
    2. generate_actions → Create action plan
    3. select_strategy → Choose execution strategy
    4. writer → Execute writing (if needed)
    5. critic → Review (if cluster strategy)
    6. merge_results → Prepare response
    
    Visual:
    
        ┌──────────────────┐
        │  analyze_intent  │
        └────────┬─────────┘
                 │
        ┌────────▼─────────┐
        │ generate_actions │
        └────────┬─────────┘
                 │
        ┌────────▼─────────┐
        │ select_strategy  │
        └────────┬─────────┘
                 │
          ┌──────┴──────┐
          │ needs_action │
          └──────┬──────┘
                 │
         execute │ merge
           ┌─────┴─────┐
           │           │
    ┌──────▼──────┐    │
    │   writer    │    │
    └──────┬──────┘    │
           │           │
    ┌──────┴──────┐    │
    │ use_critic? │    │
    └──────┬──────┘    │
           │           │
     critic│   merge   │
       ┌───┴───┐       │
       │       │       │
┌──────▼──┐    │       │
│  critic │    │       │
└────┬────┘    │       │
     │         │       │
┌────┴────┐    │       │
│ revise? │    │       │
└────┬────┘    │       │
     │         │       │
revise│  merge │       │
  │   └───┬────┘       │
  │       │            │
  │  ┌────▼────────────▼───┐
  │  │   merge_results     │
  │  └──────────┬──────────┘
  │             │
  └─────────────┘   END
         ▲
         │
         └── (loops back to writer for revision)
    """
    
    # Create graph with our state type
    graph = StateGraph(OrchestratorState)
    
    # Add nodes
    graph.add_node("analyze_intent", analyze_intent_node)
    graph.add_node("generate_actions", generate_actions_node)
    graph.add_node("select_strategy", select_strategy_node)
    graph.add_node("writer", writer_node)
    graph.add_node("critic", critic_node)
    graph.add_node("merge_results", merge_results_node)
    
    # Set entry point
    graph.set_entry_point("analyze_intent")
    
    # Linear flow: intent → actions → strategy
    graph.add_edge("analyze_intent", "generate_actions")
    graph.add_edge("generate_actions", "select_strategy")
    
    # Conditional: strategy → execute or merge
    graph.add_conditional_edges(
        "select_strategy",
        needs_action,
        {
            "execute": "writer",
            "merge": "merge_results"
        }
    )
    
    # Conditional: writer → critic or merge
    graph.add_conditional_edges(
        "writer",
        should_use_critic,
        {
            "critic": "critic",
            "merge": "merge_results"
        }
    )
    
    # Conditional: critic → revise (back to writer) or merge
    graph.add_conditional_edges(
        "critic",
        should_revise,
        {
            "revise": "writer",  # Loop back for revision
            "merge": "merge_results"
        }
    )
    
    # End
    graph.add_edge("merge_results", END)
    
    return graph


# ============================================================
# COMPILED GRAPHS
# ============================================================

_compiled_graph = None

def get_orchestrator():
    """Get compiled orchestrator graph (singleton)"""
    global _compiled_graph
    
    if _compiled_graph is None:
        print("🔧 [Workflow] Building orchestrator graph...")
        graph = build_orchestrator_graph()
        _compiled_graph = graph.compile()
        print("✅ [Workflow] Graph compiled")
    
    return _compiled_graph


def get_orchestrator_with_memory(session_id: str):
    """
    Get orchestrator with checkpoint persistence.
    
    Allows for:
    - Resuming interrupted workflows
    - Human-in-the-loop interrupts
    - Workflow history
    """
    try:
        from langgraph.checkpoint.sqlite import SqliteSaver
        
        graph = build_orchestrator_graph()
        checkpointer = SqliteSaver.from_conn_string("orchestrator_sessions.db")
        
        return graph.compile(
            checkpointer=checkpointer,
            interrupt_before=["writer"]  # Allow human-in-the-loop before writing
        )
    except ImportError:
        print("⚠️ [Workflow] SQLite checkpointer not available, using memory-only")
        return get_orchestrator()
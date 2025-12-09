"""
LangGraph Workflow Definition

This replaces MultiAgentOrchestrator with a declarative graph.
Tool executor is included but bypassed when no tools are pending.
"""

from langgraph.graph import StateGraph, END
from .state import OrchestratorState
from .nodes import (
    analyze_intent_node,
    select_strategy_node,
    generate_actions_node,
    writer_node,
    critic_node,
    tool_executor_node,
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
    """Check if we have actions to execute or need clarification"""
    
    # If clarification is needed, skip to merge (UI will handle)
    if state.get("needs_clarification", False):
        print("🤔 [Workflow] Clarification needed, skipping to merge")
        return "merge"
    
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
    
    # Check if tools are needed first
    pending_tools = state.get("pending_tool_calls", []) or []
    if len(pending_tools) > 0:
        return "tools"
    
    # Check if any actions need writer execution
    # Both content generation AND structure generation use the writer
    writer_actions = [
        a for a in actions 
        if a.get("type") in ["generate_content", "generate_structure"]
    ]
    if len(writer_actions) > 0:
        return "execute"
    
    return "merge"


def after_tools(state: OrchestratorState) -> str:
    """Route after tool execution - continue to writer or merge"""
    actions = state.get("actions", []) or []
    content_actions = [a for a in actions if a.get("type") == "generate_content"]
    
    if len(content_actions) > 0:
        return "writer"
    return "merge"


def build_orchestrator_graph() -> StateGraph:
    """
    Build the orchestrator workflow graph.
    
    Flow:
    1. analyze_intent → Understand what user wants
    2. generate_actions → Create action plan
    3. select_strategy → Choose execution strategy
    4. [optional] tool_executor → Execute MCP/tool calls if pending
    5. writer → Execute writing (if needed)
    6. critic → Review (if cluster strategy)
    7. merge_results → Prepare response
    
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
       ┌─────────┼─────────┐
       │         │         │
     tools    execute    merge
       │         │         │
       ▼         ▼         │
  ┌─────────┐ ┌─────┐      │
  │ tool_ex │ │write│      │
  └────┬────┘ └──┬──┘      │
       │         │         │
       └────┬────┘         │
            │              │
     ┌──────┴──────┐       │
     │ use_critic? │       │
     └──────┬──────┘       │
            │              │
      critic│    merge     │
        ┌───┴───┐          │
        ▼       │          │
   ┌────────┐   │          │
   │ critic │   │          │
   └───┬────┘   │          │
       │        │          │
  ┌────┴────┐   │          │
  │ revise? │   │          │
  └────┬────┘   │          │
       │        │          │
  revise│ merge │          │
    │   └───┬───┘          │
    │       │              │
    │  ┌────▼──────────────▼───┐
    │  │     merge_results     │
    │  └───────────┬───────────┘
    │              │
    └──────────────┘  END
    """
    
    # Create graph with our state type
    graph = StateGraph(OrchestratorState)
    
    # Add all nodes
    graph.add_node("analyze_intent", analyze_intent_node)
    graph.add_node("generate_actions", generate_actions_node)
    graph.add_node("select_strategy", select_strategy_node)
    graph.add_node("tool_executor", tool_executor_node)  # For future MCP
    graph.add_node("writer", writer_node)
    graph.add_node("critic", critic_node)
    graph.add_node("merge_results", merge_results_node)
    
    # Set entry point
    graph.set_entry_point("analyze_intent")
    
    # Linear flow: intent → actions → strategy
    graph.add_edge("analyze_intent", "generate_actions")
    graph.add_edge("generate_actions", "select_strategy")
    
    # Conditional: strategy → tools, execute, or merge
    graph.add_conditional_edges(
        "select_strategy",
        needs_action,
        {
            "tools": "tool_executor",
            "execute": "writer",
            "merge": "merge_results"
        }
    )
    
    # After tools: continue to writer or merge
    graph.add_conditional_edges(
        "tool_executor",
        after_tools,
        {
            "writer": "writer",
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
            "revise": "writer",
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


def reset_orchestrator():
    """Reset the compiled graph (useful for testing or config changes)"""
    global _compiled_graph
    _compiled_graph = None
    print("🔄 [Workflow] Graph reset")


def get_orchestrator_with_memory(session_id: str):
    """
    Get orchestrator with checkpoint persistence.
    """
    try:
        from langgraph.checkpoint.sqlite import SqliteSaver
        
        graph = build_orchestrator_graph()
        checkpointer = SqliteSaver.from_conn_string("orchestrator_sessions.db")
        
        return graph.compile(
            checkpointer=checkpointer,
            interrupt_before=["writer"]
        )
    except ImportError:
        print("⚠️ [Workflow] SQLite checkpointer not available, using memory-only")
        return get_orchestrator()
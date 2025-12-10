"""
LangGraph Workflow Definition

This replaces MultiAgentOrchestrator with a declarative graph-based workflow.
The graph orchestrates multiple AI agents (writer, critic) to handle user requests.

Key Concepts:
- Nodes: Individual processing steps (analyze_intent, writer, critic, etc.)
- Edges: Connections between nodes (defines execution flow)
- Conditional Edges: Dynamic routing based on state (e.g., "should we use critic?")
- State: Shared data structure passed between nodes (OrchestratorState)

Flow Overview:
1. User message → analyze_intent (understand what user wants)
2. → generate_actions (create action plan)
3. → select_strategy (choose execution approach)
4. → [conditional routing] → writer/critic/tools/merge
5. → merge_results (prepare final response)
"""

import os
from langsmith import traceable
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
    """
    Routing function: Decide whether to use the critic agent after writer.
    
    The critic reviews the writer's output and can request revisions.
    This creates a writer-critic feedback loop for quality control.
    
    Returns:
        "critic" - Route to critic node for review
        "merge" - Skip critic, go straight to final response
    
    Decision logic:
    - Only use critic if strategy is "cluster" (multi-agent mode)
    - AND enable_critic flag is True
    - Otherwise, skip directly to merge_results
    """
    strategy = state.get("strategy")
    enable_critic = state.get("enable_critic", True)
    
    if strategy == "cluster" and enable_critic:
        return "critic"
    return "merge"


def should_revise(state: OrchestratorState) -> str:
    """
    Routing function: Decide if writer should revise based on critic feedback.
    
    This implements the writer-critic loop:
    - Critic reviews writer's output
    - If not approved → send back to writer with feedback
    - If approved OR max iterations reached → proceed to final response
    
    Returns:
        "revise" - Send back to writer node for another attempt
        "merge" - Critic approved or max iterations reached, finalize response
    
    Safety: Prevents infinite loops by limiting iterations
    """
    if state.get("critic_approved", False):
        return "merge"
    
    iteration = state.get("iteration", 0) or 0
    max_iterations = state.get("max_iterations", 3) or 3
    
    if iteration >= max_iterations:
        print(f"⚠️ [Workflow] Max iterations ({max_iterations}) reached")
        return "merge"
    
    return "revise"


def needs_action(state: OrchestratorState) -> str:
    """
    Routing function: Determine what to do after strategy selection.
    
    This is the main decision point after analyzing intent and generating actions.
    It decides whether to:
    - Execute tools (MCP/tool calls)
    - Execute writer agent (content/structure generation)
    - Skip to merge (chat, clarification, or errors)
    
    Returns:
        "tools" - Route to tool_executor node (for MCP/tool calls)
        "execute" - Route to writer node (for content/structure generation)
        "merge" - Skip execution, go straight to final response
    
    Decision priority (in order):
    1. Clarification needed → merge (UI handles user input)
    2. Error occurred → merge (return error response)
    3. Pending tool calls → tools (execute tools first)
    4. Writer actions exist → execute (generate content/structure)
    5. Chat/clarify intent → merge (no execution needed)
    6. Default → merge (fallback)
    
    Note: Writer actions include both "generate_content" and "generate_structure"
    because both use the writer agent to create output.
    """
    
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
    
    # Check if tools are needed first
    pending_tools = state.get("pending_tool_calls", []) or []
    if len(pending_tools) > 0:
        return "tools"
    
    # PRIORITY: Check if any actions need writer execution BEFORE checking intent
    # This ensures clarification responses get executed even when intent is ambiguous
    # Both content generation AND structure generation use the writer
    print(f"🔍 [Workflow] Checking {len(actions)} action(s) for writer tasks...")
    for i, a in enumerate(actions):
        action_type = a.get("type", "unknown")
        print(f"   Action {i}: type='{action_type}' payload={list(a.get('payload', {}).keys())}")
    
    writer_actions = [
        a for a in actions 
        if a.get("type") in ["generate_content", "generate_structure"]
    ]
    if len(writer_actions) > 0:
        print(f"✅ [Workflow] Found {len(writer_actions)} writer action(s), routing to execute")
        return "execute"
    
    print(f"⚠️ [Workflow] No writer actions found (expected generate_content or generate_structure)")
    
    # Only skip to merge for chat/clarify if no actions were generated
    intent_type = intent.get("intent", "")
    if intent_type in ["general_chat", "clarify"]:
        return "merge"
    
    return "merge"


def after_tools(state: OrchestratorState) -> str:
    """
    Routing function: Decide what to do after tool execution completes.
    
    After tools are executed (e.g., MCP calls), check if we still need
    to generate content, or if we can proceed to final response.
    
    Returns:
        "writer" - Continue to writer node (tools prepared data, now generate content)
        "merge" - Tools were sufficient, proceed to final response
    
    Example flow:
    - Tool fetches external data → writer uses that data to generate content
    - Tool performs action → merge (no content generation needed)
    """
    actions = state.get("actions", []) or []
    content_actions = [a for a in actions if a.get("type") == "generate_content"]
    
    if len(content_actions) > 0:
        return "writer"
    return "merge"


def build_orchestrator_graph() -> StateGraph:
    """
    Build the orchestrator workflow graph.
    
    This function constructs the LangGraph workflow by:
    1. Creating a StateGraph with OrchestratorState as the state type
    2. Adding all processing nodes (analyze_intent, writer, critic, etc.)
    3. Defining edges (connections) between nodes
    4. Setting up conditional routing based on state
    
    Execution Flow:
    1. analyze_intent → Understand what user wants (LLM analyzes message)
    2. generate_actions → Create action plan (what to do: generate content, open doc, etc.)
    3. select_strategy → Choose execution approach (cluster vs direct)
    4. [conditional routing] → Based on needs_action():
       - tools → Execute MCP/tool calls (if pending)
       - execute → Run writer agent (generate content/structure)
       - merge → Skip execution, go to final response
    5. writer → Generate content using LLM (if execute path)
    6. [conditional] → should_use_critic() decides:
       - critic → Review writer output (if cluster strategy)
       - merge → Skip critic, go to final response
    7. critic → Review and approve/reject (if critic path)
    8. [conditional] → should_revise() decides:
       - revise → Send back to writer with feedback (loop)
       - merge → Critic approved, proceed to final response
    9. merge_results → Prepare final response for frontend
    
    Visual Graph Structure:
    
        ┌──────────────────┐
        │  analyze_intent  │ ← Entry point: User message analyzed
        └────────┬─────────┘
                 │ (always)
        ┌────────▼─────────┐
        │ generate_actions │ ← Creates action plan
        └────────┬─────────┘
                 │ (always)
        ┌────────▼─────────┐
        │ select_strategy │ ← Chooses execution strategy
        └────────┬─────────┘
                 │
          ┌──────┴──────┐
          │ needs_action │ ← DECISION POINT: What to do next?
          └──────┬──────┘
                 │
       ┌─────────┼─────────┐
       │         │         │
     tools    execute    merge
       │         │         │
       ▼         ▼         │
  ┌─────────┐ ┌─────┐      │
  │ tool_ex │ │write│      │ ← Writer generates content
  └────┬────┘ └──┬──┘      │
       │         │         │
       └────┬────┘         │
            │              │
     ┌──────┴──────┐       │
     │ use_critic? │ ← DECISION: Review output?
     └──────┬──────┘       │
            │              │
      critic│    merge     │
        ┌───┴───┐          │
        ▼       │          │
   ┌────────┐   │          │
   │ critic │   │          │ ← Critic reviews quality
   └───┬────┘   │          │
       │        │          │
  ┌────┴────┐   │          │
  │ revise? │ ← DECISION: Need revision?
  └────┬────┘   │          │
       │        │          │
  revise│ merge │          │
    │   └───┬───┘          │
    │       │              │
    │  ┌────▼──────────────▼───┐
    │  │     merge_results     │ ← Final response prepared
    │  └───────────┬───────────┘
    │              │
    └──────────────┘  END
    
    Returns:
        StateGraph: The compiled graph ready for execution
    """
    
    # Create graph with our state type
    # OrchestratorState defines what data flows between nodes
    graph = StateGraph(OrchestratorState)
    
    # ============================================================
    # ADD NODES (Processing Steps)
    # ============================================================
    # Each node is a function that processes the state and returns updates
    
    graph.add_node("analyze_intent", analyze_intent_node)  # Understand user intent
    graph.add_node("generate_actions", generate_actions_node)  # Create action plan
    graph.add_node("select_strategy", select_strategy_node)  # Choose execution strategy
    graph.add_node("tool_executor", tool_executor_node)  # Execute MCP/tool calls (future)
    graph.add_node("writer", writer_node)  # Generate content/structure using LLM
    graph.add_node("critic", critic_node)  # Review writer output for quality
    graph.add_node("merge_results", merge_results_node)  # Prepare final response
    
    # ============================================================
    # DEFINE EXECUTION FLOW
    # ============================================================
    
    # Set entry point: All requests start here
    graph.set_entry_point("analyze_intent")
    
    # Linear flow: These always execute in sequence
    graph.add_edge("analyze_intent", "generate_actions")
    graph.add_edge("generate_actions", "select_strategy")
    
    # ============================================================
    # CONDITIONAL ROUTING: After strategy selection
    # ============================================================
    # Based on state, route to one of three paths:
    # - tools: Execute tool calls first
    # - execute: Run writer agent
    # - merge: Skip execution, go to final response
    graph.add_conditional_edges(
        "select_strategy",
        needs_action,  # Routing function that examines state
        {
            "tools": "tool_executor",
            "execute": "writer",
            "merge": "merge_results"
        }
    )
    
    # ============================================================
    # CONDITIONAL ROUTING: After tool execution
    # ============================================================
    # Tools may prepare data for writer, or be sufficient on their own
    graph.add_conditional_edges(
        "tool_executor",
        after_tools,  # Check if we still need writer
        {
            "writer": "writer",  # Continue to writer
            "merge": "merge_results"  # Tools were enough
        }
    )
    
    # ============================================================
    # CONDITIONAL ROUTING: After writer execution
    # ============================================================
    # Decide whether to use critic for quality review
    graph.add_conditional_edges(
        "writer",
        should_use_critic,  # Check if critic should review
        {
            "critic": "critic",  # Route to critic
            "merge": "merge_results"  # Skip critic
        }
    )
    
    # ============================================================
    # CONDITIONAL ROUTING: After critic review
    # ============================================================
    # Critic can request revision (loop back to writer) or approve
    graph.add_conditional_edges(
        "critic",
        should_revise,  # Check if revision needed
        {
            "revise": "writer",  # Loop back to writer with feedback
            "merge": "merge_results"  # Critic approved, finalize
        }
    )
    
    # ============================================================
    # FINAL STEP
    # ============================================================
    # merge_results always leads to END (workflow complete)
    graph.add_edge("merge_results", END)
    
    return graph


# ============================================================
# COMPILED GRAPH SINGLETON
# ============================================================
# The graph is compiled once and reused for all requests.
# This is more efficient than rebuilding the graph each time.

_compiled_graph = None

def get_orchestrator():
    """
    Get the compiled orchestrator graph (singleton pattern).
    
    The graph is built once on first call and cached for subsequent requests.
    This improves performance since graph construction is expensive.
    
    Returns:
        CompiledStateGraph: The compiled graph ready to execute
    
    Usage:
        orchestrator = get_orchestrator()
        result = await orchestrator.ainvoke(initial_state)
    """
    global _compiled_graph
    
    if _compiled_graph is None:
        print("🔧 [Workflow] Building orchestrator graph...")
        graph = build_orchestrator_graph()
        
          # Enable LangSmith tracing if configured
        # LangGraph automatically traces when LANGSMITH_TRACING env var is set
        if os.getenv("LANGSMITH_TRACING", "false").lower() == "true":
            print("📊 [Workflow] LangSmith tracing enabled")
            # Traces will appear in LangSmith UI at https://smith.langchain.com
        
        # Compile the graph (optimizes execution)
        _compiled_graph = graph.compile()
        print("✅ [Workflow] Graph compiled")
    
    return _compiled_graph


def reset_orchestrator():
    """
    Reset the compiled graph singleton.
    
    Useful for:
    - Testing (fresh graph for each test)
    - Configuration changes (rebuild with new settings)
    - Debugging (force graph reconstruction)
    
    After calling this, the next get_orchestrator() call will rebuild the graph.
    """
    global _compiled_graph
    _compiled_graph = None
    print("🔄 [Workflow] Graph reset")


def get_orchestrator_with_memory(session_id: str):
    """
    Get orchestrator with checkpoint persistence (for future use).
    
    This version saves state to SQLite database, allowing:
    - Resuming interrupted workflows
    - Human-in-the-loop interactions (pause and wait for input)
    - Session persistence across server restarts
    
    Currently not used in production, but available for future features.
    
    Args:
        session_id: Unique identifier for the session/workflow
    
    Returns:
        CompiledStateGraph: Graph with checkpoint persistence enabled
    
    Note:
        The graph interrupts before "writer" node, allowing external
        systems to inject data or wait for user input before continuing.
    """
    try:
        from langgraph.checkpoint.sqlite import SqliteSaver
        
        graph = build_orchestrator_graph()
        checkpointer = SqliteSaver.from_conn_string("orchestrator_sessions.db")
        
        return graph.compile(
            checkpointer=checkpointer,  # Save state to SQLite
            interrupt_before=["writer"]  # Pause before writer for human input
        )
    except ImportError:
        print("⚠️ [Workflow] SQLite checkpointer not available, using memory-only")
        return get_orchestrator()
"""
LangGraph State Schema

This replaces your Blackboard + WorldState with a single typed state
that flows through the graph.

All fields that will be used in the workflow must be declared here.
"""

from typing import TypedDict, Literal, Annotated, Optional, Any
from operator import add

# Execution strategies (from MultiAgentOrchestrator)
Strategy = Literal["sequential", "parallel", "cluster"]


# ============================================================
# NESTED TYPES
# ============================================================

class ActiveSegment(TypedDict, total=False):
    """Currently selected segment"""
    id: str
    name: str
    level: Optional[int]
    has_content: Optional[bool]


class ActionPayload(TypedDict, total=False):
    """Action payload data"""
    section_id: Optional[str]
    section_name: Optional[str]
    prompt: Optional[str]
    content: Optional[str]
    format: Optional[str]
    node_id: Optional[str]
    node_name: Optional[str]


class Action(TypedDict, total=False):
    """Orchestrator action"""
    type: str  # generate_content, generate_structure, open_document, etc.
    payload: dict
    requiresUserInput: bool
    priority: str  # high, normal, low
    status: str  # pending, completed, failed
    dependsOn: list  # Actions that must complete first
    autoExecute: bool  # Whether to execute automatically


class IntentAnalysis(TypedDict, total=False):
    """Result from intent analysis"""
    intent: str
    confidence: float
    reasoning: str
    suggestedAction: Optional[str]
    requiresContext: bool
    suggestedModel: Optional[str]
    needsClarification: bool
    clarifyingQuestion: Optional[str]
    extractedEntities: dict


class Message(TypedDict, total=False):
    """Conversation message"""
    role: str  # user | orchestrator | system
    content: str
    type: str  # thinking | decision | result | error | progress | options


class ClarificationOption(TypedDict, total=False):
    """Option for request_clarification action"""
    id: str
    label: str
    description: Optional[str]
    metadata: Optional[dict]


class ToolCall(TypedDict, total=False):
    """Tool call request (for MCP/function calling)"""
    id: str
    tool_name: str  # web_search, rag_query, etc.
    parameters: dict
    status: str  # pending, executing, completed, failed
    result: Optional[Any]


# ============================================================
# REDUCERS
# ============================================================

def add_messages(existing: list, new: list) -> list:
    """Append new messages to existing list"""
    if existing is None:
        existing = []
    if new is None:
        new = []
    return existing + new


def add_actions(existing: list, new: list) -> list:
    """Append new actions to existing list"""
    if existing is None:
        existing = []
    if new is None:
        new = []
    return existing + new


def merge_results(existing: dict, new: dict) -> dict:
    """Merge new results into existing dict"""
    if existing is None:
        existing = {}
    if new is None:
        new = {}
    return {**existing, **new}


def add_tool_calls(existing: list, new: list) -> list:
    """Append new tool calls to existing list"""
    if existing is None:
        existing = []
    if new is None:
        new = []
    return existing + new


def merge_tool_results(existing: dict, new: dict) -> dict:
    """Merge new tool results into existing dict"""
    if existing is None:
        existing = {}
    if new is None:
        new = {}
    return {**existing, **new}


# ============================================================
# MAIN STATE
# ============================================================

class OrchestratorState(TypedDict, total=False):
    """
    Main state that flows through the LangGraph workflow.
    
    Replaces:
    - Blackboard (conversation history, agent messages)
    - WorldState (canvas context, active document)
    - OrchestratorRequest/Response
    
    Note: All fields must be declared here, even optional ones.
    Use total=False to make all fields optional.
    """
    
    # ========== INPUT ==========
    user_message: str
    session_id: str
    user_id: str
    
    # ========== CONTEXT (from frontend) ==========
    active_segment: Optional[dict]  # ActiveSegment as dict
    document_panel_open: bool
    document_format: Optional[str]
    canvas_context: Optional[str]
    structure_items: list
    conversation_history: list
    
    # ========== CANVAS STATE ==========
    # All nodes on canvas (for open_document, delete_node)
    canvas_nodes: list  # List of node summaries
    canvas_edges: list  # List of edges
    story_structure_node_id: Optional[str]  # Currently active document node
    
    # ========== MODEL PREFERENCES ==========
    model_mode: str  # automatic | fixed
    fixed_model_id: Optional[str]
    
    # ========== INTENT ANALYSIS ==========
    intent: Optional[dict]  # IntentAnalysis as dict
    
    # ========== STRATEGY ==========
    strategy: Optional[str]
    
    # ========== ACTIONS ==========
    # Using Annotated with reducer for append behavior
    actions: Annotated[list, add_actions]
    
    # ========== RESULTS ==========
    results: Annotated[dict, merge_results]
    
    # ========== MESSAGES ==========
    messages: Annotated[list, add_messages]
    
    # ========== CLARIFICATION ==========
    # For request_clarification action
    needs_clarification: bool
    clarification_options: list  # List of ClarificationOption
    clarification_message: Optional[str]
    original_action: Optional[str]  # Action to execute after clarification
    clarification_response: Optional[dict]  # User's response {option_id, original_action}
    
    # ========== WRITER-CRITIC LOOP ==========
    iteration: int
    max_iterations: int
    critic_approved: bool
    enable_critic: bool
    
    # ========== TOOL CALLING (MCP/Future) ==========
    # These fields support future tool/MCP integration
    pending_tool_calls: Annotated[list, add_tool_calls]  # Tools to execute
    tool_results: Annotated[dict, merge_tool_results]    # tool_id -> result
    available_tools: list  # Which tools are enabled ['web_search', 'rag_query', etc.]
    tool_execution_required: bool  # Whether we need to execute tools before continuing
    
    # ========== ERROR HANDLING ==========
    error: Optional[str]
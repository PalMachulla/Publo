"""
LangGraph State Schema

This replaces your Blackboard + WorldState with a single typed state
that flows through the graph.

All fields that will be used in the workflow must be declared here.

================================================================================
DATA FLOW: Frontend → Backend → State → Workflow
================================================================================

1. FRONTEND SOURCES (React Components):
   - OrchestratorPanelStreaming.tsx: Main orchestrator UI component
   - useOrchestratorStream.ts: Hook that collects context and sends requests
   - Canvas components: Provide canvas state (nodes, edges, active document)
   - Document panel: Provides active segment, document format, structure items

2. API LAYER (orchestrator/api/orchestrate.py):
   - OrchestrateRequest: Receives camelCase from frontend
   - Transforms to snake_case for Python
   - Builds initial_state dict from request fields
   - Passes to LangGraph workflow

3. STATE (this file):
   - OrchestratorState: TypedDict that flows through graph nodes
   - Each node reads/writes state fields
   - Reducers handle list/dict merging (messages, actions, results)

4. WORKFLOW (orchestrator/graph/workflow.py):
   - Nodes access state fields
   - Conditional edges route based on state values
   - Final state returned to frontend via SSE events

================================================================================
FRONTEND → STATE FIELD MAPPING
================================================================================

Frontend sends (camelCase)          →  State field (snake_case)
────────────────────────────────────────────────────────────────────────────
request.message                     →  user_message
request.userId                      →  user_id
request.sessionId                   →  session_id
request.activeSegment               →  active_segment (ActiveSegment dict)
request.documentPanelOpen           →  document_panel_open
request.documentFormat              →  document_format
request.canvasContext               →  canvas_context (stringified JSON)
request.structureItems              →  structure_items (list of dicts)
request.canvasNodes                 →  canvas_nodes (list of node summaries)
request.conversationHistory         →  conversation_history (list of messages)
request.clarificationResponse       →  clarification_response (dict)
"""

from typing import TypedDict, Literal, Annotated, Optional, Any
from operator import add

# Execution strategies (from MultiAgentOrchestrator)
Strategy = Literal["sequential", "parallel", "cluster"]


# ============================================================
# NESTED TYPES
# ============================================================

class ActiveSegment(TypedDict, total=False):
    """
    Currently selected segment in the document panel.
    
    Source: OrchestratorPanelStreaming.activeSegment prop
    Flow: Frontend → OrchestrateRequest.active_segment → State.active_segment
    Used by: analyze_intent_node (to understand what user is editing)
    """
    id: str  # Section/segment UUID
    name: str  # Display name (e.g., "Chapter 1", "Act 2 Scene 3")
    level: Optional[int]  # Hierarchy level (0 = top-level, 1 = nested, etc.)
    has_content: Optional[bool]  # Whether segment already has generated content


class ActionPayload(TypedDict, total=False):
    """
    Action payload data - varies by action type.
    
    Used by: All action types (generate_content, generate_structure, open_document, etc.)
    Structure: Different action types use different payload fields
    """
    section_id: Optional[str]  # For generate_content: which section to write
    section_name: Optional[str]  # For generate_content: section display name
    prompt: Optional[str]  # For generate_content/generate_structure: user's prompt
    content: Optional[str]  # For generate_content: generated content
    format: Optional[str]  # For generate_structure: document format (novel, screenplay, etc.)
    node_id: Optional[str]  # For open_document/delete_node: target node UUID
    node_name: Optional[str]  # For open_document/delete_node: node display name


class Action(TypedDict, total=False):
    """
    Orchestrator action - represents a task to execute.
    
    Written by: generate_actions_node (orchestrator/graph/nodes.py)
    Read by: tool_executor_node, writer_node (to execute actions)
    Sent to: Frontend via SSE ACTION events
    Executed by: Frontend (UI actions) or Backend (auto-executable actions)
    """
    type: str  # Action type: "generate_content", "generate_structure", "open_document", etc.
    payload: dict  # ActionPayload dict (varies by action type)
    requiresUserInput: bool  # True if frontend must handle (e.g., open_document)
    priority: str  # "high" | "normal" | "low" (for execution ordering)
    status: str  # "pending" | "completed" | "failed" (execution status)
    dependsOn: list  # List of action IDs that must complete first (for dependencies)
    autoExecute: bool  # True if backend can execute automatically (e.g., generate_content)


class IntentAnalysis(TypedDict, total=False):
    """
    Result from intent analysis (LLM-based classification).
    
    Written by: analyze_intent_node (orchestrator/graph/nodes.py)
    Source: LLM analyzes user message + context
    Used by: generate_actions_node (to create appropriate actions)
    Sent to: Frontend via SSE INTENT event (for debugging/display)
    """
    intent: str  # Detected intent: "create_structure", "generate_content", "answer_question", etc.
    confidence: float  # Confidence score (0.0 - 1.0)
    reasoning: str  # LLM's reasoning for this intent classification
    suggestedAction: Optional[str]  # Recommended action type
    requiresContext: bool  # Whether intent needs canvas/document context
    suggestedModel: Optional[str]  # Recommended LLM model for this intent
    needsClarification: bool  # Whether intent is ambiguous and needs user input
    clarifyingQuestion: Optional[str]  # Question to ask user if needsClarification = True
    extractedEntities: dict  # Extracted entities (characters, locations, themes, etc.)


class Message(TypedDict, total=False):
    """
    Conversation message - orchestrator's internal communication.
    
    Written by: All nodes (to log progress, decisions, errors)
    Used by: Frontend to display orchestrator thinking/decisions
    Sent to: Frontend via SSE MESSAGE events
    Note: Different from user/orchestrator dialogue (that's in conversation_history)
    """
    role: str  # "user" | "orchestrator" | "system"
    content: str  # Message text
    type: str  # "thinking" | "decision" | "result" | "error" | "progress" | "options"


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
    # These come directly from the user's request
    user_message: str  # From: request.message (user's chat input)
    session_id: str    # From: request.sessionId (orchestrator session UUID)
    user_id: str       # From: request.userId (Supabase auth user ID)
    
    # ========== CONTEXT (from frontend) ==========
    # These fields capture the current UI state from React components
    
    # From: OrchestratorPanelStreaming.activeSegment
    # Source: Document panel's currently selected section/segment
    # Used by: Intent analysis (to understand what user is editing)
    active_segment: Optional[dict]  # ActiveSegment as dict
                                    # {id, name, level, has_content}
    
    # From: OrchestratorPanelStreaming.documentPanelOpen
    # Source: Document panel visibility state
    # Used by: Intent analysis (closed = create new, open = edit existing)
    document_panel_open: bool
    
    # From: OrchestratorPanelStreaming.documentFormat
    # Source: Current document type (novel, screenplay, podcast, etc.)
    # Used by: Structure generation, content formatting
    document_format: Optional[str]
    
    # From: Canvas context (formatted for LLM)
    # Source: useCanvasData.ts → formatCanvasContextForLLM()
    # Contains: Summary of all nodes, edges, document structure
    # Used by: Intent analysis (to understand canvas state)
    canvas_context: Optional[str]  # Stringified JSON summary for LLM
    
    # From: request.structureItems
    # Source: Document structure (sections/chapters) from active document
    # Used by: Content generation (to know existing structure)
    structure_items: list  # List of {id, name, level, parent_id, has_content}
    
    # From: request.conversationHistory
    # Source: useOrchestratorSession.ts (persisted messages)
    # Contains: Recent user/orchestrator messages for context
    # Used by: Intent analysis (to understand conversation flow)
    conversation_history: list  # List of {role, content, timestamp}
    
    # ========== CANVAS STATE ==========
    # These come from the React Flow canvas (useCanvasData.ts)
    # Used by: Navigation actions (open_document, delete_node, navigate_section)
    
    # From: request.canvasNodes
    # Source: Canvas React Flow nodes (filtered summaries)
    # Contains: {id, type, data: {label, nodeType}, position}
    # Used by: open_document action (to find target node)
    canvas_nodes: list  # List of node summaries
    
    # From: request.canvasEdges (future - not currently sent)
    # Source: Canvas React Flow edges
    # Contains: {id, source, target, type}
    # Used by: Navigation (to understand node relationships)
    canvas_edges: list  # List of edges
    
    # From: request.currentStoryStructureNodeId
    # Source: Currently active/selected story structure node
    # Used by: Content generation (to know which document to update)
    story_structure_node_id: Optional[str]  # Currently active document node
    
    # ========== MODEL PREFERENCES ==========
    # From: request.modelMode, request.fixedModelId
    # Source: User's model selection preferences
    # Used by: Model selection node (to choose LLM provider/model)
    model_mode: str  # "automatic" | "fixed"
    fixed_model_id: Optional[str]  # If fixed, which model to use
    
    # ========== INTENT ANALYSIS ==========
    # Written by: analyze_intent_node (orchestrator/graph/nodes.py)
    # Contains: {intent, confidence, reasoning, suggestedAction, ...}
    # Used by: generate_actions_node (to create action plan)
    intent: Optional[dict]  # IntentAnalysis as dict
    
    # ========== STRATEGY ==========
    # Written by: select_strategy_node (orchestrator/graph/nodes.py)
    # Contains: "sequential" | "parallel" | "cluster"
    # Used by: Workflow routing (to determine execution approach)
    strategy: Optional[str]
    
    # ========== ACTIONS ==========
    # Written by: generate_actions_node (orchestrator/graph/nodes.py)
    # Contains: List of actions to execute (generate_content, open_document, etc.)
    # Read by: tool_executor_node, writer_node (to execute actions)
    # Sent to: Frontend via SSE ACTION events
    # Using Annotated with reducer for append behavior (new actions added, not replaced)
    actions: Annotated[list, add_actions]  # List of Action dicts
    
    # ========== PLAN SUMMARY (for UI display) ==========
    # Written by: generate_actions_node (when using Deep Agents planner)
    # Contains: {task, intent, step_count, steps: [{id, description, action_type, status}]}
    # Sent to: Frontend via SSE PLAN event (for visual progress display)
    # Note: This is transient - only used for streaming, not persisted
    plan_summary: Optional[dict]  # PlanSummary for UI display
    
    # ========== RESULTS ==========
    # Written by: writer_node, tool_executor_node (orchestrator/graph/nodes.py)
    # Contains: {section_id: content, structure: {...}, ...}
    # Read by: merge_results_node (to prepare final response)
    # Sent to: Frontend via SSE RESULT events
    # Using Annotated with reducer for merge behavior (new results merged into existing)
    results: Annotated[dict, merge_results]  # Dict of section_id -> content
    
    # ========== MESSAGES ==========
    # Written by: All nodes (to log progress, decisions, errors)
    # Contains: List of {role, content, type} messages
    # Sent to: Frontend via SSE MESSAGE events
    # Used by: Frontend to display orchestrator thinking/decisions
    # Using Annotated with reducer for append behavior (messages accumulate)
    messages: Annotated[list, add_messages]  # List of Message dicts
    
    # ========== CLARIFICATION ==========
    # Written by: generate_actions_node (when intent is ambiguous)
    # Read by: Workflow conditional edge (to pause and wait for user)
    # Sent to: Frontend via SSE CLARIFICATION event
    # Used by: Frontend to show clarification options to user
    
    # From: generate_actions_node (when needsClarification = True)
    # Contains: Whether workflow should pause for user input
    needs_clarification: bool
    
    # From: generate_actions_node (list of options to show user)
    # Contains: [{id, label, description, metadata}, ...]
    # Displayed: In OrchestratorPanelStreaming as clickable options
    clarification_options: list  # List of ClarificationOption dicts
    
    # From: generate_actions_node (question to ask user)
    # Contains: Human-readable clarification question
    clarification_message: Optional[str]
    
    # From: generate_actions_node (which action needs clarification)
    # Contains: Action type that was ambiguous (e.g., "create_structure")
    # Used by: buildActionFromClarification (to resume after user responds)
    original_action: Optional[str]  # Action to execute after clarification
    
    # From: request.clarificationResponse (when user selects an option)
    # Source: OrchestratorPanelStreaming.onClarificationOptionSelected()
    # Contains: {option_id: "...", original_action: "..."}
    # Used by: generate_actions_node (to build action from user's choice)
    clarification_response: Optional[dict]  # User's response {option_id, original_action}
    
    # ========== WRITER-CRITIC LOOP ==========
    # These fields control the writer → critic → revision loop
    # Used by: Workflow conditional edges (should_revise, should_use_critic)
    
    # From: request.maxIterations (default: 3)
    # Source: User preference for max revision cycles
    # Used by: Workflow to limit revision loops
    iteration: int  # Current iteration (0, 1, 2, ...)
    max_iterations: int  # Max iterations before giving up
    
    # From: critic_node (orchestrator/graph/nodes.py)
    # Contains: Whether critic approved the writer's output
    # Used by: Workflow conditional edge (if False → revise, if True → merge)
    critic_approved: bool
    
    # From: request.enableCritic (default: True)
    # Source: Feature flag to enable/disable critic
    # Used by: Workflow conditional edge (should_use_critic)
    enable_critic: bool
    
    # ========== TOOL CALLING (MCP/Future) ==========
    # These fields support future tool/MCP integration
    # Currently: Not actively used, reserved for future MCP (Model Context Protocol) integration
    
    # Written by: generate_actions_node (when action requires external tool)
    # Contains: List of tool calls to execute (web_search, rag_query, etc.)
    # Used by: tool_executor_node (to execute tools before content generation)
    pending_tool_calls: Annotated[list, add_tool_calls]  # List of ToolCall dicts
    
    # Written by: tool_executor_node (after executing tools)
    # Contains: {tool_id: result, ...}
    # Used by: writer_node (to incorporate tool results into content)
    tool_results: Annotated[dict, merge_tool_results]  # Dict of tool_id -> result
    
    # From: request.availableTools (future - not currently sent)
    # Source: User's enabled tools configuration
    # Contains: ['web_search', 'rag_query', 'file_read', ...]
    # Used by: generate_actions_node (to know which tools are available)
    available_tools: list  # Which tools are enabled
    
    # Written by: generate_actions_node (when actions require tools)
    # Contains: Whether workflow should route to tool_executor_node
    # Used by: Workflow conditional edge (needs_action → tool_executor)
    tool_execution_required: bool  # Whether we need to execute tools before continuing
    
    # ========== ERROR HANDLING ==========
    # Written by: Any node (when an error occurs)
    # Contains: Error message string
    # Sent to: Frontend via SSE ERROR event
    # Used by: Frontend to display error messages to user
    error: Optional[str]
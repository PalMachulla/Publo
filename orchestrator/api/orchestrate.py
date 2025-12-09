"""
Orchestration API

Full orchestration endpoint using LangGraph workflow.
Uses Python snake_case conventions - frontend proxy handles camelCase transformation.

Endpoints:
- POST /orchestrate - Full orchestration flow
- POST /orchestrate/stream - Server-Sent Events for real-time updates
- POST /actions/execute - Execute a specific action
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, AsyncIterator, Any, List
import json

router = APIRouter()


# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class ActiveSegment(BaseModel):
    """Currently selected segment in the document"""
    id: str
    name: str
    level: Optional[int] = None
    has_content: Optional[bool] = False


class StructureItem(BaseModel):
    """Document structure item (section/chapter)"""
    id: str
    name: str
    level: int
    parent_id: Optional[str] = None
    has_content: Optional[bool] = False


class ClarificationOption(BaseModel):
    """Option for request_clarification"""
    id: str
    label: str
    description: Optional[str] = None


class OrchestrateRequest(BaseModel):
    """
    Full orchestration request from frontend.
    
    Frontend sends camelCase, proxy transforms to snake_case.
    """
    # Required
    message: str
    user_id: str
    
    # Session
    session_id: Optional[str] = None
    
    # Document context
    active_segment: Optional[ActiveSegment] = None
    document_panel_open: bool = False
    document_format: Optional[str] = None
    
    # Canvas context
    canvas_context: Optional[str] = None
    structure_items: list[dict] = Field(default_factory=list)
    canvas_nodes: list[dict] = Field(default_factory=list)
    
    # Conversation history (recent messages for context)
    conversation_history: list[dict] = Field(default_factory=list)
    
    # Model preferences
    model_mode: str = "automatic"  # automatic | fixed
    fixed_model_id: Optional[str] = None
    
    # Feature flags
    enable_critic: bool = True
    max_iterations: int = 3
    
    # Clarification response (when user selects an option)
    clarification_response: Optional[dict] = None


class ActionPayload(BaseModel):
    """Action payload data"""
    section_id: Optional[str] = None
    section_name: Optional[str] = None
    prompt: Optional[str] = None
    content: Optional[str] = None
    format: Optional[str] = None
    node_id: Optional[str] = None
    node_name: Optional[str] = None
    # Allow additional fields
    class Config:
        extra = "allow"


class ActionResponse(BaseModel):
    """Action to execute on frontend"""
    type: str
    payload: dict = Field(default_factory=dict)
    requires_user_input: bool = False
    priority: str = "normal"  # high | normal | low


class MessageResponse(BaseModel):
    """Message for UI display"""
    role: str  # user | orchestrator | system
    content: str
    type: str  # thinking | decision | task | result | error | progress | options
    options: Optional[List[ClarificationOption]] = None  # For type="options"


class ResultData(BaseModel):
    """Content generation result"""
    section_id: str
    content: Any  # Can be string (content) or dict (structure)
    word_count: Optional[int] = None


class OrchestrateResponse(BaseModel):
    """
    Full orchestration response.
    
    Contains intent analysis, strategy, actions to execute, and messages.
    """
    success: bool
    
    # Intent analysis
    intent: Optional[str] = None
    confidence: Optional[float] = None
    reasoning: Optional[str] = None
    
    # Execution info
    strategy: Optional[str] = None  # sequential | parallel | cluster
    
    # Results
    actions: list[ActionResponse] = Field(default_factory=list)
    messages: list[MessageResponse] = Field(default_factory=list)
    results: list[ResultData] = Field(default_factory=list)
    
    # Clarification state
    needs_clarification: bool = False
    clarification_options: Optional[List[ClarificationOption]] = None
    clarification_message: Optional[str] = None
    original_action: Optional[str] = None
    
    # Metadata
    iterations_used: int = 0
    critic_approved: Optional[bool] = None
    
    # Error handling
    error: Optional[str] = None


# ============================================================
# ORCHESTRATE ENDPOINT
# ============================================================

@router.post("/orchestrate", response_model=OrchestrateResponse)
async def orchestrate(request: OrchestrateRequest):
    """
    Full orchestration endpoint.
    
    Flow:
    1. Analyze intent
    2. Generate actions
    3. Select strategy
    4. Execute with optional writer-critic loop
    5. Return results
    """
    try:
        print(f"🎯 [Orchestrate] Processing: {request.message[:50]}...")
        
        # Import here to avoid circular imports
        from graph.workflow import get_orchestrator
        
        # Get compiled graph
        orchestrator = get_orchestrator()
        
        # Build initial state for LangGraph
        initial_state = {
            # Input
            "user_message": request.message,
            "user_id": request.user_id,
            "session_id": request.session_id or "",
            
            # Context
            "active_segment": request.active_segment.model_dump() if request.active_segment else None,
            "document_panel_open": request.document_panel_open,
            "document_format": request.document_format,
            "canvas_context": request.canvas_context,
            "structure_items": request.structure_items,
            "canvas_nodes": request.canvas_nodes,
            "conversation_history": request.conversation_history,
            
            # Clarification response (if user selected an option)
            "clarification_response": request.clarification_response,
            
            # Workflow state
            "actions": [],
            "messages": [],
            "results": {},
            "iteration": 0,
            "max_iterations": request.max_iterations,
            "critic_approved": False,
            "enable_critic": request.enable_critic,
            
            # Clarification state
            "needs_clarification": False,
            "clarification_options": [],
            "clarification_message": None,
            "original_action": None,
            
            # Model preferences
            "model_mode": request.model_mode,
            "fixed_model_id": request.fixed_model_id,
        }
        
        # Run the graph
        final_state = await orchestrator.ainvoke(initial_state)
        
        # Extract results
        intent_data = final_state.get("intent", {}) or {}
        
        # Build messages list from state
        messages = []
        for msg in final_state.get("messages", []):
            messages.append(MessageResponse(
                role=msg.get("role", "orchestrator"),
                content=msg.get("content", ""),
                type=msg.get("type", "result")
            ))
        
        # Build results list
        results = []
        for section_id, content in final_state.get("results", {}).items():
            results.append(ResultData(
                section_id=section_id,
                content=content,
                word_count=len(content.split()) if isinstance(content, str) else None
            ))
        
        return OrchestrateResponse(
            success=True,
            
            # Intent
            intent=intent_data.get("intent"),
            confidence=intent_data.get("confidence"),
            reasoning=intent_data.get("reasoning"),
            
            # Strategy
            strategy=final_state.get("strategy"),
            
            # Actions
            actions=[
                ActionResponse(
                    type=a.get("type", "unknown"),
                    payload=a.get("payload", {}),
                    requires_user_input=a.get("requires_user_input", False),
                    priority=a.get("priority", "normal")
                )
                for a in final_state.get("actions", [])
            ],
            
            # Messages
            messages=messages,
            
            # Results
            results=results,
            
            # Clarification state
            needs_clarification=final_state.get("needs_clarification", False),
            clarification_options=[
                ClarificationOption(
                    id=opt.get("id", ""),
                    label=opt.get("label", ""),
                    description=opt.get("description")
                )
                for opt in final_state.get("clarification_options", [])
            ] if final_state.get("clarification_options") else None,
            clarification_message=final_state.get("clarification_message"),
            original_action=final_state.get("original_action"),
            
            # Metadata
            iterations_used=final_state.get("iteration", 0),
            critic_approved=final_state.get("critic_approved")
        )
        
    except Exception as e:
        print(f"❌ [Orchestrate] Error: {e}")
        import traceback
        traceback.print_exc()
        
        return OrchestrateResponse(
            success=False,
            error=str(e),
            messages=[
                MessageResponse(
                    role="system",
                    content=f"Orchestration failed: {str(e)}",
                    type="error"
                )
            ]
        )


# ============================================================
# STREAMING ENDPOINT
# ============================================================

@router.post("/orchestrate/stream")
async def orchestrate_stream(request: OrchestrateRequest):
    """
    Streaming orchestration endpoint.
    
    Uses Server-Sent Events (SSE) to stream updates as the graph executes.
    
    Event types (UPPERCASE to match Supabase constraint):
    - INTENT: Intent analysis result
    - STRATEGY: Execution strategy selected
    - CLARIFICATION: Needs user input
    - MESSAGE: Chat message
    - ACTION: Action to execute
    - RESULT: Content generation result
    - CRITIC: Critic review result
    - DONE: Stream complete
    - ERROR: Error occurred
    """
    async def generate() -> AsyncIterator[str]:
        try:
            from graph.workflow import get_orchestrator
            
            orchestrator = get_orchestrator()
            
            initial_state = {
                "user_message": request.message,
                "user_id": request.user_id,
                "session_id": request.session_id or "",
                "active_segment": request.active_segment.model_dump() if request.active_segment else None,
                "document_panel_open": request.document_panel_open,
                "document_format": request.document_format,
                "canvas_context": request.canvas_context,
                "structure_items": request.structure_items,
                "canvas_nodes": request.canvas_nodes,
                "conversation_history": request.conversation_history,
                "clarification_response": request.clarification_response,
                "actions": [],
                "messages": [],
                "results": {},
                "iteration": 0,
                "max_iterations": request.max_iterations,
                "critic_approved": False,
                "enable_critic": request.enable_critic,
                "needs_clarification": False,
                "clarification_options": [],
                "model_mode": request.model_mode,
                "fixed_model_id": request.fixed_model_id,
            }
            
            # Track what we've sent to avoid duplicates
            sent_messages = set()
            sent_actions = set()
            sent_results = set()
            sent_intent = False
            sent_strategy = False
            sent_clarification = False
            
            # Stream node outputs
            async for event in orchestrator.astream(initial_state):
                for node_name, node_output in event.items():
                    print(f"📡 [Stream] Node completed: {node_name}")
                    
                    # Stream intent analysis (deduplicated - only send once)
                    if "intent" in node_output and node_output["intent"] and not sent_intent:
                        sent_intent = True
                        yield f"event: INTENT\ndata: {json.dumps(node_output['intent'])}\n\n"
                    
                    # Stream strategy (deduplicated - only send once)
                    if "strategy" in node_output and node_output["strategy"] and not sent_strategy:
                        sent_strategy = True
                        yield f"event: STRATEGY\ndata: {json.dumps({'strategy': node_output['strategy']})}\n\n"
                    
                    # Stream clarification needed
                    if node_output.get("needs_clarification"):
                        yield f"event: CLARIFICATION\ndata: {json.dumps({'options': node_output.get('clarification_options', []), 'message': node_output.get('clarification_message'), 'originalAction': node_output.get('original_action', 'create_structure')})}\n\n"
                    
                    # Stream messages (deduplicated)
                    if "messages" in node_output:
                        for msg in node_output["messages"]:
                            msg_key = f"{msg['role']}:{msg['content'][:50]}"
                            if msg_key not in sent_messages:
                                sent_messages.add(msg_key)
                                yield f"event: MESSAGE\ndata: {json.dumps(msg)}\n\n"
                    
                    # Stream actions (deduplicated)
                    if "actions" in node_output:
                        for action in node_output["actions"]:
                            action_key = f"{action['type']}:{action.get('payload', {}).get('sectionId', '')}"
                            if action_key not in sent_actions:
                                sent_actions.add(action_key)
                                yield f"event: ACTION\ndata: {json.dumps(action)}\n\n"
                    
                    # Stream results (deduplicated)
                    if "results" in node_output and node_output["results"]:
                        for section_id, content in node_output["results"].items():
                            if section_id not in sent_results:
                                sent_results.add(section_id)
                                yield f"event: RESULT\ndata: {json.dumps({'section_id': section_id, 'content': content})}\n\n"
                    
                    # Stream critic approval
                    if "critic_approved" in node_output:
                        yield f"event: CRITIC\ndata: {json.dumps({'approved': node_output['critic_approved']})}\n\n"
            
            # Send completion
            yield f"event: DONE\ndata: {json.dumps({'success': True})}\n\n"
            
        except Exception as e:
            print(f"❌ [Stream] Error: {e}")
            import traceback
            traceback.print_exc()
            yield f"event: ERROR\ndata: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


# ============================================================
# ACTION EXECUTION ENDPOINT
# ============================================================

class ExecuteActionRequest(BaseModel):
    """Request to execute a specific action"""
    action_type: str
    payload: dict = Field(default_factory=dict)
    user_id: str
    session_id: Optional[str] = None
    
    # Context for generation
    canvas_context: Optional[str] = None
    document_format: Optional[str] = None


class ExecuteActionResponse(BaseModel):
    """Response from action execution"""
    success: bool
    content: Optional[Any] = None
    error: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


@router.post("/actions/execute", response_model=ExecuteActionResponse)
async def execute_action(request: ExecuteActionRequest):
    """
    Execute a specific action directly.
    """
    try:
        print(f"⚡ [ExecuteAction] Type: {request.action_type}")
        
        if request.action_type == "generate_content":
            from graph.agents.writer import generate_content
            
            content = await generate_content(
                prompt=request.payload.get("prompt", ""),
                section_name=request.payload.get("section_name"),
                context=request.canvas_context
            )
            
            return ExecuteActionResponse(
                success=True,
                content=content,
                metadata={"word_count": len(content.split()) if isinstance(content, str) else 0}
            )
        
        elif request.action_type == "generate_structure":
            from graph.agents.writer import generate_structure
            
            structure = await generate_structure(
                prompt=request.payload.get("prompt", ""),
                format_type=request.payload.get("format", "novel"),
                template_id=request.payload.get("template")
            )
            
            return ExecuteActionResponse(
                success=True,
                content=structure,
                metadata={"item_count": len(structure.get("items", []))}
            )
        
        else:
            return ExecuteActionResponse(
                success=False,
                error=f"Unknown action type: {request.action_type}"
            )
            
    except Exception as e:
        print(f"❌ [ExecuteAction] Error: {e}")
        return ExecuteActionResponse(
            success=False,
            error=str(e)
        )
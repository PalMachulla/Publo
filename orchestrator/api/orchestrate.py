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
from typing import Optional, AsyncIterator, Any
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
    
    # Conversation history (recent messages for context)
    conversation_history: list[dict] = Field(default_factory=list)
    
    # Model preferences
    model_mode: str = "automatic"  # automatic | fixed
    fixed_model_id: Optional[str] = None
    
    # Feature flags
    enable_critic: bool = True
    max_iterations: int = 3


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
    type: str  # thinking | decision | task | result | error | progress


class ResultData(BaseModel):
    """Content generation result"""
    section_id: str
    content: str
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
    
    Example request:
    {
        "message": "Write the opening scene",
        "user_id": "uuid-here",
        "session_id": "session-uuid",
        "active_segment": {"id": "ch1", "name": "Chapter 1"},
        "document_panel_open": true
    }
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
            "conversation_history": request.conversation_history,
            
            # Workflow state
            "actions": [],
            "messages": [],
            "results": {},
            "iteration": 0,
            "max_iterations": request.max_iterations,
            "critic_approved": False,
            "enable_critic": request.enable_critic,
            
            # Model preferences
            "model_mode": request.model_mode,
            "fixed_model_id": request.fixed_model_id,
        }
        
        # Run the graph
        final_state = await orchestrator.ainvoke(initial_state)
        
        # Extract results
        intent_data = final_state.get("intent", {})
        
        # Build response
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
                    type=a["type"],
                    payload=a.get("payload", {}),
                    requires_user_input=a.get("requiresUserInput", False),
                    priority=a.get("priority", "normal")
                )
                for a in final_state.get("actions", [])
            ],
            
            # Messages
            messages=[
                MessageResponse(
                    role=m["role"],
                    content=m["content"],
                    type=m["type"]
                )
                for m in final_state.get("messages", [])
            ],
            
            # Results (content that was generated)
            results=[
                ResultData(
                    section_id=section_id,
                    content=content,
                    word_count=len(content.split()) if content else 0
                )
                for section_id, content in final_state.get("results", {}).items()
            ],
            
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
    This provides real-time UI updates for:
    - Intent analysis results
    - Strategy selection
    - Action generation
    - Writing progress
    - Critic feedback
    
    Event types:
    - intent: Intent analysis complete
    - strategy: Strategy selected
    - action: Action generated
    - message: Status message
    - result: Content generated
    - done: Orchestration complete
    - error: Error occurred
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
                "conversation_history": request.conversation_history,
                "actions": [],
                "messages": [],
                "results": {},
                "iteration": 0,
                "max_iterations": request.max_iterations,
                "critic_approved": False,
                "enable_critic": request.enable_critic,
                "model_mode": request.model_mode,
                "fixed_model_id": request.fixed_model_id,
            }
            
            # Track what we've sent to avoid duplicates
            sent_messages = set()
            sent_actions = set()
            
            # Stream node outputs
            async for event in orchestrator.astream(initial_state):
                for node_name, node_output in event.items():
                    print(f"📡 [Stream] Node completed: {node_name}")
                    
                    # Stream intent analysis
                    if "intent" in node_output and node_output["intent"]:
                        yield f"data: {json.dumps({'type': 'intent', 'data': node_output['intent']})}\n\n"
                    
                    # Stream strategy
                    if "strategy" in node_output and node_output["strategy"]:
                        yield f"data: {json.dumps({'type': 'strategy', 'data': node_output['strategy']})}\n\n"
                    
                    # Stream messages (deduplicated)
                    if "messages" in node_output:
                        for msg in node_output["messages"]:
                            msg_key = f"{msg['role']}:{msg['content'][:50]}"
                            if msg_key not in sent_messages:
                                sent_messages.add(msg_key)
                                yield f"data: {json.dumps({'type': 'message', 'data': msg})}\n\n"
                    
                    # Stream actions (deduplicated)
                    if "actions" in node_output:
                        for action in node_output["actions"]:
                            action_key = f"{action['type']}:{action.get('payload', {}).get('sectionId', '')}"
                            if action_key not in sent_actions:
                                sent_actions.add(action_key)
                                yield f"data: {json.dumps({'type': 'action', 'data': action})}\n\n"
                    
                    # Stream results
                    if "results" in node_output and node_output["results"]:
                        for section_id, content in node_output["results"].items():
                            yield f"data: {json.dumps({'type': 'result', 'data': {'section_id': section_id, 'content': content}})}\n\n"
                    
                    # Stream critic approval
                    if "critic_approved" in node_output:
                        yield f"data: {json.dumps({'type': 'critic', 'data': {'approved': node_output['critic_approved']}})}\n\n"
            
            # Send completion
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            print(f"❌ [Stream] Error: {e}")
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"
    
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
    content: Optional[str] = None
    error: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


@router.post("/actions/execute", response_model=ExecuteActionResponse)
async def execute_action(request: ExecuteActionRequest):
    """
    Execute a specific action directly.
    
    Useful for:
    - Re-running a failed action
    - Executing user-confirmed actions
    - Manual action triggers
    
    Supported action types:
    - generate_content: Generate content for a section
    - generate_structure: Generate document structure
    - modify_content: Modify existing content
    - answer_question: Generate a response
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
                metadata={"word_count": len(content.split())}
            )
        
        elif request.action_type == "generate_structure":
            # TODO: Implement structure generation
            return ExecuteActionResponse(
                success=False,
                error="Structure generation not yet implemented"
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
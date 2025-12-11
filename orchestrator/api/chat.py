"""
Chat API Endpoint

New /chat endpoint using the Deep Agent architecture.
Provides a "power chat" experience similar to Claude.ai or Cursor.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, AsyncIterator
from langsmith import traceable
import json

from agent import create_publo_agent_with_mcp, run_agent_streaming, debug_log
from streaming import format_sse, SSEEventType
from config import settings


router = APIRouter()


# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class ChatRequest(BaseModel):
    """
    Chat request from frontend.
    
    This is the main request format for the Deep Agent.
    """
    # Required
    message: str
    story_id: str
    
    # Context
    document_format: str = "novel"
    active_section_id: Optional[str] = None
    user_preferences: Optional[Dict[str, Any]] = None
    
    # Conversation
    conversation_history: Optional[List[Dict[str, str]]] = None
    
    # Session
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    thread_id: Optional[str] = None  # For memory continuity


class ChatResponse(BaseModel):
    """Non-streaming chat response."""
    success: bool
    response: str
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None


# ============================================================
# STREAMING CHAT ENDPOINT
# ============================================================

@router.post("/chat")
@traceable(name="deep_agent_chat", metadata={"endpoint": "chat"})
async def chat(request: ChatRequest):
    """
    Main chat endpoint with SSE streaming.
    
    This provides a "power chat" experience where the agent:
    - Understands context naturally
    - Calls tools as needed without explicit routing
    - Streams responses in real-time
    
    Event types:
    - TOKEN: Streaming text content
    - TOOL_START: Tool execution beginning
    - TOOL_END: Tool execution complete
    - CONTENT_CHUNK: Content from write_section (streamed)
    - NAVIGATE: Navigation request
    - PRESENT_OPTIONS: Options for user selection
    - ERROR: Error occurred
    - DONE: Agent finished
    """
    
    async def generate() -> AsyncIterator[str]:
        """Generate SSE events from agent execution."""
        # #region agent log
        debug_log("M", "chat.py:87", "generate() called", {"message_preview": request.message[:50] if request.message else ""})
        # #endregion
        try:
            # Create agent with MCP tools
            agent = await create_publo_agent_with_mcp(
                story_id=request.story_id,
                document_format=request.document_format,
                active_section_id=request.active_section_id,
                user_preferences=request.user_preferences,
                enable_memory=True,
            )
            # #region agent log
            debug_log("M", "chat.py:99", "agent created", {"agent_type": type(agent).__name__})
            # #endregion
            
            # Build messages list
            messages = []
            if request.conversation_history:
                messages.extend(request.conversation_history)
            messages.append({"role": "user", "content": request.message})
            
            # Config for the agent
            config = {
                "configurable": {
                    "thread_id": request.thread_id or request.session_id or request.story_id,
                    "node_id": request.story_id,  # For tools to access
                    "user_id": request.user_id,
                    "document_format": request.document_format,
                }
            }
            
            # Stream events
            async for event in run_agent_streaming(agent, messages, config):
                event_type = event["type"]
                data = event["data"]
                
                if event_type == "token":
                    yield format_sse(SSEEventType.TOKEN, data)
                
                elif event_type == "tool_start":
                    yield format_sse(SSEEventType.TOOL_START, data)
                    
                    # Special handling for specific tools
                    tool_name = data.get("tool", "")
                    tool_input = data.get("input", {})
                    
                    if tool_name == "navigate_to":
                        yield format_sse(SSEEventType.NAVIGATE, {
                            "section_id": tool_input.get("section_id", ""),
                            "section_name": tool_input.get("section_name", "")
                        })
                    
                    elif tool_name == "present_options":
                        yield format_sse(SSEEventType.PRESENT_OPTIONS, {
                            "prompt": tool_input.get("prompt", ""),
                            "options": tool_input.get("options", []),
                            "allow_multiple": tool_input.get("allow_multiple", False)
                        })
                
                elif event_type == "tool_end":
                    yield format_sse(SSEEventType.TOOL_END, data)
                    
                    # Special handling for write_section completion
                    tool_name = data.get("tool", "")
                    output = data.get("output", {})
                    
                    # Handle string outputs (convert to dict if possible)
                    if isinstance(output, str):
                        try:
                            import json
                            output = json.loads(output)
                        except (json.JSONDecodeError, TypeError):
                            output = {}  # Fallback to empty dict
                    
                    if tool_name == "write_section" and isinstance(output, dict):
                        yield format_sse(SSEEventType.CONTENT_COMPLETE, {
                            "section_id": output.get("section_id", ""),
                            "word_count": output.get("word_count", 0)
                        })
                    
                    elif tool_name == "create_structure" and isinstance(output, dict):
                        yield format_sse(SSEEventType.STRUCTURE_CREATED, {
                            "title": output.get("title", "Untitled"),
                            "section_count": output.get("section_count", 0),
                            "sections": [
                                {"id": s.get("id"), "title": s.get("name", s.get("title"))}
                                for s in output.get("items", [])
                            ] if isinstance(output.get("items"), list) else [],
                            "format": output.get("format", "novel")
                        })
                
                elif event_type == "done":
                    # #region agent log
                    debug_log("K", "chat.py:174", "DONE event data", {
                        "has_final_response": "final_response" in data,
                        "final_response_length": len(data.get("final_response", "")) if data.get("final_response") else 0,
                        "data_keys": list(data.keys()) if isinstance(data, dict) else str(type(data))
                    })
                    # #endregion
                    yield format_sse(SSEEventType.DONE, data)
        
        except Exception as e:
            print(f"❌ [Chat] Error: {e}")
            import traceback
            tb = traceback.format_exc()
            # #region agent log
            debug_log("C", "chat.py:168", "streaming error caught", {"error": str(e), "traceback": tb[:500]})
            # #endregion
            traceback.print_exc()
            yield format_sse(SSEEventType.ERROR, {"error": str(e)})
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# ============================================================
# NON-STREAMING CHAT ENDPOINT
# ============================================================

@router.post("/chat/sync", response_model=ChatResponse)
@traceable(name="deep_agent_chat_sync", metadata={"endpoint": "chat_sync"})
async def chat_sync(request: ChatRequest):
    """
    Non-streaming chat endpoint.
    
    Use this for simple requests where streaming isn't needed.
    """
    try:
        from langchain_core.messages import HumanMessage, AIMessage
        
        # Create agent
        agent = await create_publo_agent_with_mcp(
            story_id=request.story_id,
            document_format=request.document_format,
            active_section_id=request.active_section_id,
            user_preferences=request.user_preferences,
            enable_memory=True,
        )
        
        # Build messages
        lc_messages = []
        if request.conversation_history:
            for msg in request.conversation_history:
                if msg["role"] == "user":
                    lc_messages.append(HumanMessage(content=msg["content"]))
                else:
                    lc_messages.append(AIMessage(content=msg["content"]))
        lc_messages.append(HumanMessage(content=request.message))
        
        # Config
        config = {
            "configurable": {
                "thread_id": request.thread_id or request.session_id or request.story_id,
                "node_id": request.story_id,
            }
        }
        
        # Invoke
        result = await agent.ainvoke({"messages": lc_messages}, config=config)
        
        # Extract response
        messages = result.get("messages", [])
        final_message = messages[-1] if messages else None
        response_text = final_message.content if final_message and hasattr(final_message, 'content') else ""
        
        return ChatResponse(
            success=True,
            response=response_text,
            tool_calls=[],
        )
    
    except Exception as e:
        print(f"❌ [Chat Sync] Error: {e}")
        return ChatResponse(
            success=False,
            response="",
            error=str(e)
        )


# ============================================================
# LEGACY COMPATIBILITY ENDPOINT
# ============================================================

@router.post("/orchestrate/stream")
async def orchestrate_stream_legacy(request: ChatRequest):
    """
    Legacy endpoint for backwards compatibility.
    
    Maps to the new /chat endpoint.
    """
    return await chat(request)

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

from agent import create_publo_agent_with_mcp, run_agent_streaming
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
    story_structure_node_id: Optional[str] = None  # Active structure node for Librarian context
    
    # Canvas context - what structures exist
    canvas_nodes: Optional[List[Dict[str, Any]]] = None  # All nodes on canvas
    structure_items: Optional[List[Dict[str, Any]]] = None  # Current structure's sections
    
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
        try:
            # Create agent with MCP tools
            agent = await create_publo_agent_with_mcp(
                story_id=request.story_id,
                document_format=request.document_format,
                active_section_id=request.active_section_id,
                user_preferences=request.user_preferences,
                enable_memory=True,
            )
            
            # Build messages list
            messages = []
            
            # Inject canvas context so agent knows what structures exist
            if request.canvas_nodes:
                # Extract story structure nodes for context
                story_nodes = []
                for node in request.canvas_nodes:
                    node_data = node.get("data", {})
                    if node.get("type") == "storyStructureNode" or node_data.get("nodeType") == "story-structure":
                        story_nodes.append({
                            "id": node.get("id"),
                            "name": node_data.get("label", "Untitled"),
                            "format": node_data.get("format", "novel"),
                            "sections_count": len(node_data.get("items", []))
                        })
                
                if story_nodes:
                    context_msg = "## Current Canvas State\n\nYou have the following story structures on your canvas:\n"
                    for sn in story_nodes:
                        context_msg += f"- **{sn['name']}** ({sn['format']}, {sn['sections_count']} sections) - Node ID: {sn['id']}\n"
                    context_msg += "\nYou can work with any of these existing stories or create a new one."
                    messages.append({"role": "system", "content": context_msg})
            
            # Add current structure items if available
            if request.structure_items and len(request.structure_items) > 0:
                sections_msg = "## Current Document Sections\n\n"
                sections_msg += "⚠️ **CRITICAL:** When calling ANY tool (`write_section`, `get_story_context`, `navigate_to`), you MUST use the EXACT section ID as shown below. Do NOT make up IDs like 'chapter_4' - use the exact IDs like 'ch-4'.\n\n"
                sections_msg += "| Section Name | EXACT Section ID |\n|--------------|------------------|\n"
                for item in request.structure_items[:20]:  # Limit to first 20
                    sections_msg += f"| {item.get('name', 'Section')} | `{item.get('id')}` |\n"
                sections_msg += "\n**Example:** To write 'Shadows and Alibis', call `write_section(section_id='ch-4', ...)`\n"
                messages.append({"role": "system", "content": sections_msg})
            
            if request.conversation_history:
                messages.extend(request.conversation_history)
            messages.append({"role": "user", "content": request.message})
            
            # Config for the agent
            # Use story_structure_node_id for Librarian context if provided,
            # otherwise fall back to story_id
            initial_node_id = request.story_structure_node_id or request.story_id
            
            # Mutable container so we can update node_id mid-stream
            # (when create_structure generates a new node_id)
            node_id_ref = {"value": initial_node_id}
            
            # Log what's being sent (simple print)
            if request.structure_items and len(request.structure_items) > 0:
                print(f"📋 [Chat] Structure items: {len(request.structure_items)} items, sample IDs: {[item.get('id') for item in request.structure_items[:3]]}")
                print(f"📋 [Chat] story_structure_node_id: {request.story_structure_node_id}, node_id_used: {initial_node_id}")
            
            config = {
                "configurable": {
                    "thread_id": request.thread_id or request.session_id or request.story_id,
                    "node_id": initial_node_id,  # For backwards compatibility
                    "node_id_ref": node_id_ref,  # Mutable container for dynamic updates
                    "story_id": request.story_id,  # Canvas ID
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
                    
                    elif tool_name == "write_section":
                        # Tell frontend to open document and scroll to section
                        section_id = tool_input.get("section_id", "")
                        
                        # Find section name from structure_items
                        section_name = "Section"
                        if request.structure_items:
                            for item in request.structure_items:
                                if item.get("id") == section_id:
                                    section_name = item.get("name", "Section")
                                    break
                        
                        # 1. Open the document panel
                        yield format_sse(SSEEventType.OPEN_DOCUMENT, {
                            "node_id": node_id_ref["value"],
                            "node_name": section_name
                        })
                        
                        # 2. Select/scroll to the section
                        yield format_sse(SSEEventType.SELECT_SECTION, {
                            "section_id": section_id,
                            "section_name": section_name
                        })
                        
                        # 3. Show writing progress
                        yield format_sse(SSEEventType.SECTION_WRITING, {
                            "section_id": section_id,
                            "title": section_name
                        })
                    
                    elif tool_name == "task":
                        # Subagent spawning - emit start event
                        yield format_sse(SSEEventType.SUBAGENT_START, {
                            "name": tool_input.get("subagent", "unknown"),
                            "task": tool_input.get("instruction", "")[:100]
                        })
                
                elif event_type == "tool_end":
                    yield format_sse(SSEEventType.TOOL_END, data)
                    
                    # Special handling for write_section completion
                    tool_name = data.get("tool", "")
                    output = data.get("output", {})
                    
                    # Handle string outputs (convert to dict if possible)
                    if isinstance(output, str):
                        try:
                            output = json.loads(output)
                        except (json.JSONDecodeError, TypeError):
                            output = {}  # Fallback to empty dict
                    
                    if tool_name == "write_section" and isinstance(output, dict):
                        yield format_sse(SSEEventType.CONTENT_COMPLETE, {
                            "section_id": output.get("section_id", ""),
                            "word_count": output.get("word_count", 0)
                        })
                    
                    elif tool_name == "create_structure" and isinstance(output, dict):
                        # Generate a node ID that the frontend will use
                        # This ensures write_section uses the correct node_id
                        import time
                        import random
                        import string
                        new_structure_node_id = f"story-structure-{int(time.time() * 1000)}-{''.join(random.choices(string.ascii_lowercase + string.digits, k=5))}"
                        
                        # Update the mutable ref so subsequent tool calls use this node_id
                        node_id_ref["value"] = new_structure_node_id
                        print(f"📌 [Chat] Updated node_id_ref to: {new_structure_node_id}")
                        
                        yield format_sse(SSEEventType.STRUCTURE_CREATED, {
                            "title": output.get("title", "Untitled"),
                            "section_count": output.get("section_count", 0),
                            "sections": [
                                {"id": s.get("id"), "title": s.get("name", s.get("title"))}
                                for s in output.get("items", [])
                            ] if isinstance(output.get("items"), list) else [],
                            "format": output.get("format", "novel"),
                            "node_id": new_structure_node_id  # Tell frontend to use this ID
                        })
                    
                    elif tool_name == "write_todos" and isinstance(output, dict):
                        # Emit plan update for frontend todo tracking
                        yield format_sse(SSEEventType.PLAN_UPDATE, {
                            "todos": output.get("todos", []),
                            "stats": output.get("stats", {})
                        })
                    
                    elif tool_name == "task" and isinstance(output, dict):
                        # Subagent completed - emit end event
                        yield format_sse(SSEEventType.SUBAGENT_END, {
                            "name": output.get("subagent", "unknown"),
                            "result": output.get("result", {})
                        })
                    
                    elif tool_name in ("save_preference", "save_pattern") and isinstance(output, dict):
                        # Memory updated - emit update event
                        if output.get("success"):
                            yield format_sse(SSEEventType.MEMORY_UPDATE, {
                                "type": "preference" if tool_name == "save_preference" else "pattern",
                                "key": output.get("key") or output.get("pattern_type"),
                                "value": output.get("value") or output.get("description")
                            })
                    
                    elif tool_name in ("write_context_file", "delete_context_file") and isinstance(output, dict):
                        # Context file updated - emit event
                        if output.get("success"):
                            yield format_sse(SSEEventType.CONTEXT_FILE_UPDATED, {
                                "action": "write" if tool_name == "write_context_file" else "delete",
                                "path": output.get("path", "")
                            })
                
                elif event_type == "done":
                    yield format_sse(SSEEventType.DONE, data)
        
        except Exception as e:
            print(f"❌ [Chat] Error: {e}")
            import traceback
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

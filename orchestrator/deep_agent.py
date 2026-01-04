"""
Publo Deep Agent (Official deepagents library)

Uses the official LangChain deepagents library for:
- Automatic context management (SummarizationMiddleware)
- Built-in planning (write_todos)
- Subagent spawning
- File system tools for context

Migration from custom PubloAgent to official deepagents.
"""

from typing import Optional, List, Dict, Any, AsyncIterator
from contextvars import ContextVar
# NOTE:
# We use langgraph.prebuilt.create_react_agent for the agent graph.
# This provides a standard ReAct agent with tool calling support.
from langgraph.prebuilt import create_react_agent
from langchain_anthropic import ChatAnthropic
from langchain_core.tools import BaseTool
from langgraph.checkpoint.memory import MemorySaver

# =============================================================================
# CONTEXT STORAGE (Thread-safe globals for deepagents compatibility)
# =============================================================================
# These allow passing user_id and story_id to tools since deepagents
# doesn't support automatic argument injection like our custom agent did.
# Using simple dict instead of ContextVar since deepagents tools run in
# different async contexts where ContextVar doesn't propagate.

import threading
_context_lock = threading.Lock()
_context_data: Dict[str, str] = {"user_id": "", "story_id": "", "node_id": ""}

# Mutable reference for node_id updates during execution
_node_id_ref: Dict[str, str] = {"value": ""}


def set_context(user_id: str = "", story_id: str = "", node_id: str = "", node_id_ref: Dict[str, str] = None):
    """Set context data for tool access."""
    global _node_id_ref
    with _context_lock:
        if user_id:
            _context_data["user_id"] = user_id
        if story_id:
            _context_data["story_id"] = story_id
        if node_id:
            _context_data["node_id"] = node_id
        if node_id_ref is not None:
            _node_id_ref = node_id_ref


def get_context_user_id() -> str:
    """Get current user_id from context."""
    with _context_lock:
        return _context_data.get("user_id", "")


def get_context_story_id() -> str:
    """Get current story_id from context."""
    with _context_lock:
        return _context_data.get("story_id", "")


def get_context_node_id() -> str:
    """Get current node_id from context (checks mutable ref first)."""
    # Check mutable ref first (gets updated when create_structure runs)
    if _node_id_ref.get("value"):
        return _node_id_ref["value"]
    with _context_lock:
        return _context_data.get("node_id", "")


# Keep ContextVar for compatibility but add simpler globals
current_user_id: ContextVar[str] = ContextVar("current_user_id", default="")
current_story_id: ContextVar[str] = ContextVar("current_story_id", default="")

# Import our existing tools
from tools import (
    get_story_context,
    write_section,
    edit_section,
    create_structure,
    update_structure,
    navigate_to,
    present_options,
    read_context_file,
    write_context_file,
    list_context_files,
    delete_context_file,
    save_preference,
    save_pattern,
    get_preferences,
    get_patterns,
)
from tools.character import (
    create_character,
    update_character,
    list_characters,
    load_character,
)
from prompts.main_agent import build_system_prompt, format_user_preferences
from config import settings


def create_publo_deep_agent(
    document_format: str = "novel",
    story_id: str = "",
    active_section_id: str = "",
    user_preferences: dict = None,
    enable_summarization: bool = True,
) -> Any:
    """
    Create a Publo agent using the official deepagents library.
    
    This replaces the custom PubloAgent with proper deepagents architecture.
    
    Args:
        document_format: Type of document (novel, screenplay, etc.)
        story_id: Active story/canvas ID
        active_section_id: Currently focused section
        user_preferences: User's writing preferences
        enable_summarization: Enable automatic context summarization
    
    Returns:
        Compiled DeepAgent graph
    """
    
    # Build system prompt
    system_prompt = build_system_prompt(
        document_format=document_format,
        story_id=story_id,
        active_section=active_section_id or "none",
        user_preferences=format_user_preferences(user_preferences),
    )
    
    # Initialize model with API key from settings
    model = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        max_tokens=8096,
        temperature=0.7,
        api_key=settings.ANTHROPIC_API_KEY,
    )
    
    # Collect tools
    tools = [
        # Story context
        get_story_context,
        # Writing
        write_section,
        edit_section,
        # Structure
        create_structure,
        update_structure,
        # Navigation
        navigate_to,
        present_options,
        # Memory
        save_preference,
        save_pattern,
        get_preferences,
        get_patterns,
        # Filesystem (for context offloading)
        read_context_file,
        write_context_file,
        list_context_files,
        delete_context_file,
        # Character management
        create_character,
        update_character,
        list_characters,
        load_character,
    ]
    
    # Memory checkpointer (in-memory for now, could use Supabase)
    checkpointer = MemorySaver()
    
    # Create the agent using LangGraph's create_react_agent.
    # This provides a standard ReAct agent with tool calling support.
    agent = create_react_agent(
        model=model,
        tools=tools,
        prompt=system_prompt,
        checkpointer=checkpointer,
    )
    
    return agent


async def run_deep_agent_streaming(
    agent: Any,
    messages: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """
    Run the deep agent with streaming.
    
    Wraps the agent's astream_events to provide consistent event format.
    
    Args:
        agent: Compiled DeepAgent
        messages: Conversation messages (LangChain message objects or dicts)
        config: Configuration dict
    
    Yields:
        Event dictionaries compatible with our SSE format
    """
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
    
    # Set context for tools (deepagents compatibility)
    # Tools can read these via get_context_user_id() / get_context_story_id() / get_context_node_id()
    if config:
        cfg = config.get("configurable", {})
        user_id = cfg.get("user_id", "")
        story_id = cfg.get("story_id", "")
        node_id = cfg.get("node_id", "")
        node_id_ref = cfg.get("node_id_ref")  # Mutable dict for updates during execution
        set_context(user_id=user_id, story_id=story_id, node_id=node_id, node_id_ref=node_id_ref)
        print(f"🔑 [DeepAgent] Set context: user_id={user_id[:8] if user_id else 'NONE'}..., story_id={story_id[:8] if story_id else 'NONE'}..., node_id={node_id[:20] if node_id else 'NONE'}...", flush=True)
    
    # Convert messages to LangChain format if needed
    lc_messages = []
    for msg in messages:
        if hasattr(msg, 'content'):
            # Already a LangChain message
            lc_messages.append(msg)
        elif isinstance(msg, dict):
            content = msg.get('content', '')
            role = msg.get('role', 'user')
            if role == 'user':
                lc_messages.append(HumanMessage(content=content))
            elif role == 'assistant':
                lc_messages.append(AIMessage(content=content))
            elif role == 'system':
                lc_messages.append(SystemMessage(content=content))
    
    # DeepAgents expects {"messages": [...]} format
    input_data = {"messages": lc_messages}
    
    print(f"🚀 [DeepAgent] Starting stream with {len(lc_messages)} messages", flush=True)
    
    try:
        async for event in agent.astream_events(input_data, config=config, version="v2"):
            event_type = event.get("event", "")
            event_name = event.get("name", "")
            event_data = event.get("data", {})
            
            # Debug: log all events
            # print(f"📡 Event: {event_type} / {event_name}", flush=True)
            
            # Map deepagents events to our format
            if event_type == "on_chat_model_stream":
                # Streaming token
                chunk = event_data.get("chunk")
                if chunk:
                    content = ""
                    if hasattr(chunk, "content") and chunk.content:
                        raw_content = chunk.content
                        # Handle list format from Claude (e.g., [{"text": "...", "type": "text"}])
                        if isinstance(raw_content, list) and raw_content:
                            for item in raw_content:
                                if isinstance(item, dict) and item.get("type") == "text":
                                    content += item.get("text", "")
                        elif isinstance(raw_content, str):
                            content = raw_content
                    elif isinstance(chunk, dict) and chunk.get("content"):
                        content = chunk["content"]
                    
                    if content:
                        yield {
                            "type": "token",
                            "data": {"content": content}
                        }
            
            elif event_type == "on_tool_start":
                # Ensure input is JSON serializable
                raw_input = event_data.get("input", {})
                if isinstance(raw_input, dict):
                    tool_input = raw_input
                else:
                    tool_input = {"args": str(raw_input)}
                
                yield {
                    "type": "tool_start",
                    "data": {
                        "tool": event_name,
                        "input": tool_input
                    }
                }
            
            elif event_type == "on_tool_end":
                # Extract output and ensure it's JSON serializable
                raw_output = event_data.get("output", {})
                
                # Handle ToolMessage or other LangChain objects
                if hasattr(raw_output, "content"):
                    # ToolMessage has content attribute
                    try:
                        import json
                        output = json.loads(raw_output.content) if isinstance(raw_output.content, str) else raw_output.content
                    except (json.JSONDecodeError, TypeError):
                        output = {"result": str(raw_output.content)}
                elif hasattr(raw_output, "dict"):
                    output = raw_output.dict()
                elif isinstance(raw_output, dict):
                    output = raw_output
                else:
                    output = {"result": str(raw_output)}
                
                yield {
                    "type": "tool_end",
                    "data": {
                        "tool": event_name,
                        "output": output
                    }
                }
            
            elif event_type == "on_chain_end":
                if event_name == "LangGraph":
                    # Final response
                    output = event_data.get("output", {})
                    final_messages = output.get("messages", [])
                    if final_messages:
                        last_msg = final_messages[-1]
                        content = ""
                        if hasattr(last_msg, "content"):
                            raw_content = last_msg.content
                            # Handle list format from Claude
                            if isinstance(raw_content, list) and raw_content:
                                for item in raw_content:
                                    if isinstance(item, dict) and item.get("type") == "text":
                                        content += item.get("text", "")
                            elif isinstance(raw_content, str):
                                content = raw_content
                        elif isinstance(last_msg, dict):
                            content = last_msg.get("content", "")
                        
                        if content:
                            yield {
                                "type": "final",
                                "data": {"content": content}
                            }
        
        # Always emit done event at the end
        yield {
            "type": "done",
            "data": {"success": True}
        }
        print(f"✅ [DeepAgent] Stream completed", flush=True)
    
    except Exception as e:
        print(f"❌ [DeepAgent] Stream error: {e}", flush=True)
        import traceback
        traceback.print_exc()
        yield {
            "type": "error",
            "data": {"message": str(e)}
        }


# For backwards compatibility during migration
async def create_publo_agent_with_mcp(*args, **kwargs):
    """
    Compatibility wrapper - creates a deep agent.
    
    During migration, this allows gradual transition from old API.
    """
    return create_publo_deep_agent(*args, **kwargs)


async def run_agent_streaming(agent, messages, config=None):
    """
    Compatibility wrapper for streaming.
    """
    async for event in run_deep_agent_streaming(agent, messages, config):
        yield event

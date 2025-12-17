"""
Publo Deep Agent Factory

Creates a conversational agent for creative writing assistance.
This is the main entry point for the new Deep Agent architecture.

Uses LangChain's native tool-calling capabilities with streaming support.

Usage:
    from agent import create_publo_agent_with_mcp, run_agent_streaming
    
    agent = await create_publo_agent_with_mcp(
        story_id="story-123",
        document_format="novel"
    )
    
    async for event in run_agent_streaming(agent, messages, config):
        print(event)
"""

from typing import Optional, List, Dict, Any, AsyncIterator
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool
import json

from tools import (
    get_story_context,
    write_section,
    edit_section,
    create_structure,
    update_structure,
    navigate_to,
    present_options,
    write_todos,
    get_todos,
    task,
    list_subagents,
    save_preference,
    save_pattern,
    get_preferences,
    get_patterns,
    read_context_file,
    write_context_file,
    list_context_files,
    delete_context_file,
)
from tools.mcp_tools import get_configured_mcp_tools
from prompts.main_agent import build_system_prompt, format_user_preferences
from config import settings


class PubloAgent:
    """
    Publo conversational agent with tool-calling capabilities.
    
    This is a simple agent that:
    1. Receives user messages
    2. Decides whether to call tools or respond directly
    3. Streams responses and tool results back
    """
    
    def __init__(
        self,
        model: ChatAnthropic,
        tools: List[BaseTool],
        system_prompt: str,
        story_id: str = "",
    ):
        self.model = model
        self.tools = tools
        self.system_prompt = system_prompt
        self.story_id = story_id
        
        # Bind tools to model
        self.model_with_tools = model.bind_tools(tools) if tools else model
        
        # Tool lookup by name
        self.tool_map = {tool.name: tool for tool in tools}
    
    async def astream_events(
        self,
        input_data: Dict[str, Any],
        config: Optional[Dict[str, Any]] = None,
        version: str = "v2",
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Stream events from agent execution.
        
        Args:
            input_data: Dict with "messages" key
            config: Optional configuration
            version: API version (ignored, for compatibility)
        
        Yields:
            Event dictionaries
        """
        messages = input_data.get("messages", [])
        
        # Add system message if not present
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=self.system_prompt)] + messages
        
        # Get configurable values
        configurable = (config or {}).get("configurable", {})
        # Use a mutable container so node_id can be updated dynamically
        # (e.g., when create_structure generates a new node_id mid-stream)
        node_id_ref = configurable.get("node_id_ref", {"value": configurable.get("node_id", self.story_id)})
        canvas_story_id = configurable.get("story_id", "")
        
        # Track conversation for multi-turn tool use
        current_messages = list(messages)
        # Prevent infinite loops, but allow enough turns for multi-section writing.
        # The model often calls one `write_section` per iteration; writing an act/chapter
        # may require many tool calls.
        max_iterations = 8
        try:
            last_user = next((m for m in reversed(current_messages) if isinstance(m, HumanMessage)), None)
            last_text = (last_user.content or "").lower() if last_user else ""
            if any(
                phrase in last_text
                for phrase in (
                    "write act",
                    "write chapter",
                    "write the act",
                    "write the chapter",
                    "write all",
                    "write scenes",
                    "finish act",
                    "finish chapter",
                    "continue writing",
                )
            ):
                max_iterations = 25
        except Exception:
            # Keep defaults if inspection fails
            pass
        
        for iteration in range(max_iterations):
            # Use ainvoke for reliable tool calls
            response = await self.model_with_tools.ainvoke(current_messages)
            
            # Extract text content
            response_content = ""
            if isinstance(response.content, str):
                response_content = response.content
            elif isinstance(response.content, list):
                for block in response.content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        response_content += block.get("text", "")
                    elif isinstance(block, str):
                        response_content += block
            
            # Simulate streaming by yielding content in chunks
            if response_content:
                chunk_size = 50
                for i in range(0, len(response_content), chunk_size):
                    chunk_text = response_content[i:i+chunk_size]
                    yield {
                        "event": "on_chat_model_stream",
                        "data": {"chunk": type('Chunk', (), {'content': chunk_text})()}
                    }
            
            # Get tool calls from response
            tool_calls = response.tool_calls or []
            
            # If no tool calls, we're done
            if not tool_calls:
                # Add final response to messages
                current_messages.append(AIMessage(content=response_content))
                yield {
                    "event": "on_chain_end",
                    "name": "LangGraph",
                    "data": {"output": {"messages": current_messages}}
                }
                break
            
            # Execute tool calls
            ai_message = AIMessage(content=response_content, tool_calls=tool_calls)
            current_messages.append(ai_message)
            
            for tool_call in tool_calls:
                tool_name = tool_call.get("name", "")
                tool_args = tool_call.get("args", {})
                tool_id = tool_call.get("id", "")
                
                # Emit tool start event
                yield {
                    "event": "on_tool_start",
                    "name": tool_name,
                    "data": {"input": tool_args}
                }
                
                # Execute tool
                if tool_name in self.tool_map:
                    tool = self.tool_map[tool_name]
                    try:
                        def _tool_accepts_arg(t: BaseTool, arg_name: str) -> bool:
                            schema = getattr(t, "args_schema", None)
                            if schema is None:
                                return False
                            # Pydantic v2
                            model_fields = getattr(schema, "model_fields", None)
                            if isinstance(model_fields, dict):
                                return arg_name in model_fields
                            # Pydantic v1
                            fields = getattr(schema, "__fields__", None)
                            if isinstance(fields, dict):
                                return arg_name in fields
                            return False

                        # Inject node_id if tool accepts it
                        # Read from mutable ref so we get the latest value
                        # (create_structure can update this mid-stream)
                        if "node_id" in tool_args or _tool_accepts_arg(tool, "node_id"):
                            tool_args["node_id"] = node_id_ref.get("value", "")

                        # Inject canvas story_id for tools that persist nodes/cards
                        if _tool_accepts_arg(tool, "story_id") and canvas_story_id:
                            tool_args["story_id"] = canvas_story_id
                        
                        # Special handling for write_section: use streaming version
                        print(f"🔧 [Agent] Tool call: {tool_name}")
                        if tool_name == "write_section":
                            print(f"📝 [Agent] Using streaming version for write_section")
                            from tools import write_section_streaming
                            
                            result = None
                            chunk_count = 0
                            async for event_type, event_data in write_section_streaming(
                                section_id=tool_args.get("section_id", ""),
                                section_name=tool_args.get("section_name", ""),
                                guidance=tool_args.get("guidance", ""),
                                style_notes=tool_args.get("style_notes"),
                                target_length=tool_args.get("target_length", "medium"),
                                node_id=tool_args.get("node_id", ""),
                            ):
                                if event_type == "content_chunk":
                                    chunk_count += 1
                                    print(f"📝 [Agent] Yielding chunk #{chunk_count}: {len(event_data.get('chunk', ''))} chars")
                                    # Yield chunk event for frontend
                                    yield {
                                        "event": "on_content_chunk",
                                        "data": event_data
                                    }
                                elif event_type == "content_complete":
                                    print(f"✅ [Agent] Content complete: {chunk_count} chunks, {event_data.get('word_count')} words")
                                    # Store result for tool message
                                    result = {
                                        "section_id": event_data.get("section_id"),
                                        "word_count": event_data.get("word_count"),
                                        "status": "complete",
                                    }
                                elif event_type == "error":
                                    result = {"error": event_data.get("error"), "status": "error"}
                            
                            result_for_event = result or {"status": "complete"}
                            result_str = json.dumps(result_for_event)
                        else:
                            # Standard tool execution
                            result = await tool.ainvoke(tool_args)
                            # Keep dict for events, convert to string for messages
                            result_for_event = result if isinstance(result, dict) else str(result)
                            result_str = json.dumps(result) if isinstance(result, dict) else str(result)
                    except Exception as e:
                        result_for_event = {"error": str(e)}
                        result_str = f"Error: {str(e)}"
                else:
                    result_for_event = {"error": f"Unknown tool: {tool_name}"}
                    result_str = f"Unknown tool: {tool_name}"
                
                # Emit tool end event (with dict if available)
                yield {
                    "event": "on_tool_end",
                    "name": tool_name,
                    "data": {"output": result_for_event}
                }
                
                # Add tool result to messages (as string)
                current_messages.append(ToolMessage(
                    content=result_str,
                    tool_call_id=tool_id
                ))
        
        # Final completion if we hit max iterations
        if iteration >= max_iterations - 1:
            yield {
                "event": "on_chain_end",
                "name": "LangGraph",
                "data": {"output": {"messages": current_messages}}
            }


def create_publo_agent(
    story_id: str,
    document_format: str = "novel",
    active_section_id: Optional[str] = None,
    user_preferences: Optional[Dict[str, Any]] = None,
    enable_memory: bool = True,
    thread_id: Optional[str] = None,
) -> PubloAgent:
    """
    Create a Publo Deep Agent instance configured for a specific story.
    
    Args:
        story_id: The active story/canvas ID (node_id)
        document_format: "novel", "screenplay", "podcast", etc.
        active_section_id: Currently focused section (if any)
        user_preferences: User style preferences from DB
        enable_memory: Enable conversation memory (not yet implemented)
        thread_id: Thread ID for memory continuity (not yet implemented)
    
    Returns:
        A PubloAgent instance ready for invocation
    """

    # Initialize model with streaming enabled
    model = ChatAnthropic(
        model=settings.MODEL_NAME,
        temperature=settings.TEMPERATURE,
        max_tokens=settings.MAX_TOKENS,
        api_key=settings.ANTHROPIC_API_KEY,
        streaming=True,
    )
    
    # Build context-aware system prompt
    system_prompt = build_system_prompt(
        document_format=document_format,
        story_id=story_id,
        active_section=active_section_id or "none",
        user_preferences=format_user_preferences(user_preferences),
    )
    
    # Collect tools
    tools = [
        get_story_context,
        write_section,
        edit_section,
        create_structure,
        update_structure,
        navigate_to,
        present_options,
        # Deep Agent planning
        write_todos,
        get_todos,
        # Deep Agent subagent spawning
        task,
        list_subagents,
        # Deep Agent memory
        save_preference,
        save_pattern,
        get_preferences,
        get_patterns,
        # Deep Agent filesystem
        read_context_file,
        write_context_file,
        list_context_files,
        delete_context_file,
    ]
    
    return PubloAgent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
        story_id=story_id,
    )


async def create_publo_agent_with_mcp(
    story_id: str,
    document_format: str = "novel",
    active_section_id: Optional[str] = None,
    user_preferences: Optional[Dict[str, Any]] = None,
    enable_memory: bool = True,
) -> PubloAgent:
    """
    Create a Publo agent with MCP tools included.
    
    Args:
        story_id: The active story/canvas ID
        document_format: Document format
        active_section_id: Currently focused section
        user_preferences: User preferences
        enable_memory: Enable memory (not yet implemented)
    
    Returns:
        Configured agent with MCP tools
    """
    
    # Initialize model with streaming enabled
    model = ChatAnthropic(
        model=settings.MODEL_NAME,
        temperature=settings.TEMPERATURE,
        max_tokens=settings.MAX_TOKENS,
        api_key=settings.ANTHROPIC_API_KEY,
        streaming=True,
    )
    
    # Build system prompt
    system_prompt = build_system_prompt(
        document_format=document_format,
        story_id=story_id,
        active_section=active_section_id or "none",
        user_preferences=format_user_preferences(user_preferences),
    )
    
    # Collect all tools including MCP
    tools = [
        get_story_context,
        write_section,
        edit_section,
        create_structure,
        update_structure,
        navigate_to,
        present_options,
        # Deep Agent planning
        write_todos,
        get_todos,
        # Deep Agent subagent spawning
        task,
        list_subagents,
        # Deep Agent memory
        save_preference,
        save_pattern,
        get_preferences,
        get_patterns,
        # Deep Agent filesystem
        read_context_file,
        write_context_file,
        list_context_files,
        delete_context_file,
    ]
    
    # Add MCP tools if available
    try:
        mcp_tools = await get_configured_mcp_tools()
        tools.extend(mcp_tools)
    except Exception as e:
        print(f"⚠️ MCP tools not available: {e}")
    
    return PubloAgent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
        story_id=story_id,
    )


async def run_agent_streaming(
    agent: PubloAgent,
    messages: List[Dict[str, str]],
    config: Optional[Dict[str, Any]] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """
    Run the agent with streaming, yielding events as they occur.
    
    Args:
        agent: The PubloAgent instance
        messages: List of message dicts [{"role": "user", "content": "..."}]
        config: Optional config for the agent
    
    Yields:
        Event dictionaries with type and data
    """
    # Convert message dicts to LangChain messages
    lc_messages = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        
        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))
        elif role == "system":
            lc_messages.append(SystemMessage(content=content))
    
    # Stream events
    async for event in agent.astream_events(
        {"messages": lc_messages},
        config=config or {},
    ):
        kind = event.get("event", "")
        
        if kind == "on_chat_model_stream":
            # Streaming text token
            chunk = event["data"]["chunk"]
            content = chunk.content if hasattr(chunk, 'content') else ""
            if content:
                yield {
                    "type": "token",
                    "data": {"content": content}
                }
        
        elif kind == "on_tool_start":
            yield {
                "type": "tool_start",
                "data": {
                    "tool": event.get("name", ""),
                    "input": event["data"].get("input"),
                }
            }
        
        elif kind == "on_tool_end":
            yield {
                "type": "tool_end",
                "data": {
                    "tool": event.get("name", ""),
                    "output": event["data"].get("output"),
                }
            }
        
        elif kind == "on_content_chunk":
            # Streaming content chunk from write_section
            yield {
                "type": "content_chunk",
                "data": event.get("data", {})
            }
        
        elif kind == "on_chain_end":
            if event.get("name") == "LangGraph":
                output = event["data"].get("output", {})
                msgs = output.get("messages", [])
                if msgs:
                    final_message = msgs[-1]
                    yield {
                        "type": "done",
                        "data": {
                            "final_response": final_message.content if hasattr(final_message, 'content') else str(final_message)
                        }
                    }

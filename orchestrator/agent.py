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
    navigate_to,
    present_options,
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
        node_id = configurable.get("node_id", self.story_id)
        
        # Track conversation for multi-turn tool use
        current_messages = list(messages)
        max_iterations = 5  # Prevent infinite loops
        
        for iteration in range(max_iterations):
            # Use ainvoke for complete tool calls (streaming gave partial args)
            # We simulate streaming by yielding the content in chunks
            response = await self.model_with_tools.ainvoke(current_messages)
            
            # Extract text content
            response_content = ""
            if isinstance(response.content, str):
                response_content = response.content
            elif isinstance(response.content, list):
                # Extract text from content blocks
                for block in response.content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        response_content += block.get("text", "")
                    elif isinstance(block, str):
                        response_content += block
            
            # Simulate streaming by yielding content in chunks
            if response_content:
                # Yield content in small chunks for streaming effect
                chunk_size = 50
                chunks_yielded = 0
                for i in range(0, len(response_content), chunk_size):
                    chunk_text = response_content[i:i+chunk_size]
                    chunks_yielded += 1
                    yield {
                        "event": "on_chat_model_stream",
                        "data": {"chunk": type('Chunk', (), {'content': chunk_text})()}
                    }
            
            # Get complete tool calls with full args
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
                        # Inject node_id if tool accepts it
                        if "node_id" in tool_args or hasattr(tool, 'args_schema'):
                            tool_args["node_id"] = node_id
                        
                        # Execute
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
    
    # Initialize model
    model = ChatAnthropic(
        model=settings.MODEL_NAME,
        temperature=settings.TEMPERATURE,
        max_tokens=settings.MAX_TOKENS,
        api_key=settings.ANTHROPIC_API_KEY,
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
        navigate_to,
        present_options,
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
    
    # Initialize model
    model = ChatAnthropic(
        model=settings.MODEL_NAME,
        temperature=settings.TEMPERATURE,
        max_tokens=settings.MAX_TOKENS,
        api_key=settings.ANTHROPIC_API_KEY,
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
        navigate_to,
        present_options,
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

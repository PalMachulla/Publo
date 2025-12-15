"""
SSE Event Formatting and Streaming Utilities

Handles Server-Sent Events for real-time frontend updates.
"""

import json
import asyncio
from typing import Any, Dict, Optional, Literal
from enum import Enum
from dataclasses import dataclass, asdict


class SSEEventType(str, Enum):
    """SSE event types used by Publo."""
    
    # LLM streaming
    TOKEN = "TOKEN"  # Streaming text token from LLM
    REASONING_TOKEN = "REASONING_TOKEN"  # Reasoning/thinking tokens
    
    # Tool execution
    TOOL_START = "TOOL_START"  # Tool execution beginning
    TOOL_END = "TOOL_END"  # Tool execution complete
    
    # Content generation
    CONTENT_CHUNK = "CONTENT_CHUNK"  # Streaming content from write_section
    CONTENT_COMPLETE = "CONTENT_COMPLETE"  # Section writing finished
    STRUCTURE_CREATED = "STRUCTURE_CREATED"  # Structure generation complete
    
    # Navigation/UI
    NAVIGATE = "NAVIGATE"  # Navigate frontend to section
    PRESENT_OPTIONS = "PRESENT_OPTIONS"  # Show option selector UI
    
    # Planning
    PLAN_UPDATE = "PLAN_UPDATE"  # Todo list updated (for complex tasks)
    
    # Subagents
    SUBAGENT_START = "SUBAGENT_START"  # Subagent spawned
    SUBAGENT_END = "SUBAGENT_END"  # Subagent completed
    
    # Memory
    MEMORY_UPDATE = "MEMORY_UPDATE"  # Preference or pattern saved
    
    # Filesystem
    CONTEXT_FILE_UPDATED = "CONTEXT_FILE_UPDATED"  # Context file written/deleted
    
    # Status
    ERROR = "ERROR"  # Error occurred
    DONE = "DONE"  # Agent finished
    
    # Legacy compatibility (will be removed)
    INTENT = "INTENT"
    STRATEGY = "STRATEGY"
    MESSAGE = "MESSAGE"
    ACTION = "ACTION"
    RESULT = "RESULT"
    CLARIFICATION = "CLARIFICATION"
    CRITIC = "CRITIC"
    SECTION_WRITING = "SECTION_WRITING"
    SECTION_COMPLETE = "SECTION_COMPLETE"
    OPEN_DOCUMENT = "OPEN_DOCUMENT"
    SELECT_SECTION = "SELECT_SECTION"


def format_sse(event_type: str, data: Dict[str, Any]) -> str:
    """
    Format data as an SSE event string.
    
    Args:
        event_type: The event type (TOKEN, TOOL_START, etc.)
        data: Dictionary of event data
    
    Returns:
        SSE-formatted string ready for streaming
    
    Example:
        >>> format_sse("TOKEN", {"content": "Hello"})
        'event: TOKEN\\ndata: {"content": "Hello"}\\n\\n'
    """
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


# Global event queue for SSE streaming
# In production, use Redis or similar for multi-process support
_event_queues: Dict[str, asyncio.Queue] = {}


def get_event_queue(session_id: str) -> asyncio.Queue:
    """
    Get or create an event queue for a session.
    
    Args:
        session_id: Unique session identifier
    
    Returns:
        asyncio.Queue for this session
    """
    if session_id not in _event_queues:
        _event_queues[session_id] = asyncio.Queue()
    return _event_queues[session_id]


def cleanup_event_queue(session_id: str):
    """
    Clean up event queue when session ends.
    
    Args:
        session_id: Session to clean up
    """
    if session_id in _event_queues:
        del _event_queues[session_id]


async def stream_sse_event(
    event_type: str,
    data: Dict[str, Any],
    session_id: Optional[str] = None
):
    """
    Stream an SSE event to the current response.
    
    Called by tools to send real-time updates to the frontend.
    
    Args:
        event_type: Type of event (TOKEN, CONTENT_CHUNK, etc.)
        data: Event data dictionary
        session_id: Optional session to target
    
    Note:
        In the current implementation, tools are called within the
        streaming context and events are yielded directly.
        This function is used for async event pushing when needed.
    """
    if session_id:
        queue = get_event_queue(session_id)
        await queue.put(format_sse(event_type, data))


@dataclass
class ContentChunkEvent:
    """Streaming content chunk from write_section."""
    section_id: str
    chunk: str
    
    def to_sse(self) -> str:
        return format_sse(SSEEventType.CONTENT_CHUNK, asdict(self))


@dataclass
class ContentCompleteEvent:
    """Section writing complete."""
    section_id: str
    word_count: int
    
    def to_sse(self) -> str:
        return format_sse(SSEEventType.CONTENT_COMPLETE, asdict(self))


@dataclass
class ToolStartEvent:
    """Tool execution starting."""
    tool: str
    input: Dict[str, Any]
    
    def to_sse(self) -> str:
        return format_sse(SSEEventType.TOOL_START, asdict(self))


@dataclass
class ToolEndEvent:
    """Tool execution complete."""
    tool: str
    output: Any
    
    def to_sse(self) -> str:
        return format_sse(SSEEventType.TOOL_END, asdict(self))


@dataclass
class NavigateEvent:
    """Navigate to section."""
    section_id: str
    
    def to_sse(self) -> str:
        return format_sse(SSEEventType.NAVIGATE, asdict(self))


@dataclass
class PresentOptionsEvent:
    """Show options to user."""
    prompt: str
    options: list
    allow_multiple: bool = False
    
    def to_sse(self) -> str:
        return format_sse(SSEEventType.PRESENT_OPTIONS, asdict(self))


@dataclass
class ErrorEvent:
    """Error occurred."""
    error: str
    
    def to_sse(self) -> str:
        return format_sse(SSEEventType.ERROR, asdict(self))


@dataclass
class DoneEvent:
    """Agent finished."""
    final_response: str = ""
    
    def to_sse(self) -> str:
        return format_sse(SSEEventType.DONE, asdict(self))


# Event type to dataclass mapping for validation
EVENT_DATACLASSES = {
    SSEEventType.CONTENT_CHUNK: ContentChunkEvent,
    SSEEventType.CONTENT_COMPLETE: ContentCompleteEvent,
    SSEEventType.TOOL_START: ToolStartEvent,
    SSEEventType.TOOL_END: ToolEndEvent,
    SSEEventType.NAVIGATE: NavigateEvent,
    SSEEventType.PRESENT_OPTIONS: PresentOptionsEvent,
    SSEEventType.ERROR: ErrorEvent,
    SSEEventType.DONE: DoneEvent,
}

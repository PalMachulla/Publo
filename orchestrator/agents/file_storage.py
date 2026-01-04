"""
File Storage Utilities

Converts OrchestratorState to/from filesystem storage.

This module provides utilities to:
- Store state fields as files
- Load context from files
- Migrate existing state to filesystem
"""

from typing import Dict, Any, Optional
from .deep_agent_backend import OrchestratorFilesystemBackend


def store_state_to_filesystem(
    backend: OrchestratorFilesystemBackend,
    state: Dict[str, Any]
) -> None:
    """
    Store OrchestratorState fields to filesystem.
    
    Maps state fields to files:
    - canvas_context → canvas_state.json
    - structure_items → document_structure.json
    - conversation_history → conversation_history.json
    - active_segment → document_structure.json (included)
    - document_format → document_structure.json (included)
    
    This allows nodes to read context selectively instead of
    loading everything into state strings.
    
    Args:
        backend: Filesystem backend instance
        state: OrchestratorState dictionary
    
    Example:
        backend = OrchestratorFilesystemBackend(project_id="canvas-123")
        store_state_to_filesystem(backend, state)
        # Now nodes can read: backend.read_file("canvas_state.json")
    """
    # Store canvas state
    # canvas_context is a stringified JSON, parse it if possible
    canvas_context = state.get("canvas_context")
    if canvas_context:
        try:
            # Try to parse if it's a JSON string
            if isinstance(canvas_context, str):
                import json
                canvas_data = json.loads(canvas_context)
            else:
                canvas_data = canvas_context
            
            backend.write_file("canvas_state.json", canvas_data)
        except (json.JSONDecodeError, TypeError):
            # Not JSON, store as string
            backend.write_file("canvas_state.json", {"raw": canvas_context})
    
    # Store document structure
    structure_items = state.get("structure_items")
    if structure_items or state.get("active_segment") or state.get("document_format"):
        document_data = {
            "items": structure_items or [],
            "format": state.get("document_format"),
            "active_segment": state.get("active_segment"),
            "document_panel_open": state.get("document_panel_open", False)
        }
        backend.write_file("document_structure.json", document_data)
    
    # Store conversation history
    conversation_history = state.get("conversation_history")
    if conversation_history:
        conversation_data = {
            "messages": conversation_history,
            "session_id": state.get("session_id"),
            "user_id": state.get("user_id")
        }
        backend.write_file("conversation_history.json", conversation_data)
    
    # Store user message (for reference)
    user_message = state.get("user_message")
    if user_message:
        backend.write_file("current_request.json", {
            "message": user_message,
            "timestamp": state.get("timestamp")  # If available
        })


def load_context_from_filesystem(
    backend: OrchestratorFilesystemBackend,
    context_type: str
) -> Optional[Any]:
    """
    Load specific context from filesystem.
    
    This enables selective context loading - nodes can read only
    the context they need, reducing context window usage.
    
    Args:
        backend: Filesystem backend instance
        context_type: Type of context to load
            - "canvas": Canvas state (nodes, edges, structure)
            - "document": Document structure (sections, format, active segment)
            - "conversation": Conversation history (messages)
            - "preferences": User preferences (from memory)
            - "patterns": Successful patterns (from memory)
            - "style": Writing style guide (from memory)
    
    Returns:
        Context data (dict/list) or None if not found
    
    Example:
        backend = OrchestratorFilesystemBackend(project_id="canvas-123")
        canvas_context = load_context_from_filesystem(backend, "canvas")
        # Use canvas_context in intent analysis
    """
    file_map = {
        "canvas": "canvas_state.json",
        "document": "document_structure.json",
        "conversation": "conversation_history.json",
        "preferences": "memory/user_preferences.json",
        "patterns": "memory/successful_patterns.json",
        "style": "memory/style_guide.json",
        "request": "current_request.json"
    }
    
    file_path = file_map.get(context_type)
    if not file_path:
        return None
    
    return backend.read_file(file_path)


def migrate_state_to_filesystem(
    backend: OrchestratorFilesystemBackend,
    state: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Migrate existing OrchestratorState to filesystem.
    
    This is a one-time migration function that:
    1. Stores state fields to filesystem
    2. Returns updated state (with filesystem references)
    
    After migration, nodes should read from filesystem instead
    of state strings.
    
    Args:
        backend: Filesystem backend instance
        state: Original OrchestratorState dictionary
    
    Returns:
        Updated state dictionary (can be used to update workflow state)
    
    Example:
        backend = OrchestratorFilesystemBackend(project_id="canvas-123")
        updated_state = migrate_state_to_filesystem(backend, state)
        # State now has filesystem references instead of large strings
    """
    # Store state to filesystem
    store_state_to_filesystem(backend, state)
    
    # Return updated state (can remove large strings, keep references)
    # For now, we keep both (backward compatibility)
    # In Phase 3, we'll remove the strings
    updated_state = state.copy()
    
    # Add filesystem metadata (for debugging)
    updated_state["_filesystem"] = {
        "project_id": backend.project_id,
        "base_path": str(backend.get_project_path())
    }
    
    return updated_state


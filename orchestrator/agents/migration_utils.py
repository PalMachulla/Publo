"""
Migration Utilities

Utilities for migrating from current state management to filesystem-based storage.
"""

from typing import Dict, Any, Optional
from .deep_agent_backend import OrchestratorFilesystemBackend
from .file_storage import store_state_to_filesystem, load_context_from_filesystem


def initialize_filesystem_for_session(
    session_id: str,
    state: Optional[Dict[str, Any]] = None
) -> OrchestratorFilesystemBackend:
    """
    Initialize filesystem backend for a session and optionally migrate state.
    
    This is the main entry point for Phase 1 - sets up filesystem
    and migrates existing state if provided.
    
    Args:
        session_id: Session ID (used as project_id)
        state: Optional OrchestratorState to migrate
    
    Returns:
        Initialized filesystem backend
    
    Example:
        backend = initialize_filesystem_for_session("session-123", state)
        # Filesystem ready, state migrated if provided
    """
    backend = OrchestratorFilesystemBackend(project_id=session_id)
    
    if state:
        store_state_to_filesystem(backend, state)
    
    return backend


def restore_state_from_filesystem(
    backend: OrchestratorFilesystemBackend
) -> Dict[str, Any]:
    """
    Restore OrchestratorState from filesystem (for rollback/testing).
    
    This reads all stored files and reconstructs the state dictionary.
    Useful for debugging or rollback scenarios.
    
    Args:
        backend: Filesystem backend instance
    
    Returns:
        Reconstructed state dictionary
    
    Example:
        backend = OrchestratorFilesystemBackend(project_id="session-123")
        state = restore_state_from_filesystem(backend)
        # State restored from files
    """
    state = {}
    
    # Load canvas context
    canvas_context = load_context_from_filesystem(backend, "canvas")
    if canvas_context:
        import json
        state["canvas_context"] = json.dumps(canvas_context) if isinstance(canvas_context, dict) else canvas_context
    
    # Load document structure
    document_data = load_context_from_filesystem(backend, "document")
    if document_data:
        state["structure_items"] = document_data.get("items", [])
        state["document_format"] = document_data.get("format")
        state["active_segment"] = document_data.get("active_segment")
        state["document_panel_open"] = document_data.get("document_panel_open", False)
    
    # Load conversation history
    conversation_data = load_context_from_filesystem(backend, "conversation")
    if conversation_data:
        state["conversation_history"] = conversation_data.get("messages", [])
        state["session_id"] = conversation_data.get("session_id")
        state["user_id"] = conversation_data.get("user_id")
    
    # Load current request
    request_data = load_context_from_filesystem(backend, "request")
    if request_data:
        state["user_message"] = request_data.get("message")
    
    return state


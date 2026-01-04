"""
Planning Tools

Tools for task decomposition and progress tracking.
Implements the write_todos capability from the Deep Agent framework.
"""

from typing import List, Dict, Any, Optional
from langchain_core.tools import tool
import json
from datetime import datetime


# In-memory store for todos (per-session)
# In production, this would use the OrchestratorFilesystemBackend
_session_todos: Dict[str, List[Dict[str, Any]]] = {}


def _get_backend(node_id: str):
    """Get the filesystem backend for a project."""
    try:
        from agents.deep_agent_backend import OrchestratorFilesystemBackend
        return OrchestratorFilesystemBackend(project_id=node_id)
    except Exception:
        return None


def _load_todos(node_id: str) -> List[Dict[str, Any]]:
    """Load todos from storage."""
    # Try filesystem first
    backend = _get_backend(node_id)
    if backend:
        todos = backend.read_file("plan/todos.json")
        if todos:
            return todos
    
    # Fallback to in-memory
    return _session_todos.get(node_id, [])


def _save_todos(node_id: str, todos: List[Dict[str, Any]]):
    """Save todos to storage."""
    # Try filesystem first
    backend = _get_backend(node_id)
    if backend:
        backend.write_file("plan/todos.json", todos)
    
    # Also keep in memory for fast access
    _session_todos[node_id] = todos


@tool
def write_todos(
    todos: List[Dict[str, str]],
    merge: bool = False,
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Create or update a task list for complex requests.
    
    Use this tool when you need to:
    - Break down a complex task into steps
    - Track progress on multi-part work
    - Show the user your plan of action
    
    Args:
        todos: List of todo items, each with:
            - id: Unique identifier (e.g., "step-1", "write-ch1")
            - content: Description of the task
            - status: "pending" | "in_progress" | "completed" | "cancelled"
        merge: If True, merge with existing todos (update by id).
               If False, replace all existing todos.
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        Updated todo list with statistics
    
    Example:
        write_todos([
            {"id": "1", "content": "Get story context", "status": "completed"},
            {"id": "2", "content": "Write Chapter 1 opening", "status": "in_progress"},
            {"id": "3", "content": "Write Chapter 1 conflict", "status": "pending"},
            {"id": "4", "content": "Write Chapter 1 resolution", "status": "pending"}
        ], merge=False)
    """
    # Validate todo structure
    valid_statuses = {"pending", "in_progress", "completed", "cancelled"}
    validated_todos = []
    
    for todo in todos:
        if not isinstance(todo, dict):
            continue
        
        todo_id = todo.get("id", f"todo-{len(validated_todos)}")
        content = todo.get("content", "")
        status = todo.get("status", "pending")
        
        if status not in valid_statuses:
            status = "pending"
        
        validated_todos.append({
            "id": todo_id,
            "content": content,
            "status": status,
            "updated_at": datetime.utcnow().isoformat() + "Z"
        })
    
    if merge:
        # Merge with existing todos
        existing = _load_todos(node_id)
        existing_by_id = {t["id"]: t for t in existing}
        
        for todo in validated_todos:
            existing_by_id[todo["id"]] = todo
        
        final_todos = list(existing_by_id.values())
    else:
        # Replace all todos
        final_todos = validated_todos
    
    # Save
    _save_todos(node_id, final_todos)
    
    # Calculate statistics
    total = len(final_todos)
    completed = sum(1 for t in final_todos if t["status"] == "completed")
    in_progress = sum(1 for t in final_todos if t["status"] == "in_progress")
    pending = sum(1 for t in final_todos if t["status"] == "pending")
    cancelled = sum(1 for t in final_todos if t["status"] == "cancelled")
    
    return {
        "success": True,
        "todos": final_todos,
        "stats": {
            "total": total,
            "completed": completed,
            "in_progress": in_progress,
            "pending": pending,
            "cancelled": cancelled,
            "percent_complete": round(completed / total * 100) if total > 0 else 0
        }
    }


@tool
def get_todos(node_id: str = "") -> Dict[str, Any]:
    """
    Get the current task list.
    
    Args:
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        Current todo list with statistics
    """
    todos = _load_todos(node_id)
    
    total = len(todos)
    completed = sum(1 for t in todos if t.get("status") == "completed")
    
    return {
        "todos": todos,
        "stats": {
            "total": total,
            "completed": completed,
            "percent_complete": round(completed / total * 100) if total > 0 else 0
        }
    }


def clear_todos(node_id: str):
    """Clear all todos for a session (utility function)."""
    _save_todos(node_id, [])
    return {"success": True, "message": "Todos cleared"}

"""
Filesystem Tools

Tools for reading/writing context files in the agent's project filesystem.
Enables persistent context storage and retrieval.
"""

from typing import Dict, Any, List, Optional
from langchain_core.tools import tool


def _get_backend(node_id: str):
    """Get filesystem backend for a project."""
    try:
        from agents.deep_agent_backend import OrchestratorFilesystemBackend
        return OrchestratorFilesystemBackend(project_id=node_id)
    except Exception as e:
        print(f"⚠️ Could not create filesystem backend: {e}")
        return None


@tool
def read_context_file(
    path: str,
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Read a file from the project context filesystem.
    
    Use this to retrieve previously saved context, notes, or data.
    
    Args:
        path: File path within the context filesystem (e.g., "notes/character_notes.txt")
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        File contents (as string for text, as dict for JSON)
    
    Example:
        read_context_file(path="notes/plot_outline.txt")
    """
    backend = _get_backend(node_id)
    
    if not backend:
        return {
            "success": False,
            "error": "Filesystem backend not available"
        }
    
    try:
        content = backend.read_file(path)
        
        if content is None:
            return {
                "success": False,
                "path": path,
                "error": f"File not found: {path}"
            }
        
        return {
            "success": True,
            "path": path,
            "content": content,
            "type": "json" if isinstance(content, (dict, list)) else "text"
        }
    except Exception as e:
        return {
            "success": False,
            "path": path,
            "error": str(e)
        }


@tool
def write_context_file(
    path: str,
    content: str,
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Write content to the project context filesystem.
    
    Use this to save notes, outlines, research, or any context for later use.
    
    Args:
        path: File path within the context filesystem (e.g., "notes/character_notes.txt")
        content: Content to write (string for text, or JSON-serializable for .json files)
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        Confirmation of file write
    
    Example:
        write_context_file(
            path="notes/character_notes.txt",
            content="Sarah: 35, detective, skeptical of supernatural"
        )
    """
    backend = _get_backend(node_id)
    
    if not backend:
        return {
            "success": False,
            "error": "Filesystem backend not available"
        }
    
    try:
        # For .json files, try to parse as JSON
        if path.endswith('.json'):
            import json
            try:
                content_to_write = json.loads(content) if isinstance(content, str) else content
            except json.JSONDecodeError:
                content_to_write = content
        else:
            content_to_write = content
        
        backend.write_file(path, content_to_write)
        
        return {
            "success": True,
            "path": path,
            "message": f"File saved: {path}",
            "bytes_written": len(content) if isinstance(content, str) else len(str(content))
        }
    except Exception as e:
        return {
            "success": False,
            "path": path,
            "error": str(e)
        }


@tool
def list_context_files(
    directory: str = "",
    node_id: str = "",
) -> Dict[str, Any]:
    """
    List files in the context filesystem.
    
    Use this to see what context files are available.
    
    Args:
        directory: Directory to list (empty string for root)
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        List of files and directories
    
    Example:
        list_context_files(directory="notes")
    """
    backend = _get_backend(node_id)
    
    if not backend:
        return {
            "success": False,
            "files": [],
            "error": "Filesystem backend not available"
        }
    
    try:
        files = backend.list_files(directory or "")
        
        return {
            "success": True,
            "directory": directory or "/",
            "files": files,
            "count": len(files)
        }
    except Exception as e:
        return {
            "success": False,
            "directory": directory or "/",
            "files": [],
            "error": str(e)
        }


@tool
def delete_context_file(
    path: str,
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Delete a file from the context filesystem.
    
    Use this to remove outdated context.
    
    Args:
        path: File path to delete
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        Confirmation of deletion
    """
    backend = _get_backend(node_id)
    
    if not backend:
        return {
            "success": False,
            "error": "Filesystem backend not available"
        }
    
    try:
        backend.delete_file(path)
        
        return {
            "success": True,
            "path": path,
            "message": f"File deleted: {path}"
        }
    except Exception as e:
        return {
            "success": False,
            "path": path,
            "error": str(e)
        }

"""
Memory Tools

Tools for saving and retrieving learned user preferences and patterns.
Implements persistent learning for the Deep Agent framework.
"""

from typing import Dict, Any, Optional, List
from langchain_core.tools import tool


def _get_memory_manager(node_id: str):
    """Get memory manager for a project."""
    try:
        from agents.deep_agent_backend import OrchestratorFilesystemBackend
        from agents.memory_manager import MemoryManager
        
        backend = OrchestratorFilesystemBackend(project_id=node_id)
        return MemoryManager(backend)
    except Exception as e:
        print(f"⚠️ Could not create memory manager: {e}")
        return None


@tool
def save_preference(
    key: str,
    value: str,
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Save a learned user preference.
    
    Use this when you notice a pattern in user behavior or explicit preferences.
    Examples:
    - User prefers dialogue-heavy writing
    - User likes detailed descriptions
    - User favors first-person POV
    
    Args:
        key: Preference key (e.g., "writing_style", "pov_preference", "dialogue_ratio")
        value: Preference value as a string
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        Confirmation of saved preference
    
    Example:
        save_preference(key="writing_style", value="dialogue-heavy with minimal exposition")
    """
    manager = _get_memory_manager(node_id)
    
    if not manager:
        return {
            "success": False,
            "error": "Memory manager not available"
        }
    
    try:
        manager.save_preference(key, value)
        
        return {
            "success": True,
            "key": key,
            "value": value,
            "message": f"Saved preference: {key}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@tool
def save_pattern(
    pattern_type: str,
    description: str,
    context: str = "",
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Save a successful pattern for future use.
    
    Use this when something works well and should be remembered.
    Examples:
    - A structure template that user approved
    - A writing style that received positive feedback
    - A pacing approach that worked well
    
    Args:
        pattern_type: Type of pattern (e.g., "structure_template", "writing_style", "pacing")
        description: What the pattern is and why it works
        context: When/how the pattern was used
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        Confirmation of saved pattern
    
    Example:
        save_pattern(
            pattern_type="structure_template",
            description="3-act structure with twist at midpoint",
            context="User requested mystery story"
        )
    """
    manager = _get_memory_manager(node_id)
    
    if not manager:
        return {
            "success": False,
            "error": "Memory manager not available"
        }
    
    try:
        pattern = {
            "type": pattern_type,
            "description": description,
            "context": context
        }
        manager.save_pattern(pattern)
        
        return {
            "success": True,
            "pattern_type": pattern_type,
            "description": description,
            "message": f"Saved pattern: {pattern_type}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@tool
def get_preferences(node_id: str = "") -> Dict[str, Any]:
    """
    Get all saved user preferences.
    
    Use this at the start of interactions to personalize responses.
    
    Args:
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        Dictionary of user preferences
    """
    manager = _get_memory_manager(node_id)
    
    if not manager:
        return {
            "success": False,
            "preferences": {},
            "error": "Memory manager not available"
        }
    
    try:
        preferences = manager.load_preferences()
        
        return {
            "success": True,
            "preferences": preferences,
            "count": len([k for k in preferences if not k.startswith("_")])
        }
    except Exception as e:
        return {
            "success": False,
            "preferences": {},
            "error": str(e)
        }


@tool
def get_patterns(
    pattern_type: Optional[str] = None,
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Get saved patterns, optionally filtered by type.
    
    Use this to recall successful approaches from previous sessions.
    
    Args:
        pattern_type: Optional filter by type (e.g., "structure_template")
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        List of matching patterns
    """
    manager = _get_memory_manager(node_id)
    
    if not manager:
        return {
            "success": False,
            "patterns": [],
            "error": "Memory manager not available"
        }
    
    try:
        if pattern_type:
            patterns = manager.find_similar_patterns(pattern_type)
        else:
            patterns = manager.load_patterns()
        
        return {
            "success": True,
            "patterns": patterns,
            "count": len(patterns)
        }
    except Exception as e:
        return {
            "success": False,
            "patterns": [],
            "error": str(e)
        }

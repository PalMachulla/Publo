"""
Publo Deep Agent Tools

Custom tools for the Publo creative writing assistant.
These tools wrap core functionality (Librarian, Writer, etc.) and expose
them to the Deep Agent for natural tool selection.
"""

from .story_context import get_story_context
from .writing import write_section, edit_section, write_section_streaming
from .structure import create_structure, update_structure
from .navigation import navigate_to, present_options
from .planning import write_todos, get_todos
from .task import task, list_subagents
from .memory import save_preference, save_pattern, get_preferences, get_patterns
from .filesystem import read_context_file, write_context_file, list_context_files, delete_context_file

__all__ = [
    # Story context
    "get_story_context",
    # Writing
    "write_section", 
    "write_section_streaming",  # Streaming version for real-time updates
    "edit_section",
    # Structure
    "create_structure",
    "update_structure",
    # Navigation
    "navigate_to",
    "present_options",
    # Planning (Deep Agent)
    "write_todos",
    "get_todos",
    # Subagent spawning (Deep Agent)
    "task",
    "list_subagents",
    # Memory (Deep Agent)
    "save_preference",
    "save_pattern",
    "get_preferences",
    "get_patterns",
    # Filesystem (Deep Agent)
    "read_context_file",
    "write_context_file",
    "list_context_files",
    "delete_context_file",
]

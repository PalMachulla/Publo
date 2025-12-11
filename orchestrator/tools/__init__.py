"""
Publo Deep Agent Tools

Custom tools for the Publo creative writing assistant.
These tools wrap core functionality (Librarian, Writer, etc.) and expose
them to the Deep Agent for natural tool selection.
"""

from .story_context import get_story_context
from .writing import write_section, edit_section
from .structure import create_structure
from .navigation import navigate_to, present_options

__all__ = [
    "get_story_context",
    "write_section", 
    "edit_section",
    "create_structure",
    "navigate_to",
    "present_options",
]

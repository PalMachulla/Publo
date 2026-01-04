"""
Navigation Tools

Tools for navigating the UI and presenting options to users,
and arranging nodes on the canvas.
"""

from typing import List, Dict, Any, Optional, Literal
from langchain_core.tools import tool


@tool
async def navigate_to(
    section_id: str,
    section_name: Optional[str] = None,
) -> Dict[str, str]:
    """
    Navigate the user's view to a specific section.
    
    Use this when the user asks to go to a section, or after writing
    to show them the result.
    
    Args:
        section_id: The section to navigate to
        section_name: Optional human-readable section name
    
    Returns:
        Confirmation of navigation request
    """
    from streaming import format_sse, SSEEventType
    
    # Note: The actual SSE event is sent through the streaming layer
    # This tool returns data that the agent can use to confirm the action
    
    return {
        "status": "navigation_requested",
        "section_id": section_id,
        "section_name": section_name or section_id,
        "message": f"Navigating to {section_name or section_id}..."
    }


@tool
async def present_options(
    prompt: str,
    options: List[Dict[str, str]],
    allow_multiple: bool = False,
    context: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Present clickable options to the user.
    
    Use this when you want the user to choose from structured options,
    like selecting a template, choosing a section to edit, or picking
    a direction for the story.
    
    Args:
        prompt: The question or context for the options
        options: List of options, each with 'id', 'label', and optional 'description'
        allow_multiple: Whether user can select multiple options
        context: Optional additional context about the choice
    
    Returns:
        Confirmation that options were presented
    
    Example:
        present_options(
            prompt="Which template would you like to use?",
            options=[
                {"id": "hero_journey", "label": "Hero's Journey", "description": "Classic adventure structure"},
                {"id": "three_act", "label": "Three-Act Structure", "description": "Setup, confrontation, resolution"},
            ]
        )
    """
    from streaming import format_sse, SSEEventType
    
    # Validate options format
    validated_options = []
    for opt in options:
        if isinstance(opt, dict) and "id" in opt and "label" in opt:
            validated_options.append({
                "id": opt["id"],
                "label": opt["label"],
                "description": opt.get("description", "")
            })
        elif isinstance(opt, str):
            validated_options.append({
                "id": opt,
                "label": opt,
                "description": ""
            })
    
    # Note: The actual SSE event is sent through the streaming layer
    # The agent will receive the user's selection in the next message
    
    return {
        "status": "options_presented",
        "prompt": prompt,
        "options": validated_options,
        "allow_multiple": allow_multiple,
        "awaiting_selection": True,
        "message": prompt
    }


@tool
async def show_template_options() -> Dict[str, Any]:
    """
    Show available story structure templates to the user.
    
    Use this when the user wants to create a structure but hasn't
    specified a template.
    
    Returns:
        Options for template selection
    """
    from .structure import get_available_templates
    
    templates = get_available_templates()
    
    options = [
        {
            "id": t["id"],
            "label": t["name"],
            "description": t["description"]
        }
        for t in templates
    ]
    
    return await present_options(
        prompt="Which structure template would you like to use?",
        options=options,
        allow_multiple=False,
        context="Choose a template to help organize your story, or I can create a custom structure."
    )


@tool
async def show_section_options(
    prompt: str,
    sections: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Show available sections for the user to choose from.
    
    Use this when the user wants to navigate or edit but there are
    multiple matching sections.
    
    Args:
        prompt: The question to ask
        sections: List of sections with 'id' and 'name'
    
    Returns:
        Options for section selection
    """
    options = [
        {
            "id": s.get("id", ""),
            "label": s.get("name", s.get("title", "Section")),
            "description": s.get("description", "")
        }
        for s in sections
    ]
    
    return await present_options(
        prompt=prompt,
        options=options,
        allow_multiple=False
    )


def format_navigation_event(section_id: str, section_name: str = "") -> str:
    """
    Format a navigation event for SSE streaming.
    
    Args:
        section_id: Target section
        section_name: Human-readable name
    
    Returns:
        SSE-formatted event string
    """
    from streaming import format_sse, SSEEventType
    
    return format_sse(SSEEventType.NAVIGATE, {
        "section_id": section_id,
        "section_name": section_name or section_id
    })


def format_options_event(
    prompt: str,
    options: List[Dict[str, str]],
    allow_multiple: bool = False
) -> str:
    """
    Format a present_options event for SSE streaming.
    
    Args:
        prompt: Question for user
        options: Available options
        allow_multiple: Multi-select allowed
    
    Returns:
        SSE-formatted event string
    """
    from streaming import format_sse, SSEEventType
    
    return format_sse(SSEEventType.PRESENT_OPTIONS, {
        "prompt": prompt,
        "options": options,
        "allow_multiple": allow_multiple
    })


# =============================================================================
# CANVAS ARRANGEMENT
# =============================================================================

@tool
async def arrange_nodes(
    node_type: Literal["character", "story", "all"] = "all",
    sort_by: Optional[str] = None,
    layout: Literal["default", "grid", "horizontal", "clusters"] = "default",
    ascending: bool = True,
    story_id: str = "",
    user_id: str = "",
) -> Dict[str, Any]:
    """
    Arrange nodes on the canvas by a specified attribute.
    
    Use this when the user wants to organize, sort, or layout nodes on the canvas.
    Characters are always positioned ABOVE the orchestrator node.
    Stories are always positioned BELOW the orchestrator node.
    
    Examples:
    - "Sort the characters by gender" → arrange_nodes(node_type="character", sort_by="gender", layout="clusters")
    - "Organize characters by role" → arrange_nodes(node_type="character", sort_by="role", layout="clusters")
    - "Arrange characters by extraversion" → arrange_nodes(node_type="character", sort_by="extraversion", layout="horizontal")
    - "Put characters in a grid" → arrange_nodes(node_type="character", layout="grid")
    - "Organize the canvas" → arrange_nodes(node_type="all", layout="default")
    
    Args:
        node_type: Which nodes to arrange - "character", "story", or "all"
        sort_by: Attribute to sort/group by. For characters: "gender", "role", "age", 
                 "openness", "conscientiousness", "extraversion", "agreeableness", 
                 "neuroticism", "personality_type". For stories: "format". 
                 None = don't sort, just layout.
        layout: Layout algorithm:
                - "default": Characters above, stories below orchestrator (grid within each zone)
                - "grid": Arrange in a grid pattern
                - "horizontal": Arrange in a horizontal line (good for trait scales)
                - "clusters": Group by sort_by attribute (good for categorical like gender/role)
        ascending: Sort order (True = low→high or A→Z, False = high→low or Z→A)
        story_id: Current story ID (injected by system)
        user_id: Current user ID (injected by system)
    
    Returns:
        Confirmation with arrangement details
    """
    print(f"📐 [ArrangeNodes] Arranging {node_type} nodes by {sort_by} using {layout} layout", flush=True)
    
    # The actual positioning is done by the frontend based on the SSE event.
    # We just tell it what to do and it calculates positions.
    
    return {
        "status": "arrangement_requested",
        "node_type": node_type,
        "sort_by": sort_by,
        "layout": layout,
        "ascending": ascending,
        "message": f"Arranged {node_type} nodes" + (f" by {sort_by}" if sort_by else "") + f" using {layout} layout"
    }

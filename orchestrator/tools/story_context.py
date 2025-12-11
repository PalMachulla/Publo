"""
Story Context Tool

Get story context (characters, places, events) before writing.
Backed by the Librarian service.
"""

from typing import Optional, Dict, Any
from langchain_core.tools import tool


@tool
async def get_story_context(
    section_id: Optional[str] = None,
    include_characters: bool = True,
    include_places: bool = True,
    include_events: bool = True,
    include_nearby_summaries: bool = True,
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Get story context for writing or discussion.
    
    Call this BEFORE writing to understand what's been established in the story.
    If section_id is provided, returns context relevant to that section.
    Otherwise returns global story context.
    
    Args:
        section_id: Optional section to get context for
        include_characters: Include character registry
        include_places: Include location registry
        include_events: Include plot events timeline
        include_nearby_summaries: Include summaries of adjacent sections
        node_id: Story node ID (injected by agent)
    
    Returns:
        Dictionary containing requested story elements:
        - characters: List of character info
        - places: List of location info
        - events: List of plot events
        - nearby_sections: Summaries of adjacent sections
        - section_card: Current section's intelligence card
        - coherency_issues: Any flagged issues for this section
    """
    from librarian import get_librarian
    from config import get_supabase_client
    
    # Get librarian instance
    supabase = get_supabase_client()
    librarian = get_librarian(node_id, supabase)
    
    context = {}
    
    if include_characters:
        context["characters"] = await librarian.get_characters(
            relevant_to_section=section_id
        )
    
    if include_places:
        context["places"] = await librarian.get_places(
            relevant_to_section=section_id
        )
    
    if include_events:
        context["events"] = await librarian.get_events(
            up_to_section=section_id
        )
    
    if include_nearby_summaries and section_id:
        context["nearby_sections"] = await librarian.get_nearby_summaries(
            section_id=section_id,
            window=2
        )
    
    if section_id:
        card = await librarian.get_section_card(section_id)
        if card:
            from dataclasses import asdict
            context["section_card"] = asdict(card)
        context["coherency_issues"] = await librarian.get_coherency_issues(section_id)
    
    return context


def format_context_for_prompt(context: Dict[str, Any]) -> str:
    """
    Format context dictionary as a string for LLM prompts.
    
    Args:
        context: Context from get_story_context
    
    Returns:
        Formatted string for inclusion in prompts
    """
    sections = []
    
    # Characters
    characters = context.get("characters", [])
    if characters:
        char_lines = []
        for c in characters[:10]:  # Limit to 10
            name = c.get("name", "Unknown")
            desc = c.get("description", "No description")
            traits = ", ".join(c.get("traits", [])[:5])
            char_lines.append(f"- {name}: {desc} (Traits: {traits})")
        sections.append("### Characters\n" + "\n".join(char_lines))
    
    # Places
    places = context.get("places", [])
    if places:
        place_lines = []
        for p in places[:10]:
            name = p.get("name", "Unknown")
            desc = p.get("description", "No description")
            place_lines.append(f"- {name}: {desc}")
        sections.append("### Places\n" + "\n".join(place_lines))
    
    # Events
    events = context.get("events", [])
    if events:
        event_lines = [f"- {e.get('summary', e.get('name', 'Event'))}" for e in events[-10:]]
        sections.append("### Recent Events\n" + "\n".join(event_lines))
    
    # Nearby sections
    nearby = context.get("nearby_sections", [])
    if nearby:
        nearby_lines = [f"- {s.get('section_name')}: {s.get('summary', 'No summary')}" for s in nearby]
        sections.append("### Adjacent Sections\n" + "\n".join(nearby_lines))
    
    # Coherency issues
    issues = context.get("coherency_issues", [])
    if issues:
        issue_lines = [f"⚠️ {i.get('description', 'Issue')}" for i in issues]
        sections.append("### ⚠️ Coherency Warnings\n" + "\n".join(issue_lines))
    
    return "\n\n".join(sections) if sections else "No story context available yet."

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
    
    Returns:
        Dictionary containing requested story elements:
        - characters: List of character info
        - places: List of location info
        - events: List of plot events
        - nearby_sections: Summaries of adjacent sections
        - section_card: Current section's intelligence card
        - coherency_issues: Any flagged issues for this section
    """
    try:
        from librarian import get_librarian
        from config import get_supabase_client
        from deep_agent import get_context_node_id
    except Exception as e:
        return {"error": f"Import error: {str(e)}"}
    
    # Get node_id from context
    node_id = get_context_node_id()
    
    # Get librarian instance
    try:
        supabase = get_supabase_client()
        librarian = get_librarian(node_id, supabase)
    except Exception as e:
        return {"error": f"Failed to create librarian: {str(e)}"}
    
    context = {}
    
    try:
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
    except Exception as e:
        return {"error": f"Failed to get context: {str(e)}"}
    
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
    
    # =========================================================================
    # SECTION CARD - THE LIBRARIAN'S VISION FOR THIS SECTION
    # =========================================================================
    # This is the most important context! The Librarian's plan for what should
    # happen in this section, the mood, any hooks to plant, and constraints.
    section_card = context.get("section_card")
    if section_card:
        card_lines = []
        
        # Section name and summary (the Librarian's vision)
        section_name = section_card.get("section_name", "This section")
        summary = section_card.get("summary")
        if summary:
            card_lines.append(f"**What should happen:** {summary}")
        
        # Mood/tone guidance
        mood = section_card.get("mood")
        if mood:
            card_lines.append(f"**Mood/Tone:** {mood}")
        
        # Hooks to plant (foreshadowing for later sections)
        hooks = section_card.get("hooks", [])
        if hooks:
            card_lines.append(f"**Foreshadowing to plant:** {', '.join(hooks)}")
        
        # Constraints (things to avoid or be careful about)
        constraints = section_card.get("constraints", [])
        if constraints:
            card_lines.append(f"**Constraints:** {', '.join(constraints)}")
        
        # Must include/exclude
        must_include = section_card.get("must_include", [])
        if must_include:
            card_lines.append(f"**Must include:** {', '.join(must_include)}")
        
        must_not_include = section_card.get("must_not_include", [])
        if must_not_include:
            card_lines.append(f"**Avoid/Don't include:** {', '.join(must_not_include)}")
        
        # Dependencies (what happened before that matters)
        dependencies = section_card.get("dependencies", [])
        if dependencies:
            dep_lines = [d.get("description", d.get("section_name", "")) for d in dependencies if isinstance(d, dict)]
            if dep_lines:
                card_lines.append(f"**Follows from:** {'; '.join(dep_lines)}")
        
        if card_lines:
            sections.append(f"### 📋 Librarian's Plan for \"{section_name}\"\n" + "\n".join(card_lines))
    
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

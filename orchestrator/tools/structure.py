"""
Structure Tool

Create document structures from templates or descriptions.
"""

from typing import Optional, Dict, Any, List
from langchain_core.tools import tool
import json
import time

# #region agent log
LOG_PATH = "/Users/palmac/Aiakaki/Code/publo/.cursor/debug.log"
def debug_log(hyp: str, loc: str, msg: str, data: dict = None):
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps({"hypothesisId": hyp, "location": loc, "message": msg, "data": data or {}, "timestamp": int(time.time()*1000), "sessionId": "debug-session"}) + "\n")
# #endregion


@tool
async def create_structure(
    prompt: str,
    template_id: Optional[str] = None,
    format_type: str = "novel",
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Create a new document structure from a template or description.
    
    Args:
        prompt: Description of what to create (e.g., "A mystery story about a detective")
        template_id: Optional template to use (e.g., "hero_journey", "three_act")
        format_type: Document format ("novel", "screenplay", "podcast", etc.)
        node_id: Story node ID (injected by agent)
    
    Returns:
        Dictionary with:
        - title: Document title
        - format: Document format
        - items: List of structure items [{id, name, type, level}]
        - section_count: Number of sections
    """
    from config import get_model_for_task
    
    # #region agent log
    debug_log("N", "structure.py:45", "create_structure called", {"prompt_preview": prompt[:100] if prompt else "", "template_id": template_id, "format_type": format_type})
    # #endregion
    
    # Get template if specified
    template_guidance = ""
    if template_id:
        template_guidance = _get_template_guidance(template_id)
    
    # Build prompt for structure generation
    structure_prompt = _build_structure_prompt(
        prompt=prompt,
        format_type=format_type,
        template_guidance=template_guidance,
    )
    
    # #region agent log
    debug_log("N", "structure.py:58", "structure prompt built", {"prompt_length": len(structure_prompt), "has_template": bool(template_guidance)})
    # #endregion
    
    # Generate structure using LLM
    model = get_model_for_task("general")
    
    response = await model.ainvoke(structure_prompt)
    response_text = response.content if hasattr(response, 'content') else str(response)
    
    # #region agent log
    debug_log("N", "structure.py:68", "LLM response received", {"response_length": len(response_text), "response_preview": response_text[:200] if response_text else ""})
    # #endregion
    
    # Parse the JSON response
    structure = _parse_structure_response(response_text)
    
    # #region agent log
    debug_log("N", "structure.py:75", "structure parsed", {"title": structure.get("title"), "items_count": len(structure.get("items", []))})
    # #endregion
    
    # Ensure required fields
    if "title" not in structure:
        structure["title"] = "Untitled"
    if "format" not in structure:
        structure["format"] = format_type
    if "items" not in structure:
        structure["items"] = []
    
    structure["section_count"] = len(structure.get("items", []))
    
    return structure


def _get_template_guidance(template_id: str) -> str:
    """Get guidance text for a template."""
    
    templates = {
        "hero_journey": """
Follow the Hero's Journey structure:
1. Ordinary World - Establish the hero's normal life
2. Call to Adventure - Something disrupts the ordinary
3. Refusal of the Call - Initial hesitation
4. Meeting the Mentor - Guidance appears
5. Crossing the Threshold - Entering the adventure
6. Tests, Allies, Enemies - Challenges and relationships
7. Approach to the Inmost Cave - Preparing for major challenge
8. Ordeal - The central crisis
9. Reward - Seizing the prize
10. The Road Back - Journey home begins
11. Resurrection - Final test
12. Return with Elixir - Transformed return
""",
        
        "three_act": """
Follow the Three-Act Structure:

ACT 1 - Setup (25%):
- Opening Image
- Introduction of protagonist
- Inciting Incident
- First Plot Point (end of Act 1)

ACT 2 - Confrontation (50%):
- Rising action
- Midpoint (major twist or revelation)
- All Is Lost moment
- Dark Night of the Soul
- Second Plot Point (end of Act 2)

ACT 3 - Resolution (25%):
- Climax
- Resolution
- Final Image
""",
        
        "save_the_cat": """
Follow Save the Cat structure:
1. Opening Image
2. Theme Stated
3. Set-Up
4. Catalyst
5. Debate
6. Break into Two
7. B Story
8. Fun and Games
9. Midpoint
10. Bad Guys Close In
11. All Is Lost
12. Dark Night of the Soul
13. Break into Three
14. Finale
15. Final Image
""",
        
        "podcast_episode": """
Structure for a podcast episode:
1. Cold Open - Hook the listener
2. Introduction - Welcome and topic introduction
3. Main Content Part 1 - First major point
4. Transition/Break
5. Main Content Part 2 - Second major point
6. Interview/Story Segment (if applicable)
7. Main Content Part 3 - Third major point
8. Wrap-Up - Summary and key takeaways
9. Call to Action - What listeners should do
10. Outro - Closing remarks and credits
""",
    }
    
    return templates.get(template_id, "")


def _build_structure_prompt(
    prompt: str,
    format_type: str,
    template_guidance: str,
) -> str:
    """Build the prompt for structure generation."""
    
    format_guidance = {
        "novel": "Create chapters with descriptive titles. Each chapter should advance the plot.",
        "screenplay": "Create scenes with location and context. Include act breaks.",
        "podcast": "Create episodes or segments with clear topics.",
        "short_story": "Create sections or parts that flow naturally.",
        "article": "Create sections with clear headings covering the topic.",
    }
    
    return f"""Create a document structure based on this request:

"{prompt}"

Format: {format_type}
{format_guidance.get(format_type, '')}

{template_guidance if template_guidance else ''}

Return a JSON object with this structure:
{{
  "title": "Document Title",
  "format": "{format_type}",
  "items": [
    {{
      "id": "ch-1",
      "name": "Chapter/Section Name",
      "type": "chapter",
      "level": 1,
      "description": "Brief description of what happens"
    }},
    ...
  ]
}}

Guidelines:
- Create a compelling title
- Generate 8-15 sections/chapters appropriate for the format
- Each item needs: id (unique), name (title), type, level (1 for main sections)
- Add a brief description for each section
- Make the structure coherent and well-paced

Return ONLY valid JSON, no markdown formatting or explanation.
"""


def _parse_structure_response(response_text: str) -> Dict[str, Any]:
    """Parse the LLM response into a structure dict."""
    import json
    
    # Clean up response
    text = response_text.strip()
    
    # Remove markdown code blocks if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        if text.startswith("json"):
            text = text[4:]
    
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError as e:
        print(f"❌ [Structure] Failed to parse structure: {e}")
        # Return minimal structure
        return {
            "title": "Untitled",
            "format": "novel",
            "items": [
                {"id": "ch-1", "name": "Chapter 1", "type": "chapter", "level": 1}
            ]
        }


def get_available_templates() -> List[Dict[str, str]]:
    """
    Get list of available structure templates.
    
    Returns:
        List of template info [{id, name, description}]
    """
    return [
        {
            "id": "hero_journey",
            "name": "Hero's Journey",
            "description": "Classic 12-stage adventure structure (Vogler)"
        },
        {
            "id": "three_act",
            "name": "Three-Act Structure",
            "description": "Traditional Setup, Confrontation, Resolution"
        },
        {
            "id": "save_the_cat",
            "name": "Save the Cat",
            "description": "Blake Snyder's 15-beat screenwriting structure"
        },
        {
            "id": "podcast_episode",
            "name": "Podcast Episode",
            "description": "Standard podcast episode flow"
        },
    ]

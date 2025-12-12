"""
Structure Tool

Create document structures from templates or descriptions.
"""

from typing import Optional, Dict, Any, List
from langchain_core.tools import tool
import json


@tool
async def create_structure(
    prompt: str,
    format_type: str,
    template_id: Optional[str] = None,
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Create a new document structure from a template or description.
    
    IMPORTANT: Extract the format_type from the user's message. Available formats:
    - "novel" - For novels, books, long fiction
    - "short-story" - For short stories, flash fiction
    - "screenplay" - For movies, TV scripts
    - "podcast" - For podcast episodes, audio content
    - "report" - For business reports, research reports, technical reports
    - "article" - For blog posts, news articles, how-to guides
    - "essay" - For essays, opinion pieces, academic writing
    
    Args:
        prompt: Description of what to create (e.g., "A mystery story about a detective")
        format_type: REQUIRED - Document format. Detect from user's message.
                     Use "report" for reports, "article" for articles, etc.
        template_id: Optional template to use (e.g., "business", "research", "technical" for reports)
        node_id: Story node ID (injected by agent)
    
    Returns:
        Dictionary with:
        - title: Document title
        - format: Document format
        - items: List of structure items [{id, name, type, level}]
        - section_count: Number of sections
    """
    from config import get_model_for_task
    
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
    
    # Generate structure using LLM
    model = get_model_for_task("general")
    
    response = await model.ainvoke(structure_prompt)
    response_text = response.content if hasattr(response, 'content') else str(response)
    
    # Parse the JSON response
    structure = _parse_structure_response(response_text)
    
    # Ensure required fields
    if "title" not in structure:
        structure["title"] = "Untitled"
    if "format" not in structure:
        structure["format"] = format_type
    if "items" not in structure:
        structure["items"] = []
    
    structure["section_count"] = len(structure.get("items", []))
    
    # =========================================================================
    # LIBRARIAN INTEGRATION: Create initial section cards with planning context
    # =========================================================================
    # Cards are initialized with data from the structure generation prompt,
    # so the Librarian already has context before any content is written.
    try:
        await _initialize_librarian_cards(
            node_id=node_id,
            structure=structure,
            planning_context={
                "prompt": prompt,
                "format": format_type,
                "template": template_id,
                "title": structure.get("title", "Untitled"),
            }
        )
        print(f"📚 [Structure] Initialized {len(structure.get('items', []))} section cards via Librarian")
    except Exception as e:
        print(f"⚠️ [Structure] Librarian card initialization failed (non-fatal): {e}")
    
    return structure


async def _initialize_librarian_cards(
    node_id: str,
    structure: Dict[str, Any],
    planning_context: Dict[str, Any],
) -> None:
    """
    Initialize section cards with planning context from structure creation.
    
    This ensures the Librarian has context about each section BEFORE 
    any content is written, enabling better writer guidance.
    """
    if not node_id:
        print("⚠️ [Structure] No node_id - skipping Librarian initialization")
        return
    
    from librarian import get_librarian
    from config import get_supabase_client
    
    supabase = get_supabase_client()
    librarian = get_librarian(node_id, supabase)
    
    items = structure.get("items", [])
    if not items:
        return
    
    # Create initial cards with planning data
    await librarian.create_initial_cards_with_planning(
        items=items,
        planning_context=planning_context
    )


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
        
        "business": """
Structure for a business report:
1. Executive Summary - Key findings and recommendations at a glance
2. Introduction - Purpose and scope of the report
3. Background - Context and situation overview
4. Methodology - How data was gathered (if applicable)
5. Findings - Detailed analysis of the data/situation
6. Discussion - Interpretation and implications
7. Recommendations - Actionable next steps
8. Conclusion - Summary and final thoughts
9. Appendices - Supporting materials (if needed)
""",
        
        "research": """
Structure for a research report:
1. Abstract - Brief summary of the entire report
2. Introduction - Research question and objectives
3. Literature Review - Existing research and context
4. Methodology - Research design and methods
5. Results - Data and findings
6. Analysis - Interpretation of results
7. Discussion - Implications and limitations
8. Conclusion - Summary and future directions
9. References - Citations and sources
""",
        
        "technical": """
Structure for a technical report:
1. Executive Summary - Overview for non-technical readers
2. Introduction - Purpose and scope
3. Technical Background - Relevant concepts and context
4. Requirements/Specifications - What needs to be achieved
5. Design/Architecture - Technical approach
6. Implementation - How it was built/done
7. Testing/Validation - Verification of requirements
8. Results - Outcomes and metrics
9. Recommendations - Next steps and improvements
10. Appendices - Technical details, code, diagrams
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
        "short-story": "Create sections or parts that flow naturally. Keep it concise.",
        "screenplay": "Create scenes with location and context. Include act breaks.",
        "podcast": "Create episodes or segments with clear topics.",
        "report": "Create professional sections: Executive Summary, Introduction, Findings, Analysis, Recommendations, Conclusion.",
        "article": "Create sections with clear headings covering the topic.",
        "essay": "Create a clear introduction, body paragraphs with arguments, and conclusion.",
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
        # Novel/Story templates
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
        # Podcast templates
        {
            "id": "podcast_episode",
            "name": "Podcast Episode",
            "description": "Standard podcast episode flow"
        },
        # Report templates
        {
            "id": "business",
            "name": "Business Report",
            "description": "Executive summary, findings, and recommendations"
        },
        {
            "id": "research",
            "name": "Research Report",
            "description": "Academic structure with methodology and results"
        },
        {
            "id": "technical",
            "name": "Technical Report",
            "description": "Specifications, implementation, and documentation"
        },
    ]

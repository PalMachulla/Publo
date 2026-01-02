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
    
    Returns:
        Dictionary with:
        - title: Document title
        - format: Document format
        - items: List of structure items [{id, name, type, level}]
        - section_count: Number of sections
        - node_id: Generated node ID for this structure
    """
    import time
    import random
    import string
    from config import get_model_for_task
    from deep_agent import get_context_story_id, _node_id_ref
    
    # Get story_id from context
    story_id = get_context_story_id()
    
    # Generate new node_id for this structure
    node_id = f"story-structure-{int(time.time() * 1000)}-{''.join(random.choices(string.ascii_lowercase + string.digits, k=5))}"
    print(f"📌 [Structure] Generated new node_id: {node_id}")
    
    # Update the mutable ref so subsequent tool calls (like write_section) can use this node_id
    _node_id_ref["value"] = node_id
    print(f"📌 [Structure] Updated _node_id_ref to: {node_id}")
    
    # Get template if specified
    template_guidance = ""
    if template_id:
        template_guidance = _get_template_guidance(template_id)
    
    # Try to load connected characters from context file (written by chat.py)
    characters = None
    try:
        from agents.supabase_backend import SupabaseFilesystemBackend
        from deep_agent import get_context_user_id
        user_id = get_context_user_id()
        
        if story_id and user_id:
            backend = SupabaseFilesystemBackend(story_id=story_id, user_id=user_id)
            char_data = backend.read_file("context/connected_characters.json")
            if char_data and isinstance(char_data, dict):
                characters = [
                    {"name": name, **data} 
                    for name, data in char_data.items()
                ]
                print(f"📌 [Structure] Loaded {len(characters)} connected characters: {[c['name'] for c in characters]}")
    except Exception as e:
        print(f"⚠️ [Structure] Could not load characters (non-fatal): {e}")
    
    # Build prompt for structure generation
    structure_prompt = _build_structure_prompt(
        prompt=prompt,
        format_type=format_type,
        template_guidance=template_guidance,
        characters=characters,
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
    print(f"📚 [Structure] About to initialize Librarian cards...")
    print(f"📚 [Structure] node_id: '{node_id}', items: {len(structure.get('items', []))}")
    
    if not node_id:
        print("⚠️ [Structure] WARNING: No node_id provided - Librarian cards will NOT be created!")
    
    # =========================================================================
    # CREATE NODE IN DATABASE FIRST (required for Librarian FK constraint)
    # =========================================================================
    # The section_cards table has a foreign key to nodes, so we must ensure
    # the node exists BEFORE the Librarian tries to save cards.
    try:
        from config import get_supabase_client
        supabase = get_supabase_client()
        
        # Build document_data with structure for immediate display
        document_data = {
            "structure": structure.get("items", []),
            "format": format_type,
            "version": 1,
            "totalWordCount": 0
        }
        
        node_record = {
            "id": node_id,
            # Link the structure node to the owning canvas/project when available.
            # (Frontend persists nodes with story_id=canvas id.)
            "story_id": story_id or node_id,
            # DB node type should match the API route `/api/node/create` payload.
            "type": "storyStructure",
            "position_x": 400,  # Default position
            "position_y": 200,
            "data": {
                "label": structure.get("title", "Untitled"),
                "items": structure.get("items", []),
                "format": format_type,
                "nodeType": "story-structure"
            },
            "document_data": document_data
        }
        
        # Upsert node to ensure it exists before Librarian runs
        result = supabase.table("nodes").upsert(node_record, on_conflict="id").execute()
        print(f"✅ [Structure] Node created in DB: {node_id}")
    except Exception as e:
        print(f"⚠️ [Structure] Failed to pre-create node (Librarian may fail): {e}")
    
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
        print(f"✅ [Structure] Initialized {len(structure.get('items', []))} section cards via Librarian")
    except Exception as e:
        import traceback
        print(f"❌ [Structure] Librarian card initialization failed: {e}")
        print(f"❌ [Structure] Traceback: {traceback.format_exc()}")

    # Include node_id in return so chat.py uses the same ID
    structure["node_id"] = node_id
    
    return structure


@tool
async def update_structure(
    changes_description: str,
) -> Dict[str, Any]:
    """
    Update an EXISTING document structure based on user's requested changes.
    
    USE THIS instead of create_structure when the user wants to modify
    an existing story structure (add sections, remove sections, reorder, etc.)
    
    This tool:
    1. Fetches the current structure from the database
    2. Uses LLM to apply the requested changes intelligently
    3. Preserves existing content where possible
    4. Flags sections that need to be rewritten due to storyline changes
    5. Updates Librarian cards for new/modified sections
    
    Args:
        changes_description: What changes to make (e.g., "Add a dolphin that travels with them in the car. 
                            This changes the entire premise - they're now taking the dolphin to the ocean.")
    
    Returns:
        Dictionary with:
        - title: Updated title (if changed)
        - items: Updated list of sections
        - changes_made: Summary of changes (added, removed, modified sections)
        - sections_needing_revision: List of sections that have content but may need rewriting
        - node_id: The same node_id (structure updated in place)
    """
    from config import get_supabase_client, get_model_for_task
    from librarian import get_librarian
    from deep_agent import get_context_node_id
    
    # Get node_id from context
    node_id = get_context_node_id()
    
    if not node_id:
        return {
            "error": "No node_id provided. Cannot update structure without knowing which structure to update.",
            "hint": "Make sure a story structure is active on the canvas."
        }
    
    print(f"📝 [UpdateStructure] Updating structure {node_id}")
    print(f"📝 [UpdateStructure] Changes: {changes_description[:200]}...")
    
    # Fetch existing structure from database
    supabase = get_supabase_client()
    
    try:
        result = supabase.table("nodes").select("*").eq("id", node_id).limit(1).execute()
        if not result.data:
            return {
                "error": f"Structure not found: {node_id}",
                "hint": "The structure may have been deleted or the node_id is incorrect."
            }
        
        node = result.data[0]
        existing_data = node.get("data", {})
        document_data = node.get("document_data", {})
        
        existing_items = existing_data.get("items", []) or document_data.get("structure", [])
        existing_title = existing_data.get("label", "Untitled")
        existing_format = existing_data.get("format", "novel")
        
        print(f"📝 [UpdateStructure] Found existing structure: {existing_title} with {len(existing_items)} sections")
    except Exception as e:
        return {"error": f"Failed to fetch existing structure: {str(e)}"}
    
    # Build sections summary for LLM
    sections_summary = []
    for i, item in enumerate(existing_items):
        has_content = bool(item.get("content"))
        word_count = item.get("wordCount", 0)
        sections_summary.append({
            "id": item.get("id"),
            "name": item.get("name") or item.get("title"),
            "description": item.get("description", ""),
            "has_content": has_content,
            "word_count": word_count
        })
    
    # Build LLM prompt to generate updated structure
    update_prompt = f"""You are updating an existing story structure based on user's requested changes.

## Current Structure
Title: {existing_title}
Format: {existing_format}

Sections:
{json.dumps(sections_summary, indent=2)}

## Requested Changes
{changes_description}

## Instructions
1. Apply the user's requested changes to the structure
2. You can: add new sections, remove sections, rename sections, reorder sections
3. For sections that remain, try to preserve their IDs if the section is conceptually the same
4. For new sections, generate new IDs (use format like "ch-1", "ch-2", etc. or "sec-1", "sec-2")
5. If the overall storyline changes significantly, note which existing sections with content may need revision

Return a JSON object with:
{{
    "title": "Updated title (or same if unchanged)",
    "format": "{existing_format}",
    "items": [
        {{
            "id": "section-id",
            "name": "Section Name",
            "description": "What happens in this section",
            "level": 1,
            "order": 1
        }}
    ],
    "changes_made": {{
        "added": ["list of new section names"],
        "removed": ["list of removed section names"],
        "modified": ["list of renamed/reordered section names"]
    }},
    "sections_needing_revision": [
        {{
            "id": "section-id",
            "name": "Section Name",
            "reason": "Why this section may need rewriting"
        }}
    ],
    "storyline_impact": "Brief description of how the overall story is affected"
}}

Return ONLY valid JSON, no markdown code blocks or other text."""

    # Generate updated structure using LLM
    try:
        model = get_model_for_task("general")
        response = await model.ainvoke(update_prompt)
        response_text = response.content if hasattr(response, 'content') else str(response)
        
        # Parse the response
        updated_structure = _parse_structure_response(response_text)
    except Exception as e:
        return {"error": f"Failed to generate updated structure: {str(e)}"}
    
    # Preserve existing content in matching sections
    new_items = updated_structure.get("items", [])
    for new_item in new_items:
        new_id = new_item.get("id")
        # Find matching old item
        for old_item in existing_items:
            if old_item.get("id") == new_id:
                # Preserve content and wordCount
                if old_item.get("content"):
                    new_item["content"] = old_item["content"]
                    new_item["wordCount"] = old_item.get("wordCount", 0)
                break
    
    # Update the node in database
    try:
        # Build updated document_data
        updated_document_data = {
            "structure": new_items,
            "format": existing_format,
            "version": document_data.get("version", 1) + 1,
            "totalWordCount": sum(item.get("wordCount", 0) for item in new_items),
            "lastEditedAt": __import__('datetime').datetime.utcnow().isoformat() + "Z"
        }
        
        # Build updated data
        updated_data = {
            "label": updated_structure.get("title", existing_title),
            "items": new_items,
            "format": existing_format,
            "nodeType": "story-structure"
        }
        
        # Update the node
        supabase.table("nodes").update({
            "data": updated_data,
            "document_data": updated_document_data
        }).eq("id", node_id).execute()
        
        print(f"✅ [UpdateStructure] Updated node in database")
    except Exception as e:
        return {"error": f"Failed to save updated structure: {str(e)}"}
    
    # Update Librarian cards for new/modified sections
    try:
        librarian = get_librarian(node_id, supabase)
        
        # Create cards for new sections
        added_section_ids = set()
        for section_name in updated_structure.get("changes_made", {}).get("added", []):
            # Find the item with this name
            for item in new_items:
                if item.get("name") == section_name or item.get("title") == section_name:
                    added_section_ids.add(item.get("id"))
        
        if added_section_ids:
            # Create cards for new sections only
            new_section_items = [item for item in new_items if item.get("id") in added_section_ids]
            if new_section_items:
                await librarian.create_initial_cards_with_planning(
                    items=new_section_items,
                    planning_context={
                        "prompt": changes_description,
                        "format": existing_format,
                        "title": updated_structure.get("title", existing_title),
                        "is_update": True
                    }
                )
                print(f"✅ [UpdateStructure] Created {len(new_section_items)} new Librarian cards")
    except Exception as e:
        print(f"⚠️ [UpdateStructure] Librarian card update failed (non-critical): {e}")
    
    # Prepare result
    result = {
        "title": updated_structure.get("title", existing_title),
        "format": existing_format,
        "items": new_items,
        "section_count": len(new_items),
        "changes_made": updated_structure.get("changes_made", {}),
        "sections_needing_revision": updated_structure.get("sections_needing_revision", []),
        "storyline_impact": updated_structure.get("storyline_impact", ""),
        "node_id": node_id
    }
    
    print(f"✅ [UpdateStructure] Complete. Changes: {result['changes_made']}")
    
    return result


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
    characters: Optional[List[Dict[str, Any]]] = None,
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
    
    # Build character context if available
    character_context = ""
    if characters:
        char_lines = []
        for char in characters:
            name = char.get("name", "Unknown")
            role = char.get("role", "Active")
            bio = char.get("bio", "")[:200] if char.get("bio") else ""
            char_lines.append(f"- **{name}** ({role}): {bio}" if bio else f"- **{name}** ({role})")
        
        character_context = f"""
## Characters to Include
These characters MUST be woven into the story structure:
{chr(10).join(char_lines)}

Plan which characters appear in which chapters. Consider:
- Whose POV/perspective is featured in each chapter
- Character arcs and development across the story
- Key moments for each character
"""
    
    return f"""Create a detailed document structure for this story:

"{prompt}"

Format: {format_type}
{format_guidance.get(format_type, '')}
{character_context}
{template_guidance if template_guidance else ''}

## CRITICAL: Section Summaries
Each section MUST have a detailed "summary" field (2-3 sentences) that describes:
1. WHAT happens in this section (key events/plot points)
2. WHO is involved (which characters appear)
3. WHY it matters to the overall story arc

These summaries will be used to maintain consistency when writing each section.

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
      "summary": "Detailed 2-3 sentence summary of what happens in this chapter, who appears, and how it advances the story. Be specific!",
      "characters": ["Character Name 1", "Character Name 2"],
      "newCharactersIntroduced": [
        {{"name": "The Landlord", "description": "Axel's grumpy apartment landlord who threatens eviction"}},
        {{"name": "A Fan", "description": "Enthusiastic audience member who approaches the band"}}
      ],
      "mood": "tense/hopeful/mysterious/etc"
    }},
    ...
  ]
}}

IMPORTANT for newCharactersIntroduced:
- These are NEW minor/supporting characters who appear in this scene but aren't main cast
- Examples: "The Bartender", "A Security Guard", "Marcus's Ex-Girlfriend", "The Venue Owner"
- Include a brief description of their role in the scene
- Don't include the main cast characters here - they go in "characters" array
- Leave empty [] if no new characters are introduced in that section

Guidelines:
- Create a compelling title
- Generate 8-15 sections/chapters appropriate for the format
- Each item needs: id (unique), name (title), type, level (1 for main sections)
- **EACH ITEM MUST HAVE a detailed "summary" field** - this is critical!
- Include which characters appear in each section
- Add a mood for each section
- Plan the story arc: setup → rising action → climax → resolution
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

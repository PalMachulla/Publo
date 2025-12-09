"""
Writer Agent

Handles content and structure generation using LLM.

=============================================================================
PROGRESSIVE GENERATION (NEW)
=============================================================================

This module now supports two modes:
1. Single-shot: `generate_structure()` - Returns complete structure at once
2. Progressive: `plan_outline()` + `generate_section_summary()` - Step by step

The progressive mode is used by the streaming endpoint to show real-time
progress as each section is generated.

Flow:
  plan_outline() → Returns title + section names
       ↓
  generate_section_summary() × N → Each section's summary
       ↓
  Complete structure with all summaries
"""

import os
import json
import uuid
from typing import Optional, List, Dict, Any

# Try to import LangChain components
try:
    from langchain_anthropic import ChatAnthropic
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage
    HAS_LANGCHAIN = True
except ImportError:
    HAS_LANGCHAIN = False
    print("⚠️ [Writer] LangChain not available, using mock responses")


# ============================================================
# LLM SETUP
# ============================================================

def get_llm(temperature: float = 0.7, fast: bool = False):
    """
    Get the best available LLM
    
    Args:
        temperature: Creativity level (0.0-1.0)
        fast: If True, use faster/cheaper model for simple tasks
    """
    if not HAS_LANGCHAIN:
        return None
    
    # Try Anthropic first
    if os.getenv("ANTHROPIC_API_KEY"):
        model = "claude-3-5-haiku-latest" if fast else "claude-sonnet-4-20250514"
        return ChatAnthropic(
            model=model,
            temperature=temperature,
            max_tokens=4000 if not fast else 1000
        )
    
    # Fall back to OpenAI
    if os.getenv("OPENAI_API_KEY"):
        model = "gpt-4o-mini" if fast else "gpt-4o"
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            max_tokens=4000 if not fast else 1000
        )
    
    return None


# ============================================================
# PROGRESSIVE STRUCTURE GENERATION (NEW)
# ============================================================

async def plan_outline(
    prompt: str,
    format_type: str,
    template: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Step 1 of progressive generation: Plan the structure outline.
    
    Returns title, logline, and section names (without summaries).
    This is fast because summaries are generated separately.
    
    Args:
        prompt: User's request
        format_type: Document type (novel, screenplay, etc.)
        template: Optional template object from registry
    
    Returns:
        {
            "title": "Story Title",
            "logline": "One-sentence summary",
            "sections": ["Section 1", "Section 2", ...]
        }
    """
    print(f"📐 [Writer] Planning outline for: {format_type}")
    
    llm = get_llm(temperature=0.5, fast=True)  # Use fast model for planning
    
    if not llm:
        # Mock response
        return {
            "title": "Untitled Story",
            "logline": "A story waiting to be told.",
            "sections": ["Beginning", "Middle", "End"]
        }
    
    # Build template context
    template_context = ""
    if template:
        template_context = f"""
Use this template as a guide:
- Template: {template.name}
- Description: {template.description}
"""
    
    # Format-specific section counts
    section_guidance = {
        "novel": "Create 8-15 chapter names",
        "short-story": "Create 3-7 section names",
        "screenplay": "Create 8-12 scene names (use INT./EXT. format)",
        "podcast": "Create 5-9 segment names",
        "blog": "Create 4-7 section names",
        "essay": "Create 4-6 section names",
    }
    
    guidance = section_guidance.get(format_type, "Create 4-8 section names")
    
    system_prompt = f"""You are a story structure expert.

Based on the user's idea, create an outline plan. {guidance}.
{template_context}

Return ONLY valid JSON in this exact format:
{{
    "title": "A compelling, evocative title",
    "logline": "A one-sentence hook that captures the essence",
    "sections": ["Section Name 1", "Section Name 2", "Section Name 3"]
}}

Guidelines:
- Title should be memorable and intriguing
- Logline should make people want to read more
- Section names should be descriptive (not just "Chapter 1")
- Names should hint at content without spoiling
- Return ONLY JSON, no markdown or explanation"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Create an outline for: {prompt}")
    ]
    
    try:
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        
        # Clean markdown if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        plan = json.loads(content.strip())
        print(f"✅ [Writer] Planned outline: {plan.get('title')} with {len(plan.get('sections', []))} sections")
        return plan
        
    except Exception as e:
        print(f"❌ [Writer] Plan outline failed: {e}")
        # Return basic structure on error
        return {
            "title": "Untitled",
            "logline": prompt[:100],
            "sections": ["Beginning", "Middle", "End"]
        }


async def generate_section_summary(
    title: str,
    section_name: str,
    section_index: int,
    total_sections: int,
    previous_sections: List[Dict[str, Any]],
    format_type: str,
    prompt: str
) -> str:
    """
    Step 2+ of progressive generation: Generate summary for one section.
    
    This is called for each section, allowing real-time streaming updates.
    
    Args:
        title: Story title
        section_name: Name of this section
        section_index: Index (0-based)
        total_sections: Total number of sections
        previous_sections: Already-generated sections with summaries
        format_type: Document type
        prompt: Original user prompt
    
    Returns:
        Summary string (2-3 sentences)
    """
    print(f"✍️ [Writer] Generating summary {section_index + 1}/{total_sections}: {section_name}")
    
    llm = get_llm(temperature=0.7, fast=True)  # Use fast model for summaries
    
    if not llm:
        return f"Content for {section_name} will go here."
    
    # Build context from previous sections
    prev_context = ""
    if previous_sections:
        prev_summaries = "\n".join([
            f"- {s['name']}: {s.get('summary', 'No summary')}"
            for s in previous_sections[-3:]  # Last 3 for context
        ])
        prev_context = f"""
Previous sections:
{prev_summaries}

Ensure this section continues naturally from what came before."""
    
    # Position-based guidance
    position_pct = section_index / max(total_sections - 1, 1)
    if position_pct < 0.2:
        position_hint = "This is near the beginning - establish characters, setting, and initial situation."
    elif position_pct < 0.4:
        position_hint = "This is early-middle - introduce complications and develop conflicts."
    elif position_pct < 0.6:
        position_hint = "This is the middle - raise stakes, deepen relationships, reach a turning point."
    elif position_pct < 0.8:
        position_hint = "This is late-middle - build toward climax, increase tension."
    else:
        position_hint = "This is near the end - resolve conflicts, provide closure."
    
    system_prompt = f"""You are writing section summaries for a {format_type}.

Story: "{title}"
Original concept: {prompt}

{position_hint}
{prev_context}

Write a 2-3 sentence summary for "{section_name}".
The summary should:
- Describe what happens in this section specifically
- Be concrete and vivid (not vague)
- Set up the next section naturally
- Match the tone of the overall story

Return ONLY the summary text, no labels, quotes, or formatting."""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Write the summary for: {section_name}")
    ]
    
    try:
        response = await llm.ainvoke(messages)
        summary = response.content.strip()
        
        # Clean up any accidental formatting
        summary = summary.strip('"\'')
        if summary.startswith(f"{section_name}:"):
            summary = summary[len(f"{section_name}:"):].strip()
        
        print(f"✅ [Writer] Generated summary: {summary[:50]}...")
        return summary
        
    except Exception as e:
        print(f"❌ [Writer] Summary generation failed: {e}")
        return f"This section covers key developments in the story."


# ============================================================
# EXISTING FUNCTIONS (PRESERVED)
# ============================================================

async def generate_content(
    prompt: str,
    section_name: str = "Content",
    context: Optional[str] = None,
    existing_content: Optional[str] = None
) -> str:
    """
    Generate content for a section.
    
    Args:
        prompt: User's writing prompt
        section_name: Name of the section being written
        context: Optional canvas/document context
        existing_content: Optional existing content to expand
    
    Returns:
        Generated content as string
    """
    print(f"✍️ [Writer] Generating content for: {section_name}")
    
    llm = get_llm(temperature=0.7)
    
    if not llm:
        # Mock response for testing
        return f"# {section_name}\n\nThis is placeholder content for '{prompt}'. LLM not configured."
    
    # Build system prompt
    system_prompt = f"""You are a creative writer helping to write content for a story.
You are writing the section: {section_name}

Guidelines:
- Write engaging, vivid prose
- Maintain consistent tone and style
- Include sensory details and dialogue where appropriate
- Keep the narrative flowing naturally
"""
    
    if context:
        system_prompt += f"\n\nContext from the document:\n{context}"
    
    if existing_content:
        system_prompt += f"\n\nExisting content to continue from:\n{existing_content}"
    
    # Generate content
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=prompt)
    ]
    
    try:
        response = await llm.ainvoke(messages)
        content = response.content
        print(f"✅ [Writer] Generated {len(content)} characters")
        return content
    except Exception as e:
        print(f"❌ [Writer] Generation failed: {e}")
        raise


async def generate_structure(
    prompt: str,
    format_type: str = "novel",
    template_id: Optional[str] = None,
    context: Optional[str] = None
) -> dict:
    """
    Generate a story structure (outline) based on format and template.
    
    This is the SINGLE-SHOT version that returns everything at once.
    For progressive generation, use plan_outline() + generate_section_summary().
    
    Args:
        prompt: User's request (e.g., "Write a mystery novel")
        format_type: Type of document (novel, screenplay, etc.)
        template_id: Optional template ID (three-act, heros-journey, etc.)
        context: Optional context
    
    Returns:
        Structure as dict with items array
    """
    print(f"📐 [Writer] Generating {format_type} structure with template: {template_id or 'default'}")
    
    # Import template info
    try:
        from ..schemas.template_registry import get_template_by_id, get_format_label
        template = get_template_by_id(format_type, template_id) if template_id else None
        template_name = template.name if template else "Standard"
        template_desc = template.description if template else ""
    except ImportError:
        template = None
        template_name = "Standard"
        template_desc = ""
    
    llm = get_llm(temperature=0.5)  # Lower temp for more structured output
    
    if not llm:
        # Mock response for testing
        return create_mock_structure(format_type, template_id, prompt)
    
    # Build prompt for structure generation based on template
    system_prompt = f"""You are a story structure expert. Generate a detailed outline for a {format_type}.

Template: {template_name}
{f'Description: {template_desc}' if template_desc else ''}

Output format (JSON):
{{
  "format": "{format_type}",
  "template": "{template_id or 'default'}",
  "title": "The story title",
  "logline": "A one-sentence summary of the story",
  "items": [
    {{
      "id": "unique-id",
      "name": "Chapter/Scene/Act name",
      "level": 0,
      "summary": "Brief description of what happens (2-3 sentences)",
      "children": []
    }}
  ]
}}

"""
    
    # Add template-specific guidance
    system_prompt += get_template_guidance(format_type, template_id)
    
    system_prompt += "\n\nRespond ONLY with valid JSON, no markdown or explanation."
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Create a {format_type} structure for: {prompt}")
    ]
    
    try:
        response = await llm.ainvoke(messages)
        content = response.content
        
        # Parse JSON response
        # Clean up response (remove markdown if present)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        structure = json.loads(content.strip())
        
        # Ensure IDs are unique
        structure = ensure_unique_ids(structure)
        
        print(f"✅ [Writer] Generated structure with {len(structure.get('items', []))} items")
        return structure
        
    except json.JSONDecodeError as e:
        print(f"⚠️ [Writer] Failed to parse structure JSON: {e}")
        return create_mock_structure(format_type, template_id, prompt)
    except Exception as e:
        print(f"❌ [Writer] Structure generation failed: {e}")
        raise


# ============================================================
# PROGRESSIVE STRUCTURE (FULL FLOW HELPER)
# ============================================================

async def generate_structure_progressive(
    prompt: str,
    format_type: str = "novel",
    template_id: Optional[str] = None,
    on_plan: Optional[callable] = None,
    on_section: Optional[callable] = None
) -> dict:
    """
    Generate structure progressively with callbacks.
    
    This is a convenience function that combines plan_outline() and
    generate_section_summary() with optional callbacks for UI updates.
    
    Args:
        prompt: User's request
        format_type: Document type
        template_id: Optional template ID
        on_plan: Callback(plan) when outline is ready
        on_section: Callback(index, section) when each section completes
    
    Returns:
        Complete structure dict
    """
    # Get template
    template = None
    try:
        from ..schemas.template_registry import get_template_by_id
        if template_id:
            template = get_template_by_id(format_type, template_id)
    except ImportError:
        pass
    
    # Step 1: Plan outline
    plan = await plan_outline(prompt, format_type, template)
    
    if on_plan:
        on_plan(plan)
    
    title = plan.get("title", "Untitled")
    logline = plan.get("logline", "")
    sections = plan.get("sections", [])
    
    # Step 2: Generate each section summary
    items = []
    for i, section_name in enumerate(sections):
        summary = await generate_section_summary(
            title=title,
            section_name=section_name,
            section_index=i,
            total_sections=len(sections),
            previous_sections=items,
            format_type=format_type,
            prompt=prompt
        )
        
        section = {
            "id": f"section-{i}-{uuid.uuid4().hex[:6]}",
            "name": section_name,
            "level": 0,
            "summary": summary
        }
        items.append(section)
        
        if on_section:
            on_section(i, section)
    
    # Return complete structure
    return {
        "format": format_type,
        "template": template_id,
        "title": title,
        "logline": logline,
        "items": items
    }


# ============================================================
# HELPER FUNCTIONS (PRESERVED)
# ============================================================

def get_template_guidance(format_type: str, template_id: Optional[str]) -> str:
    """Get specific guidance for generating structure based on template"""
    
    guidance = {
        # Novel templates
        ('novel', 'three-act'): """
Structure with THREE ACTS:
- Act 1 (Setup, ~25%): Introduction, inciting incident, first plot point
- Act 2 (Confrontation, ~50%): Rising action, midpoint, complications
- Act 3 (Resolution, ~25%): Climax, falling action, resolution
Create 8-12 chapters distributed across the three acts.""",
        
        ('novel', 'heros-journey'): """
Follow the Hero's Journey (12 stages):
1. Ordinary World - Hero's normal life
2. Call to Adventure - Challenge appears
3. Refusal of the Call - Hero hesitates
4. Meeting the Mentor - Guide appears
5. Crossing the Threshold - Hero commits
6. Tests, Allies, Enemies - Challenges and friends
7. Approach to Inmost Cave - Preparing for ordeal
8. Ordeal - Major crisis
9. Reward - Hero gains something
10. The Road Back - Returning home
11. Resurrection - Final test
12. Return with Elixir - Hero transformed""",
        
        ('novel', 'save-the-cat'): """
Follow Save the Cat beats:
1. Opening Image - Snapshot of before
2. Theme Stated - What story is about
3. Setup - Hero's world
4. Catalyst - Inciting incident
5. Debate - Hero's hesitation
6. Break into Two - Hero decides
7. B Story - Love/friendship subplot
8. Fun and Games - Promise of premise
9. Midpoint - False victory/defeat
10. Bad Guys Close In - Complications
11. All Is Lost - Darkest moment
12. Dark Night of the Soul - Hero reflects
13. Break into Three - Solution found
14. Finale - Final confrontation
15. Final Image - Snapshot of after""",
        
        # Screenplay templates
        ('screenplay', 'feature'): """
Create a three-act screenplay structure:
- ACT ONE (pages 1-30): Setup, inciting incident
- ACT TWO (pages 30-90): Confrontation, midpoint reversal
- ACT THREE (pages 90-120): Resolution, climax
Include 8-12 major scenes with INT./EXT. style naming.""",
        
        ('screenplay', 'tv-pilot'): """
Create a TV pilot structure:
- TEASER: Cold open hook
- ACT ONE: Establish world and characters
- ACT TWO: Introduce conflict
- ACT THREE: Complications
- ACT FOUR: Climax and cliffhanger
Include A-plot and B-plot threads.""",
        
        # Podcast templates
        ('podcast', 'interview'): """
Create an interview podcast structure:
1. Cold Open / Teaser (hook from interview)
2. Intro Music + Host Welcome
3. Guest Introduction
4. Main Interview Segment 1 (background)
5. Main Interview Segment 2 (main topic)
6. Main Interview Segment 3 (deep dive)
7. Rapid Fire / Quick Questions
8. Guest's Recommendations
9. Outro + Call to Action""",
        
        ('podcast', 'storytelling'): """
Create a narrative podcast structure:
1. Cold Open (dramatic hook)
2. Introduction (set the scene)
3. Act 1 (background, context)
4. Act 2 (the journey, complications)
5. Act 3 (climax, revelation)
6. Denouement (reflection, meaning)
7. Outro (credits, next episode tease)""",

        # Short story templates
        ('short-story', 'classic'): """
Create a classic short story structure:
1. Opening Hook - Grab attention immediately
2. Setup - Establish character and situation
3. Rising Action - Build tension
4. Climax - The turning point
5. Resolution - The aftermath""",

        ('short-story', 'twist'): """
Create a twist-ending short story:
1. Ordinary Beginning - Establish normalcy
2. Subtle Hints - Plant seeds for the twist
3. Building Tension - Increase stakes
4. Misdirection - Lead reader one way
5. The Twist - Reveal the unexpected
6. Recontextualization - Everything makes new sense""",
    }
    
    key = (format_type, template_id)
    if key in guidance:
        return f"\nTemplate Guidelines:\n{guidance[key]}"
    
    # Default guidance by format
    format_defaults = {
        'novel': "Create 8-12 chapters with clear narrative progression.",
        'short-story': "Create 3-7 sections with tight narrative arc.",
        'screenplay': "Use INT./EXT. scene headings. Include 8-12 major scenes.",
        'podcast': "Create 6-9 segments with clear transitions.",
        'report': "Create logical sections: Introduction, Analysis, Conclusions, Recommendations.",
        'article': "Create 5-7 sections with engaging headers.",
        'essay': "Create introduction, 3-4 body sections, conclusion.",
    }
    
    return f"\nGuidelines:\n{format_defaults.get(format_type, 'Create logical sections with clear progression.')}"


def create_mock_structure(format_type: str, template_id: Optional[str], prompt: str) -> dict:
    """Create a mock structure for testing when LLM is not available"""
    
    if format_type == "novel":
        return {
            "format": "novel",
            "template": template_id or "three-act",
            "title": "Untitled Novel",
            "logline": "A story waiting to be told.",
            "items": [
                {"id": "ch1", "name": "Chapter 1: The Beginning", "level": 0, "summary": "Introduction to the world and main character."},
                {"id": "ch2", "name": "Chapter 2: The Call", "level": 0, "summary": "The inciting incident that changes everything."},
                {"id": "ch3", "name": "Chapter 3: Crossing the Threshold", "level": 0, "summary": "Hero commits to the journey."},
                {"id": "ch4", "name": "Chapter 4: Tests and Allies", "level": 0, "summary": "Challenges and new friendships."},
                {"id": "ch5", "name": "Chapter 5: The Ordeal", "level": 0, "summary": "Major crisis point."},
                {"id": "ch6", "name": "Chapter 6: The Reward", "level": 0, "summary": "Victory and transformation."},
                {"id": "ch7", "name": "Chapter 7: The Road Back", "level": 0, "summary": "Journey home begins."},
                {"id": "ch8", "name": "Chapter 8: Resolution", "level": 0, "summary": "Final confrontation and ending."},
            ]
        }
    elif format_type == "short-story":
        return {
            "format": "short-story",
            "template": template_id or "classic",
            "title": "Untitled Short Story",
            "logline": "A brief tale of transformation.",
            "items": [
                {"id": "sec1", "name": "The Hook", "level": 0, "summary": "An intriguing opening that draws the reader in."},
                {"id": "sec2", "name": "The Setup", "level": 0, "summary": "Establish the character and their world."},
                {"id": "sec3", "name": "The Complication", "level": 0, "summary": "Something disrupts the normal order."},
                {"id": "sec4", "name": "The Climax", "level": 0, "summary": "The moment of greatest tension."},
                {"id": "sec5", "name": "The Resolution", "level": 0, "summary": "How things settle into a new normal."},
            ]
        }
    elif format_type == "podcast":
        return {
            "format": "podcast",
            "template": template_id or "interview",
            "title": "Untitled Podcast",
            "logline": "An engaging conversation.",
            "items": [
                {"id": "seg1", "name": "Cold Open", "level": 0, "summary": "Hook the audience with a teaser."},
                {"id": "seg2", "name": "Intro & Welcome", "level": 0, "summary": "Host introduction and episode overview."},
                {"id": "seg3", "name": "Guest Introduction", "level": 0, "summary": "Introduce the guest and their background."},
                {"id": "seg4", "name": "Main Discussion", "level": 0, "summary": "Deep dive into the main topic."},
                {"id": "seg5", "name": "Rapid Fire Questions", "level": 0, "summary": "Quick, fun questions."},
                {"id": "seg6", "name": "Outro & Call to Action", "level": 0, "summary": "Wrap up and next steps."},
            ]
        }
    else:
        return {
            "format": format_type,
            "template": template_id or "default",
            "title": f"Untitled {format_type.title()}",
            "logline": "Content to be developed.",
            "items": [
                {"id": "sec1", "name": "Section 1: Introduction", "level": 0, "summary": "Set the stage."},
                {"id": "sec2", "name": "Section 2: Main Content", "level": 0, "summary": "Core material."},
                {"id": "sec3", "name": "Section 3: Conclusion", "level": 0, "summary": "Wrap up and takeaways."},
            ]
        }


def ensure_unique_ids(structure: dict) -> dict:
    """Ensure all items have unique IDs"""
    
    def process_items(items: list, prefix: str = "") -> list:
        for i, item in enumerate(items):
            if not item.get("id"):
                item["id"] = f"{prefix}item-{i}-{uuid.uuid4().hex[:6]}"
            if item.get("children"):
                item["children"] = process_items(item["children"], f"{item['id']}-")
        return items
    
    if "items" in structure:
        structure["items"] = process_items(structure["items"])
    
    return structure
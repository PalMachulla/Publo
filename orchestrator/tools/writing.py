"""
Writing Tools

Tools for content generation (write_section, edit_section).
"""

from typing import Optional, Dict, Any
from langchain_core.tools import tool


@tool
async def write_section(
    section_id: str,
    guidance: str,
    style_notes: Optional[str] = None,
    target_length: str = "medium",
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Write content for a story section.
    
    IMPORTANT: Call get_story_context first to understand established story elements.
    
    Args:
        section_id: The section to write
        guidance: What to write (e.g., "confrontation scene between Marcus and Elena")
        style_notes: Optional style guidance (e.g., "tense, short sentences")
        target_length: "short" (~500 words), "medium" (~1500 words), "long" (~3000 words)
        node_id: Story node ID (injected by agent)
    
    Returns:
        Dictionary with:
        - section_id: The written section
        - content: Generated content
        - word_count: Word count
        - status: "complete"
    """
    from librarian import get_librarian
    from config import get_supabase_client, get_model_for_task
    from streaming import format_sse, SSEEventType
    from .story_context import format_context_for_prompt
    
    supabase = get_supabase_client()
    librarian = get_librarian(node_id, supabase)
    
    # Get section metadata
    section_info = await _get_section_info(section_id, supabase)
    section_name = section_info.get("name", "Section")
    
    # Get context from Librarian
    context = await librarian.get_writer_context(section_id)
    
    # Build generation prompt
    prompt = _build_writing_prompt(
        section_name=section_name,
        guidance=guidance,
        context=context,
        style_notes=style_notes,
        target_length=target_length,
    )
    
    # Generate with streaming
    model = get_model_for_task("writing")
    
    content_chunks = []
    async for chunk in model.astream(prompt):
        chunk_text = chunk.content if hasattr(chunk, 'content') else str(chunk)
        content_chunks.append(chunk_text)
        # Note: SSE events are streamed through the API layer
    
    full_content = "".join(content_chunks)
    
    # Update Librarian with new content
    await librarian.analyze_and_update(section_id, full_content, section_name)
    
    # Store content in database
    await _store_section_content(section_id, full_content, supabase)
    
    return {
        "section_id": section_id,
        "content": full_content,
        "word_count": len(full_content.split()),
        "status": "complete",
    }


@tool
async def edit_section(
    section_id: str,
    instructions: str,
    preserve_length: bool = True,
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Edit existing content in a section based on instructions.
    
    Args:
        section_id: The section to edit
        instructions: What changes to make (e.g., "make the dialogue more tense")
        preserve_length: Try to maintain similar word count
        node_id: Story node ID (injected by agent)
    
    Returns:
        Dictionary with:
        - section_id: The edited section
        - content: New content
        - word_count: New word count
        - status: "complete"
    """
    from librarian import get_librarian
    from config import get_supabase_client, get_model_for_task
    
    supabase = get_supabase_client()
    librarian = get_librarian(node_id, supabase)
    
    # Get existing content
    existing_content = await _get_section_content(section_id, supabase)
    if not existing_content:
        return {
            "section_id": section_id,
            "content": "",
            "word_count": 0,
            "status": "error",
            "error": "No existing content found to edit"
        }
    
    original_word_count = len(existing_content.split())
    
    # Get context
    context = await librarian.get_writer_context(section_id)
    
    # Build edit prompt
    prompt = _build_edit_prompt(
        existing_content=existing_content,
        instructions=instructions,
        context=context,
        preserve_length=preserve_length,
        original_word_count=original_word_count,
    )
    
    # Generate
    model = get_model_for_task("writing")
    
    content_chunks = []
    async for chunk in model.astream(prompt):
        chunk_text = chunk.content if hasattr(chunk, 'content') else str(chunk)
        content_chunks.append(chunk_text)
    
    full_content = "".join(content_chunks)
    
    # Update Librarian
    section_name = context.get("section_card", {}).get("section_name", section_id)
    await librarian.analyze_and_update(section_id, full_content, section_name)
    
    # Store
    await _store_section_content(section_id, full_content, supabase)
    
    return {
        "section_id": section_id,
        "content": full_content,
        "word_count": len(full_content.split()),
        "original_word_count": original_word_count,
        "status": "complete",
    }


# ========================================
# Helper Functions
# ========================================

async def _get_section_info(section_id: str, supabase) -> Dict[str, Any]:
    """Get section metadata from database."""
    try:
        # Try document_sections first
        result = supabase.table("document_sections") \
            .select("*") \
            .eq("id", section_id) \
            .limit(1) \
            .execute()
        
        if result.data:
            return result.data[0]
        return {"id": section_id, "name": "Section"}
    except:
        return {"id": section_id, "name": "Section"}


async def _get_section_content(section_id: str, supabase) -> Optional[str]:
    """Get existing section content."""
    try:
        result = supabase.table("document_sections") \
            .select("content") \
            .eq("id", section_id) \
            .limit(1) \
            .execute()
        
        if result.data:
            return result.data[0].get("content")
        return None
    except:
        return None


async def _store_section_content(section_id: str, content: str, supabase):
    """Store section content in database."""
    try:
        supabase.table("document_sections") \
            .update({"content": content}) \
            .eq("id", section_id) \
            .execute()
    except Exception as e:
        print(f"❌ [Writing] Failed to store content: {e}")


def _build_writing_prompt(
    section_name: str,
    guidance: str,
    context: Dict[str, Any],
    style_notes: Optional[str],
    target_length: str,
) -> str:
    """Build the prompt for content generation."""
    from .story_context import format_context_for_prompt
    
    length_guidance = {
        "short": "approximately 500 words",
        "medium": "approximately 1500 words",
        "long": "approximately 3000 words",
    }
    
    context_str = format_context_for_prompt(context)
    
    return f"""Write the section "{section_name}" for this story.

## User's Request
{guidance}

## Story Context
{context_str}

## Constraints
- Target length: {length_guidance.get(target_length, 'approximately 1500 words')}
- Maintain established character voices and traits
- Stay consistent with established timeline and facts
{f'- Style notes: {style_notes}' if style_notes else ''}

## Instructions
Write the section now. Focus on engaging prose that advances the story.
Use proper formatting (paragraphs, dialogue formatting, etc.).
Include sensory details and emotional depth.
Maintain pacing appropriate to the scene.
"""


def _build_edit_prompt(
    existing_content: str,
    instructions: str,
    context: Dict[str, Any],
    preserve_length: bool,
    original_word_count: int,
) -> str:
    """Build the prompt for content editing."""
    from .story_context import format_context_for_prompt
    
    context_str = format_context_for_prompt(context)
    
    length_instruction = ""
    if preserve_length:
        length_instruction = f"- Maintain approximately the same length ({original_word_count} words)"
    
    return f"""Edit the following content based on the instructions provided.

## Existing Content
{existing_content}

## Edit Instructions
{instructions}

## Story Context (for consistency)
{context_str}

## Constraints
{length_instruction}
- Preserve the overall narrative structure
- Maintain character consistency
- Keep any plot-critical elements

## Instructions
Rewrite the content with the requested changes.
Return ONLY the new content, no explanations.
"""

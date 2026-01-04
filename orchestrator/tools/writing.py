"""
Writing Tools

Tools for content generation (write_section, edit_section).
Supports streaming content chunks for real-time document updates.
"""

from typing import Optional, Dict, Any, AsyncIterator, Tuple
from langchain_core.tools import tool
import json
import time


@tool
async def write_section(
    section_id: str,
    section_name: str,
    guidance: str,
    style_notes: Optional[str] = None,
    target_length: str = "medium",
) -> Dict[str, Any]:
    """
    Write content for a story section.
    
    IMPORTANT: 
    - Call get_story_context first to understand established story elements.
    - You MUST provide BOTH section_id AND section_name that match each other.
    - Check the section table to ensure the ID matches the name.
    
    Args:
        section_id: The EXACT section ID from the sections table (e.g., "sec-2" for Introduction)
        section_name: The section name (e.g., "Introduction") - must match the section_id
        guidance: What to write (e.g., "confrontation scene between Marcus and Elena")
        style_notes: Optional style guidance (e.g., "tense, short sentences")
        target_length: "short" (~500 words), "medium" (~1500 words), "long" (~3000 words)
    
    Returns:
        Dictionary with:
        - section_id: The written section
        - content: Generated content
        - word_count: Word count
        - status: "complete"
    """
    # Get node_id from context (set by deep_agent before tool execution)
    from deep_agent import get_context_node_id
    node_id = get_context_node_id()
    
    print(f"📝 [write_section] Called with section_id='{section_id}', section_name='{section_name}', node_id='{node_id}'")
    try:
        from librarian import get_librarian
        from config import get_supabase_client, get_model_for_task
        from streaming import format_sse, SSEEventType
        from .story_context import format_context_for_prompt
    except Exception as e:
        return {"error": f"Import error: {str(e)}", "status": "error"}
    
    try:
        supabase = get_supabase_client()
        librarian = get_librarian(node_id, supabase)
    except Exception as e:
        return {"error": f"Failed to create librarian: {str(e)}", "status": "error"}
    
    # Get section metadata
    try:
        section_info = await _get_section_info(section_id, supabase)
        section_name = section_info.get("name", "Section")
    except Exception as e:
        section_name = "Section"
    
    # Get context from Librarian
    try:
        context = await librarian.get_writer_context(section_id)
    except Exception as e:
        context = {}
    
    # Build generation prompt
    prompt = _build_writing_prompt(
        section_name=section_name,
        guidance=guidance,
        context=context,
        style_notes=style_notes,
        target_length=target_length,
    )
    
    # Generate with streaming
    try:
        model = get_model_for_task("writing")
        
        content_chunks = []
        async for chunk in model.astream(prompt):
            chunk_text = chunk.content if hasattr(chunk, 'content') else str(chunk)
            content_chunks.append(chunk_text)
            # Note: SSE events are streamed through the API layer
        
        full_content = "".join(content_chunks)
    except Exception as e:
        return {"error": f"Content generation failed: {str(e)}", "status": "error"}
    
    # Update Librarian with new content
    try:
        await librarian.analyze_and_update(section_id, full_content, section_name)
    except Exception as e:
        pass  # Non-critical: Librarian update failure shouldn't block content
    
    # Store content in database
    await _store_section_content(section_id, full_content, supabase, node_id)

    return {
        "section_id": section_id,
        "content": full_content,
        "word_count": len(full_content.split()),
        "status": "complete",
    }


async def write_section_streaming(
    section_id: str,
    section_name: str,
    guidance: str,
    style_notes: Optional[str] = None,
    target_length: str = "medium",
    node_id: str = "",  # Optional override, will use context if empty
) -> AsyncIterator[Tuple[str, Dict[str, Any]]]:
    """
    Streaming version of write_section that yields chunks as they're generated.
    
    This is NOT a @tool - it's called internally by the agent when streaming is needed.
    
    Yields:
        Tuples of (event_type, data):
        - ("content_chunk", {"section_id": str, "chunk": str})
        - ("content_complete", {"section_id": str, "word_count": int, "content": str})
        - ("error", {"error": str})
    """
    # Get node_id from context if not provided
    if not node_id:
        from deep_agent import get_context_node_id
        node_id = get_context_node_id()
    
    print(f"📝 [write_section_streaming] Called with section_id='{section_id}', section_name='{section_name}', node_id='{node_id}'")
    
    try:
        from librarian import get_librarian
        from config import get_supabase_client, get_model_for_task
    except Exception as e:
        yield ("error", {"error": f"Import error: {str(e)}"})
        return
    
    try:
        supabase = get_supabase_client()
        librarian = get_librarian(node_id, supabase)
    except Exception as e:
        yield ("error", {"error": f"Failed to create librarian: {str(e)}"})
        return
    
    # Get section metadata
    try:
        section_info = await _get_section_info(section_id, supabase)
        actual_section_name = section_info.get("name", section_name)
    except Exception as e:
        actual_section_name = section_name
    
    # Get context from Librarian
    try:
        context = await librarian.get_writer_context(section_id)
    except Exception as e:
        context = {}
    
    # Build generation prompt
    prompt = _build_writing_prompt(
        section_name=actual_section_name,
        guidance=guidance,
        context=context,
        style_notes=style_notes,
        target_length=target_length,
    )
    
    # Generate with streaming - yield chunks as they come
    try:
        model = get_model_for_task("writing")
        
        content_chunks = []
        async for chunk in model.astream(prompt):
            chunk_text = chunk.content if hasattr(chunk, 'content') else str(chunk)
            if chunk_text:  # Only yield non-empty chunks
                content_chunks.append(chunk_text)
                yield ("content_chunk", {
                    "section_id": section_id,
                    "chunk": chunk_text
                })
        
        full_content = "".join(content_chunks)
    except Exception as e:
        yield ("error", {"error": f"Content generation failed: {str(e)}"})
        return
    
    # Update Librarian with new content (non-blocking)
    try:
        await librarian.analyze_and_update(section_id, full_content, actual_section_name)
    except Exception as e:
        pass  # Non-critical
    
    # Store content in database
    await _store_section_content(section_id, full_content, supabase, node_id)
    
    # Yield completion event
    yield ("content_complete", {
        "section_id": section_id,
        "word_count": len(full_content.split()),
        "content": full_content,
    })


@tool
async def edit_section(
    section_id: str,
    instructions: str,
    preserve_length: bool = True,
) -> Dict[str, Any]:
    """
    Edit existing content in a section based on instructions.
    
    Args:
        section_id: The section to edit
        instructions: What changes to make (e.g., "make the dialogue more tense")
        preserve_length: Try to maintain similar word count
    
    Returns:
        Dictionary with:
        - section_id: The edited section
        - content: New content
        - word_count: New word count
        - status: "complete"
    """
    from deep_agent import get_context_node_id
    from librarian import get_librarian
    from config import get_supabase_client, get_model_for_task
    
    # Get node_id from context
    node_id = get_context_node_id()
    
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
    await _store_section_content(section_id, full_content, supabase, node_id)

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


async def _store_section_content(section_id: str, content: str, supabase, node_id: str = ""):
    """
    Store section content in database.
    
    Content is stored inside the document_data.structure nodes.
    The document_data structure is:
    {
        version: 1,
        format: "novel",
        structure: [
            { id: "ch-1", name: "Chapter 1", content: "...", wordCount: 123, ... },
            { id: "ch-2", name: "Chapter 2", content: "...", wordCount: 456, ... }
        ],
        fullDocument: "...",
        totalWordCount: 1234
    }
    """
    if not node_id:
        print(f"❌ [Writing] No node_id provided, cannot store content")
        return
        
    try:
        # Get current document_data
        result = supabase.table("nodes") \
            .select("document_data") \
            .eq("id", node_id) \
            .limit(1) \
            .execute()
        
        if not result.data:
            print(f"❌ [Writing] Node not found: {node_id}")
            return
        
        document_data = result.data[0].get("document_data") or {}
        structure = document_data.get("structure", [])
        
        print(f"🔍 [Writing] Looking for section {section_id} in {len(structure)} structure items")
        
        # Find and update the section in the structure (recursive search)
        def update_section_in_structure(items, target_id, new_content):
            for item in items:
                if item.get("id") == target_id:
                    item["content"] = new_content
                    item["wordCount"] = len(new_content.split())
                    item["status"] = "in_progress"
                    item["updatedAt"] = __import__('datetime').datetime.utcnow().isoformat() + "Z"
                    print(f"✅ [Writing] Found and updated section: {item.get('name', target_id)}")
                    return True
                # Check children recursively
                children = item.get("children", [])
                if children and update_section_in_structure(children, target_id, new_content):
                    return True
            return False
        
        found = update_section_in_structure(structure, section_id, content)
        
        if not found:
            print(f"⚠️ [Writing] Section {section_id} not found in structure, listing available IDs:")
            for item in structure:
                print(f"   - {item.get('id')}: {item.get('name')}")
            return
        
        # Recalculate total word count
        def calculate_total_words(items):
            total = 0
            for item in items:
                total += item.get("wordCount", 0)
                total += calculate_total_words(item.get("children", []))
            return total
        
        document_data["totalWordCount"] = calculate_total_words(structure)
        document_data["lastEditedAt"] = __import__('datetime').datetime.utcnow().isoformat() + "Z"
        
        # Rebuild full document
        def build_full_document(items, depth=0):
            parts = []
            for item in items:
                name = item.get("title") or item.get("name", "")
                content_text = item.get("content", "")
                
                # Add section marker and heading
                parts.append(f'<span id="section-{item.get("id")}"></span>')
                parts.append(f'<!-- section-id: {item.get("id")} -->')
                parts.append(f' {name}')
                parts.append('')
                
                if content_text.strip():
                    parts.append(content_text)
                else:
                    parts.append('')
                    parts.append('*Content will appear here once generated.*')
                
                parts.append('')
                parts.append('---')
                parts.append('')
                
                # Add children
                children = item.get("children", [])
                if children:
                    parts.append(build_full_document(children, depth + 1))
            
            return '\n'.join(parts)
        
        document_data["fullDocument"] = build_full_document(structure)
        document_data["fullDocumentUpdatedAt"] = __import__('datetime').datetime.utcnow().isoformat() + "Z"
        
        # Save back to database
        supabase.table("nodes") \
            .update({"document_data": document_data}) \
            .eq("id", node_id) \
            .execute()
        
        print(f"✅ [Writing] Content stored for section {section_id} in node {node_id} ({len(content.split())} words)")
        
    except Exception as e:
        import traceback
        print(f"❌ [Writing] Failed to store content: {e}")
        traceback.print_exc()


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

IMPORTANT: Do NOT include the section title/heading at the start of your response.
The heading "{section_name}" is already displayed in the document structure.
Start directly with the content (narrative prose, dialogue, etc.).
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

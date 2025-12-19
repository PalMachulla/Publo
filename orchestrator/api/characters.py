"""
Character utility endpoints (non-chat).

Used for deterministic UI actions that should not go through the LLM.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
import asyncio

from config import get_supabase_client
from agents.gemini_portrait import generate_and_store_character_portrait


router = APIRouter()


class GeneratePortraitRequest(BaseModel):
    story_id: str = Field(..., description="Story UUID")
    user_id: str = Field(..., description="User UUID (owner)")
    node_id: str = Field(..., description="Canvas node id for the character node")
    character_id: str = Field(..., description="Character UUID")
    force: bool = Field(False, description="Regenerate even if photo_url already exists")


@router.post("/characters/portrait")
async def generate_character_portrait(req: GeneratePortraitRequest):
    """
    Queue portrait generation for an existing character.

    This endpoint is designed for:
    - manual 'Retry portrait' from the UI
    - background reprocessing workflows

    It validates that the user owns the story + character, then spawns
    a background task. Returns immediately.
    """
    supabase = get_supabase_client()

    # Verify story ownership
    story_res = (
        supabase.table("stories")
        .select("id,user_id")
        .eq("id", req.story_id)
        .maybe_single()
        .execute()
    )
    story = story_res.data
    if not story or story.get("user_id") != req.user_id:
        return {"success": False, "error": "Story not found or unauthorized"}

    # Load character and verify ownership (only owners can update photo_url)
    char_res = (
        supabase.table("characters")
        .select("id,user_id,name,bio,role,visibility,photo_url,attributes")
        .eq("id", req.character_id)
        .maybe_single()
        .execute()
    )
    char = char_res.data
    if not char:
        return {"success": False, "error": "Character not found"}
    if char.get("user_id") != req.user_id:
        return {"success": False, "error": "Unauthorized to generate portrait for this character"}

    # If already has a photo_url and not forced, no-op
    if (char.get("photo_url") or "").strip() and not req.force:
        return {"success": True, "queued": False, "photo_url": char.get("photo_url")}

    # Mark node as generating (best-effort; node may not exist yet)
    try:
        node_sel = (
            supabase.table("nodes")
            .select("data")
            .eq("id", req.node_id)
            .eq("story_id", req.story_id)
            .maybe_single()
            .execute()
        )
        node = node_sel.data or {}
        data = (node.get("data") if isinstance(node, dict) else None) or {}
        if not isinstance(data, dict):
            data = {}
        data["isGeneratingImage"] = True
        data.pop("imageGenerationError", None)
        supabase.table("nodes").update({"data": data}).eq("id", req.node_id).eq("story_id", req.story_id).execute()
    except Exception:
        pass

    # Spawn background generation
    asyncio.create_task(
        generate_and_store_character_portrait(
            story_id=req.story_id,
            user_id=req.user_id,
            node_id=req.node_id,
            character={
                "id": char.get("id"),
                "name": char.get("name"),
                "bio": char.get("bio") or "",
                "role": char.get("role") or "",
                "attributes": char.get("attributes") or {},
                "photo_url": "",  # force regeneration path
            },
        )
    )

    return {"success": True, "queued": True}


"""
Gemini-based Character Portrait Generation

Generates photorealistic character portraits via the Gemini Image API,
uploads to Supabase Storage, and persists `photo_url` to the `characters` table.

Also attempts to update the related canvas node (`nodes` table) so refresh
restores the portrait without requiring the frontend to poll.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
import asyncio
import base64
import json
import time

import httpx

from config import settings, get_supabase_client


CHARACTER_PORTRAIT_BUCKET = "character-images"
GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"  # fast + good enough for avatars
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

# Throttle to avoid bursts that trigger 429s when creating many characters quickly.
_GEMINI_SEMAPHORE = asyncio.Semaphore(1)
_LAST_GEMINI_CALL_TS = 0.0
_LAST_GEMINI_CALL_LOCK = asyncio.Lock()
_MIN_SECONDS_BETWEEN_CALLS = 1.5


def _get_google_api_key() -> Optional[str]:
    return settings.GOOGLE_AI_API_KEY or settings.GOOGLE_API_KEY


def build_photorealistic_portrait_prompt(character: Dict[str, Any]) -> str:
    """
    Build a photorealistic headshot prompt from known character fields.

    IMPORTANT:
    - We avoid inferring sensitive traits (ethnicity, religion, health, etc.).
    - We rely only on explicit user-provided info in bio/attributes.
    """
    name = (character.get("name") or "Unnamed").strip()
    bio = (character.get("bio") or "").strip()
    role = (character.get("role") or "").strip()
    attrs = character.get("attributes") if isinstance(character.get("attributes"), dict) else {}

    # Lightweight "facts" line if present. Keep it compact.
    facts_parts = []
    for key in ["age", "gender", "occupation"]:
        val = attrs.get(key)
        if isinstance(val, str) and val.strip():
            facts_parts.append(val.strip())
        elif isinstance(val, (int, float)) and key == "age":
            facts_parts.append(f"{int(val)} years old")

    facts = ", ".join(facts_parts)
    if facts:
        subject = f"{name} ({facts})"
    else:
        subject = name

    # Bio snippet (keep short to avoid prompt bloat)
    bio_snippet = bio
    if len(bio_snippet) > 600:
        bio_snippet = bio_snippet[:600].rstrip() + "…"

    # Role can hint styling (very lightly)
    vibe = ""
    if role:
        vibe = f"Subtle vibe consistent with their role in a story ({role})."

    prompt = f"""Photorealistic studio headshot portrait of {subject}.

Use only the following character guidance (do not add sensitive traits unless explicitly present):
- Bio: {bio_snippet if bio_snippet else "(no bio provided)"}
{("- Notes: " + vibe) if vibe else ""}

Camera: 85mm lens, shallow depth of field (f/1.8), sharp focus on eyes.
Lighting: soft diffused key light + subtle rim light, neutral color grading.
Background: clean seamless light gray.
Composition: head and shoulders, centered, looking at camera, natural expression.
Style: ultra-realistic, high detail skin texture. NOT illustration, NOT CGI, NOT anime.
Constraints: no text, no watermark, no logo, no extra people, no busy background.
"""
    return prompt.strip()


async def _call_gemini_image(prompt: str, aspect_ratio: str = "4:5") -> bytes:
    api_key = _get_google_api_key()
    if not api_key:
        raise RuntimeError("Missing GOOGLE_AI_API_KEY / GOOGLE_API_KEY for Gemini image generation")

    url = f"{GEMINI_API_BASE}/models/{GEMINI_IMAGE_MODEL}:generateContent"
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            # Ask for image-only output
            "responseModalities": ["IMAGE"],
            "imageConfig": {
                "aspectRatio": aspect_ratio,
            },
        },
    }

    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json",
    }

    # Retry on rate limits / transient errors with exponential backoff.
    max_attempts = 5
    backoff_s = 2.0

    async with _GEMINI_SEMAPHORE:
        for attempt in range(1, max_attempts + 1):
            # Global pacing between calls (helps when generating a set of portraits).
            async with _LAST_GEMINI_CALL_LOCK:
                global _LAST_GEMINI_CALL_TS
                now = time.time()
                wait = (_LAST_GEMINI_CALL_TS + _MIN_SECONDS_BETWEEN_CALLS) - now
                if wait > 0:
                    await asyncio.sleep(wait)
                _LAST_GEMINI_CALL_TS = time.time()

            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    resp.raise_for_status()
                    data = resp.json()
                break
            except httpx.HTTPStatusError as e:
                status = e.response.status_code if e.response is not None else None

                # Retryable statuses
                if status in (429, 500, 502, 503, 504):
                    retry_after = None
                    try:
                        ra = e.response.headers.get("retry-after")
                        if ra:
                            retry_after = float(ra)
                    except Exception:
                        retry_after = None

                    if attempt >= max_attempts:
                        raise

                    sleep_s = retry_after if retry_after is not None else backoff_s
                    # small jitter
                    sleep_s = sleep_s + (0.2 * attempt)
                    print(
                        f"⏳ [Portrait] Gemini returned {status}; retrying in {sleep_s:.1f}s (attempt {attempt}/{max_attempts})",
                        flush=True,
                    )
                    await asyncio.sleep(sleep_s)
                    backoff_s = min(backoff_s * 2.0, 30.0)
                    continue

                raise

    # Extract first inline image part
    try:
        parts = data["candidates"][0]["content"]["parts"]
    except Exception:
        raise RuntimeError(f"Unexpected Gemini response shape: {json.dumps(data)[:500]}")

    for part in parts:
        inline = part.get("inlineData") or part.get("inline_data")  # be tolerant
        if inline and inline.get("data"):
            b64 = inline["data"]
            return base64.b64decode(b64)

    raise RuntimeError("No image data returned from Gemini")


def _ensure_bucket_exists() -> None:
    supabase = get_supabase_client()
    try:
        # Fast check first
        supabase.storage.get_bucket(CHARACTER_PORTRAIT_BUCKET)
        # Ensure it's public so `get_public_url` works.
        try:
            supabase.storage.update_bucket(CHARACTER_PORTRAIT_BUCKET, {"public": True})
        except Exception:
            pass
        return
    except Exception:
        pass

    try:
        # NOTE: supabase-py create_bucket does NOT accept options like {"public": True}
        # (it errors with "body/name must be string"). Create with name only.
        supabase.storage.create_bucket(CHARACTER_PORTRAIT_BUCKET)
        print(f"🪣 [Portrait] Created bucket: {CHARACTER_PORTRAIT_BUCKET}", flush=True)
        # Make it public (update_bucket DOES accept options).
        try:
            supabase.storage.update_bucket(CHARACTER_PORTRAIT_BUCKET, {"public": True})
            print(f"🪣 [Portrait] Set bucket public: {CHARACTER_PORTRAIT_BUCKET}", flush=True)
        except Exception as e:
            print(f"⚠️ [Portrait] Could not set bucket public: {e}", flush=True)
    except Exception as e:
        # If this fails, portrait upload will 404. Make it loud.
        print(f"❌ [Portrait] Failed to create bucket '{CHARACTER_PORTRAIT_BUCKET}': {e}", flush=True)
        raise


def _upload_portrait_bytes(user_id: str, character_id: str, image_bytes: bytes) -> str:
    _ensure_bucket_exists()
    supabase = get_supabase_client()

    path = f"portraits/{user_id}/{character_id}.png"
    # Upsert-like behavior: remove existing then upload
    try:
        supabase.storage.from_(CHARACTER_PORTRAIT_BUCKET).remove([path])
    except Exception:
        pass

    supabase.storage.from_(CHARACTER_PORTRAIT_BUCKET).upload(
        path,
        image_bytes,
        {"content-type": "image/png", "upsert": "true"},
    )

    public_url = supabase.storage.from_(CHARACTER_PORTRAIT_BUCKET).get_public_url(path)
    if isinstance(public_url, dict) and public_url.get("publicUrl"):
        return public_url["publicUrl"]
    if isinstance(public_url, str):
        return public_url
    # Fallback: stringify
    return str(public_url)


def _update_character_photo_url(character_id: str, photo_url: str) -> None:
    supabase = get_supabase_client()
    supabase.table("characters").update({"photo_url": photo_url}).eq("id", character_id).execute()


def _try_update_node_image(story_id: str, node_id: str, photo_url: str) -> bool:
    """
    Attempt to merge image fields into the node.data JSON.
    Returns True if update succeeded, False if node not found yet.
    """
    supabase = get_supabase_client()
    res = supabase.table("nodes").select("data").eq("id", node_id).eq("story_id", story_id).limit(1).execute()
    rows = res.data or []
    if not rows:
        return False
    data = rows[0].get("data") if isinstance(rows[0], dict) else None
    if not isinstance(data, dict):
        data = {}
    data["image"] = photo_url
    data["isGeneratingImage"] = False
    supabase.table("nodes").update({"data": data}).eq("id", node_id).eq("story_id", story_id).execute()
    return True


def _try_update_node_image_failure(story_id: str, node_id: str, error_code: str) -> bool:
    """
    Best-effort: stop pulsing and store a lightweight error marker in node.data.
    """
    supabase = get_supabase_client()
    res = supabase.table("nodes").select("data").eq("id", node_id).eq("story_id", story_id).limit(1).execute()
    rows = res.data or []
    if not rows:
        return False
    data = rows[0].get("data") if isinstance(rows[0], dict) else None
    if not isinstance(data, dict):
        data = {}
    data["isGeneratingImage"] = False
    data["imageGenerationError"] = error_code
    supabase.table("nodes").update({"data": data}).eq("id", node_id).eq("story_id", story_id).execute()
    return True


async def generate_and_store_character_portrait(
    *,
    story_id: str,
    user_id: str,
    node_id: str,
    character: Dict[str, Any],
    max_node_update_wait_s: float = 8.0,
) -> Optional[str]:
    """
    Generate portrait and persist it. Returns photo_url on success.

    This is safe to run in a background task.
    """
    character_id = character.get("id") or character.get("character_id") or ""
    if not character_id:
        print("⚠️ [Portrait] Missing character_id; skipping portrait generation", flush=True)
        return None

    # If already has a photo_url, skip
    existing = character.get("photo_url")
    if isinstance(existing, str) and existing.strip():
        return existing.strip()

    try:
        prompt = build_photorealistic_portrait_prompt(character)
        print(f"🖼️ [Portrait] Generating portrait for {character.get('name')} ({character_id[:8]}...)", flush=True)
        image_bytes = await _call_gemini_image(prompt, aspect_ratio="4:5")
        photo_url = _upload_portrait_bytes(user_id, character_id, image_bytes)
        _update_character_photo_url(character_id, photo_url)
        print(f"✅ [Portrait] Saved photo_url for {character.get('name')}: {photo_url[:80]}...", flush=True)

        # Try to update node data so refresh restores image.
        if story_id and node_id:
            deadline = time.time() + max_node_update_wait_s
            while time.time() < deadline:
                if _try_update_node_image(story_id, node_id, photo_url):
                    print(f"✅ [Portrait] Updated node image: {node_id}", flush=True)
                    break
                await asyncio.sleep(0.5)

        return photo_url
    except Exception as e:
        err_text = str(e)
        print(f"❌ [Portrait] Generation failed: {err_text}", flush=True)

        # Stop pulsing if we can find the node row (best-effort).
        if story_id and node_id:
            deadline = time.time() + max_node_update_wait_s
            error_code = "portrait_failed"
            if "429" in err_text or "Too Many Requests" in err_text:
                error_code = "rate_limited"
            while time.time() < deadline:
                if _try_update_node_image_failure(story_id, node_id, error_code):
                    print(f"⚠️ [Portrait] Marked node image failure: {node_id} ({error_code})", flush=True)
                    break
                await asyncio.sleep(0.5)
        return None


"""
Character Tools

Tools for creating, listing, and loading characters onto the canvas.
Characters are personas that influence story generation when connected to the orchestrator.

These tools follow the same pattern as structure.py for consistency.
"""

from typing import Optional, Dict, Any, List
from langchain_core.tools import tool


def _get_context_user_id() -> str:
    """Get user_id from context (for deepagents compatibility)."""
    try:
        from deep_agent import get_context_user_id, _context_data
        result = get_context_user_id()
        print(f"🔍 [Character] Context lookup: user_id={result[:8] if result else 'EMPTY'}..., _context_data={_context_data}", flush=True)
        return result
    except Exception as e:
        print(f"⚠️ [Character] Failed to get context user_id: {e}", flush=True)
        return ""


def _get_context_story_id() -> str:
    """Get story_id from context (for deepagents compatibility)."""
    try:
        from deep_agent import get_context_story_id
        return get_context_story_id()
    except Exception as e:
        print(f"⚠️ [Character] Failed to get context story_id: {e}", flush=True)
        return ""


# =============================================================================
# CREATE CHARACTER
# =============================================================================

@tool
async def create_character(
    name: str,
    bio: str = "",
    role: str = "Active",
    attributes: Optional[Dict[str, Any]] = None,
    profiler_chat: Optional[List[Dict[str, str]]] = None,
    story_id: str = "",
    user_id: str = "",
) -> Dict[str, Any]:
    """
    Create a new character and add them to the canvas.
    
    IMPORTANT: Only call this after gathering enough information through conversation.
    The user should confirm they're ready before you call this tool.
    
    Conversation flow:
    1. Ask for name (required)
    2. Ask for key traits, age, occupation
    3. Optionally offer "profiler mode" with situational questions
    4. Summarize and confirm before calling this tool
    
    Args:
        name: Character's full name (REQUIRED)
        bio: Character biography/description. Can include:
             - Physical description
             - Personality traits
             - Background/history
             - Motivations and goals
        role: Story role - determines how prominently they appear:
              - "Main": Core protagonist/antagonist, drives the plot
              - "Active": Key supporting cast with agency
              - "Included": Supporting presence, adds texture
              - "Involved": Cultural/semiotic influence on worldview
              - "Passive": Background influence, ambience
        attributes: Optional dict with additional structured traits:
                   {"age": 36, "occupation": "fisherman", "quirks": ["anxious"]}
        profiler_chat: Optional list of Q&A pairs from profiler conversation:
                      [{"question": "How would they react at a party?", 
                        "answer": "They'd find a quiet corner..."}]
        story_id: Canvas/project ID (injected by agent)
        user_id: Current user's ID (injected by agent)
    
    Returns:
        Dictionary with:
        - success: Boolean indicating success
        - character: Character data object
        - character_id: Unique ID for the character
        - node_id: Generated node ID for canvas placement
        - message: Human-readable result message
    """
    import time
    import random
    import string
    import uuid
    
    # Get user_id and story_id from context if not provided (deepagents compatibility)
    if not user_id:
        user_id = _get_context_user_id()
    if not story_id:
        story_id = _get_context_story_id()
    
    print(f"🎭 [Character] user_id: {user_id[:8] if user_id else 'NONE'}..., story_id: {story_id[:8] if story_id else 'NONE'}...", flush=True)
    
    # Validate required fields
    if not name or not name.strip():
        return {
            "success": False,
            "error": "Character name is required",
            "message": "Please provide a name for the character."
        }
    
    # Clean inputs
    name = name.strip()
    bio = (bio or "").strip()
    role = role if role in ["Main", "Active", "Included", "Involved", "Passive"] else "Active"
    
    # Generate unique IDs (use UUID for database compatibility)
    timestamp = int(time.time() * 1000)
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
    
    character_id = str(uuid.uuid4())  # UUID for Supabase compatibility
    node_id = f"character-{timestamp}-{random_suffix}"  # Node ID can be custom format
    
    print(f"🎭 [Character] Creating character: {name} (role: {role})", flush=True)
    
    # Build character data
    character_data = {
        "id": character_id,
        "name": name,
        "bio": bio,
        "role": role,
        "attributes": attributes or {},
        "profilerChat": profiler_chat or [],
        "visibility": "private",  # New characters are private by default
    }
    
    # Optionally save to Supabase (if user_id provided)
    saved_to_db = False
    if user_id:
        try:
            from config import get_supabase_client
            supabase = get_supabase_client()
            
            db_record = {
                "id": character_id,
                "user_id": user_id,
                "name": name,
                "bio": bio,
                "role": role,
                "visibility": "private",
            }
            
            result = supabase.table("characters").insert(db_record).execute()
            saved_to_db = bool(result.data)
            if saved_to_db:
                print(f"✅ [Character] Saved to database: {character_id}", flush=True)
        except Exception as e:
            # Non-fatal: character will still appear on canvas
            print(f"⚠️ [Character] Database save skipped: {e}", flush=True)
    
    return {
        "success": True,
        "character": character_data,
        "character_id": character_id,
        "node_id": node_id,
        "saved_to_db": saved_to_db,
        "message": f"Created character '{name}' with role '{role}'"
    }


# =============================================================================
# LIST CHARACTERS
# =============================================================================

@tool
async def list_characters(
    include_public: bool = True,
    user_id: str = "",
) -> Dict[str, Any]:
    """
    List available characters the user can add to their story.
    
    Returns the user's own characters plus optionally public characters from others.
    Use this when the user wants to load an existing character onto the canvas.
    
    Args:
        include_public: Whether to include public characters from other users (default: True)
        user_id: Current user's ID (injected by agent)
    
    Returns:
        Dictionary with:
        - own_characters: List of user's characters (up to 20)
        - public_characters: List of public characters from others (up to 20)
        - total_count: Total number of characters returned
    """
    from config import get_supabase_client
    
    # Get user_id from context if not provided (deepagents compatibility)
    if not user_id:
        user_id = _get_context_user_id()
    
    if not user_id:
        return {
            "own_characters": [],
            "public_characters": [],
            "total_count": 0,
            "error": "User ID required to list characters"
        }
    
    try:
        supabase = get_supabase_client()
        
        # Get user's own characters
        own_result = supabase.table("characters") \
            .select("id, name, bio, role, visibility, photo_url") \
            .eq("user_id", user_id) \
            .order("updated_at", desc=True) \
            .limit(20) \
            .execute()
        
        # Simplify output - just essentials for display (avoid large tool results)
        own_characters = []
        for char in (own_result.data or []):
            bio = char.get("bio", "") or ""
            own_characters.append({
                "id": char.get("id"),
                "name": char.get("name"),
                "role": char.get("role", "Active"),
                "visibility": char.get("visibility", "private"),
                "bio_excerpt": bio[:60] + "..." if len(bio) > 60 else bio,
            })
        
        # Get public characters from other users
        public_characters = []
        if include_public:
            public_result = supabase.table("characters") \
                .select("id, name, bio, role, visibility") \
                .eq("visibility", "public") \
                .neq("user_id", user_id) \
                .order("updated_at", desc=True) \
                .limit(10) \
                .execute()
            
            for char in (public_result.data or []):
                bio = char.get("bio", "") or ""
                public_characters.append({
                    "id": char.get("id"),
                    "name": char.get("name"),
                    "role": char.get("role", "Active"),
                    "bio_excerpt": bio[:60] + "..." if len(bio) > 60 else bio,
                })
        
        print(f"📋 [Character] Listed {len(own_characters)} own + {len(public_characters)} public", flush=True)
        
        return {
            "own_characters": own_characters,
            "public_characters": public_characters,
            "total_count": len(own_characters) + len(public_characters),
        }
        
    except Exception as e:
        print(f"❌ [Character] List failed: {e}", flush=True)
        return {
            "own_characters": [],
            "public_characters": [],
            "total_count": 0,
            "error": str(e)
        }


# =============================================================================
# LOAD CHARACTER
# =============================================================================

@tool
async def load_character(
    character_id: str,
    role_override: Optional[str] = None,
    user_id: str = "",
) -> Dict[str, Any]:
    """
    Load an existing character onto the canvas.
    
    Use this after list_characters when the user selects a character to add.
    The character must be either owned by the user or have public visibility.
    
    Args:
        character_id: ID of the character to load (from list_characters)
        role_override: Optional - override the character's default role for this story.
                      Use if user says "add them as a Main character" etc.
        user_id: Current user's ID (injected by agent, for visibility check)
    
    Returns:
        Dictionary with:
        - success: Boolean indicating success
        - character: Character data object
        - character_id: The character's ID
        - node_id: Generated node ID for canvas placement
        - is_existing: True (to differentiate from newly created)
        - message: Human-readable result message
    """
    import time
    import random
    import string
    from config import get_supabase_client
    
    # Get user_id from context if not provided (deepagents compatibility)
    if not user_id:
        user_id = _get_context_user_id()
    
    if not character_id:
        return {
            "success": False,
            "error": "Character ID is required",
            "message": "Please specify which character to load."
        }
    
    try:
        supabase = get_supabase_client()
        
        # Fetch character
        result = supabase.table("characters") \
            .select("*") \
            .eq("id", character_id) \
            .single() \
            .execute()
        
        if not result.data:
            return {
                "success": False,
                "error": "Character not found",
                "message": f"Could not find character with ID '{character_id}'."
            }
        
        char = result.data
        
        # Check visibility permissions
        is_owner = char.get("user_id") == user_id
        is_public = char.get("visibility") == "public"
        
        if not is_owner and not is_public:
            return {
                "success": False,
                "error": "Character is private",
                "message": "This character is private and belongs to another user."
            }
        
        # Determine role (override or original)
        final_role = role_override if role_override in ["Main", "Active", "Included", "Involved", "Passive"] else char.get("role", "Active")
        
        # Generate node ID for canvas
        timestamp = int(time.time() * 1000)
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
        node_id = f"character-{timestamp}-{random_suffix}"
        
        print(f"📂 [Character] Loading existing: {char.get('name')} (role: {final_role})", flush=True)
        
        # Simplify output to avoid "large tool result" handling
        bio = char.get("bio", "") or ""
        return {
            "success": True,
            "character": {
                "id": char["id"],
                "name": char.get("name", "Unknown"),
                "bio": bio[:100] + "..." if len(bio) > 100 else bio,  # Short excerpt
                "role": final_role,
                "photo_url": char.get("photo_url"),
                "visibility": char.get("visibility", "private"),
            },
            "character_id": char["id"],
            "node_id": node_id,
            "is_existing": True,
            "message": f"Loaded character '{char.get('name')}' as {final_role}"
        }
        
    except Exception as e:
        print(f"❌ [Character] Load failed: {e}", flush=True)
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to load character: {e}"
        }

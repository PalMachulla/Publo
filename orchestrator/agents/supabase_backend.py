"""
Supabase Filesystem Backend for Deep Agents

Stores agent context files in Supabase instead of ephemeral /tmp/ storage.
Provides persistent, cross-session context management.
"""

from typing import Optional, Any, List, Dict
import json
from config import get_supabase_client


class SupabaseFilesystemBackend:
    """
    Supabase-backed filesystem for Deep Agent context storage.
    
    Replaces OrchestratorFilesystemBackend (which used /tmp/) with
    persistent Supabase storage using the agent_context_files table.
    
    Usage:
        backend = SupabaseFilesystemBackend(
            story_id="uuid-123",
            user_id="uuid-456"
        )
        backend.write_file("context/characters.json", {"Lars": {...}})
        data = backend.read_file("context/characters.json")
    """
    
    def __init__(self, story_id: str, user_id: str):
        """
        Initialize Supabase filesystem backend.
        
        Args:
            story_id: Story/canvas UUID
            user_id: User UUID (for RLS)
        """
        self.story_id = story_id
        self.user_id = user_id
        self._supabase = None
    
    @property
    def supabase(self):
        """Lazy-load Supabase client."""
        if self._supabase is None:
            self._supabase = get_supabase_client()
        return self._supabase
    
    def write_file(self, path: str, content: Any) -> bool:
        """
        Write content to a file in Supabase.
        
        Args:
            path: File path (e.g., "context/connected_characters.json")
            content: Content to write (dict/list for JSON, str for text)
        
        Returns:
            True if successful
        
        Example:
            backend.write_file("context/characters.json", {"Lars": {...}})
            backend.write_file("notes/outline.txt", "Chapter 1: ...")
        """
        try:
            is_json = path.endswith('.json')
            
            if is_json:
                # Store as JSONB
                json_content = content if isinstance(content, (dict, list)) else json.loads(content)
                result = self.supabase.table("agent_context_files").upsert({
                    "story_id": self.story_id,
                    "user_id": self.user_id,
                    "path": path,
                    "content": json_content,
                    "text_content": None,
                    "file_type": "json",
                    "size_bytes": len(json.dumps(json_content)),
                }, on_conflict="story_id,path").execute()
            else:
                # Store as text
                text_content = content if isinstance(content, str) else str(content)
                result = self.supabase.table("agent_context_files").upsert({
                    "story_id": self.story_id,
                    "user_id": self.user_id,
                    "path": path,
                    "content": None,
                    "text_content": text_content,
                    "file_type": "text",
                    "size_bytes": len(text_content),
                }, on_conflict="story_id,path").execute()
            
            print(f"📁 [Supabase] Wrote file: {path}", flush=True)
            return True
            
        except Exception as e:
            # Check if table doesn't exist yet (migration not run)
            error_str = str(e)
            if "relation" in error_str and "does not exist" in error_str:
                print(f"⚠️ [Supabase] Table agent_context_files not found - run migration 019", flush=True)
            else:
                print(f"❌ [Supabase] Failed to write {path}: {e}", flush=True)
            return False
    
    def read_file(self, path: str) -> Optional[Any]:
        """
        Read content from a file in Supabase.
        
        Args:
            path: File path to read
        
        Returns:
            File content (dict/list for JSON, str for text) or None if not found
        
        Example:
            data = backend.read_file("context/characters.json")
            if data:
                print(data["Lars"]["bio"])
        """
        try:
            result = self.supabase.table("agent_context_files") \
                .select("content, text_content, file_type") \
                .eq("story_id", self.story_id) \
                .eq("path", path) \
                .single() \
                .execute()
            
            if not result.data:
                return None
            
            row = result.data
            if row.get("file_type") == "json":
                return row.get("content")
            else:
                return row.get("text_content")
                
        except Exception as e:
            # File not found returns an error from .single()
            if "No rows found" in str(e) or "0 rows" in str(e):
                return None
            print(f"⚠️ [Supabase] Error reading {path}: {e}", flush=True)
            return None
    
    def list_files(self, directory: str = "") -> List[Dict[str, Any]]:
        """
        List files in a directory.
        
        Args:
            directory: Directory path (empty for root)
        
        Returns:
            List of file info dicts with path, file_type, size_bytes, updated_at
        
        Example:
            files = backend.list_files("context/")
            for f in files:
                print(f["path"], f["size_bytes"])
        """
        try:
            query = self.supabase.table("agent_context_files") \
                .select("path, file_type, size_bytes, updated_at") \
                .eq("story_id", self.story_id)
            
            if directory:
                # Filter by directory prefix
                query = query.like("path", f"{directory}%")
            
            result = query.order("path").execute()
            
            return result.data or []
            
        except Exception as e:
            print(f"⚠️ [Supabase] Error listing files: {e}", flush=True)
            return []
    
    def delete_file(self, path: str) -> bool:
        """
        Delete a file from Supabase.
        
        Args:
            path: File path to delete
        
        Returns:
            True if deleted (or didn't exist)
        """
        try:
            self.supabase.table("agent_context_files") \
                .delete() \
                .eq("story_id", self.story_id) \
                .eq("path", path) \
                .execute()
            
            print(f"🗑️ [Supabase] Deleted file: {path}", flush=True)
            return True
            
        except Exception as e:
            print(f"⚠️ [Supabase] Error deleting {path}: {e}", flush=True)
            return False
    
    def file_exists(self, path: str) -> bool:
        """Check if a file exists."""
        try:
            result = self.supabase.table("agent_context_files") \
                .select("id") \
                .eq("story_id", self.story_id) \
                .eq("path", path) \
                .single() \
                .execute()
            
            return result.data is not None
            
        except Exception:
            return False


# Backwards compatibility - alias to old class name
def get_backend(story_id: str, user_id: str) -> SupabaseFilesystemBackend:
    """
    Get a filesystem backend for a story.
    
    This is the new default - uses Supabase instead of /tmp/.
    
    Args:
        story_id: Story/canvas UUID
        user_id: User UUID
    
    Returns:
        SupabaseFilesystemBackend instance
    """
    return SupabaseFilesystemBackend(story_id=story_id, user_id=user_id)

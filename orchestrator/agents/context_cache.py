"""
Context Cache for Performance

Caches loaded context to avoid repeated filesystem reads.
This improves performance when multiple nodes need the same context.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import threading


class ContextCache:
    """
    Thread-safe cache for filesystem context.
    
    Caches context data with TTL (time-to-live) to avoid stale data.
    Used by nodes to share loaded context without re-reading files.
    
    Usage:
        cache = ContextCache(ttl_seconds=60)
        canvas_context = cache.get_or_load("canvas", lambda: load_from_filesystem("canvas"))
    """
    
    def __init__(self, ttl_seconds: int = 60):
        """
        Initialize context cache.
        
        Args:
            ttl_seconds: Time-to-live for cached entries (default: 60 seconds)
        """
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl_seconds = ttl_seconds
        self.lock = threading.Lock()
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get cached context if available and not expired.
        
        Args:
            key: Cache key (e.g., "canvas", "conversation")
        
        Returns:
            Cached data or None if not found/expired
        """
        with self.lock:
            if key not in self.cache:
                return None
            
            entry = self.cache[key]
            expires_at = entry.get("expires_at")
            
            # Check if expired
            if expires_at and datetime.now() > expires_at:
                del self.cache[key]
                return None
            
            return entry.get("data")
    
    def set(self, key: str, data: Any) -> None:
        """
        Cache context data with expiration.
        
        Args:
            key: Cache key (e.g., "canvas", "conversation")
            data: Data to cache
        """
        with self.lock:
            expires_at = datetime.now() + timedelta(seconds=self.ttl_seconds)
            self.cache[key] = {
                "data": data,
                "expires_at": expires_at,
                "cached_at": datetime.now()
            }
    
    def get_or_load(self, key: str, loader: callable) -> Any:
        """
        Get from cache or load using provided function.
        
        Args:
            key: Cache key
            loader: Function to call if cache miss
        
        Returns:
            Cached or loaded data
        """
        # Try cache first
        cached = self.get(key)
        if cached is not None:
            return cached
        
        # Load and cache
        data = loader()
        if data is not None:
            self.set(key, data)
        
        return data
    
    def clear(self, key: Optional[str] = None) -> None:
        """
        Clear cache entry or all entries.
        
        Args:
            key: Specific key to clear, or None to clear all
        """
        with self.lock:
            if key:
                self.cache.pop(key, None)
            else:
                self.cache.clear()
    
    def clear_expired(self) -> None:
        """Remove all expired entries from cache."""
        with self.lock:
            now = datetime.now()
            expired_keys = [
                key for key, entry in self.cache.items()
                if entry.get("expires_at") and now > entry["expires_at"]
            ]
            for key in expired_keys:
                del self.cache[key]


# Global cache instance (shared across nodes)
_global_cache: Optional[ContextCache] = None


def get_context_cache() -> ContextCache:
    """
    Get or create global context cache instance.
    
    Returns:
        Global ContextCache instance
    """
    global _global_cache
    if _global_cache is None:
        _global_cache = ContextCache(ttl_seconds=60)
    return _global_cache


"""
Memory Manager for Persistent Learning

Stores and retrieves user preferences, patterns, and style guides.
This enables the orchestrator to learn from interactions and personalize
the experience over time.

Phase 5: Persistent Memory
"""

from typing import Dict, Any, Optional, List
from .deep_agent_backend import OrchestratorFilesystemBackend
from datetime import datetime
import json


class MemoryManager:
    """
    Manages persistent memory for learning and personalization.
    
    Memory is stored in the filesystem under /project/memory/:
    - user_preferences.json: Learned user preferences
    - successful_patterns.json: Patterns that worked well
    - style_guide.json: Writing style extracted from user content
    - character_profiles.json: Recurring characters
    - correction_history.json: What didn't work (to avoid)
    
    Usage:
        manager = MemoryManager(backend)
        manager.save_preference("prefers_dialogue_heavy", True)
        prefs = manager.load_preferences()
    """
    
    def __init__(self, backend: OrchestratorFilesystemBackend):
        """
        Initialize memory manager.
        
        Args:
            backend: Filesystem backend for storing memory
        """
        self.backend = backend
    
    # ============================================================
    # PREFERENCES
    # ============================================================
    
    def load_preferences(self) -> Dict[str, Any]:
        """
        Load user preferences from memory.
        
        Returns:
            Dictionary of preferences (e.g., {"prefers_dialogue_heavy": True})
        """
        prefs = self.backend.read_file("memory/user_preferences.json")
        return prefs or {}
    
    def save_preference(self, key: str, value: Any) -> None:
        """
        Save a user preference.
        
        Args:
            key: Preference key (e.g., "prefers_dialogue_heavy")
            value: Preference value (any JSON-serializable type)
        """
        prefs = self.load_preferences()
        prefs[key] = value
        prefs["_updated_at"] = datetime.now().isoformat()
        self.backend.write_file("memory/user_preferences.json", prefs)
        print(f"💾 [Memory] Saved preference: {key} = {value}")
    
    def update_preferences(self, updates: Dict[str, Any]) -> None:
        """
        Update multiple preferences at once.
        
        Args:
            updates: Dictionary of preference updates
        """
        prefs = self.load_preferences()
        prefs.update(updates)
        prefs["_updated_at"] = datetime.now().isoformat()
        self.backend.write_file("memory/user_preferences.json", prefs)
        print(f"💾 [Memory] Updated {len(updates)} preference(s)")
    
    # ============================================================
    # PATTERNS
    # ============================================================
    
    def load_patterns(self) -> List[Dict[str, Any]]:
        """
        Load successful patterns from memory.
        
        Returns:
            List of pattern dictionaries
        """
        patterns = self.backend.read_file("memory/successful_patterns.json")
        return patterns or []
    
    def save_pattern(self, pattern: Dict[str, Any]) -> None:
        """
        Save a successful pattern.
        
        Args:
            pattern: Pattern dictionary with:
                - type: Pattern type (e.g., "structure_template", "writing_style")
                - description: What the pattern is
                - context: When it was used
                - result: What happened (success metrics)
                - metadata: Additional info
        """
        patterns = self.load_patterns()
        
        # Add timestamp
        pattern["_saved_at"] = datetime.now().isoformat()
        pattern["_id"] = pattern.get("_id") or f"pattern_{len(patterns)}_{int(datetime.now().timestamp())}"
        
        patterns.append(pattern)
        
        # Keep only last 100 patterns (prevent unbounded growth)
        if len(patterns) > 100:
            patterns = patterns[-100:]
        
        self.backend.write_file("memory/successful_patterns.json", patterns)
        print(f"💾 [Memory] Saved pattern: {pattern.get('type', 'unknown')}")
    
    def find_similar_patterns(self, pattern_type: str, context: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Find patterns similar to the given type and context.
        
        Args:
            pattern_type: Type of pattern to find
            context: Optional context for matching
        
        Returns:
            List of similar patterns (sorted by relevance)
        """
        patterns = self.load_patterns()
        
        # Filter by type
        matching = [p for p in patterns if p.get("type") == pattern_type]
        
        # TODO: Add similarity matching based on context
        # For now, just return recent patterns of the same type
        matching.sort(key=lambda p: p.get("_saved_at", ""), reverse=True)
        
        return matching[:10]  # Return top 10
    
    # ============================================================
    # STYLE GUIDE
    # ============================================================
    
    def load_style_guide(self) -> Dict[str, Any]:
        """
        Load writing style guide from memory.
        
        Returns:
            Style guide dictionary with:
                - tone: Writing tone (formal, casual, etc.)
                - pov: Point of view preference
                - dialogue_style: How dialogue is written
                - description_style: How descriptions are written
                - examples: Example passages
        """
        style = self.backend.read_file("memory/style_guide.json")
        return style or {}
    
    def update_style_guide(self, updates: Dict[str, Any]) -> None:
        """
        Update writing style guide.
        
        Args:
            updates: Style guide updates
        """
        style = self.load_style_guide()
        style.update(updates)
        style["_updated_at"] = datetime.now().isoformat()
        self.backend.write_file("memory/style_guide.json", style)
        print(f"💾 [Memory] Updated style guide")
    
    def extract_style_from_content(self, content: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Extract style characteristics from user content.
        
        This analyzes the content to learn the user's writing style.
        
        Args:
            content: User's written content
            metadata: Optional metadata (format, section, etc.)
        
        Returns:
            Extracted style characteristics
        """
        # Simple style extraction (can be enhanced with LLM analysis)
        style = {
            "avg_sentence_length": len(content.split(".")) / max(content.count("."), 1),
            "dialogue_ratio": content.count('"') / max(len(content.split()), 1),
            "description_ratio": len([w for w in content.split() if len(w) > 6]) / max(len(content.split()), 1),
        }
        
        # Update style guide with extracted characteristics
        current_style = self.load_style_guide()
        current_style.update(style)
        self.update_style_guide(current_style)
        
        return style
    
    # ============================================================
    # CHARACTER PROFILES
    # ============================================================
    
    def load_character_profiles(self) -> List[Dict[str, Any]]:
        """
        Load character profiles from memory.
        
        Returns:
            List of character profile dictionaries
        """
        profiles = self.backend.read_file("memory/character_profiles.json")
        return profiles or []
    
    def save_character_profile(self, character: Dict[str, Any]) -> None:
        """
        Save a character profile.
        
        Args:
            character: Character dictionary with name, traits, etc.
        """
        profiles = self.load_character_profiles()
        
        # Check if character already exists
        existing = next((p for p in profiles if p.get("name") == character.get("name")), None)
        if existing:
            # Update existing
            existing.update(character)
            existing["_updated_at"] = datetime.now().isoformat()
        else:
            # Add new
            character["_created_at"] = datetime.now().isoformat()
            character["_id"] = f"char_{len(profiles)}_{int(datetime.now().timestamp())}"
            profiles.append(character)
        
        self.backend.write_file("memory/character_profiles.json", profiles)
        print(f"💾 [Memory] Saved character profile: {character.get('name', 'unknown')}")
    
    # ============================================================
    # CORRECTION HISTORY
    # ============================================================
    
    def load_corrections(self) -> List[Dict[str, Any]]:
        """
        Load correction history (what didn't work).
        
        Returns:
            List of correction dictionaries
        """
        corrections = self.backend.read_file("memory/correction_history.json")
        return corrections or []
    
    def save_correction(self, correction: Dict[str, Any]) -> None:
        """
        Save a correction (something that didn't work).
        
        Args:
            correction: Correction dictionary with:
                - original: What was tried
                - issue: What was wrong
                - correction: What was changed
                - context: When/where it happened
        """
        corrections = self.load_corrections()
        
        correction["_saved_at"] = datetime.now().isoformat()
        correction["_id"] = f"correction_{len(corrections)}_{int(datetime.now().timestamp())}"
        
        corrections.append(correction)
        
        # Keep only last 50 corrections
        if len(corrections) > 50:
            corrections = corrections[-50:]
        
        self.backend.write_file("memory/correction_history.json", corrections)
        print(f"💾 [Memory] Saved correction: {correction.get('issue', 'unknown')}")
    
    def should_avoid(self, action: str, context: Optional[Dict[str, Any]] = None) -> bool:
        """
        Check if an action should be avoided based on correction history.
        
        Args:
            action: Action to check (e.g., "use_template_X")
            context: Optional context
        
        Returns:
            True if action should be avoided
        """
        corrections = self.load_corrections()
        
        # Check if similar action was corrected before
        for correction in corrections:
            if action in str(correction.get("original", "")):
                return True
        
        return False


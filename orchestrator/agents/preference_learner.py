"""
Preference Learner

Learns user preferences from interactions and stores them in memory.

Phase 5: Persistent Memory
"""

from typing import Dict, Any, Optional
from .memory_manager import MemoryManager
from datetime import datetime


class PreferenceLearner:
    """
    Learns user preferences from interactions.
    
    This analyzes user behavior, corrections, and feedback to learn:
    - Writing style preferences
    - Template preferences
    - Model preferences
    - Content preferences
    
    Usage:
        learner = PreferenceLearner(memory_manager)
        learner.learn_from_interaction(user_message, result, feedback)
    """
    
    def __init__(self, memory_manager: MemoryManager):
        """
        Initialize preference learner.
        
        Args:
            memory_manager: Memory manager for storing preferences
        """
        self.memory = memory_manager
    
    def learn_from_interaction(
        self,
        user_message: str,
        result: Dict[str, Any],
        feedback: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Learn preferences from a user interaction.
        
        Args:
            user_message: User's original message
            result: Result of the interaction (structure, content, etc.)
            feedback: Optional explicit feedback (like/dislike, corrections)
        """
        # Extract preferences from user message
        message_prefs = self._extract_preferences_from_message(user_message)
        
        # Extract preferences from result
        result_prefs = self._extract_preferences_from_result(result)
        
        # Extract preferences from feedback
        feedback_prefs = self._extract_preferences_from_feedback(feedback) if feedback else {}
        
        # Merge all preferences
        all_prefs = {**message_prefs, **result_prefs, **feedback_prefs}
        
        # Update memory
        if all_prefs:
            self.memory.update_preferences(all_prefs)
            print(f"🧠 [PreferenceLearner] Learned {len(all_prefs)} preference(s)")
    
    def _extract_preferences_from_message(self, message: str) -> Dict[str, Any]:
        """
        Extract preferences from user message.
        
        Args:
            message: User's message
        
        Returns:
            Dictionary of extracted preferences
        """
        prefs = {}
        message_lower = message.lower()
        
        # Detect dialogue preference
        if any(word in message_lower for word in ["dialogue", "conversation", "talking"]):
            prefs["prefers_dialogue_heavy"] = True
        
        # Detect POV preference
        if "first person" in message_lower or "i " in message_lower[:50]:
            prefs["pov_preference"] = "first_person"
        elif "third person" in message_lower:
            prefs["pov_preference"] = "third_person"
        
        # Detect tone preference
        if any(word in message_lower for word in ["formal", "professional", "academic"]):
            prefs["tone_preference"] = "formal"
        elif any(word in message_lower for word in ["casual", "relaxed", "conversational"]):
            prefs["tone_preference"] = "casual"
        
        # Detect format preference
        if "novel" in message_lower:
            prefs["format_preference"] = "novel"
        elif "screenplay" in message_lower:
            prefs["format_preference"] = "screenplay"
        elif "podcast" in message_lower:
            prefs["format_preference"] = "podcast"
        
        return prefs
    
    def _extract_preferences_from_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract preferences from result (what was generated).
        
        Args:
            result: Result dictionary (structure, content, etc.)
        
        Returns:
            Dictionary of extracted preferences
        """
        prefs = {}
        
        # Extract format from structure
        if "structure" in result:
            structure = result["structure"]
            if isinstance(structure, dict):
                format_type = structure.get("format")
                if format_type:
                    prefs["last_used_format"] = format_type
        
        # Extract template preference
        if "structure" in result:
            structure = result["structure"]
            if isinstance(structure, dict):
                template = structure.get("template")
                if template:
                    prefs["last_used_template"] = template
        
        return prefs
    
    def _extract_preferences_from_feedback(self, feedback: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract preferences from explicit feedback.
        
        Args:
            feedback: Feedback dictionary (like/dislike, corrections, etc.)
        
        Returns:
            Dictionary of extracted preferences
        """
        prefs = {}
        
        # Extract from explicit preferences
        if "preferences" in feedback:
            prefs.update(feedback["preferences"])
        
        # Extract from corrections (what user didn't like)
        if "corrections" in feedback:
            corrections = feedback["corrections"]
            for correction in corrections:
                # Learn what to avoid
                if "avoid" in correction:
                    prefs[f"avoid_{correction['avoid']}"] = True
        
        return prefs
    
    def learn_from_correction(
        self,
        original: str,
        corrected: str,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Learn from a user correction.
        
        Args:
            original: Original content/action
            corrected: Corrected version
            context: Optional context
        """
        # Save correction to memory
        self.memory.save_correction({
            "original": original,
            "corrected": corrected,
            "context": context or {},
            "issue": "User correction"
        })
        
        # Extract preferences from correction
        # If user corrected something, they likely prefer the corrected version
        prefs = {}
        
        # Simple heuristic: if correction changes format/template, learn preference
        if "format" in str(original).lower() and "format" in str(corrected).lower():
            # User changed format - learn the new format preference
            pass  # TODO: Extract format from corrected
        
        if prefs:
            self.memory.update_preferences(prefs)
            print(f"🧠 [PreferenceLearner] Learned from correction")


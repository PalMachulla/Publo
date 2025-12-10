"""
Pattern Learner

Learns successful patterns from interactions and stores them for reuse.

Phase 5: Persistent Memory
"""

from typing import Dict, Any, Optional, List
from .memory_manager import MemoryManager
from datetime import datetime


class PatternLearner:
    """
    Learns successful patterns from interactions.
    
    This analyzes what worked well and stores patterns for future use:
    - Structure templates that worked
    - Writing styles that were successful
    - Content patterns that resonated
    - Workflow patterns that were efficient
    
    Usage:
        learner = PatternLearner(memory_manager)
        learner.learn_from_success(result, metrics)
    """
    
    def __init__(self, memory_manager: MemoryManager):
        """
        Initialize pattern learner.
        
        Args:
            memory_manager: Memory manager for storing patterns
        """
        self.memory = memory_manager
    
    def learn_from_success(
        self,
        result: Dict[str, Any],
        metrics: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Learn patterns from a successful interaction.
        
        Args:
            result: Result of the interaction (structure, content, etc.)
            metrics: Optional success metrics (user satisfaction, completion time, etc.)
            context: Optional context (user message, intent, etc.)
        """
        patterns = []
        
        # Learn structure patterns
        if "structure" in result:
            structure_pattern = self._extract_structure_pattern(result["structure"], context)
            if structure_pattern:
                patterns.append(structure_pattern)
        
        # Learn content patterns
        if "results" in result:
            for section_id, content in result["results"].items():
                content_pattern = self._extract_content_pattern(section_id, content, context)
                if content_pattern:
                    patterns.append(content_pattern)
        
        # Learn workflow patterns
        workflow_pattern = self._extract_workflow_pattern(result, metrics, context)
        if workflow_pattern:
            patterns.append(workflow_pattern)
        
        # Save all patterns
        for pattern in patterns:
            self.memory.save_pattern(pattern)
        
        if patterns:
            print(f"🧠 [PatternLearner] Learned {len(patterns)} pattern(s)")
    
    def _extract_structure_pattern(
        self,
        structure: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Extract pattern from structure.
        
        Args:
            structure: Structure dictionary
            context: Optional context
        
        Returns:
            Pattern dictionary or None
        """
        if not isinstance(structure, dict):
            return None
        
        return {
            "type": "structure_template",
            "description": f"Structure for {structure.get('format', 'unknown')} format",
            "context": {
                "format": structure.get("format"),
                "template": structure.get("template"),
                "section_count": len(structure.get("items", []))
            },
            "result": {
                "structure": {
                    "format": structure.get("format"),
                    "template": structure.get("template"),
                    "item_count": len(structure.get("items", []))
                }
            },
            "metadata": {
                "user_message": context.get("user_message") if context else None,
                "intent": context.get("intent") if context else None
            }
        }
    
    def _extract_content_pattern(
        self,
        section_id: str,
        content: str,
        context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Extract pattern from content.
        
        Args:
            section_id: Section identifier
            content: Content text
            context: Optional context
        
        Returns:
            Pattern dictionary or None
        """
        # Simple pattern extraction (can be enhanced with LLM analysis)
        return {
            "type": "content_style",
            "description": f"Content style for section {section_id}",
            "context": {
                "section_id": section_id,
                "word_count": len(content.split()),
                "has_dialogue": '"' in content,
                "avg_sentence_length": len(content.split(".")) / max(content.count("."), 1)
            },
            "result": {
                "word_count": len(content.split()),
                "style_characteristics": {
                    "dialogue_heavy": content.count('"') > 10,
                    "description_heavy": len([w for w in content.split() if len(w) > 6]) > 50
                }
            },
            "metadata": {
                "section_id": section_id
            }
        }
    
    def _extract_workflow_pattern(
        self,
        result: Dict[str, Any],
        metrics: Optional[Dict[str, Any]],
        context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Extract workflow pattern (what steps were taken, how long, etc.).
        
        Args:
            result: Result dictionary
            metrics: Optional metrics
            context: Optional context
        
        Returns:
            Pattern dictionary or None
        """
        return {
            "type": "workflow_pattern",
            "description": "Workflow pattern for successful generation",
            "context": {
                "intent": context.get("intent") if context else None,
                "strategy": context.get("strategy") if context else None,
                "action_count": len(result.get("results", {}))
            },
            "result": {
                "success": True,
                "completion_time": metrics.get("completion_time") if metrics else None,
                "sections_generated": len(result.get("results", {}))
            },
            "metadata": {
                "user_message": context.get("user_message") if context else None
            }
        }
    
    def get_recommended_patterns(
        self,
        pattern_type: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get recommended patterns for a given type and context.
        
        Args:
            pattern_type: Type of pattern to find
            context: Optional context for matching
        
        Returns:
            List of recommended patterns (sorted by relevance)
        """
        return self.memory.find_similar_patterns(pattern_type, context)


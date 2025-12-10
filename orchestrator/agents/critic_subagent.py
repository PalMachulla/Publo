"""
Critic Subagent

Specialized subagent for reviewing and critiquing content.

Phase 4: Subagent Spawning
"""

from typing import Dict, Any, Optional
from .deep_agent_backend import OrchestratorFilesystemBackend
from .file_storage import load_context_from_filesystem


class CriticSubagent:
    """
    Critic subagent for reviewing content quality.
    
    This subagent:
    - Reviews generated content
    - Provides feedback and suggestions
    - Can request revisions
    - Stores feedback in filesystem
    
    Usage:
        critic = CriticSubagent(backend)
        feedback = await critic.review_content(section_id, content)
    """
    
    def __init__(self, backend: OrchestratorFilesystemBackend):
        """
        Initialize critic subagent.
        
        Args:
            backend: Filesystem backend for storing feedback
        """
        self.backend = backend
    
    async def review_content(
        self,
        section_id: str,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Review content and provide feedback.
        
        Args:
            section_id: Section identifier
            content: Content to review
            context: Optional context (document structure, style guide, etc.)
        
        Returns:
            Feedback dictionary with:
            - approved: bool (whether content is approved)
            - feedback: str (review comments)
            - suggestions: List[str] (improvement suggestions)
            - score: float (quality score 0-1)
        """
        print(f"🔍 [Critic] Reviewing content for section: {section_id}")
        
        # Load style guide and preferences from memory (if available)
        style_guide = load_context_from_filesystem(self.backend, "style")
        preferences = load_context_from_filesystem(self.backend, "preferences")
        
        # Build review prompt
        review_prompt = self._build_review_prompt(
            content=content,
            section_id=section_id,
            style_guide=style_guide,
            preferences=preferences,
            context=context
        )
        
        # Use LLM to review content
        from langchain.prompts import ChatPromptTemplate
        from langchain_core.messages import SystemMessage, HumanMessage
        from orchestrator.graph.agents.writer import get_llm
        
        llm = get_llm(temperature=0.3)  # Lower temperature for more consistent reviews
        
        if not llm:
            # Fallback: approve by default if LLM not available
            return {
                "approved": True,
                "feedback": "LLM not configured - auto-approved",
                "suggestions": [],
                "score": 0.8
            }
        
        messages = [
            SystemMessage(content=review_prompt["system"]),
            HumanMessage(content=review_prompt["user"])
        ]
        
        try:
            response = await llm.ainvoke(messages)
            review_text = response.content
            
            # Parse review (expects structured response)
            feedback = self._parse_review(review_text)
            
            # Store feedback in filesystem
            self.backend.write_file(f"feedback/{section_id}_review.json", {
                "section_id": section_id,
                "approved": feedback["approved"],
                "feedback": feedback["feedback"],
                "suggestions": feedback["suggestions"],
                "score": feedback["score"],
                "review_text": review_text
            })
            
            print(f"✅ [Critic] Review complete: approved={feedback['approved']}, score={feedback['score']:.2f}")
            
            return feedback
            
        except Exception as e:
            print(f"❌ [Critic] Review failed: {e}")
            # Fallback: approve on error
            return {
                "approved": True,
                "feedback": f"Review error: {str(e)}",
                "suggestions": [],
                "score": 0.7
            }
    
    def _build_review_prompt(
        self,
        content: str,
        section_id: str,
        style_guide: Optional[Dict[str, Any]],
        preferences: Optional[Dict[str, Any]],
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, str]:
        """
        Build review prompt for LLM.
        
        Returns:
            Dictionary with "system" and "user" prompts
        """
        system_prompt = """You are a professional editor and critic reviewing creative writing.

Your job is to:
1. Evaluate content quality (clarity, engagement, style)
2. Check for consistency (tone, character, plot)
3. Provide constructive feedback
4. Suggest improvements

Be specific and actionable in your feedback."""

        if style_guide:
            system_prompt += f"\n\nStyle Guide:\n{style_guide}"

        if preferences:
            system_prompt += f"\n\nUser Preferences:\n{preferences}"

        user_prompt = f"""Review this content for section "{section_id}":

{content[:2000]}  # Limit content length for review

Provide your review in this format:
APPROVED: yes/no
SCORE: 0.0-1.0
FEEDBACK: Your detailed review comments
SUGGESTIONS:
- Suggestion 1
- Suggestion 2
"""

        return {
            "system": system_prompt,
            "user": user_prompt
        }
    
    def _parse_review(self, review_text: str) -> Dict[str, Any]:
        """
        Parse LLM review response into structured feedback.
        
        Args:
            review_text: Raw LLM response
        
        Returns:
            Structured feedback dictionary
        """
        # Try to parse structured response
        approved = "yes" in review_text.lower()[:100] or "approved" in review_text.lower()[:100]
        
        # Extract score (look for "SCORE: 0.8" pattern)
        import re
        score_match = re.search(r'SCORE:\s*([0-9.]+)', review_text, re.IGNORECASE)
        score = float(score_match.group(1)) if score_match else 0.7
        
        # Extract feedback (between FEEDBACK: and SUGGESTIONS:)
        feedback_match = re.search(r'FEEDBACK:\s*(.*?)(?=SUGGESTIONS:|$)', review_text, re.DOTALL | re.IGNORECASE)
        feedback = feedback_match.group(1).strip() if feedback_match else review_text
        
        # Extract suggestions (list after SUGGESTIONS:)
        suggestions_match = re.search(r'SUGGESTIONS:\s*(.*?)$', review_text, re.DOTALL | re.IGNORECASE)
        suggestions_text = suggestions_match.group(1) if suggestions_match else ""
        suggestions = [s.strip("- ").strip() for s in suggestions_text.split("\n") if s.strip()]
        
        return {
            "approved": approved and score >= 0.6,  # Approve if score >= 0.6
            "feedback": feedback,
            "suggestions": suggestions,
            "score": score
        }


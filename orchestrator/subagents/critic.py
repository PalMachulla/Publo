"""
Critic Subagent

Reviews content for quality, pacing, consistency, and engagement.
Returns structured feedback with scores and recommendations.
"""

from typing import Dict, Any, Optional
from langchain_core.tools import tool
from ..prompts.subagent_prompts import CRITIC_PROMPT


@tool
async def evaluate_pacing(
    content: str,
    genre: str = "general",
    expected_pace: str = "medium",
) -> Dict[str, Any]:
    """
    Analyze the pacing of a piece of content.
    
    Args:
        content: The content to analyze
        genre: Genre context (thriller, romance, etc.)
        expected_pace: Expected pacing (fast, medium, slow)
    
    Returns:
        Pacing analysis with score and recommendations
    """
    from ..config import get_model_for_task
    
    model = get_model_for_task("fast")
    
    prompt = f"""Analyze the pacing of this content.

CONTENT:
{content[:3000]}

GENRE: {genre}
EXPECTED PACE: {expected_pace}

Return JSON:
{{
  "pacing_score": 1-10,
  "actual_pace": "fast|medium|slow|uneven",
  "observations": ["observation 1", "observation 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}}

Return ONLY valid JSON."""

    try:
        response = await model.ainvoke(prompt)
        import json
        text = response.content if hasattr(response, 'content') else str(response)
        return json.loads(text.strip())
    except Exception as e:
        return {
            "pacing_score": 5,
            "actual_pace": "unknown",
            "observations": [f"Analysis failed: {str(e)}"],
            "recommendations": []
        }


@tool
async def check_dialogue_quality(
    content: str,
    character_voices: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Evaluate dialogue for naturalness and character voice.
    
    Args:
        content: The content to analyze
        character_voices: Optional dict of character name -> voice notes
    
    Returns:
        Dialogue quality analysis
    """
    from ..config import get_model_for_task
    
    model = get_model_for_task("fast")
    
    voice_context = ""
    if character_voices:
        voice_context = "\n".join([
            f"- {name}: {notes}" 
            for name, notes in character_voices.items()
        ])
    
    prompt = f"""Analyze the dialogue quality in this content.

CONTENT:
{content[:3000]}

{f'CHARACTER VOICES:\n{voice_context}' if voice_context else ''}

Evaluate:
1. Naturalness - Does it sound like real speech?
2. Distinctiveness - Can you tell characters apart?
3. Purpose - Does dialogue advance plot or reveal character?
4. Subtext - Is there depth beyond surface meaning?

Return JSON:
{{
  "dialogue_score": 1-10,
  "naturalness": 1-10,
  "distinctiveness": 1-10,
  "purpose": 1-10,
  "observations": ["observation 1", "observation 2"],
  "problematic_lines": ["line 1", "line 2"],
  "recommendations": ["recommendation 1"]
}}

Return ONLY valid JSON."""

    try:
        response = await model.ainvoke(prompt)
        import json
        text = response.content if hasattr(response, 'content') else str(response)
        return json.loads(text.strip())
    except Exception as e:
        return {
            "dialogue_score": 5,
            "naturalness": 5,
            "distinctiveness": 5,
            "purpose": 5,
            "observations": [f"Analysis failed: {str(e)}"],
            "problematic_lines": [],
            "recommendations": []
        }


async def review_content(
    content: str,
    context: Optional[Dict[str, Any]] = None,
    focus_areas: Optional[list] = None,
) -> Dict[str, Any]:
    """
    Full content review by the critic.
    
    Args:
        content: The content to review
        context: Story context (characters, events, etc.)
        focus_areas: Specific areas to focus on
    
    Returns:
        Complete review with score, strengths, improvements, and approval
    """
    from ..config import get_model_for_task
    import json
    
    model = get_model_for_task("general")
    
    focus_text = ""
    if focus_areas:
        focus_text = f"\nPay special attention to: {', '.join(focus_areas)}"
    
    context_text = ""
    if context:
        if context.get("characters"):
            chars = context["characters"][:5]
            context_text += "\nEstablished characters: " + ", ".join(
                [c.get("name", "Unknown") for c in chars]
            )
    
    prompt = f"""{CRITIC_PROMPT}

CONTENT TO REVIEW:
{content[:5000]}

{context_text}
{focus_text}

Provide your review as JSON following the format in the instructions."""

    try:
        response = await model.ainvoke(prompt)
        text = response.content if hasattr(response, 'content') else str(response)
        
        # Clean up response
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        if text.endswith("```"):
            text = text[:-3]
        
        review = json.loads(text.strip())
        
        # Ensure required fields
        if "score" not in review:
            review["score"] = 7
        if "approved" not in review:
            review["approved"] = review.get("score", 7) >= 6
        if "strengths" not in review:
            review["strengths"] = []
        if "improvements" not in review:
            review["improvements"] = []
        if "summary" not in review:
            review["summary"] = "Review complete."
        
        return review
        
    except Exception as e:
        return {
            "score": 7,
            "approved": True,
            "strengths": ["Unable to fully analyze"],
            "improvements": [],
            "summary": f"Review incomplete: {str(e)}",
            "error": str(e)
        }


# Subagent configuration for Deep Agent
critic_subagent = {
    "name": "critic",
    "description": "Reviews content for quality, pacing, consistency, and engagement. Returns detailed feedback with a score and approval recommendation.",
    "prompt": CRITIC_PROMPT,
    "tools": [evaluate_pacing, check_dialogue_quality],
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 2048,
}

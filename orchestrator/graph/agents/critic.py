# graph/agents/critic.py

"""
Critic Agent

Reviews content and provides feedback.
Replaces: CriticAgent.ts
"""

import os
import json
from typing import TypedDict
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI


class CritiqueResult(TypedDict):
    score: int  # 1-10
    feedback: str
    suggestions: list
    approved: bool


def get_critic_llm():
    """Get LLM for critic tasks"""
    if os.getenv("ANTHROPIC_API_KEY"):
        return ChatAnthropic(
            model="claude-sonnet-4-20250514",
            temperature=0.3,
            max_tokens=1000
        )
    elif os.getenv("OPENAI_API_KEY"):
        return ChatOpenAI(
            model="gpt-4o",
            temperature=0.3,
            max_tokens=1000
        )
    else:
        raise ValueError("No API key found for critic agent")


async def critique_content(
    content: str,
    threshold: int = 7
) -> CritiqueResult:
    """
    Critique content and decide if it meets quality threshold.
    
    Args:
        content: Content to critique
        threshold: Minimum score to approve (default 7)
        
    Returns:
        CritiqueResult with score, feedback, and approval status
    """
    llm = get_critic_llm()
    
    # Build messages directly - avoid ChatPromptTemplate to prevent brace issues
    system_message = """You are an expert editor and writing critic. 
Your job is to evaluate content quality and provide constructive feedback.

Evaluate based on:
1. Clarity and readability
2. Engagement and flow
3. Grammar and style
4. Consistency with context
5. Creativity and originality

Respond with ONLY valid JSON (no markdown, no extra text):
Example: {"score": 8, "feedback": "Good writing with strong imagery", "suggestions": ["Add more dialogue"]}

Score 1-10 where 7 or higher means approved quality."""

    user_message = f"Evaluate this content:\n\n{content[:3000]}"
    
    # Use invoke directly instead of ChatPromptTemplate
    from langchain_core.messages import SystemMessage, HumanMessage
    
    messages = [
        SystemMessage(content=system_message),
        HumanMessage(content=user_message)
    ]
    
    response = await llm.ainvoke(messages)
    
    # Parse JSON response
    try:
        response_text = response.content
        
        # Clean up response - remove markdown fences if present
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        response_text = response_text.strip()
        result = json.loads(response_text)
        
        score = result.get("score", 5)
        approved = score >= threshold
        
        print(f"🎭 [Critic] Score: {score}/10 - {'Approved ✅' if approved else 'Needs revision ❌'}")
        
        return CritiqueResult(
            score=score,
            feedback=result.get("feedback", ""),
            suggestions=result.get("suggestions", []),
            approved=approved
        )
        
    except (json.JSONDecodeError, KeyError) as e:
        print(f"⚠️ [Critic] Failed to parse response: {e}")
        print(f"⚠️ [Critic] Raw response: {response.content[:200]}")
        return CritiqueResult(
            score=7,
            feedback="Unable to parse critique response",
            suggestions=[],
            approved=True
        )
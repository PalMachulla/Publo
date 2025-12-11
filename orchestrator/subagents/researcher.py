"""
Researcher Subagent

Conducts research for accuracy in creative writing.
Focuses on historical details, technical accuracy, cultural practices, etc.
"""

from typing import Dict, Any, Optional, List
from langchain_core.tools import tool
from ..prompts.subagent_prompts import RESEARCHER_PROMPT


@tool
async def research_topic(
    topic: str,
    context: str = "",
    depth: str = "standard",
) -> Dict[str, Any]:
    """
    Research a topic for creative writing accuracy.
    
    Args:
        topic: The topic to research
        context: Why this research is needed (story context)
        depth: "quick" (facts only), "standard", or "deep" (comprehensive)
    
    Returns:
        Research findings formatted for creative writing use
    """
    from ..config import get_model_for_task, settings
    from ..tools.mcp_tools import web_search
    
    # Try web search if available
    search_results = None
    if settings.TAVILY_API_KEY:
        search_results = await web_search(
            query=topic,
            max_results=5 if depth == "deep" else 3
        )
    
    # Format search results for LLM
    search_context = ""
    if search_results and search_results.get("results"):
        from ..tools.mcp_tools import format_search_results_for_prompt
        search_context = format_search_results_for_prompt(search_results)
    
    model = get_model_for_task("general")
    
    depth_instruction = {
        "quick": "Provide key facts only. Be concise.",
        "standard": "Provide useful details for creative writing.",
        "deep": "Provide comprehensive research with sources and nuances."
    }
    
    prompt = f"""{RESEARCHER_PROMPT}

RESEARCH TOPIC: {topic}

CONTEXT: {context}

{f'WEB SEARCH RESULTS:\n{search_context}' if search_context else ''}

DEPTH: {depth_instruction.get(depth, depth_instruction['standard'])}

Provide research findings as JSON following the format in the instructions."""

    try:
        response = await model.ainvoke(prompt)
        import json
        text = response.content if hasattr(response, 'content') else str(response)
        
        # Clean up
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        if text.endswith("```"):
            text = text[:-3]
        
        findings = json.loads(text.strip())
        findings["topic"] = topic
        findings["depth"] = depth
        
        return findings
        
    except Exception as e:
        return {
            "topic": topic,
            "depth": depth,
            "key_facts": [],
            "sensory_details": [],
            "vocabulary": [],
            "common_mistakes": [],
            "error": str(e)
        }


@tool
async def fact_check(
    claim: str,
    story_context: str = "",
) -> Dict[str, Any]:
    """
    Verify a specific claim or fact for accuracy.
    
    Args:
        claim: The claim to verify
        story_context: Context from the story
    
    Returns:
        Verification result with accuracy assessment
    """
    from ..config import get_model_for_task, settings
    from ..tools.mcp_tools import web_search
    
    # Search for verification
    search_results = None
    if settings.TAVILY_API_KEY:
        search_results = await web_search(
            query=f"fact check {claim}",
            max_results=3
        )
    
    search_context = ""
    if search_results and search_results.get("results"):
        from ..tools.mcp_tools import format_search_results_for_prompt
        search_context = format_search_results_for_prompt(search_results)
    
    model = get_model_for_task("fast")
    
    prompt = f"""Verify this claim for creative writing accuracy:

CLAIM: {claim}

STORY CONTEXT: {story_context}

{f'SEARCH RESULTS:\n{search_context}' if search_context else ''}

Return JSON:
{{
  "claim": "{claim}",
  "accuracy": "accurate|mostly_accurate|questionable|inaccurate|unverifiable",
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation",
  "corrections": ["Any needed corrections"],
  "creative_license_ok": true/false  // Is this the kind of thing where creative license is acceptable?
}}

Return ONLY valid JSON."""

    try:
        response = await model.ainvoke(prompt)
        import json
        text = response.content if hasattr(response, 'content') else str(response)
        return json.loads(text.strip())
    except Exception as e:
        return {
            "claim": claim,
            "accuracy": "unverifiable",
            "confidence": 0.0,
            "explanation": f"Verification failed: {str(e)}",
            "corrections": [],
            "creative_license_ok": True
        }


@tool
async def get_period_details(
    period: str,
    aspects: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Get period-specific details for historical accuracy.
    
    Args:
        period: Time period (e.g., "Victorian England", "1920s New York")
        aspects: Specific aspects to research (e.g., ["fashion", "transportation"])
    
    Returns:
        Period details organized by category
    """
    aspects = aspects or ["daily_life", "fashion", "language", "technology", "social_norms"]
    
    from ..config import get_model_for_task
    
    model = get_model_for_task("general")
    
    prompt = f"""Provide period-accurate details for creative writing.

PERIOD: {period}
ASPECTS TO COVER: {', '.join(aspects)}

For each aspect, provide:
- Authentic details a writer should include
- Common anachronisms to avoid
- Vocabulary/terms from the period

Return JSON:
{{
  "period": "{period}",
  "aspects": {{
    "aspect_name": {{
      "authentic_details": ["detail 1", "detail 2"],
      "avoid": ["anachronism 1", "anachronism 2"],
      "vocabulary": ["term 1", "term 2"]
    }}
  }},
  "general_atmosphere": "Overall feel/mood of the period",
  "quick_tips": ["tip 1", "tip 2"]
}}

Return ONLY valid JSON."""

    try:
        response = await model.ainvoke(prompt)
        import json
        text = response.content if hasattr(response, 'content') else str(response)
        
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        if text.endswith("```"):
            text = text[:-3]
        
        return json.loads(text.strip())
    except Exception as e:
        return {
            "period": period,
            "aspects": {},
            "general_atmosphere": "",
            "quick_tips": [],
            "error": str(e)
        }


# Subagent configuration for Deep Agent
researcher_subagent = {
    "name": "researcher",
    "description": "Conducts in-depth research on specific topics for accuracy in creative writing. Use for historical periods, technical details, cultural practices, etc.",
    "prompt": RESEARCHER_PROMPT,
    "tools": [research_topic, fact_check, get_period_details],
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 4096,
}

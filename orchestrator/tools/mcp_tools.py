"""
MCP Tool Integrations

External tools via Model Context Protocol (MCP).
Currently includes: web search, image generation (future).
"""

from typing import Optional, List, Dict, Any
from langchain_core.tools import tool


@tool
async def web_search(
    query: str,
    max_results: int = 5,
    search_depth: str = "basic",
) -> Dict[str, Any]:
    """
    Search the web for information.
    
    Use this for research: historical details, technical accuracy,
    current events, etc.
    
    Args:
        query: Search query
        max_results: Maximum number of results (default 5)
        search_depth: "basic" or "advanced" search depth
    
    Returns:
        Dictionary with:
        - results: List of search results
        - query: Original query
        - count: Number of results
    """
    from config import settings
    
    if not settings.TAVILY_API_KEY:
        return {
            "results": [],
            "query": query,
            "count": 0,
            "error": "Web search not configured (TAVILY_API_KEY missing)"
        }
    
    try:
        from langchain_community.tools.tavily_search import TavilySearchResults
        
        search_tool = TavilySearchResults(
            api_key=settings.TAVILY_API_KEY,
            max_results=max_results,
            search_depth=search_depth
        )
        
        # Run search
        results = await search_tool.ainvoke({"query": query})
        
        # Format results
        formatted_results = []
        if isinstance(results, list):
            for r in results:
                formatted_results.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", r.get("snippet", "")),
                })
        
        return {
            "results": formatted_results,
            "query": query,
            "count": len(formatted_results)
        }
        
    except ImportError:
        return {
            "results": [],
            "query": query,
            "count": 0,
            "error": "Tavily search not available - install langchain-community"
        }
    except Exception as e:
        return {
            "results": [],
            "query": query,
            "count": 0,
            "error": str(e)
        }


@tool
async def generate_image(
    prompt: str,
    style: str = "realistic",
    size: str = "1024x1024",
) -> Dict[str, Any]:
    """
    Generate an image based on a text prompt.
    
    Use this for character references, setting visualizations, etc.
    
    Args:
        prompt: Description of the image to generate
        style: Image style (realistic, artistic, sketch, etc.)
        size: Image dimensions
    
    Returns:
        Dictionary with:
        - url: URL of generated image
        - prompt: Original prompt
        - status: "complete" or "error"
    """
    from config import settings
    
    if not settings.MCP_IMAGE_GEN_ENABLED:
        return {
            "url": None,
            "prompt": prompt,
            "status": "disabled",
            "error": "Image generation is not enabled"
        }
    
    # TODO: Implement image generation when ready
    # Options:
    # - DALL-E 3 via OpenAI
    # - Stable Diffusion via Replicate
    # - Midjourney via API
    
    return {
        "url": None,
        "prompt": prompt,
        "status": "not_implemented",
        "error": "Image generation not yet implemented"
    }


def format_search_results_for_prompt(results: Dict[str, Any]) -> str:
    """
    Format search results for inclusion in an LLM prompt.
    
    Args:
        results: Results from web_search
    
    Returns:
        Formatted string for prompts
    """
    if not results.get("results"):
        return "No search results found."
    
    lines = [f"Search results for: {results.get('query', 'unknown')}"]
    lines.append("")
    
    for i, r in enumerate(results["results"], 1):
        title = r.get("title", "Untitled")
        content = r.get("content", "No content")
        url = r.get("url", "")
        
        lines.append(f"{i}. **{title}**")
        lines.append(f"   {content[:300]}..." if len(content) > 300 else f"   {content}")
        if url:
            lines.append(f"   Source: {url}")
        lines.append("")
    
    return "\n".join(lines)


async def get_configured_mcp_tools() -> List:
    """
    Get list of configured MCP tools based on settings.
    
    Returns:
        List of tool instances ready for use
    """
    from config import settings
    
    tools = []
    
    if settings.MCP_WEB_SEARCH_ENABLED and settings.TAVILY_API_KEY:
        tools.append(web_search)
    
    if settings.MCP_IMAGE_GEN_ENABLED:
        tools.append(generate_image)
    
    return tools

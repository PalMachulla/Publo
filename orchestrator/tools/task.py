"""
Task Tool for Subagent Spawning

Implements the Deep Agent `task` tool that spawns specialized subagents
for isolated, focused work on specific subtasks.
"""

from typing import Dict, Any, Optional, List
from langchain_core.tools import tool
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage
import json


# Registry of available subagents
SUBAGENT_REGISTRY: Dict[str, Dict[str, Any]] = {}


def register_subagent(config: Dict[str, Any]):
    """Register a subagent configuration."""
    SUBAGENT_REGISTRY[config["name"]] = config


def _load_subagents():
    """Lazy-load subagent configurations."""
    if SUBAGENT_REGISTRY:
        return
    
    try:
        from subagents.critic import critic_subagent
        register_subagent(critic_subagent)
    except ImportError as e:
        print(f"⚠️ Could not load critic subagent: {e}")
    
    try:
        from subagents.researcher import researcher_subagent
        register_subagent(researcher_subagent)
    except ImportError as e:
        print(f"⚠️ Could not load researcher subagent: {e}")


@tool
async def task(
    subagent: str,
    instruction: str,
    context: Optional[str] = None,
    node_id: str = "",
) -> Dict[str, Any]:
    """
    Spawn a specialized subagent for isolated, focused work.
    
    Use this when you need:
    - The critic to review content quality before finalizing
    - The researcher to gather accurate details for writing
    
    Args:
        subagent: Name of the subagent ("critic" or "researcher")
        instruction: Specific task for the subagent
        context: Additional context (content to review, topic details, etc.)
        node_id: Story/project node ID (injected by agent)
    
    Returns:
        Subagent's result with structured findings
    
    Example - Using critic:
        task(
            subagent="critic",
            instruction="Review this chapter opening for pacing and engagement",
            context="[chapter content here]"
        )
    
    Example - Using researcher:
        task(
            subagent="researcher", 
            instruction="Research Victorian-era London police procedures",
            context="Story involves a detective in 1888 London"
        )
    """
    from config import settings
    
    # Load subagents if not already loaded
    _load_subagents()
    
    # Validate subagent
    if subagent not in SUBAGENT_REGISTRY:
        available = list(SUBAGENT_REGISTRY.keys())
        return {
            "success": False,
            "error": f"Unknown subagent '{subagent}'. Available: {available}",
            "subagent": subagent
        }
    
    config = SUBAGENT_REGISTRY[subagent]
    
    print(f"🤖 [Task] Spawning subagent: {subagent}")
    print(f"📋 [Task] Instruction: {instruction[:100]}...")
    
    try:
        # Create subagent model
        model = ChatAnthropic(
            model=config.get("model", settings.MODEL_NAME),
            temperature=0.3,  # Lower temperature for focused work
            max_tokens=config.get("max_tokens", 2048),
            api_key=settings.ANTHROPIC_API_KEY,
        )
        
        # Build subagent prompt
        system_prompt = config.get("prompt", "")
        
        user_message = f"""## Task
{instruction}

## Context
{context or 'No additional context provided.'}

## Instructions
Complete the task according to your specialization. Return structured results."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message)
        ]
        
        # Execute subagent
        response = await model.ainvoke(messages)
        content = response.content if hasattr(response, 'content') else str(response)
        
        # Try to parse as JSON
        result = None
        try:
            # Clean up markdown code blocks
            clean_content = content.strip()
            if clean_content.startswith("```"):
                clean_content = clean_content.split("```")[1]
                if clean_content.startswith("json"):
                    clean_content = clean_content[4:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
            
            result = json.loads(clean_content.strip())
        except (json.JSONDecodeError, IndexError):
            # Return raw content if not JSON
            result = {"raw_response": content}
        
        print(f"✅ [Task] Subagent {subagent} completed")
        
        return {
            "success": True,
            "subagent": subagent,
            "instruction": instruction,
            "result": result
        }
        
    except Exception as e:
        print(f"❌ [Task] Subagent {subagent} failed: {e}")
        return {
            "success": False,
            "subagent": subagent,
            "instruction": instruction,
            "error": str(e)
        }


@tool
def list_subagents() -> Dict[str, Any]:
    """
    List available subagents and their capabilities.
    
    Returns:
        Dictionary of available subagents with descriptions
    """
    _load_subagents()
    
    agents = []
    for name, config in SUBAGENT_REGISTRY.items():
        agents.append({
            "name": name,
            "description": config.get("description", "No description"),
            "tools": [t.name for t in config.get("tools", []) if hasattr(t, 'name')]
        })
    
    return {
        "available_subagents": agents,
        "count": len(agents)
    }

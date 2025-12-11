"""
Publo Deep Agent Prompts

System prompts for the main agent and subagents.
"""

from .main_agent import PUBLO_SYSTEM_PROMPT
from .subagent_prompts import CRITIC_PROMPT, RESEARCHER_PROMPT

__all__ = [
    "PUBLO_SYSTEM_PROMPT",
    "CRITIC_PROMPT", 
    "RESEARCHER_PROMPT",
]

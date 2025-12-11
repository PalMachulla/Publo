"""
Publo Subagents

Specialized agents that can be spawned by the main Deep Agent
for focused, isolated work (e.g., content review, research).
"""

from .critic import critic_subagent, CRITIC_PROMPT
from .researcher import researcher_subagent, RESEARCHER_PROMPT

__all__ = [
    "critic_subagent",
    "researcher_subagent",
    "CRITIC_PROMPT",
    "RESEARCHER_PROMPT",
]

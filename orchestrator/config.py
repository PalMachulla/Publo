"""
Publo Orchestrator Configuration

Centralized configuration using pydantic-settings.
Loads from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache
import os


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    Usage:
        from config import settings
        model = settings.MODEL_NAME
    """
    
    # ========================================
    # Model Configuration
    # ========================================
    MODEL_NAME: str = "claude-sonnet-4-5-20250929"
    TEMPERATURE: float = 0.7
    WRITING_TEMPERATURE: float = 0.8  # Slightly higher for creative writing
    MAX_TOKENS: int = 4096
    
    # Fallback model for less complex tasks
    FAST_MODEL_NAME: str = "gpt-4o-mini"
    FAST_MODEL_TEMPERATURE: float = 0.3
    
    # ========================================
    # Feature Flags
    # ========================================
    USE_DEEP_AGENT: bool = True  # New Deep Agent architecture
    USE_LEGACY_WORKFLOW: bool = False  # Old LangGraph workflow (deprecated)
    ENABLE_HITL: bool = True  # Human-in-the-loop for destructive operations
    ENABLE_MCP: bool = True  # MCP tool integrations
    ENABLE_CRITIC: bool = True  # Critic subagent for content review
    
    # ========================================
    # MCP Configuration
    # ========================================
    MCP_WEB_SEARCH_ENABLED: bool = True
    MCP_IMAGE_GEN_ENABLED: bool = False  # Enable when ready
    TAVILY_API_KEY: Optional[str] = None
    
    # ========================================
    # Database (Supabase)
    # ========================================
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""  # Service role key for backend
    SUPABASE_SERVICE_KEY: str = ""  # Alternative name for service role key
    SUPABASE_ANON_KEY: str = ""  # Anon key (if needed)
    
    # ========================================
    # AI Provider Keys
    # ========================================
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_AI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    
    # ========================================
    # LangSmith Tracing
    # ========================================
    LANGSMITH_API_KEY: Optional[str] = None
    LANGSMITH_TRACING: bool = False
    LANGSMITH_PROJECT: str = "publo-orchestrator"
    
    # ========================================
    # Server Configuration
    # ========================================
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:3000"
    
    # ========================================
    # Rate Limiting
    # ========================================
    MAX_REQUESTS_PER_MINUTE: int = 60
    MAX_TOKENS_PER_REQUEST: int = 100000
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra env vars


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    
    Uses lru_cache to avoid re-reading env vars on every call.
    """
    return Settings()


# Convenience alias
settings = get_settings()


# ========================================
# Helper Functions
# ========================================

def get_supabase_client():
    """
    Get a Supabase client instance.
    
    Returns:
        Supabase client configured with service role key
    """
    from supabase import create_client, Client
    
    # Accept either SUPABASE_KEY or SUPABASE_SERVICE_KEY
    supabase_key = settings.SUPABASE_KEY or settings.SUPABASE_SERVICE_KEY
    
    if not settings.SUPABASE_URL or not supabase_key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_KEY) must be set in environment"
        )
    
    return create_client(settings.SUPABASE_URL, supabase_key)


async def get_mcp_tools() -> List:
    """
    Get configured MCP tools if enabled.
    
    Returns:
        List of MCP tool instances, or empty list if disabled
    """
    if not settings.ENABLE_MCP:
        return []
    
    tools = []
    
    # Web search via Tavily
    if settings.MCP_WEB_SEARCH_ENABLED and settings.TAVILY_API_KEY:
        try:
            from langchain_community.tools.tavily_search import TavilySearchResults
            tools.append(TavilySearchResults(
                api_key=settings.TAVILY_API_KEY,
                max_results=5
            ))
        except ImportError:
            print("⚠️ Tavily search not available - install langchain-community")
    
    # TODO: Add image generation when ready
    # if settings.MCP_IMAGE_GEN_ENABLED:
    #     tools.append(...)
    
    return tools


def get_model_for_task(task_type: str = "general"):
    """
    Get the appropriate model for a given task type.
    
    Args:
        task_type: Type of task (general, writing, analysis, fast)
    
    Returns:
        Configured LLM instance
    """
    from langchain_anthropic import ChatAnthropic
    from langchain_openai import ChatOpenAI
    
    if task_type == "fast":
        # Use fast model for simple tasks
        return ChatOpenAI(
            model=settings.FAST_MODEL_NAME,
            temperature=settings.FAST_MODEL_TEMPERATURE,
            api_key=settings.OPENAI_API_KEY,
        )
    
    elif task_type == "writing":
        # Use main model with higher temperature for creativity
        return ChatAnthropic(
            model=settings.MODEL_NAME,
            temperature=settings.WRITING_TEMPERATURE,
            max_tokens=settings.MAX_TOKENS,
            api_key=settings.ANTHROPIC_API_KEY,
        )
    
    elif task_type == "librarian":
        # Use fast model for Librarian tasks (summaries, analysis)
        return ChatOpenAI(
            model=settings.FAST_MODEL_NAME,
            temperature=0.5,  # Balanced for structured + creative output
            api_key=settings.OPENAI_API_KEY,
        )
    
    else:
        # Default: main model with standard temperature
        return ChatAnthropic(
            model=settings.MODEL_NAME,
            temperature=settings.TEMPERATURE,
            max_tokens=settings.MAX_TOKENS,
            api_key=settings.ANTHROPIC_API_KEY,
        )

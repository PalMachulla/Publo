"""
Intent Analyzer - Main Entry Point

This orchestrates the intent analysis pipeline:
1. Try pattern matching (fast, no LLM)
2. If no match, use deep LLM analysis

Equivalent to your intentRouter.ts analyzeIntent() function.
"""

from .types import IntentAnalysis, PipelineContext
from .classifier import classify_with_patterns
from .deep_analyzer import get_deep_analyzer


async def analyze_intent(
    message: str,
    context: PipelineContext
) -> IntentAnalysis:
    """
    Analyze user intent from their message.
    
    Pipeline:
    1. Pattern matching (Stage 1 - fast)
    2. Deep LLM analysis (Stage 3 - if patterns don't match)
    
    This is the main entry point for intent analysis.
    
    Args:
        message: The user's message to analyze
        context: Pipeline context (document state, canvas, history)
        
    Returns:
        IntentAnalysis with detected intent and metadata
    
    Example:
        >>> context = PipelineContext(
        ...     message="Write chapter 1",
        ...     activeSegment={"id": "ch1", "name": "Chapter 1", "level": 2},
        ...     documentPanelOpen=True
        ... )
        >>> result = await analyze_intent("Write chapter 1", context)
        >>> print(result.intent)
        'write_content'
    """
    print(f"🎯 [IntentAnalyzer] Analyzing: {message[:50]}...")
    
    # ============================================================
    # STAGE 1: Pattern Matching (Fast Path)
    # ============================================================
    pattern_result = classify_with_patterns(message, context)
    
    if pattern_result is not None:
        print(f"✅ [IntentAnalyzer] Pattern match: {pattern_result.intent} (confidence: {pattern_result.confidence})")
        return pattern_result
    
    # ============================================================
    # STAGE 3: Deep LLM Analysis (Slow Path)
    # ============================================================
    # Pattern matching didn't give a confident result, use LLM
    print("🔍 [IntentAnalyzer] No pattern match, using deep analysis...")
    
    analyzer = get_deep_analyzer()
    result = await analyzer.analyze(message, context)
    
    print(f"✅ [IntentAnalyzer] Deep analysis: {result.intent} (confidence: {result.confidence})")
    return result


# ============================================================
# CONVENIENCE FUNCTIONS
# ============================================================

from typing import Optional

def classify_only(message: str, context: PipelineContext) -> Optional[IntentAnalysis]:
    """
    Run only pattern matching (synchronous, no LLM).
    
    Useful for testing or when you want to avoid LLM calls.
    Returns None if no pattern matches.
    """
    return classify_with_patterns(message, context)


async def analyze_with_llm(message: str, context: PipelineContext) -> IntentAnalysis:
    """
    Force LLM analysis (skip pattern matching).
    
    Useful for complex messages or testing LLM behavior.
    """
    analyzer = get_deep_analyzer()
    return await analyzer.analyze(message, context)

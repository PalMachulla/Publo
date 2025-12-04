"""
Pattern-Based Intent Classifier

This is the Python equivalent of your classifier.ts

It uses regex patterns to quickly classify simple intents without
calling an LLM. This saves tokens and reduces latency for common requests.

Returns IntentAnalysis for high-confidence matches, None if needs LLM.
"""

import re
from typing import Optional
from .types import IntentAnalysis, PipelineContext


# ============================================================
# PATTERN DEFINITIONS
# ============================================================
# These map to your SIMPLE_PATTERNS, COMPLEX_PATTERNS, STRUCTURE_PATTERNS

SIMPLE_PATTERNS = {
    # Navigation patterns (when document is open)
    "navigate": [
        re.compile(r"go to|jump to|navigate to|take me to|show me|find the", re.IGNORECASE),
    ],
    
    # Write content patterns (when segment is selected)
    "write": [
        re.compile(r"\b(write|expand|continue|generate|create content|fill in|draft)\b", re.IGNORECASE),
    ],
    
    # Rewrite with coherence (multi-section operations)
    "rewriteCoherence": [
        re.compile(r"(rewrite|update|change).*(coherent|consistent|flow|match)", re.IGNORECASE),
        re.compile(r"make (it |this |them )?(all )?(coherent|consistent|flow)", re.IGNORECASE),
    ],
    
    # Improve content patterns
    "improve": [
        re.compile(r"\b(improve|enhance|refine|polish|make (it )?better|fix)\b", re.IGNORECASE),
    ],
    
    # Delete patterns
    "delete": [
        re.compile(r"\b(delete|remove|discard|trash|get rid of)\b", re.IGNORECASE),
    ],
    
    # Question patterns
    "answer": [
        re.compile(r"^(what|who|where|when|why|how|can you|could you|tell me|explain)\b", re.IGNORECASE),
        re.compile(r"\?$"),  # Ends with question mark
    ],
    
    # Open and write patterns (reference to canvas node)
    "openAndWrite": [
        re.compile(r"(write|expand|continue).*(in|for|on) (the |my )?", re.IGNORECASE),
    ],
    
    # Modify structure patterns
    "modifyStructure": [
        re.compile(r"(add|insert|move|reorder|reorganize|restructure)", re.IGNORECASE),
        re.compile(r"(new|another) (chapter|scene|act|section|part)", re.IGNORECASE),
    ],
}

# Structure creation patterns (only when document panel is closed)
STRUCTURE_PATTERNS = [
    re.compile(r"\b(create|start|begin|make|build|write)\b.*(novel|story|book|screenplay|script|podcast|report)", re.IGNORECASE),
    re.compile(r"\b(novel|story|book|screenplay|script|podcast|report)\b.*(about|on|regarding)", re.IGNORECASE),
    re.compile(r"^(a |the )?(new )?(novel|story|book|screenplay|script|podcast|report)", re.IGNORECASE),
]

# Complex patterns that need deeper analysis
COMPLEX_PATTERNS = [
    re.compile(r"(like|similar to|based on|inspired by)", re.IGNORECASE),
    re.compile(r"(but|however|although|except)", re.IGNORECASE),
    re.compile(r"(if|when|unless|until)", re.IGNORECASE),
]


# ============================================================
# CLASSIFIER FUNCTION
# ============================================================

def classify_with_patterns(
    message: str,
    context: PipelineContext
) -> Optional[IntentAnalysis]:
    """
    Try to classify intent using pattern matching.
    
    Returns IntentAnalysis if high-confidence match, None if needs LLM.
    
    This mirrors your classifyWithPatterns() function in classifier.ts
    """
    normalized = message.lower().strip()
    has_active_segment = context.activeSegment is not None
    document_panel_open = context.documentPanelOpen
    
    # ============================================================
    # PRIORITY 0: Navigation (when document is open)
    # ============================================================
    if document_panel_open:
        if any(p.search(message) for p in SIMPLE_PATTERNS["navigate"]):
            return IntentAnalysis(
                intent="navigate_section",
                confidence=0.95,
                reasoning=f"User wants to navigate to a specific section within the currently open {context.documentFormat or 'document'}",
                suggestedAction=f'Find and select the requested section: "{message}"',
                requiresContext=False,
                suggestedModel="orchestrator",
                usedLLM=False
            )
    
    # ============================================================
    # PRIORITY 1: Write content (when segment is selected)
    # ============================================================
    if has_active_segment:
        segment_name = context.activeSegment.get("name", "selected section")
        
        if any(p.search(message) for p in SIMPLE_PATTERNS["write"]):
            return IntentAnalysis(
                intent="write_content",
                confidence=0.95,
                reasoning=f'User explicitly requested content generation for "{segment_name}" with keywords like "write", "expand", or "continue"',
                suggestedAction=f'Generate content for the selected section: "{segment_name}"',
                requiresContext=True,
                suggestedModel="writer",
                usedLLM=False
            )
        
        # Rewrite with coherence
        if any(p.search(message) for p in SIMPLE_PATTERNS["rewriteCoherence"]):
            return IntentAnalysis(
                intent="rewrite_with_coherence",
                confidence=0.95,
                reasoning=f'User wants multi-section operation: modify "{segment_name}" and/or other sections (coherence/batch generation)',
                suggestedAction="Analyze dependencies, write/rewrite sections, and ensure story consistency",
                requiresContext=True,
                suggestedModel="orchestrator",
                usedLLM=False
            )
        
        # Improve content
        if any(p.search(message) for p in SIMPLE_PATTERNS["improve"]):
            return IntentAnalysis(
                intent="improve_content",
                confidence=0.9,
                reasoning=f'User wants to improve existing content in "{segment_name}"',
                suggestedAction=f'Refine and enhance the content in: "{segment_name}"',
                requiresContext=True,
                suggestedModel="editor",
                usedLLM=False
            )
    
    # ============================================================
    # PRIORITY 2: Delete node
    # ============================================================
    if any(p.search(message) for p in SIMPLE_PATTERNS["delete"]):
        return IntentAnalysis(
            intent="delete_node",
            confidence=0.9,
            reasoning="User wants to delete/remove a canvas node",
            suggestedAction="Identify which node to delete and confirm with user",
            requiresContext=False,
            suggestedModel="orchestrator",
            usedLLM=False
        )
    
    # ============================================================
    # PRIORITY 3: Answer question
    # ============================================================
    if any(p.search(message) for p in SIMPLE_PATTERNS["answer"]):
        return IntentAnalysis(
            intent="answer_question",
            confidence=0.9,
            reasoning="User is asking for explanation or information based on interrogative patterns",
            suggestedAction="Answer the user's question using orchestrator model in chat",
            requiresContext=False,
            suggestedModel="orchestrator",
            usedLLM=False
        )
    
    # ============================================================
    # PRIORITY 4: Open and write (when canvas node is referenced)
    # ============================================================
    if not document_panel_open and not has_active_segment and context.canvasContext:
        if any(p.search(message) for p in SIMPLE_PATTERNS["openAndWrite"]):
            return IntentAnalysis(
                intent="open_and_write",
                confidence=0.95,
                reasoning="User wants to write content in an existing canvas node - will auto-open document",
                suggestedAction="Open the referenced document and prepare for content writing",
                requiresContext=False,
                suggestedModel="orchestrator",
                usedLLM=False
            )
    
    # ============================================================
    # PRIORITY 5: Structure creation (only when document panel is closed)
    # ============================================================
    if not document_panel_open and not has_active_segment:
        if any(p.search(message) for p in STRUCTURE_PATTERNS):
            return IntentAnalysis(
                intent="create_structure",
                confidence=0.9,
                reasoning="User wants to create a new story structure from scratch (document panel is closed)",
                suggestedAction="Generate a complete story structure using orchestrator model",
                requiresContext=False,
                suggestedModel="orchestrator",
                usedLLM=False
            )
    
    # ============================================================
    # PRIORITY 6: Modify structure
    # ============================================================
    if any(p.search(message) for p in SIMPLE_PATTERNS["modifyStructure"]):
        return IntentAnalysis(
            intent="modify_structure",
            confidence=0.85,
            reasoning="User wants to modify the existing story structure",
            suggestedAction="Update the story structure based on user request",
            requiresContext=False,
            suggestedModel="orchestrator",
            usedLLM=False
        )
    
    # ============================================================
    # Check for complex patterns (needs deeper analysis)
    # ============================================================
    if any(p.search(message) for p in COMPLEX_PATTERNS):
        return None  # Needs LLM analysis
    
    # No pattern match - needs deeper analysis
    return None

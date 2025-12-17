"""
Intent Analysis Types

These are the Python equivalents of your TypeScript types:
- IntentAnalysis (from intentRouter.ts)
- PipelineContext (from pipeline/types.ts)
- UserIntent (enum of possible intents)

Pydantic models provide:
- Type validation (like Zod)
- Serialization to/from JSON
- Auto-generated OpenAPI docs
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


# ============================================================
# USER INTENT ENUM
# ============================================================

class UserIntent(str, Enum):
    """
    All possible user intents that the system can detect.
    
    Maps to your UserIntent type in intentRouter.ts
    """
    # Structure operations
    CREATE_STRUCTURE = "create_structure"
    MODIFY_STRUCTURE = "modify_structure"
    
    # Content operations
    WRITE_CONTENT = "write_content"
    IMPROVE_CONTENT = "improve_content"
    REWRITE_WITH_COHERENCE = "rewrite_with_coherence"
    
    # Navigation
    NAVIGATE_SECTION = "navigate_section"
    OPEN_AND_WRITE = "open_and_write"
    
    # Node operations
    DELETE_NODE = "delete_node"
    
    # Conversation
    ANSWER_QUESTION = "answer_question"
    GENERAL_CHAT = "general_chat"
    
    # Special
    CLARIFICATION_NEEDED = "clarification_needed"


# ============================================================
# PIPELINE CONTEXT
# ============================================================

class PipelineContext(BaseModel):
    """
    Context passed through the intent analysis pipeline.
    
    Maps to your PipelineContext type from pipeline/types.ts
    """
    message: str = Field(..., description="The user's message")
    
    # Document panel state
    activeSegment: Optional[dict] = Field(
        None, 
        description="Currently selected section {id, name, level, content?}"
    )
    documentPanelOpen: bool = Field(
        False, 
        description="Whether document panel is open"
    )
    documentFormat: Optional[str] = Field(
        None, 
        description="Format of open document (novel, screenplay, etc.)"
    )
    
    # Canvas state
    canvasContext: Optional[dict] = Field(
        None, 
        description="Canvas nodes and edges"
    )
    
    # Conversation history
    conversationHistory: list[dict] = Field(
        default_factory=list,
        description="Recent messages [{role, content}]"
    )
    
    class Config:
        # Allow extra fields for forward compatibility
        extra = "allow"


# ============================================================
# INTENT ANALYSIS RESULT
# ============================================================

class IntentAnalysis(BaseModel):
    """
    Result of intent analysis.
    
    Maps to your IntentAnalysis type from intentRouter.ts
    """
    intent: str = Field(
        ..., 
        description="Detected intent (e.g., 'write_content', 'create_structure')"
    )
    confidence: float = Field(
        ..., 
        ge=0, 
        le=1, 
        description="Confidence score from 0 to 1"
    )
    reasoning: str = Field(
        ..., 
        description="Explanation of why this intent was detected"
    )
    suggestedAction: str = Field(
        ..., 
        description="What action the orchestrator should take"
    )
    requiresContext: bool = Field(
        False, 
        description="Whether the action needs canvas/document context"
    )
    suggestedModel: str = Field(
        "orchestrator", 
        description="Which model type to use (orchestrator, writer, editor)"
    )
    needsClarification: bool = Field(
        False, 
        description="Whether to ask user for clarification"
    )
    clarifyingQuestion: Optional[str] = Field(
        None, 
        description="Question to ask if needsClarification is true"
    )
    extractedEntities: dict = Field(
        default_factory=dict, 
        description="Entities extracted from the message (e.g., chapter names)"
    )
    usedLLM: bool = Field(
        False, 
        description="Whether LLM was used (vs pattern matching only)"
    )
    
    class Config:
        # Allow serialization of the model
        from_attributes = True

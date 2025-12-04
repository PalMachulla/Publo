"""
Intent Analysis API

This is the Python equivalent of your intentRouter.ts + classifier.ts + DeepAnalyzer.ts

The flow mirrors your TypeScript pipeline:
1. Pattern matching (classifier.ts) → Fast, no LLM call
2. If no match → Deep analysis with LLM (DeepAnalyzer.ts)

Usage from your Next.js frontend:
    const response = await fetch('http://localhost:8000/api/intent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: userMessage,
            context: {
                activeSegment: selectedSection,
                documentPanelOpen: isDocPanelOpen,
                canvasContext: canvasState,
                conversationHistory: recentMessages
            }
        })
    })
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Literal
import os

# Import our intent analysis module
from orchestrator.intent.analyzer import analyze_intent
from orchestrator.intent.types import IntentAnalysis, PipelineContext

router = APIRouter()


# ============================================================
# REQUEST/RESPONSE MODELS (Pydantic = TypeScript's Zod)
# ============================================================

class ActiveSegment(BaseModel):
    """Currently selected section in the document panel"""
    id: str
    name: str
    level: int = 1
    content: Optional[str] = None


class CanvasNode(BaseModel):
    """A node on the canvas (simplified for intent analysis)"""
    nodeId: str
    nodeType: str
    label: str
    format: Optional[str] = None


class CanvasContext(BaseModel):
    """Canvas state for context resolution"""
    connectedNodes: list[CanvasNode] = []
    allNodes: list[CanvasNode] = []
    totalNodes: int = 0


class ConversationMessage(BaseModel):
    """A message in the conversation history"""
    role: Literal["user", "assistant", "orchestrator"]
    content: str


class IntentRequest(BaseModel):
    """
    Request body for intent analysis.
    
    This maps to your PipelineContext type in TypeScript.
    """
    message: str = Field(..., description="The user's message to analyze")
    
    # Context fields (all optional for flexibility)
    activeSegment: Optional[ActiveSegment] = Field(
        None, 
        description="Currently selected section (if document panel is open)"
    )
    documentPanelOpen: bool = Field(
        False, 
        description="Whether the document panel is open"
    )
    documentFormat: Optional[str] = Field(
        None, 
        description="Format of the open document (novel, screenplay, etc.)"
    )
    canvasContext: Optional[CanvasContext] = Field(
        None, 
        description="Canvas state for node resolution"
    )
    conversationHistory: list[ConversationMessage] = Field(
        default_factory=list,
        description="Recent conversation messages for context"
    )


class IntentResponse(BaseModel):
    """
    Response from intent analysis.
    
    This maps to your IntentAnalysis type in TypeScript.
    """
    intent: str = Field(..., description="Detected intent (create_structure, write_content, etc.)")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score 0-1")
    reasoning: str = Field(..., description="Why this intent was detected")
    suggestedAction: str = Field(..., description="What action to take")
    requiresContext: bool = Field(False, description="Whether the action needs canvas context")
    suggestedModel: str = Field("orchestrator", description="Which model to use")
    needsClarification: bool = Field(False, description="Whether to ask for clarification")
    clarifyingQuestion: Optional[str] = Field(None, description="Question to ask user")
    extractedEntities: dict = Field(default_factory=dict, description="Entities extracted from message")
    usedLLM: bool = Field(False, description="Whether LLM was used (vs pattern matching)")


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/analyze", response_model=IntentResponse)
async def analyze_intent_endpoint(request: IntentRequest):
    """
    Analyze user intent from their message.
    
    This endpoint mirrors your intentRouter.analyzeIntent() function.
    
    Process:
    1. Try pattern matching first (fast, no API call)
    2. If no match, use LLM for deep analysis
    3. Return structured intent analysis
    
    Example:
        POST /api/intent/analyze
        {
            "message": "Write chapter 1",
            "activeSegment": {"id": "ch1", "name": "Chapter 1", "level": 2},
            "documentPanelOpen": true
        }
        
        Response:
        {
            "intent": "write_content",
            "confidence": 0.95,
            "reasoning": "User explicitly requested content generation...",
            "suggestedAction": "Generate content for Chapter 1",
            ...
        }
    """
    try:
        # Convert Pydantic models to our internal types
        context = PipelineContext(
            message=request.message,
            activeSegment=request.activeSegment.model_dump() if request.activeSegment else None,
            documentPanelOpen=request.documentPanelOpen,
            documentFormat=request.documentFormat,
            canvasContext=request.canvasContext.model_dump() if request.canvasContext else None,
            conversationHistory=[msg.model_dump() for msg in request.conversationHistory]
        )
        
        # Run the analysis pipeline
        result = await analyze_intent(request.message, context)
        
        return IntentResponse(**result.model_dump())
        
    except Exception as e:
        # Log the error (in production, use proper logging)
        print(f"❌ Intent analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Intent analysis failed: {str(e)}")


@router.post("/classify")
async def classify_only(request: IntentRequest):
    """
    Pattern-based classification only (no LLM).
    
    This is useful for testing pattern matching or when you want
    to avoid LLM calls for simple intents.
    
    Returns null if no pattern matches.
    """
    from orchestrator.intent.classifier import classify_with_patterns
    
    context = PipelineContext(
        message=request.message,
        activeSegment=request.activeSegment.model_dump() if request.activeSegment else None,
        documentPanelOpen=request.documentPanelOpen,
        documentFormat=request.documentFormat,
        canvasContext=request.canvasContext.model_dump() if request.canvasContext else None,
        conversationHistory=[msg.model_dump() for msg in request.conversationHistory]
    )
    
    result = classify_with_patterns(request.message, context)
    
    if result:
        return IntentResponse(**result.model_dump())
    else:
        return {"matched": False, "message": "No pattern matched - would need LLM analysis"}

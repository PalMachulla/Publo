"""
Orchestration API

This will eventually contain the full orchestration flow.
For now, it's a stub that demonstrates the endpoint structure.

Future endpoints:
- POST /orchestrate - Full orchestration flow
- POST /orchestrate/stream - With Server-Sent Events for real-time updates
- POST /actions/execute - Execute a specific action
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class OrchestrateRequest(BaseModel):
    """
    Request for full orchestration.
    This will eventually match your OrchestratorRequest type.
    """
    message: str
    userId: str
    # Canvas state (snapshot from frontend)
    canvasNodes: list[dict] = []
    canvasEdges: list[dict] = []
    # Document state
    activeDocumentId: Optional[str] = None
    selectedSectionId: Optional[str] = None
    documentPanelOpen: bool = False


@router.post("/orchestrate")
async def orchestrate(request: OrchestrateRequest):
    """
    Full orchestration endpoint.
    
    This will eventually:
    1. Analyze intent
    2. Build context
    3. Generate actions
    4. Execute actions (or return for UI execution)
    
    For now, returns a stub response.
    """
    return {
        "status": "stub",
        "message": "Full orchestration not yet implemented",
        "received": {
            "message": request.message,
            "userId": request.userId,
            "nodeCount": len(request.canvasNodes)
        },
        "nextSteps": [
            "1. Implement intent analysis (in progress)",
            "2. Implement state management",
            "3. Implement LangGraph workflow",
            "4. Implement action execution"
        ]
    }


@router.get("/status")
async def orchestrator_status():
    """
    Get current orchestrator status.
    Useful for the frontend to check if backend is ready.
    """
    return {
        "status": "ready",
        "capabilities": [
            "intent_analysis",  # ✅ Implemented
            # "full_orchestration",  # Coming soon
            # "multi_agent",  # Coming later
        ],
        "version": "0.1.0"
    }

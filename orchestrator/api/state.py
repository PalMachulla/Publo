# api/state.py

"""
State Management API

Handles session creation, message persistence, and state retrieval.
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import os
from supabase import create_client, Client

router = APIRouter()

# Initialize Supabase client
def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")  # Use service key for backend
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


# ============================================================
# MODELS
# ============================================================

class CreateSessionRequest(BaseModel):
    user_id: str
    canvas_id: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class SessionResponse(BaseModel):
    id: str
    user_id: str
    created_at: str
    is_active: bool
    metadata: dict


class AddMessageRequest(BaseModel):
    session_id: str
    role: Literal["user", "orchestrator", "system"]
    content: str
    type: str = "message"
    metadata: dict = Field(default_factory=dict)


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    type: str
    created_at: str
    metadata: dict


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/sessions", response_model=SessionResponse)
async def create_session(request: CreateSessionRequest):
    """Create a new orchestrator session."""
    try:
        supabase = get_supabase()
        
        result = supabase.table("orchestrator_sessions").insert({
            "user_id": request.user_id,
            "canvas_id": request.canvas_id,
            "metadata": request.metadata,
            "is_active": True
        }).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create session")
        
        session = result.data[0]
        return SessionResponse(
            id=session["id"],
            user_id=session["user_id"],
            created_at=session["created_at"],
            is_active=session["is_active"],
            metadata=session["metadata"] or {}
        )
    except Exception as e:
        print(f"❌ [State API] Create session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{user_id}/active", response_model=Optional[SessionResponse])
async def get_active_session(user_id: str):
    """Get the active session for a user, or None if no active session."""
    try:
        supabase = get_supabase()
        
        result = supabase.table("orchestrator_sessions")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("is_active", True)\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
        
        if not result.data:
            return None
        
        session = result.data[0]
        return SessionResponse(
            id=session["id"],
            user_id=session["user_id"],
            created_at=session["created_at"],
            is_active=session["is_active"],
            metadata=session["metadata"] or {}
        )
    except Exception as e:
        print(f"❌ [State API] Get session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/messages", response_model=MessageResponse)
async def add_message(request: AddMessageRequest):
    """Add a message to a session."""
    try:
        supabase = get_supabase()
        
        result = supabase.table("orchestrator_messages").insert({
            "session_id": request.session_id,
            "role": request.role,
            "content": request.content,
            "type": request.type,
            "metadata": request.metadata
        }).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to add message")
        
        msg = result.data[0]
        return MessageResponse(
            id=msg["id"],
            session_id=msg["session_id"],
            role=msg["role"],
            content=msg["content"],
            type=msg["type"],
            created_at=msg["created_at"],
            metadata=msg["metadata"] or {}
        )
    except Exception as e:
        print(f"❌ [State API] Add message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str, limit: int = 50):
    """Get messages for a session."""
    try:
        supabase = get_supabase()
        
        result = supabase.table("orchestrator_messages")\
            .select("*")\
            .eq("session_id", session_id)\
            .order("created_at", desc=False)\
            .limit(limit)\
            .execute()
        
        return {
            "messages": [
                MessageResponse(
                    id=msg["id"],
                    session_id=msg["session_id"],
                    role=msg["role"],
                    content=msg["content"],
                    type=msg["type"],
                    created_at=msg["created_at"],
                    metadata=msg["metadata"] or {}
                ) for msg in (result.data or [])
            ]
        }
    except Exception as e:
        print(f"❌ [State API] Get messages error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def end_session(session_id: str):
    """Mark a session as inactive (soft delete)."""
    try:
        supabase = get_supabase()
        
        result = supabase.table("orchestrator_sessions")\
            .update({"is_active": False})\
            .eq("id", session_id)\
            .execute()
        
        return {"status": "success", "session_id": session_id}
    except Exception as e:
        print(f"❌ [State API] End session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
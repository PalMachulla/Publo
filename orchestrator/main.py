"""
Publo Backend - Main Application Entry Point

This is the equivalent of your Next.js API routes, but as a standalone Python server.

Run with:
    uvicorn main:app --reload --port 8000

Then visit:
    http://localhost:8000/docs  - Interactive API documentation
    http://localhost:8000/redoc - Alternative documentation

The --reload flag auto-restarts when you change code (like Next.js dev mode).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# ============================================================
# APPLICATION SETUP
# ============================================================

app = FastAPI(
    title="Publo Orchestrator Backend",
    description="AI orchestration service for the Publo creative writing platform",
    version="0.1.0",
)

# ============================================================
# CORS CONFIGURATION
# ============================================================
# This allows your Next.js frontend to call this backend.
# In production, replace "*" with your actual frontend URL.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
        "http://localhost:3001",  # Alternative port
        os.getenv("FRONTEND_URL", "*"),  # Production URL from env
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# ROUTES
# ============================================================

# Import routers (we'll create these)
from api.intent import router as intent_router
from api.orchestrate import router as orchestrate_router
from api.health import router as health_router

# Mount routers
app.include_router(health_router, tags=["Health"])
app.include_router(intent_router, prefix="/api/intent", tags=["Intent Analysis"])
app.include_router(orchestrate_router, prefix="/api/orchestrator", tags=["Orchestration"])

# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
async def root():
    """
    Root endpoint - confirms the server is running.
    Equivalent to a health check.
    """
    return {
        "status": "running",
        "service": "publo-orchestrator",
        "version": "0.1.0",
        "docs": "/docs"
    }


# ============================================================
# STARTUP & SHUTDOWN
# ============================================================

@app.on_event("startup")
async def startup_event():
    """
    Called when the server starts.
    Good place to initialize database connections, etc.
    """
    print("🚀 Publo Orchestrator Backend starting...")
    print(f"📍 API docs available at: http://localhost:8000/docs")
    
    # Check for required environment variables
    required_vars = ["OPENAI_API_KEY"]  # Add more as needed
    missing = [var for var in required_vars if not os.getenv(var)]
    
    if missing:
        print(f"⚠️  Warning: Missing environment variables: {missing}")
    else:
        print("✅ All required environment variables found")


@app.on_event("shutdown")
async def shutdown_event():
    """
    Called when the server shuts down.
    Good place to close database connections, etc.
    """
    print("👋 Publo Orchestrator Backend shutting down...")

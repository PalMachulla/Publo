"""
Health Check Endpoints

Simple endpoints to verify the service is running and dependencies are available.
Useful for:
- Load balancer health checks
- Monitoring/alerting systems
- Deployment verification
"""

from fastapi import APIRouter
import os

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Basic health check - is the server responding?
    """
    return {"status": "healthy"}


@router.get("/health/ready")
async def readiness_check():
    """
    Readiness check - are all dependencies available?
    This is more thorough than the basic health check.
    """
    checks = {
        "openai_key": bool(os.getenv("OPENAI_API_KEY")),
        "anthropic_key": bool(os.getenv("ANTHROPIC_API_KEY")),
        "supabase_url": bool(os.getenv("SUPABASE_URL")),
    }
    
    all_ready = all(checks.values())
    
    return {
        "status": "ready" if all_ready else "degraded",
        "checks": checks
    }

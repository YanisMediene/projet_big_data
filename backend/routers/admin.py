"""
Admin routes for AI Pictionary
Handles model retraining triggers and administrative tasks
"""

from fastapi import APIRouter, HTTPException, Header, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional
import subprocess
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


class RetrainResponse(BaseModel):
    status: str
    message: str
    triggered_at: str
    job_id: Optional[str] = None


class RetrainStatus(BaseModel):
    job_id: str
    status: str
    progress: Optional[str] = None


def verify_admin_token(authorization: str = Header(None)) -> bool:
    """
    Verify admin authorization token
    In production, this should validate Firebase Admin tokens or API keys
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    # Extract token from "Bearer <token>" format
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(
            status_code=401, detail="Invalid authorization header format"
        )

    # Validate token against environment variable
    admin_token = os.getenv("ADMIN_API_KEY")
    if not admin_token:
        logger.warning("ADMIN_API_KEY not configured - admin endpoints disabled")
        raise HTTPException(
            status_code=503, detail="Admin functionality not configured"
        )

    if token != admin_token:
        raise HTTPException(status_code=403, detail="Invalid admin token")

    return True


def trigger_retraining_pipeline():
    """
    Execute the ML retraining pipeline script
    This runs as a background task to avoid request timeout
    """
    try:
        script_path = os.getenv(
            "RETRAIN_SCRIPT_PATH", "/app/ml-training/scripts/retrain_pipeline.py"
        )

        # Fallback for local development
        if not os.path.exists(script_path):
            script_path = "./ml-training/scripts/retrain_pipeline.py"

        if not os.path.exists(script_path):
            logger.error(f"Retraining script not found at {script_path}")
            return

        # Run the pipeline script
        logger.info(f"Starting retraining pipeline: {script_path}")
        result = subprocess.run(
            ["python3", script_path],
            capture_output=True,
            text=True,
            timeout=3600,  # 1 hour timeout
        )

        if result.returncode == 0:
            logger.info(f"Retraining pipeline completed successfully:\n{result.stdout}")
        else:
            logger.error(f"Retraining pipeline failed:\n{result.stderr}")

    except subprocess.TimeoutExpired:
        logger.error("Retraining pipeline timed out after 1 hour")
    except Exception as e:
        logger.error(f"Error running retraining pipeline: {e}")


@router.post("/retrain", response_model=RetrainResponse)
async def trigger_retrain(
    background_tasks: BackgroundTasks, authorized: bool = Depends(verify_admin_token)
):
    """
    Trigger the ML model retraining pipeline

    **Security**: Requires admin API key in Authorization header
    **Usage**: POST /admin/retrain with "Bearer <ADMIN_API_KEY>" header
    **Process**:
    1. Validates admin token
    2. Triggers background task to run retrain_pipeline.py
    3. Returns immediately with job ID

    This endpoint is designed to be called by:
    - Cloud Scheduler (automated weekly retraining)
    - Manual admin triggers
    - CI/CD pipelines for model updates
    """

    # Generate job ID for tracking
    job_id = f"retrain_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    # Add retraining to background tasks
    background_tasks.add_task(trigger_retraining_pipeline)

    logger.info(f"Retraining job triggered: {job_id}")

    return RetrainResponse(
        status="triggered",
        message="Model retraining pipeline started in background",
        triggered_at=datetime.utcnow().isoformat(),
        job_id=job_id,
    )


@router.get("/retrain/status/{job_id}", response_model=RetrainStatus)
async def get_retrain_status(
    job_id: str, authorized: bool = Depends(verify_admin_token)
):
    """
    Get status of a retraining job

    **Note**: In production, this should query a job tracking system
    (e.g., Firestore, Redis) to get real-time status
    """

    # TODO: Implement job status tracking with Firestore
    # For now, return a placeholder response
    return RetrainStatus(
        job_id=job_id,
        status="running",
        progress="Check server logs for detailed progress",
    )


@router.get("/health")
async def admin_health():
    """
    Admin health check endpoint (no auth required)
    """
    return {
        "status": "healthy",
        "admin_api_configured": bool(os.getenv("ADMIN_API_KEY")),
        "retrain_script_exists": os.path.exists(
            os.getenv(
                "RETRAIN_SCRIPT_PATH", "./ml-training/scripts/retrain_pipeline.py"
            )
        ),
    }


# ==================== GAME CLEANUP ENDPOINTS ====================


@router.post("/cleanup/abandoned-games")
async def cleanup_abandoned_games(
    max_age_minutes: int = 30, authorized: bool = Depends(verify_admin_token)
):
    """
    Clean up games that have been waiting/abandoned for too long

    **Security**: Requires admin API key
    **Usage**: Called by Cloud Scheduler or manually

    Args:
        max_age_minutes: Games older than this will be deleted (default: 30)
    """
    from services.presence_service import GameCleanupService

    result = await GameCleanupService.cleanup_abandoned_games(max_age_minutes)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    logger.info(f"Abandoned games cleanup: {result}")
    return result


@router.post("/cleanup/sync-presence/{game_id}")
async def sync_presence_to_firestore(
    game_id: str, authorized: bool = Depends(verify_admin_token)
):
    """
    Sync RTDB presence data to Firestore for a specific game
    Removes players from Firestore who are not present in RTDB

    **Security**: Requires admin API key
    """
    from services.presence_service import GameCleanupService

    result = await GameCleanupService.sync_presence_to_firestore(game_id)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return result


@router.delete("/games/{game_id}")
async def delete_game(game_id: str, authorized: bool = Depends(verify_admin_token)):
    """
    Force delete a game and all associated data

    **Security**: Requires admin API key
    **Use case**: Manual cleanup of problematic games
    """
    from firebase_admin import firestore as fb_firestore
    from services.presence_service import PresenceService

    try:
        db = fb_firestore.client()

        # Delete game document
        game_ref = db.collection("games").document(game_id)
        game_ref.delete()

        # Delete chat subcollection
        chat_docs = db.collection("games").document(game_id).collection("chat").stream()
        for doc in chat_docs:
            doc.reference.delete()

        # Delete turns subcollection
        turns_docs = (
            db.collection("games").document(game_id).collection("turns").stream()
        )
        for doc in turns_docs:
            doc.reference.delete()

        # Clean up RTDB presence
        await PresenceService.cleanup_game_presence(game_id)

        logger.info(f"Game {game_id} force deleted by admin")
        return {"status": "deleted", "game_id": game_id}

    except Exception as e:
        logger.error(f"Error deleting game: {e}")
        raise HTTPException(status_code=500, detail=str(e))

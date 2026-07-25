"""Health & metadata endpoints."""
import time
from fastapi import APIRouter

from app.core.config import settings
from app.schemas.prediction import HealthResponse
from app.services.model_service import model_service

router = APIRouter()
_started_at = time.time()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    from app.services.verification_service import verification_service

    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        model_loaded=not model_service.use_disease_stub,
        quality_model_loaded=not model_service.use_quality_stub,
        verification_model_loaded=model_service.verification_loaded,
        verification_method=verification_service.method,
        verification_threshold=verification_service.threshold,
        uptime_seconds=time.time() - _started_at,
    )


@router.get("/classes")
async def classes():
    """Return all class labels — useful for the frontend's legend UI."""
    from app.services.model_service import (
        DISEASE_CLASSES,
        QUALITY_CLASSES,
        VERIFICATION_CLASSES,
    )
    return {
        "diseases": DISEASE_CLASSES,
        "qualities": QUALITY_CLASSES,
        "verification": VERIFICATION_CLASSES,
    }

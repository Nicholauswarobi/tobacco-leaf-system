"""Admin endpoints: gated by a simple API key header."""
from fastapi import APIRouter, Header, HTTPException, status

from app.core.config import settings
from app.services.history_service import history_service

router = APIRouter()


def _require_admin(x_api_key: str | None) -> None:
    if x_api_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin API key",
        )


@router.get("/stats")
async def admin_stats(x_api_key: str | None = Header(default=None)):
    _require_admin(x_api_key)
    return history_service.stats()

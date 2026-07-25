"""Global exception handlers — return clean JSON errors."""
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.services.verification_service import NotATobaccoLeafError

logger = logging.getLogger("tobacco-api.errors")

# Machine-readable marker so clients can distinguish "wrong subject" from a
# genuine failure without string-matching the message.
NOT_A_TOBACCO_LEAF_CODE = "NOT_A_TOBACCO_LEAF"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotATobaccoLeafError)
    async def not_a_tobacco_leaf_handler(request: Request, exc: NotATobaccoLeafError):
        """Rejection from the Tobacco Verification gate.

        Registered globally so every current and future endpoint returns the
        same 422 body. `message` stays a plain string at the top level, which
        is what the existing frontend error handler reads; the structured
        `verification` block carries the probabilities for richer UIs.
        """
        outcome = exc.outcome
        return JSONResponse(
            status_code=422,
            content={
                "error": True,
                "status": 422,
                "code": NOT_A_TOBACCO_LEAF_CODE,
                "message": outcome.message,
                "verification": outcome.as_dict(),
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exc_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": True, "message": exc.detail, "status": exc.status_code},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": True,
                "message": "Validation error",
                "details": exc.errors(),
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception")
        return JSONResponse(
            status_code=500,
            content={"error": True, "message": "Internal server error"},
        )

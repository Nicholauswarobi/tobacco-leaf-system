"""
FastAPI entry point for the Tobacco Leaf Disease & Quality Grading API.

Loads the trained CNN model on startup and exposes REST endpoints for
image upload, prediction, history, and health checks.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.core.logging import setup_logging
from app.routers import predict, history, health, admin
from app.services.model_service import model_service
from app.middleware.error_handler import register_exception_handlers

logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle: load the model on startup, free on shutdown."""
    logger.info("Starting Tobacco Leaf API...")
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.MODEL_DIR).mkdir(parents=True, exist_ok=True)

    try:
        model_service.load_models()
        logger.info("Models loaded successfully")
    except Exception as exc:  # noqa: BLE001
        # Don't crash the server if a model file is missing or unreadable, fall
        # back to a stub predictor so the rest of the API stays usable.
        #
        # These set the two real flags. `use_stub` is a read-only property, so
        # assigning to it raised AttributeError *inside this handler* and took
        # the whole startup down: the one path meant to keep the server alive
        # was the one that killed it.
        logger.warning("Model load failed (%s). Using stub predictor.", exc)
        model_service.use_disease_stub = model_service.disease_model is None
        model_service.use_quality_stub = model_service.quality_model is None

    yield
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    description="Detection of Leaf Diseases and Quality Grading of Tobacco Leaves",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

# Serve uploaded images so the frontend can show user thumbnails.
app.mount(
    "/uploads",
    StaticFiles(directory=settings.UPLOAD_DIR),
    name="uploads",
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(predict.router, prefix="/api", tags=["prediction"])
app.include_router(history.router, prefix="/api", tags=["history"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }

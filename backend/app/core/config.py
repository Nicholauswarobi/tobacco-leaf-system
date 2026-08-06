"""Application configuration via environment variables."""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    APP_NAME: str = "TobaccoScan API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # CORS — comma-separated list in env, parsed into a Python list.
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Filesystem paths (relative to backend/ working dir).
    UPLOAD_DIR: str = "uploads"
    MODEL_DIR: str = "saved_models"
    DISEASE_MODEL_PATH: str = "saved_models/tobacco_disease_model.keras"
    QUALITY_MODEL_PATH: str = "saved_models/tobacco_quality_model.keras"
    VERIFICATION_MODEL_PATH: str = "saved_models/tobacco_verification_model.keras"
    # Written by ml/scripts/train_verification.py — carries the class order and
    # the calibrated threshold so this service never hard-codes a tuned number.
    VERIFICATION_METADATA_PATH: str = "saved_models/verification_metadata.json"

    # --- Tobacco verification gate -----------------------------------------
    # Runs before disease detection and quality grading. Turning it off lets
    # non-tobacco images reach models that cannot handle them; only do that
    # for debugging.
    VERIFICATION_ENABLED: bool = True
    # Minimum P(Tobacco) required to proceed. Overridden by the threshold in
    # VERIFICATION_METADATA_PATH when that file is present.
    VERIFICATION_THRESHOLD: float = 0.5
    # When the trained model is absent, fall back to the HSV colour pre-screen
    # rather than waving everything through.
    VERIFICATION_COLOR_FALLBACK: bool = True

    # Image preprocessing
    IMAGE_SIZE: int = 224
    MAX_UPLOAD_MB: int = 10
    ALLOWED_EXTENSIONS: List[str] = ["jpg", "jpeg", "png", "webp"]

    # In-memory history (or SQLite path if you want to persist).
    HISTORY_DB: str = "history.db"

    # Auth (very simple token for the admin route — replace in production).
    ADMIN_API_KEY: str = "change-me-in-production"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

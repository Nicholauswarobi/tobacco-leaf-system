"""Image utilities: validation, secure save, basic preprocessing."""
from __future__ import annotations
import io
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.core.config import settings


def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


async def validate_and_load(file: UploadFile) -> Tuple[Image.Image, bytes, str]:
    """Validate an UploadFile and return (PIL.Image, raw_bytes, extension).

    Raises HTTPException on any validation failure.
    """
    # Extension check
    ext = _ext(file.filename or "")
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {settings.ALLOWED_EXTENSIONS}",
        )

    # Size check (read in chunks to avoid loading huge files into memory)
    raw = await file.read()
    size_mb = len(raw) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_MB:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({size_mb:.1f} MB). Max {settings.MAX_UPLOAD_MB} MB.",
        )

    # Decode: verifies the bytes are an actual image, not a renamed file.
    try:
        image = Image.open(io.BytesIO(raw))
        image.verify()  # quick header check
        image = Image.open(io.BytesIO(raw))  # re-open after verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image file: {exc}",
        ) from exc

    return image, raw, ext


def save_upload(raw: bytes, ext: str) -> Tuple[str, str]:
    """Persist raw bytes to UPLOAD_DIR with a random filename.

    Returns (filename, public_url_path).
    """
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = Path(settings.UPLOAD_DIR) / filename
    with open(path, "wb") as f:
        f.write(raw)
    return filename, f"/uploads/{filename}"

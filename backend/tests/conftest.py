"""Shared fixtures for the API tests.

The suite runs without any .keras files: the disease and quality models fall
back to their stub predictors, and the verification model is replaced by a
fake whose output each test controls directly. That keeps the tests fast and
deterministic while still exercising the real service and routing code.
"""
from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from app.services.model_service import model_service

# Real tobacco leaves, used where a genuine image matters more than a synthetic
# one. Skipped automatically when the dataset is not checked out.
TOBACCO_SAMPLES = (
    Path(__file__).resolve().parents[2] / "ml" / "data" / "raw" / "disease"
)


class FakeVerificationModel:
    """Stands in for the trained Keras verification model.

    `probs` is [P(Not Tobacco), P(Tobacco)] — the class order that
    build_verification_dataset.py produces.
    """

    def __init__(self, probs: list[float]) -> None:
        self.probs = probs
        self.calls = 0

    def predict(self, x, verbose=0):  # noqa: ARG002 — mirrors the Keras signature
        self.calls += 1
        return np.array([self.probs], dtype="float32")


@pytest.fixture
def image_bytes():
    """Build a small in-memory JPEG of a given colour."""

    def _make(color=(34, 139, 34), size=(256, 256)) -> bytes:
        buf = io.BytesIO()
        Image.new("RGB", size, color=color).save(buf, format="JPEG")
        return buf.getvalue()

    return _make


@pytest.fixture
def real_leaf_bytes() -> bytes:
    """Bytes of an actual tobacco leaf from the training set."""
    if not TOBACCO_SAMPLES.exists():
        pytest.skip(f"tobacco dataset not present at {TOBACCO_SAMPLES}")
    for path in sorted(TOBACCO_SAMPLES.rglob("*.jpg"))[:1]:
        return path.read_bytes()
    pytest.skip("no .jpg images found in the tobacco dataset")


@pytest.fixture
def verification_model(request):
    """Install a FakeVerificationModel, and restore the real state afterwards.

    Usage:
        @pytest.mark.parametrize("verification_model", [[0.02, 0.98]], indirect=True)
    """
    probs = getattr(request, "param", [0.02, 0.98])
    fake = FakeVerificationModel(probs)

    previous = model_service.verification_model
    model_service.verification_model = fake
    try:
        yield fake
    finally:
        model_service.verification_model = previous


@pytest.fixture
def no_verification_model():
    """Force the colour-pre-screen fallback tier."""
    previous = model_service.verification_model
    model_service.verification_model = None
    try:
        yield
    finally:
        model_service.verification_model = previous

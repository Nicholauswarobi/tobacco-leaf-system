"""Tests for the Tobacco Verification pipeline.

The contract under test:

    1. Verification runs before disease detection and quality grading.
    2. A Not-Tobacco verdict stops the pipeline with the documented message.
    3. No downstream model is ever invoked for a rejected image.
    4. Every entry point enforces the rule identically.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import model_service as model_service_module
from app.services.model_service import model_service
from app.services.verification_service import (
    FAILURE_MESSAGE,
    SUCCESS_MESSAGE,
    METHOD_MODEL,
    verification_service,
)

client = TestClient(app)

TOBACCO = [0.02, 0.98]      # confidently tobacco
NOT_TOBACCO = [0.97, 0.03]  # confidently not tobacco
BORDERLINE = [0.55, 0.45]   # below a 0.5 threshold

PREDICT_ROUTES = ["/api/predict", "/api/predict/disease", "/api/predict/quality"]


def _files(payload: bytes, name: str = "leaf.jpg"):
    return {"file": (name, payload, "image/jpeg")}


# ---------------------------------------------------------------------------
# Rejection stops the pipeline
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("route", PREDICT_ROUTES + ["/api/verify"])
@pytest.mark.parametrize("verification_model", [NOT_TOBACCO], indirect=True)
def test_not_tobacco_is_rejected_on_every_route(route, verification_model, image_bytes):
    r = client.post(route, files=_files(image_bytes()))

    assert r.status_code == 422, r.text
    body = r.json()
    assert body["code"] == "NOT_A_TOBACCO_LEAF"
    assert body["message"] == FAILURE_MESSAGE
    assert body["verification"]["is_tobacco"] is False
    assert body["verification"]["label"] == "Not Tobacco"


@pytest.mark.parametrize("route", PREDICT_ROUTES)
@pytest.mark.parametrize("verification_model", [NOT_TOBACCO], indirect=True)
def test_rejected_image_never_reaches_downstream_models(
    route, verification_model, image_bytes, monkeypatch
):
    """The core guarantee: disease/quality inference must not be attempted."""
    def explode(*args, **kwargs):
        raise AssertionError(
            f"{route} ran a downstream model on a non-tobacco image"
        )

    monkeypatch.setattr(model_service, "predict_disease", explode)
    monkeypatch.setattr(model_service, "predict_quality", explode)

    r = client.post(route, files=_files(image_bytes()))
    assert r.status_code == 422
    assert verification_model.calls == 1, "verification should run exactly once"


@pytest.mark.parametrize("verification_model", [NOT_TOBACCO], indirect=True)
def test_rejected_image_is_not_saved_to_history(verification_model, image_bytes):
    from app.services.history_service import history_service

    before = history_service.count()
    r = client.post("/api/predict", files=_files(image_bytes()))
    assert r.status_code == 422
    assert history_service.count() == before


# ---------------------------------------------------------------------------
# Acceptance continues the pipeline
# ---------------------------------------------------------------------------

# Green reads as a fresh field leaf and gold as a cured one, so each route has
# to be fed the leaf state it actually analyses - otherwise the section routing
# (correctly) turns the upload away and this test would be asserting the wrong
# thing about the verification gate.
ROUTE_APPROPRIATE_COLOUR = {
    "/api/predict/quality": (198, 142, 46),   # cured gold
}
DEFAULT_LEAF_COLOUR = (34, 139, 34)           # fresh green


@pytest.mark.parametrize("route", PREDICT_ROUTES)
@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_tobacco_continues_to_downstream_models(route, verification_model, image_bytes):
    colour = ROUTE_APPROPRIATE_COLOUR.get(route, DEFAULT_LEAF_COLOUR)
    r = client.post(route, files=_files(image_bytes(color=colour)))

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["verification"]["is_tobacco"] is True
    assert body["verification"]["message"] == SUCCESS_MESSAGE
    assert body["verification"]["method"] == METHOD_MODEL
    assert "disease" in body and "quality" in body


@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_verify_endpoint_reports_probabilities(verification_model, image_bytes):
    r = client.post("/api/verify", files=_files(image_bytes()))

    assert r.status_code == 200, r.text
    v = r.json()["verification"]
    assert v["is_tobacco"] is True
    assert v["confidence"] == pytest.approx(0.98, abs=1e-6)
    probs = {p["label"]: p["probability"] for p in v["all_probabilities"]}
    assert probs["Tobacco"] == pytest.approx(0.98, abs=1e-6)
    assert probs["Not Tobacco"] == pytest.approx(0.02, abs=1e-6)


@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_verification_runs_once_per_request(verification_model, image_bytes):
    """The router pre-verifies; the service must not re-run inference."""
    r = client.post("/api/predict", files=_files(image_bytes()))
    assert r.status_code == 200
    assert verification_model.calls == 1


# ---------------------------------------------------------------------------
# Threshold behaviour
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("verification_model", [BORDERLINE], indirect=True)
def test_threshold_boundary_is_respected(verification_model, image_bytes, monkeypatch):
    # P(Tobacco) = 0.45 -> rejected at the default 0.5 threshold
    monkeypatch.setattr(model_service, "verification_threshold", 0.5)
    assert client.post("/api/verify", files=_files(image_bytes())).status_code == 422

    # ...and accepted once the threshold drops below it
    monkeypatch.setattr(model_service, "verification_threshold", 0.4)
    r = client.post("/api/verify", files=_files(image_bytes()))
    assert r.status_code == 200, r.text
    assert r.json()["verification"]["threshold"] == pytest.approx(0.4)


@pytest.mark.parametrize("verification_model", [[0.5, 0.5]], indirect=True)
def test_threshold_is_inclusive(verification_model, image_bytes, monkeypatch):
    """P(Tobacco) exactly at the threshold counts as tobacco."""
    monkeypatch.setattr(model_service, "verification_threshold", 0.5)
    assert client.post("/api/verify", files=_files(image_bytes())).status_code == 200


def test_metadata_threshold_is_adopted(tmp_path, monkeypatch):
    """A calibrated threshold in the sidecar overrides the configured default."""
    import json
    from app.core.config import settings

    meta = tmp_path / "verification_metadata.json"
    meta.write_text(json.dumps({"classes": ["Not_Tobacco", "Tobacco"], "threshold": 0.83}))
    monkeypatch.setattr(settings, "VERIFICATION_METADATA_PATH", str(meta))
    monkeypatch.setattr(model_service, "verification_threshold", 0.5)

    model_service._load_verification_metadata()
    assert model_service.verification_threshold == pytest.approx(0.83)


def test_malformed_metadata_keeps_the_default(tmp_path, monkeypatch):
    from app.core.config import settings

    meta = tmp_path / "verification_metadata.json"
    meta.write_text("{ not json")
    monkeypatch.setattr(settings, "VERIFICATION_METADATA_PATH", str(meta))
    monkeypatch.setattr(model_service, "verification_threshold", 0.5)

    model_service._load_verification_metadata()  # must not raise
    assert model_service.verification_threshold == pytest.approx(0.5)


@pytest.mark.parametrize("bad_threshold", [0, 1, 1.5, -0.2, "high", None])
def test_out_of_range_metadata_threshold_is_ignored(tmp_path, monkeypatch, bad_threshold):
    """A nonsense threshold must not silently open or close the gate."""
    import json
    from app.core.config import settings

    meta = tmp_path / "verification_metadata.json"
    meta.write_text(json.dumps({"threshold": bad_threshold}))
    monkeypatch.setattr(settings, "VERIFICATION_METADATA_PATH", str(meta))
    monkeypatch.setattr(model_service, "verification_threshold", 0.5)

    model_service._load_verification_metadata()
    assert model_service.verification_threshold == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# Fallback tier
# ---------------------------------------------------------------------------

def test_colour_fallback_rejects_obvious_non_leaves(no_verification_model, image_bytes):
    """With no trained model, the HSV pre-screen still stops a blue sky."""
    r = client.post("/api/verify", files=_files(image_bytes(color=(30, 90, 220))))

    assert r.status_code == 422, r.text
    assert r.json()["verification"]["method"] == "color_prescreen"


def test_colour_fallback_abstains_on_grayscale_leaves(
    no_verification_model, real_leaf_bytes
):
    """Regression: the dataset's leaves are grayscale and were 100% rejected.

    Hue/saturation carry no signal on a grayscale image, so the pre-screen must
    abstain rather than report "not a tobacco leaf" about a genuine leaf.
    """
    r = client.post("/api/verify", files=_files(real_leaf_bytes))

    assert r.status_code == 200, r.text
    v = r.json()["verification"]
    assert v["is_tobacco"] is True
    assert "grayscale" in v["detail"]


def test_grayscale_detection(real_leaf_bytes, image_bytes):
    import io
    from PIL import Image
    from app.utils.leaf_validator import is_effectively_grayscale

    assert is_effectively_grayscale(Image.open(io.BytesIO(real_leaf_bytes))) is True
    saturated = Image.open(io.BytesIO(image_bytes(color=(30, 90, 220))))
    assert is_effectively_grayscale(saturated) is False


def test_predict_verification_returns_none_without_a_model(no_verification_model):
    """No stub for verification — guessing here would defeat the gate."""
    from PIL import Image

    assert model_service.predict_verification(Image.new("RGB", (64, 64))) is None


# ---------------------------------------------------------------------------
# Wrong-shaped model output
# ---------------------------------------------------------------------------

def test_wrong_output_shape_fails_closed(image_bytes, monkeypatch):
    """A 3-class model in the verification slot must reject, not mis-index."""
    from tests.conftest import FakeVerificationModel

    monkeypatch.setattr(
        model_service, "verification_model", FakeVerificationModel([0.1, 0.2, 0.7])
    )
    r = client.post("/api/verify", files=_files(image_bytes()))
    assert r.status_code == 422
    assert r.json()["verification"]["is_tobacco"] is False


# ---------------------------------------------------------------------------
# Health reporting
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_health_reports_verification_state(verification_model):
    body = client.get("/api/health").json()
    assert body["verification_model_loaded"] is True
    assert body["verification_method"] == METHOD_MODEL
    assert 0.0 < body["verification_threshold"] < 1.0


def test_health_reports_fallback_state(no_verification_model):
    body = client.get("/api/health").json()
    assert body["verification_model_loaded"] is False
    assert body["verification_method"] == "color_prescreen"


def test_classes_lists_verification_labels():
    body = client.get("/api/classes").json()
    assert body["verification"] == ["Not Tobacco", "Tobacco"]
    # index 1 must be Tobacco — the service indexes on it
    assert body["verification"][model_service_module.TOBACCO_INDEX] == "Tobacco"


# ---------------------------------------------------------------------------
# Service-level reuse
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_service_is_shared_by_all_callers(verification_model):
    """Both downstream models resolve to the same gate instance."""
    from app.services import prediction_service

    assert prediction_service.verification_service is verification_service
    assert verification_service.is_model_backed is True

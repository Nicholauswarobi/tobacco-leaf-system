"""Smoke tests for the API.

These run with no .keras files loaded: disease and quality fall back to their
stub predictors. Anything that needs to reach those stubs must first pass the
Tobacco Verification gate, so the `verification_model` fixture installs a fake
that returns a confident Tobacco verdict.

The verification pipeline itself is covered in test_verification.py.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)

TOBACCO = [0.02, 0.98]


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"


def test_classes():
    r = client.get("/api/classes")
    assert r.status_code == 200
    body = r.json()
    assert "Healthy" in body["diseases"]
    assert "Grade A" in body["qualities"]
    assert "Tobacco" in body["verification"]


@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_predict_with_stub(verification_model, image_bytes):
    files = {"file": ("leaf.jpg", image_bytes(), "image/jpeg")}
    r = client.post("/api/predict", files=files)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "disease" in body and "quality" in body
    assert 0.0 <= body["disease"]["confidence"] <= 1.0
    assert body["disease"]["label"] in {
        "Healthy",
        "Alternaria Leaf Spot",
        "Cercospora Leaf Spot",
        "Tobacco Mosaic Virus",
    }


def test_predict_rejects_bad_extension():
    files = {"file": ("notes.txt", b"not an image", "text/plain")}
    r = client.post("/api/predict", files=files)
    assert r.status_code == 400

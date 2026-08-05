"""Tests for routing a tobacco leaf to the correct analysis section.

WHY THIS FILE EXISTS
--------------------
Disease detection is trained on fresh green leaves in the field; quality
grading is trained on cured leaves on the grading table. They are different
subjects, so an image sent to the wrong one still gets a confident answer -
just a meaningless one. Nothing errors, so the wrong grade looks exactly like
a right one.

The two failure modes this pins down:

1. Telling a farmer "this is not a tobacco leaf" when they photographed a
   perfectly good cured leaf and merely opened the wrong tab. That is why
   WRONG_SECTION is a separate code from NOT_A_TOBACCO_LEAF and reports
   is_tobacco: true.

2. Blocking on a guess. A leaf part-way through curing is genuinely ambiguous,
   and every image in ml/data/raw/disease/ is grayscale, which carries no hue
   at all. Both must pass straight through - refusing to analyse because we
   could not tell is worse than analysing.
"""
from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.utils.leaf_validator import (
    STATE_CURED,
    STATE_FRESH,
    STATE_UNKNOWN,
    classify_leaf_state,
)

client = TestClient(app)

TOBACCO = [0.02, 0.98]

FRESH_GREEN = (34, 139, 34)
CURED_GOLD = (198, 142, 46)
# A flat synthetic patch is harsher than a real leaf, whose texture spreads
# pixels across several tone bands. This is a mahogany sampled to sit in the
# saturation range real cured leaves occupy, not a fully saturated red-brown.
CURED_MAHOGANY = (110, 70, 45)


def _files(data: bytes):
    return {"file": ("leaf.jpg", data, "image/jpeg")}


def _jpeg(color=FRESH_GREEN, size=(256, 256)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color=color).save(buf, format="JPEG")
    return buf.getvalue()


def _grayscale_jpeg(level: int = 120, size=(256, 256)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color=(level, level, level)).save(buf, format="JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# The colour rule itself
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("colour", [CURED_GOLD, CURED_MAHOGANY])
def test_cured_tones_classify_as_cured(colour):
    state, evidence = classify_leaf_state(Image.open(io.BytesIO(_jpeg(colour))))
    assert state == STATE_CURED
    assert evidence["cured_share"] == 1.0


def test_green_classifies_as_fresh():
    state, evidence = classify_leaf_state(Image.open(io.BytesIO(_jpeg(FRESH_GREEN))))
    assert state == STATE_FRESH
    assert evidence["green_share"] == 1.0


def test_grayscale_abstains_rather_than_guessing():
    """Every disease image in this project is grayscale. If this returned a
    state instead of abstaining, the routing would block real uploads."""
    state, evidence = classify_leaf_state(Image.open(io.BytesIO(_grayscale_jpeg())))
    assert state == STATE_UNKNOWN
    assert "colour" in evidence["reason"]


# ---------------------------------------------------------------------------
# Routing through the API
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_cured_leaf_on_disease_route_is_sent_to_quality(verification_model):
    r = client.post("/api/predict/disease", files=_files(_jpeg(CURED_GOLD)))

    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "WRONG_SECTION"
    assert body["routing"]["is_tobacco"] is True
    assert body["routing"]["detected_state"] == STATE_CURED
    assert body["routing"]["suggested_mode"] == "quality"
    assert "Quality Grading" in body["message"]


@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_fresh_leaf_on_quality_route_is_sent_to_disease(verification_model):
    r = client.post("/api/predict/quality", files=_files(_jpeg(FRESH_GREEN)))

    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "WRONG_SECTION"
    assert body["routing"]["is_tobacco"] is True
    assert body["routing"]["detected_state"] == STATE_FRESH
    assert body["routing"]["suggested_mode"] == "disease"
    assert "Disease Detection" in body["message"]


@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_wrong_section_is_not_reported_as_not_tobacco(verification_model):
    """The distinction that matters to the person holding the leaf."""
    r = client.post("/api/predict/quality", files=_files(_jpeg(FRESH_GREEN)))
    body = r.json()

    assert body["code"] != "NOT_A_TOBACCO_LEAF"
    assert body["verification"]["is_tobacco"] is True
    assert "not a tobacco leaf" not in body["message"].lower()


@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_each_leaf_state_passes_on_its_own_route(verification_model):
    assert client.post(
        "/api/predict/quality", files=_files(_jpeg(CURED_GOLD))
    ).status_code == 200
    assert client.post(
        "/api/predict/disease", files=_files(_jpeg(FRESH_GREEN))
    ).status_code == 200


@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_grayscale_upload_is_never_blocked_by_routing(verification_model):
    """A grayscale photo carries no hue, so the rule abstains and the upload
    must proceed on both routes."""
    for route in ("/api/predict/disease", "/api/predict/quality"):
        r = client.post(route, files=_files(_grayscale_jpeg()))
        assert r.status_code == 200, f"{route}: {r.text}"


@pytest.mark.parametrize("verification_model", [TOBACCO], indirect=True)
def test_combined_route_never_routes(verification_model):
    """mode=full runs both models, so no leaf state is out of place."""
    for data in (_jpeg(CURED_GOLD), _jpeg(FRESH_GREEN)):
        r = client.post("/api/predict?mode=full", files=_files(data))
        assert r.status_code == 200, r.text

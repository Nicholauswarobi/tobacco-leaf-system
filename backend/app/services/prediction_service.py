"""
Prediction service — orchestrates the disease and quality models,
builds rich responses with descriptions and recommendations.
"""
from __future__ import annotations
import time
import uuid
from datetime import datetime
from typing import List

from PIL import Image

from app.services.model_service import (
    model_service,
    DISEASE_CLASSES,
    QUALITY_CLASSES,
)
from app.schemas.prediction import (
    PredictionResponse,
    DiseaseResult,
    QualityResult,
    ClassProbability,
    VerificationResult,
)
from app.services.verification_service import (
    verification_service,
    VerificationOutcome,
    NotATobaccoLeafError,
    WrongSectionError,
    FAILURE_MESSAGE,
    METHOD_COLOR,
)
from app.utils.leaf_validator import (
    classify_leaf_state,
    STATE_CURED,
    STATE_FRESH,
)

# Applies only while the verification model is untrained — see
# _assert_confident_enough below.
MIN_LEAF_CONFIDENCE: float = 0.65

# Re-exported so existing importers of NotATobaccoLeafError keep working; the
# exception now lives with the service that raises it.
__all__ = [
    "NotATobaccoLeafError",
    "WrongSectionError",
    "predict_disease_only",
    "predict_quality_only",
    "predict_full",
]


# ── Stage 2: is this leaf in the right section? ──────────────────────────────
#
# Disease detection is trained on fresh green leaves growing in the field.
# Quality grading is trained on cured (dried) leaves on the grading table.
# They are different subjects, so an image sent to the wrong one gets a
# confident, meaningless answer. This routes instead of guessing.
_SECTION_RULES = {
    # attempted mode -> (state that does NOT belong here, where it should go)
    "disease": (
        STATE_CURED,
        "quality",
        "This is a tobacco leaf, but it is a *cured* (dried) leaf. Disease "
        "detection works on fresh green leaves from the field. Upload this "
        "image under Quality Grading instead.",
    ),
    "quality": (
        STATE_FRESH,
        "disease",
        "This is a tobacco leaf, but it is a *fresh green* leaf. Quality "
        "grading works on cured (dried) leaves after harvest. Upload this "
        "image under Disease Detection instead.",
    ),
}


def _assert_right_section(
    image: Image.Image, mode: str, verification: VerificationOutcome
) -> tuple[str, dict]:
    """Raise WrongSectionError if a tobacco leaf was sent to the wrong analysis.

    Only ever fires on a *confident* mismatch. A leaf part-way through curing,
    or a grayscale photo, classifies as unknown and is allowed straight
    through - refusing to analyse because we could not tell would be worse
    than analysing.
    """
    state, evidence = classify_leaf_state(image)
    rule = _SECTION_RULES.get(mode)
    if rule is None:
        return state, evidence

    blocked_state, suggested_mode, message = rule
    if state == blocked_state:
        raise WrongSectionError(
            detected_state=state,
            attempted_mode=mode,
            suggested_mode=suggested_mode,
            message=message,
            evidence=evidence,
            outcome=verification,
        )
    return state, evidence


# ── Stage 1: Tobacco Verification (runs before ANY downstream model) ─────────
def _verify(
    image: Image.Image, precomputed: VerificationOutcome | None = None
) -> VerificationOutcome:
    """Run the Tobacco Verification Model; raise if the image is not tobacco.

    Every prediction entry point calls this first. Because it raises rather
    than returning a flag, there is no path to a downstream model that skips
    verification by forgetting to check a boolean.

    `precomputed` lets a caller that has already verified (the router does, so
    it can reject before writing the upload to disk) pass the result through
    instead of paying for a second inference. It is re-checked rather than
    trusted blindly, so a caller cannot smuggle a rejection past this point.
    """
    if precomputed is not None:
        if not precomputed.is_tobacco:
            raise NotATobaccoLeafError(precomputed)
        return precomputed
    return verification_service.verify_or_raise(image)


def _assert_confident_enough(
    top_confidence: float, verification: VerificationOutcome
) -> None:
    """Secondary net, active only while the verification model is untrained.

    Before this pipeline existed, a low top-class disease score was the only
    signal that an image might not be a leaf. That heuristic stays in place
    *only* when verification fell back to the colour pre-screen.

    Once the trained verification model is loaded it is the sole authority on
    what is and is not tobacco. Second-guessing it here would tell a farmer
    "this is not a tobacco leaf" about a genuine leaf that merely sits between
    two disease classes — which is a diagnosis problem, not an input problem.
    """
    if verification.method != METHOD_COLOR:
        return
    if top_confidence >= MIN_LEAF_CONFIDENCE:
        return

    fallback = VerificationOutcome(
        is_tobacco=False,
        label="Not Tobacco",
        confidence=1.0 - top_confidence,
        message=FAILURE_MESSAGE,
        method=METHOD_COLOR,
        threshold=verification.threshold,
        detail=(
            f"The disease model's best match reached only {top_confidence:.0%} "
            f"confidence, below the {MIN_LEAF_CONFIDENCE:.0%} needed to trust a "
            "result. Train the Tobacco Verification Model for a reliable check."
        ),
    )
    raise NotATobaccoLeafError(fallback)


def _to_verification_result(outcome: VerificationOutcome) -> VerificationResult:
    return VerificationResult(
        is_tobacco=outcome.is_tobacco,
        label=outcome.label,
        confidence=outcome.confidence,
        message=outcome.message,
        method=outcome.method,
        threshold=outcome.threshold,
        all_probabilities=[
            ClassProbability(label=p["label"], probability=p["probability"])
            for p in outcome.probabilities
        ],
    )

# Knowledge base for disease descriptions + farmer-facing recommendations.
DISEASE_INFO = {
    "Alternaria Leaf Spot": {
        "description": (
            "Fungal infection caused by Alternaria alternata. Produces "
            "concentric brown spots that expand and may merge, weakening "
            "the leaf and reducing market value."
        ),
        "recommendations": [
            "Remove and destroy infected leaves to limit spread.",
            "Apply a labeled fungicide (e.g., azoxystrobin or mancozeb).",
            "Avoid overhead irrigation; water at the base.",
            "Improve airflow by widening plant spacing.",
        ],
    },
    "Cercospora Leaf Spot": {
        "description": (
            "Caused by Cercospora nicotianae. Small circular spots with "
            "tan centers and dark borders — 'frog-eye' lesions. Severe "
            "infections cause premature defoliation."
        ),
        "recommendations": [
            "Rotate crops; avoid planting tobacco on the same field 2 years in a row.",
            "Apply a copper- or chlorothalonil-based fungicide on a 7–10 day schedule.",
            "Remove crop debris after harvest.",
            "Use resistant cultivars next season if available.",
        ],
    },
    "Healthy": {
        "description": (
            "The leaf shows no visible signs of disease. Color, texture, and "
            "veining are within normal ranges for cured tobacco."
        ),
        "recommendations": [
            "Maintain current irrigation and fertilization schedule.",
            "Continue routine pest scouting every 7–10 days.",
            "Monitor humidity to prevent fungal onset.",
        ],
    },
}

_DISEASE_INFO_FALLBACK = {
    "description": "No description available for this disease class.",
    "recommendations": ["Consult a local agricultural extension officer for guidance."],
}

QUALITY_INFO = {
    "Grade A": {
        "description": (
            "Premium quality. Leaves are uniform, well-cured, with rich "
            "color, fine texture, and high oil content. Suitable for "
            "premium cigars and export markets."
        ),
        "market_value": "Highest — premium export pricing",
    },
    "Grade B": {
        "description": (
            "Mid-tier quality. Acceptable color and texture with minor "
            "blemishes or color variation. Suitable for blended cigarettes "
            "and domestic markets."
        ),
        "market_value": "Standard market pricing",
    },
    "Grade C": {
        "description": (
            "Lower quality. Inconsistent color, possible damage, brittle "
            "texture, or poor curing. Typically used for low-grade products "
            "or further processing."
        ),
        "market_value": "Lowest — bulk processing pricing",
    },
}


def _lookup_disease(label: str) -> dict:
    """Safe lookup — never raises KeyError for unknown labels."""
    return DISEASE_INFO.get(label, _DISEASE_INFO_FALLBACK)


def _lookup_quality(label: str) -> dict:
    """Safe lookup — never raises KeyError for unknown grade labels."""
    return QUALITY_INFO.get(label, {
        "description": "Quality grade not recognized.",
        "market_value": "Unknown",
    })


def _to_class_probs(labels: List[str], probs: List[float]) -> List[ClassProbability]:
    return [ClassProbability(label=l, probability=p) for l, p in zip(labels, probs)]


def predict_disease_only(
    image: Image.Image,
    image_url: str | None = None,
    verification: VerificationOutcome | None = None,
) -> PredictionResponse:
    """Run disease prediction only (quality result is a stub).

    Raises NotATobaccoLeafError if verification rejects the image.
    """
    # Stage 1: Tobacco Verification — the disease model is not touched unless
    # this passes.
    verification = _verify(image, verification)
    # Stage 2: right subject for this model? A cured leaf gets sent to Quality.
    _assert_right_section(image, "disease", verification)

    started = time.perf_counter()
    disease_probs = model_service.predict_disease(image)

    disease_idx = max(range(len(disease_probs)), key=lambda i: disease_probs[i])
    top_confidence = float(disease_probs[disease_idx])

    _assert_confident_enough(top_confidence, verification)

    disease_label = DISEASE_CLASSES[disease_idx]
    d_info = _lookup_disease(disease_label)

    elapsed_ms = (time.perf_counter() - started) * 1000

    # Quality grading is not performed in disease-only mode
    quality_label = "Grade A"
    q_info = _lookup_quality(quality_label)

    return PredictionResponse(
        id=str(uuid.uuid4()),
        timestamp=datetime.utcnow(),
        image_url=image_url,
        mode="disease",
        verification=_to_verification_result(verification),
        disease=DiseaseResult(
            label=disease_label,
            confidence=top_confidence,
            description=d_info["description"],
            recommendations=d_info["recommendations"],
            all_probabilities=_to_class_probs(DISEASE_CLASSES, disease_probs),
        ),
        quality=QualityResult(
            grade=quality_label,
            confidence=1.0,
            description="Quality grading not performed in disease-only mode.",
            market_value="N/A",
            all_probabilities=_to_class_probs(QUALITY_CLASSES, [0.33, 0.33, 0.34]),
        ),
        processing_time_ms=elapsed_ms,
    )


def predict_quality_only(
    image: Image.Image,
    image_url: str | None = None,
    verification: VerificationOutcome | None = None,
) -> PredictionResponse:
    """Run quality prediction only (disease result is a stub).

    Raises NotATobaccoLeafError if verification rejects the image.
    """
    # Stage 1: Tobacco Verification — the quality model is not touched unless
    # this passes.
    verification = _verify(image, verification)
    # Stage 2: right subject for this model? A fresh leaf gets sent to Disease.
    _assert_right_section(image, "quality", verification)

    started = time.perf_counter()

    # The disease model runs here purely as the legacy confidence net, and only
    # matters while verification is on the colour fallback.
    if verification.method == METHOD_COLOR:
        disease_probs = model_service.predict_disease(image)
        _assert_confident_enough(max(disease_probs), verification)

    quality_probs = model_service.predict_quality(image)
    quality_idx = max(range(len(quality_probs)), key=lambda i: quality_probs[i])
    quality_label = QUALITY_CLASSES[quality_idx]
    q_info = _lookup_quality(quality_label)

    elapsed_ms = (time.perf_counter() - started) * 1000

    # Stub disease result
    disease_label = "Healthy"
    d_info = _lookup_disease(disease_label)

    return PredictionResponse(
        id=str(uuid.uuid4()),
        timestamp=datetime.utcnow(),
        image_url=image_url,
        mode="quality",
        verification=_to_verification_result(verification),
        disease=DiseaseResult(
            label=disease_label,
            confidence=1.0,
            description="Disease detection not performed in quality-only mode.",
            recommendations=[],
            all_probabilities=_to_class_probs(DISEASE_CLASSES, [0.34, 0.33, 0.33]),
        ),
        quality=QualityResult(
            grade=quality_label,
            confidence=float(quality_probs[quality_idx]),
            description=q_info["description"],
            market_value=q_info["market_value"],
            all_probabilities=_to_class_probs(QUALITY_CLASSES, quality_probs),
        ),
        processing_time_ms=elapsed_ms,
    )


def predict_full(
    image: Image.Image,
    image_url: str | None = None,
    verification: VerificationOutcome | None = None,
) -> PredictionResponse:
    """Run BOTH disease and quality predictions in one call.

    Raises NotATobaccoLeafError if verification rejects the image.
    """
    # Stage 1: Tobacco Verification — neither downstream model is touched
    # unless this passes.
    verification = _verify(image, verification)

    started = time.perf_counter()

    disease_probs = model_service.predict_disease(image)
    quality_probs = model_service.predict_quality(image)

    disease_idx = max(range(len(disease_probs)), key=lambda i: disease_probs[i])
    quality_idx = max(range(len(quality_probs)), key=lambda i: quality_probs[i])

    top_confidence = float(disease_probs[disease_idx])

    _assert_confident_enough(top_confidence, verification)

    disease_label = DISEASE_CLASSES[disease_idx]
    quality_label = QUALITY_CLASSES[quality_idx]

    d_info = _lookup_disease(disease_label)
    q_info = _lookup_quality(quality_label)

    elapsed_ms = (time.perf_counter() - started) * 1000

    return PredictionResponse(
        id=str(uuid.uuid4()),
        timestamp=datetime.utcnow(),
        image_url=image_url,
        mode="full",
        verification=_to_verification_result(verification),
        disease=DiseaseResult(
            label=disease_label,
            confidence=float(disease_probs[disease_idx]),
            description=d_info["description"],
            recommendations=d_info["recommendations"],
            all_probabilities=_to_class_probs(DISEASE_CLASSES, disease_probs),
        ),
        quality=QualityResult(
            grade=quality_label,
            confidence=float(quality_probs[quality_idx]),
            description=q_info["description"],
            market_value=q_info["market_value"],
            all_probabilities=_to_class_probs(QUALITY_CLASSES, quality_probs),
        ),
        processing_time_ms=elapsed_ms,
    )

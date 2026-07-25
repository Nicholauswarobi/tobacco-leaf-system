"""
Tobacco Verification Service — the gate that runs before every other model.

WHY THIS EXISTS
---------------
The disease and quality models are closed-world classifiers. Trained only on
tobacco leaves, they have no "none of the above" option, so a photo of maize,
a phone or a person is forced into a tobacco class — confidently and wrongly.
A confidence threshold cannot fix that, because the model is often confident
*and* wrong on inputs it has never seen.

This service answers one question first: is this a tobacco leaf at all?

    Upload -> verify -> reject, or continue to disease / quality

STRATEGY
--------
Tier 1  Tobacco Verification Model (ml/scripts/train_verification.py)
        A binary CNN over Tobacco / Not_Tobacco. Used whenever the trained
        .keras file is present. The decision threshold comes from the
        metadata sidecar written at training time.

Tier 2  HSV colour pre-screen (app/utils/leaf_validator.py)
        Used only when the trained model is missing, so a fresh checkout is
        no worse than it was before this pipeline existed. It is a heuristic,
        not a classifier — it catches blue skies and red cars, not maize.

Both tiers return the same VerificationOutcome, so callers never branch on
which one ran.

REUSE
-----
Every downstream entry point goes through the same call:

    from app.services.verification_service import verification_service
    outcome = verification_service.verify(image)     # or verify_or_raise(image)

so disease detection, quality grading and the standalone /api/verify endpoint
all enforce one identical rule.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import List, Optional

from PIL import Image

from app.core.config import settings
from app.services.model_service import (
    model_service,
    VERIFICATION_CLASSES,
    TOBACCO_INDEX,
)
from app.utils.leaf_validator import check_is_tobacco_leaf, is_effectively_grayscale

logger = logging.getLogger("tobacco-api.verification")

# User-facing copy. Kept here so the API, the tests and the docs agree.
SUCCESS_MESSAGE = "Tobacco leaf detected successfully."
FAILURE_MESSAGE = (
    "This image is not a tobacco leaf. Please upload a valid tobacco leaf image."
)

# Reported in the response so clients (and bug reports) can tell which tier ran.
METHOD_MODEL = "verification_model"
METHOD_COLOR = "color_prescreen"
METHOD_DISABLED = "disabled"


class NotATobaccoLeafError(ValueError):
    """Raised when verification rejects an image.

    Carries the full outcome so the API layer can return the probabilities
    alongside the message instead of just a bare string.
    """

    def __init__(self, outcome: "VerificationOutcome") -> None:
        super().__init__(outcome.message)
        self.outcome = outcome


@dataclass
class VerificationOutcome:
    """The verdict, plus everything needed to explain it."""

    is_tobacco: bool
    label: str
    # Confidence in the decision that was made — P(Tobacco) when accepted,
    # P(Not Tobacco) when rejected. Always "how sure are we about this verdict".
    confidence: float
    message: str
    method: str
    threshold: float
    probabilities: List[dict] = field(default_factory=list)
    detail: Optional[str] = None
    processing_time_ms: float = 0.0
    # Raw P(Tobacco) from the model; None when the colour fallback ran, which
    # produces no calibrated probability.
    p_tobacco: Optional[float] = None

    def as_dict(self) -> dict:
        return {
            "is_tobacco": self.is_tobacco,
            "label": self.label,
            "confidence": self.confidence,
            "message": self.message,
            "method": self.method,
            "threshold": self.threshold,
            "all_probabilities": self.probabilities,
            "detail": self.detail,
            "processing_time_ms": self.processing_time_ms,
        }


class VerificationService:
    """Reusable Tobacco / Not Tobacco gate shared by all downstream models."""

    @property
    def is_model_backed(self) -> bool:
        """True when the trained CNN is doing the work (not the colour fallback)."""
        return model_service.verification_loaded

    @property
    def threshold(self) -> float:
        return model_service.verification_threshold

    @property
    def method(self) -> str:
        if not settings.VERIFICATION_ENABLED:
            return METHOD_DISABLED
        return METHOD_MODEL if self.is_model_backed else METHOD_COLOR

    def verify(self, image: Image.Image) -> VerificationOutcome:
        """Classify an image as Tobacco / Not Tobacco. Never raises."""
        started = time.perf_counter()

        if not settings.VERIFICATION_ENABLED:
            logger.warning("Verification is disabled — image accepted unchecked.")
            outcome = VerificationOutcome(
                is_tobacco=True,
                label="Tobacco",
                confidence=1.0,
                message=SUCCESS_MESSAGE,
                method=METHOD_DISABLED,
                threshold=self.threshold,
                detail="Verification is disabled via VERIFICATION_ENABLED=false.",
            )
        else:
            probs = model_service.predict_verification(image)
            outcome = (
                self._from_model(probs)
                if probs is not None
                else self._from_color_prescreen(image)
            )

        outcome.processing_time_ms = (time.perf_counter() - started) * 1000
        return outcome

    def verify_or_raise(self, image: Image.Image) -> VerificationOutcome:
        """Verify and raise NotATobaccoLeafError on rejection.

        This is what the prediction pipeline calls: it makes "continue only if
        tobacco" the default control flow, so a downstream model can never be
        reached by forgetting to check a boolean.
        """
        outcome = self.verify(image)
        if not outcome.is_tobacco:
            logger.info(
                "Rejected non-tobacco upload (method=%s, P(tobacco)=%s, threshold=%.2f)",
                outcome.method,
                f"{outcome.p_tobacco:.3f}" if outcome.p_tobacco is not None else "n/a",
                outcome.threshold,
            )
            raise NotATobaccoLeafError(outcome)
        return outcome

    # ---------- tier 1: the trained model ----------
    def _from_model(self, probs: List[float]) -> VerificationOutcome:
        if len(probs) != len(VERIFICATION_CLASSES):
            # A model with the wrong head shape would silently mis-index.
            logger.error(
                "Verification model returned %d probabilities, expected %d. "
                "Falling back to the colour pre-screen.",
                len(probs), len(VERIFICATION_CLASSES),
            )
            return VerificationOutcome(
                is_tobacco=False,
                label="Not Tobacco",
                confidence=0.0,
                message=FAILURE_MESSAGE,
                method=METHOD_MODEL,
                threshold=self.threshold,
                detail="Verification model output shape is invalid.",
            )

        p_tobacco = float(probs[TOBACCO_INDEX])
        threshold = self.threshold
        is_tobacco = p_tobacco >= threshold

        if is_tobacco:
            detail = None
        else:
            detail = (
                f"The verification model scored this image {p_tobacco:.0%} "
                f"likely to be a tobacco leaf, below the {threshold:.0%} "
                "threshold required to continue."
            )

        return VerificationOutcome(
            is_tobacco=is_tobacco,
            label="Tobacco" if is_tobacco else "Not Tobacco",
            confidence=p_tobacco if is_tobacco else 1.0 - p_tobacco,
            message=SUCCESS_MESSAGE if is_tobacco else FAILURE_MESSAGE,
            method=METHOD_MODEL,
            threshold=threshold,
            probabilities=[
                {"label": label, "probability": float(p)}
                for label, p in zip(VERIFICATION_CLASSES, probs)
            ],
            detail=detail,
            p_tobacco=p_tobacco,
        )

    # ---------- tier 2: colour pre-screen fallback ----------
    def _from_color_prescreen(self, image: Image.Image) -> VerificationOutcome:
        if not settings.VERIFICATION_COLOR_FALLBACK:
            # Explicit opt-out: no trained model and no heuristic means no gate.
            # Logged at warning level every request, because this is exactly the
            # configuration in which maize reaches the disease model.
            logger.warning(
                "Verification model missing and VERIFICATION_COLOR_FALLBACK=false "
                "— image accepted without any check."
            )
            return VerificationOutcome(
                is_tobacco=True,
                label="Tobacco",
                confidence=0.5,
                message=SUCCESS_MESSAGE,
                method=METHOD_COLOR,
                threshold=self.threshold,
                detail=(
                    "No verification was performed: the model is not loaded and the "
                    "colour fallback is disabled."
                ),
            )

        # The heuristic reads hue and saturation. A grayscale image has neither,
        # so it scores 0% leaf coverage and would be rejected outright — which
        # is wrong: it means "cannot tell", not "not a leaf". Abstain instead,
        # and let the downstream confidence net decide.
        if is_effectively_grayscale(image):
            logger.info(
                "Colour pre-screen abstained: image is grayscale, so hue/saturation "
                "carry no signal. Train the verification model for a real check."
            )
            return VerificationOutcome(
                is_tobacco=True,
                label="Tobacco",
                confidence=0.5,
                message=SUCCESS_MESSAGE,
                method=METHOD_COLOR,
                threshold=self.threshold,
                detail=(
                    "The colour pre-screen cannot judge a grayscale image, so it "
                    "abstained. Train the Tobacco Verification Model for a "
                    "reliable check."
                ),
            )

        ok, reason = check_is_tobacco_leaf(image)

        if ok:
            detail = (
                "Colour pre-screen only — the verification model is not loaded, "
                "so this image was accepted on colour distribution alone."
            )
        else:
            detail = reason or "Colour pre-screen rejected this image."

        # The heuristic produces no calibrated probability. Inventing one would
        # overstate what is actually known, so confidence stays at a neutral 0.5
        # and `method` tells the caller which tier decided.
        return VerificationOutcome(
            is_tobacco=ok,
            label="Tobacco" if ok else "Not Tobacco",
            confidence=0.5,
            message=SUCCESS_MESSAGE if ok else FAILURE_MESSAGE,
            method=METHOD_COLOR,
            threshold=self.threshold,
            probabilities=[],
            detail=detail,
            p_tobacco=None,
        )


# singleton, mirroring model_service / history_service
verification_service = VerificationService()

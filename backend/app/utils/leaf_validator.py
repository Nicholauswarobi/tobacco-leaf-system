"""
Tobacco leaf pre-screening via color-space analysis.

WHY THIS EXISTS
--------------
The disease and quality ML models are closed-world classifiers trained
*exclusively* on tobacco leaf images.  They have never seen a non-leaf,
so they confidently force any input — a portrait, a car, a blue sky — into
one of their known leaf-disease classes.  A confidence threshold alone cannot
reliably stop this, because the model can be wrong *and* confident.

DETECTION STRATEGY
------------------
Two layers of color-based gates run **before** any ML inference:

  Layer 1 (hard floor)
      If fewer than LEAF_HARD_MIN of all pixels fall in tobacco-leaf color
      ranges, reject immediately.

  Layer 2 (soft + non-leaf check)
      If leaf coverage is below LEAF_SOFT_MIN **and** clearly non-leaf colors
      (blues, purples, bright reds) exceed NON_LEAF_SOFT_MAX, reject.

After both gates pass, the ML models run as usual and the existing
confidence threshold acts as a third safety net.

COLOR SPACE NOTES (cv2 HSV convention)
---------------------------------------
  H : 0 – 180  (each unit = 2°, so H=60 ≈ 120° ≈ pure green)
  S : 0 – 255
  V : 0 – 255

Tobacco leaf color palette across growth / curing stages:

  Stage                 | H (cv2) | S         | V
  ─────────────────────────────────────────────────────────
  Fresh / live green    | 40 – 75 | 50 – 255  | 50 – 255
  Yellowing (stress)    | 28 – 45 | 50 – 200  | 77 – 230
  Yellow / gold (cure)  | 15 – 30 | 64 – 200  | 128 – 230
  Warm brown / tan      |  4 – 22 | 18 – 165  | 38 – 200
  Dark brown (cured)    |  2 – 20 | 12 – 130  | 12 – 102
  Necrotic / dark spots |  2 – 30 |  8 –  55  | 18 – 140

Clearly non-leaf colors:

  Type                  | H (cv2)    | S     | V
  ────────────────────────────────────────────────
  Blue (sky, clothing)  | 88 – 128  | ≥ 50  | any
  Purple / violet       | 128 – 152 | ≥ 60  | any
  Pink / magenta        | 152 – 178 | ≥ 60  | any
  Bright red (wrap)     | < 4 or > 170 | > 120 | > 77
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

# ─────────────────────────────────────────────────────────────────────────────
# Tunable thresholds
# ─────────────────────────────────────────────────────────────────────────────

# Hard floor: below this fraction of leaf-like pixels → always reject
LEAF_HARD_MIN: float = 0.12

# Soft floor: below this fraction AND non-leaf ratio exceeds NON_LEAF_SOFT_MAX → reject
LEAF_SOFT_MIN: float = 0.22

# Non-leaf ceiling (paired with the soft floor)
NON_LEAF_SOFT_MAX: float = 0.20

# Mean saturation below which an image carries no usable colour information.
# Every leaf mask below requires S >= 8 at minimum, so a grayscale image scores
# 0% leaf coverage and would be rejected outright — including genuine tobacco
# leaves. See is_effectively_grayscale().
GRAYSCALE_MAX_SATURATION: float = 8.0


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _to_hsv(image: Image.Image, size: int = 112) -> np.ndarray:
    """
    Convert a PIL image to a cv2 HSV array of shape (size, size, 3).

    We resize to a small square first — color distribution analysis is
    resolution-invariant and this keeps latency under 1 ms.
    """
    small = image.convert("RGB").resize((size, size), Image.BILINEAR)
    bgr = cv2.cvtColor(np.asarray(small, dtype=np.uint8), cv2.COLOR_RGB2BGR)
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)


def _build_masks(hsv: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Return (leaf_mask, non_leaf_mask) — boolean arrays of shape (H, W).

    leaf_mask     : pixels whose color is consistent with tobacco leaf tissue
    non_leaf_mask : pixels that are clearly and unambiguously not leaf tissue
    """
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    # ── leaf-like color ranges ────────────────────────────────────────────

    # Fresh / live green leaf surface
    fresh_green   = (h >= 40) & (h <= 75) & (s >= 50) & (v >= 50)

    # Yellowing leaf (stress, early curing stage)
    yellow_green  = (h >= 28) & (h <= 45) & (s >= 50) & (v >= 77)

    # Yellow / gold (mid-to-late curing)
    yellow        = (h >= 15) & (h <= 30) & (s >= 64) & (v >= 128)

    # Warm brown / tan (fully cured leaf)
    brown         = (h >= 4)  & (h <= 22) & (s >= 18) & (s <= 165) & (v >= 38) & (v <= 200)

    # Dark brown (heavily cured or necrotic tissue)
    dark_brown    = (h >= 2)  & (h <= 20) & (s >= 12) & (s <= 130) & (v >= 12) & (v <= 102)

    # Low-saturation warm tones: shadows, underlit leaf areas, venation texture
    warm_shadow   = (h >= 2)  & (h <= 30) & (s >= 8)  & (s <= 55)  & (v >= 18) & (v <= 140)

    leaf_mask = fresh_green | yellow_green | yellow | brown | dark_brown | warm_shadow

    # ── clearly non-leaf color ranges ─────────────────────────────────────

    # Blue (sky, denim, vehicles, water)
    blue          = (h >= 88) & (h <= 128) & (s >= 50)

    # Purple / violet
    purple        = (h >= 128) & (h <= 152) & (s >= 60)

    # Pink / magenta
    pink          = (h >= 152) & (h <= 178) & (s >= 60)

    # Bright red — wraps around H=0 in cv2; exclude warm brown-reds which are valid leaf
    bright_red    = ((h <= 3) | (h >= 170)) & (s > 120) & (v > 77)

    non_leaf_mask = blue | purple | pink | bright_red

    return leaf_mask, non_leaf_mask


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def is_effectively_grayscale(image: Image.Image) -> bool:
    """True when the image carries essentially no colour information.

    WHY THIS MATTERS
    ----------------
    This module decides using hue and saturation only. A grayscale image has
    S ~= 0 everywhere, so it matches none of the leaf ranges below and scores
    0% leaf coverage — which reads as "definitely not a leaf" when the truth
    is "this test cannot tell".

    That is not hypothetical: every image in this project's training set
    (ml/data/raw/disease/) is stored as RGB but is perfectly grayscale, so all
    of them fail the colour screen. Black-and-white scans and heavily
    desaturated phone photos hit the same wall.

    Callers should treat a True here as "abstain", not "reject", and defer to
    the trained Tobacco Verification Model.
    """
    hsv = _to_hsv(image)
    return float(hsv[..., 1].mean()) < GRAYSCALE_MAX_SATURATION


def check_is_tobacco_leaf(image: Image.Image) -> tuple[bool, str]:
    """
    Pre-screen an image to determine whether it could plausibly be a tobacco leaf.

    Parameters
    ----------
    image : PIL.Image.Image
        The uploaded image (any mode, any size).

    Returns
    -------
    (True, "")
        Image passes screening — proceed to ML model inference.
    (False, rejection_reason)
        Image fails screening — caller should raise NotATobaccoLeafError.

    This check runs in ~ 1 ms (112×112 resize + two boolean masks).
    """
    hsv = _to_hsv(image)
    leaf_mask, non_leaf_mask = _build_masks(hsv)

    leaf_ratio     = float(leaf_mask.mean())
    non_leaf_ratio = float(non_leaf_mask.mean())

    # ── Gate 1: hard floor — almost no leaf-like color at all ─────────────
    if leaf_ratio < LEAF_HARD_MIN:
        return False, (
            f"The uploaded image does not appear to be a tobacco leaf. "
            f"Only {leaf_ratio:.0%} of the image contains leaf-like colors "
            f"(greens, yellows, or browns). "
            "Please upload a clear, well-lit photograph of a tobacco leaf."
        )

    # ── Gate 2: soft floor — sparse leaf color AND non-leaf colors dominate
    if leaf_ratio < LEAF_SOFT_MIN and non_leaf_ratio > NON_LEAF_SOFT_MAX:
        return False, (
            f"The uploaded image does not appear to be a tobacco leaf. "
            f"Leaf-like color coverage is only {leaf_ratio:.0%}, "
            f"while {non_leaf_ratio:.0%} of the image contains clearly "
            "non-leaf colors (blues, purples, or bright reds). "
            "Please upload a clear photograph of a tobacco leaf."
        )

    return True, ""

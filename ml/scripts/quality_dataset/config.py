"""Paths, source registry and the grade mapping for the quality dataset build.

The mapping from the source dataset's native grade codes to Grade A / B / C is
the only judgement call in this pipeline, so it lives here on its own, fully
documented, rather than being buried in the build script.

Tanzanian grade codes (the source labelling scheme)
---------------------------------------------------
A code is read left to right as: plant position, quality, colour, special
factor. From Table 1 of the dataset's Data-in-Brief paper
(https://doi.org/10.1016/j.dib.2024.110838):

    position   C = Cutters, L = Leaf, M = Thin Leaf, X = Lugs and Primings
    quality    1 = Choice, 2 = Fine, 3 = Good, 4 = Fair, 5 = Low
    colour     L = Lemon, O = Orange, R = Mahogany
    special    F = maturity spots / full maturity / full orange colour

So L2OF is a Leaf-position, Fine-quality, Orange leaf showing full maturity.
Every image in the source dataset is from the Leaf ("L") position.

The quality digit is an explicit, expert-assigned quality ranking, which is
exactly what a three-tier A/B/C grading model needs. Collapsing five official
tiers into three is the mapping below. The paper does NOT define the five
off-grade codes (LG, LK, LLV, LND, LOV) and they carry no quality digit, so
they are deliberately left unmapped and routed to manual review instead of
being guessed into a grade.
"""
from __future__ import annotations

from pathlib import Path

# ml/
ROOT = Path(__file__).resolve().parents[2]

DATASET_ROOT = ROOT / "data" / "tobacco_quality_dataset"

RAW_DIR = DATASET_ROOT / "raw_images"
PROCESSED_DIR = DATASET_ROOT / "processed_images"
DUPLICATES_DIR = DATASET_ROOT / "duplicates"
REJECTED_DIR = DATASET_ROOT / "rejected_images"
REVIEW_DIR = DATASET_ROOT / "needs_manual_review"
REPORTS_DIR = DATASET_ROOT / "reports"

GRADES = ("Grade_A", "Grade_B", "Grade_C")

# Cached Dataverse file index, so re-runs do not re-crawl 50 pages of API.
INDEX_CACHE = REPORTS_DIR / "source_index_tz_dataverse.json"

METADATA_CSV = DATASET_ROOT / "metadata.csv"
MAPPING_CSV = DATASET_ROOT / "grade_mapping.csv"
REVIEW_CSV = REVIEW_DIR / "needs_manual_review.csv"
STATS_JSON = REPORTS_DIR / "dataset_statistics.json"
STATS_MD = REPORTS_DIR / "dataset_statistics.md"
SOURCES_MD = REPORTS_DIR / "download_sources.md"
MONTAGE_PNG = REPORTS_DIR / "preview_montage.png"


# --------------------------------------------------------------------------
# Source registry
# --------------------------------------------------------------------------

TZ_DATAVERSE = {
    "key": "tz_dataverse",
    "name": "Tobacco leaves dataset (Virginia flue-cured, Tanzania)",
    "doi": "doi:10.7910/DVN/TTPLFT",
    "landing_page": "https://doi.org/10.7910/DVN/TTPLFT",
    "repository": "Harvard Dataverse",
    "license": "CC0 1.0 Universal (public domain dedication)",
    "attribution": (
        "Nguleni, Faith (2024), 'Tobacco leaves dataset', Harvard Dataverse, "
        "V1, doi:10.7910/DVN/TTPLFT. Collected by NM-AIST, the Tobacco "
        "Research Institute of Tanzania (TORITA) and the Tanzania Tobacco "
        "Board (TTB)."
    ),
    "paper": "https://doi.org/10.1016/j.dib.2024.110838",
    "api_files": (
        "https://dataverse.harvard.edu/api/datasets/:persistentId"
        "/versions/:latest/files"
    ),
    "api_access": "https://dataverse.harvard.edu/api/access/datafile/{file_id}",
    "cured": True,
    "notes": (
        "Cured (flue-cured) leaves photographed on grading tables at 90 "
        "degrees under white-tent diffused light with a Canon 5D Mark III + "
        "100 mm macro lens. 49,778 JPEGs at 960x1440, one leaf per image."
    ),
}

SOURCES = {TZ_DATAVERSE["key"]: TZ_DATAVERSE}


# --------------------------------------------------------------------------
# Grade mapping
# --------------------------------------------------------------------------

#: Official quality tier (the digit in the code) -> target class.
QUALITY_TIER_TO_GRADE = {
    1: "Grade_A",  # Choice
    2: "Grade_A",  # Fine
    3: "Grade_B",  # Good
    4: "Grade_C",  # Fair
    5: "Grade_C",  # Low
}

QUALITY_TIER_NAME = {
    1: "Choice",
    2: "Fine",
    3: "Good",
    4: "Fair",
    5: "Low",
}

POSITION_NAME = {
    "C": "Cutters",
    "L": "Leaf",
    "M": "Thin Leaf",
    "X": "Lugs and Primings",
}

COLOUR_NAME = {
    "L": "Lemon",
    "O": "Orange",
    "R": "Mahogany",
}

#: Codes the source paper lists in its class table but never defines, and which
#: carry no quality digit. Never mapped to a grade - see module docstring.
UNDEFINED_CODES = {
    "LG": "Leaf, off-grade code not defined in the source paper",
    "LK": "Leaf, off-grade code not defined in the source paper",
    "LLV": "Leaf, off-grade code not defined in the source paper",
    "LND": "Leaf, off-grade code not defined in the source paper",
    "LOV": "Leaf, off-grade code not defined in the source paper",
}


class GradeDecision(dict):
    """Result of interpreting one native grade code."""


def interpret_code(code: str) -> GradeDecision:
    """Decode a Tanzanian grade code into a target grade plus its reasoning.

    Returns a dict with ``grade`` set to a member of :data:`GRADES` or ``None``
    when the code cannot be mapped without guessing. ``reason`` always explains
    the decision so it can be written straight into the mapping file.
    """
    code = code.strip().upper()

    if code in UNDEFINED_CODES:
        return GradeDecision(
            code=code,
            position=POSITION_NAME.get(code[0], "unknown"),
            quality_tier=None,
            quality_name="undefined",
            colour="undefined",
            grade=None,
            reason=(
                f"{UNDEFINED_CODES[code]}; no quality digit, so no grade can "
                "be assigned without guessing"
            ),
        )

    digits = [ch for ch in code if ch.isdigit()]
    if len(digits) != 1:
        return GradeDecision(
            code=code,
            position=POSITION_NAME.get(code[:1], "unknown"),
            quality_tier=None,
            quality_name="unknown",
            colour="unknown",
            grade=None,
            reason="code carries no single quality digit; cannot be mapped",
        )

    tier = int(digits[0])
    idx = code.index(digits[0])
    position = code[:idx]
    tail = code[idx + 1 :]
    colour = tail[:1]
    special = tail[1:]

    grade = QUALITY_TIER_TO_GRADE.get(tier)
    reason = (
        f"quality digit {tier} = {QUALITY_TIER_NAME.get(tier, '?')} quality "
        f"-> {grade}"
    )
    return GradeDecision(
        code=code,
        position=POSITION_NAME.get(position, position or "unknown"),
        quality_tier=tier,
        quality_name=QUALITY_TIER_NAME.get(tier, "unknown"),
        colour=COLOUR_NAME.get(colour, colour or "unknown"),
        special_factor=special or "",
        grade=grade,
        reason=reason,
    )


# --------------------------------------------------------------------------
# Curation thresholds
# --------------------------------------------------------------------------

#: Both sides must be at least this long (the brief's minimum resolution).
MIN_SIDE = 512

#: Variance of the Laplacian below this reads as out of focus. Calibrated
#: against the source images, which are studio-lit and consistently sharp.
BLUR_VARIANCE_MIN = 40.0

#: Hamming distance between 64-bit dHashes at or below which two images are
#: treated as the same leaf. 0 catches re-encodes, small values catch a second
#: shot of the same leaf.
DHASH_MAX_DISTANCE = 6

#: Images whose pixels are nearly all one value are blank frames or lens caps.
MIN_PIXEL_STD = 12.0

ACCEPTED_FORMATS = {"JPEG", "PNG"}
OUTPUT_FORMAT = "JPEG"
OUTPUT_QUALITY = 92

#: Longest side of a processed image. The source is 960x1440, so the default
#: keeps native resolution (no upscaling, no detail thrown away).
MAX_LONG_SIDE = 1440

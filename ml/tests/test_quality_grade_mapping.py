"""Regression tests for the cured-leaf grade mapping and sampling.

Run with:  python -m pytest tests/ -q      (from the ml/ directory)

WHY THIS FILE EXISTS
--------------------
The source dataset labels leaves with Tanzanian grade codes like 'L2OF', where
only the middle digit is a quality ranking. Two silent failures live here.

First, five source codes (LG, LK, LLV, LND, LOV) carry no quality digit and are
never defined by the source paper. It is very tempting to shove them into
Grade C on a hunch. Nothing would ever fail: training runs, accuracy looks
fine, and a few thousand images are simply mislabelled forever. The refusal to
map them has to be enforced, not remembered.

Second, the quota split has to land exactly on target and must never draw more
images from a code than exist. Over-drawing raises no error - it just silently
repeats or truncates images, quietly unbalancing the classes.
"""
from __future__ import annotations

import random
import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.quality_dataset import config  # noqa: E402
from scripts.quality_dataset.build import (  # noqa: E402
    allocate,
    build_plan,
    drop_exact_duplicates,
    group_by_code,
    reset_derived_outputs,
)


# --------------------------------------------------------------------------
# Code interpretation
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "code,tier,grade",
    [
        ("L1L", 1, "Grade_A"),   # Choice
        ("L1OF", 1, "Grade_A"),  # Choice + special factor F
        ("L2R", 2, "Grade_A"),   # Fine
        ("L3L", 3, "Grade_B"),   # Good
        ("L3OF", 3, "Grade_B"),
        ("L4O", 4, "Grade_C"),   # Fair
        ("L5R", 5, "Grade_C"),   # Low
    ],
)
def test_quality_digit_drives_the_grade(code, tier, grade):
    decision = config.interpret_code(code)
    assert decision["quality_tier"] == tier
    assert decision["grade"] == grade


def test_special_factor_is_not_mistaken_for_quality():
    """'F' trails the colour; it must not shift which character is the digit."""
    plain = config.interpret_code("L2O")
    special = config.interpret_code("L2OF")
    assert plain["quality_tier"] == special["quality_tier"] == 2
    assert plain["colour"] == special["colour"] == "Orange"
    assert special["special_factor"] == "F"
    assert plain["special_factor"] == ""


@pytest.mark.parametrize("code", sorted(config.UNDEFINED_CODES))
def test_undefined_codes_are_never_given_a_grade(code):
    """The whole point: no quality digit means no grade, ever."""
    decision = config.interpret_code(code)
    assert decision["grade"] is None
    assert decision["quality_tier"] is None
    assert "guessing" in decision["reason"]


def test_every_tier_maps_somewhere_and_only_to_real_grades():
    assert set(config.QUALITY_TIER_TO_GRADE) == {1, 2, 3, 4, 5}
    assert set(config.QUALITY_TIER_TO_GRADE.values()) <= set(config.GRADES)


def test_mapping_is_monotonic_in_quality():
    """A better quality tier must never map to a worse grade."""
    order = {"Grade_A": 0, "Grade_B": 1, "Grade_C": 2}
    ranks = [order[config.QUALITY_TIER_TO_GRADE[t]] for t in sorted(config.QUALITY_TIER_TO_GRADE)]
    assert ranks == sorted(ranks)


# --------------------------------------------------------------------------
# Planning and sampling
# --------------------------------------------------------------------------


def _record(idx: int, code: str, md5: str | None = None) -> dict:
    return {
        "id": idx,
        "filename": f"{code}_{idx}.jpg",
        "directoryLabel": f"{code}/{code}_1",
        "filesize": 300_000,
        "contentType": "image/jpeg",
        "md5": md5 if md5 is not None else f"md5-{idx}",
    }


def test_group_by_code_ignores_non_images():
    records = [
        _record(1, "L1L"),
        {"id": 2, "filename": "sheet.docx", "directoryLabel": "",
         "contentType": "application/vnd.openxmlformats-officedocument."
                        "wordprocessingml.document", "md5": "x"},
    ]
    buckets = group_by_code(records)
    assert set(buckets) == {"L1L"}


def test_exact_duplicates_are_dropped_before_download():
    records = [_record(1, "L1L", "same"), _record(2, "L1L", "same"), _record(3, "L1L", "other")]
    kept, dropped = drop_exact_duplicates(records)
    assert [r["id"] for r in kept] == [1, 3]
    assert len(dropped) == 1
    assert dropped[0]["duplicate_of"] == "L1L_1.jpg"


def test_allocate_hits_the_quota_exactly():
    rng = random.Random(0)
    buckets = {"L1L": [_record(i, "L1L") for i in range(500)],
               "L2L": [_record(1000 + i, "L2L") for i in range(300)],
               "L2R": [_record(2000 + i, "L2R") for i in range(7)]}
    picked = allocate(buckets, 200, rng)
    assert len(picked) == 200


def test_allocate_never_over_draws_a_small_pool():
    rng = random.Random(0)
    buckets = {"big": [_record(i, "L1L") for i in range(1000)],
               "tiny": [_record(5000 + i, "L2R") for i in range(3)]}
    picked = allocate(buckets, 900, rng)
    counts = Counter(r["directoryLabel"].split("/")[0] for r in picked)
    assert counts["L2R"] <= 3
    assert len(picked) == 900
    assert len({r["id"] for r in picked}) == 900  # no repeats


def test_allocate_is_capped_by_availability():
    rng = random.Random(0)
    buckets = {"L1L": [_record(i, "L1L") for i in range(10)]}
    assert len(allocate(buckets, 999, rng)) == 10


def test_allocate_spreads_across_codes_not_just_the_biggest():
    rng = random.Random(1)
    buckets = {code: [_record(i + n * 1000, code) for i in range(400)]
               for n, code in enumerate(["L4L", "L4O", "L5L", "L5O"])}
    picked = allocate(buckets, 400, rng)
    counts = Counter(r["directoryLabel"].split("/")[0] for r in picked)
    assert set(counts) == set(buckets)
    assert min(counts.values()) >= 90  # ~100 each, allowing for rounding


def test_build_plan_balances_grades_and_quarantines_undefined_codes():
    rng = random.Random(42)
    records = []
    idx = 0
    for code in ["L1L", "L2O", "L3L", "L3O", "L4L", "L5R", "LG", "LND"]:
        for _ in range(200):
            idx += 1
            records.append(_record(idx, code))

    plan, review, _predrops, buckets = build_plan(records, target=300, review_sample=50, rng=rng)

    assert {g: len(v) for g, v in plan.items()} == {
        "Grade_A": 100, "Grade_B": 100, "Grade_C": 100
    }
    # Undefined codes must not leak into any grade.
    graded_codes = {r["directoryLabel"].split("/")[0] for v in plan.values() for r in v}
    assert graded_codes.isdisjoint(config.UNDEFINED_CODES)
    # ...and must be the only thing in the review queue.
    review_codes = {r["directoryLabel"].split("/")[0] for r in review}
    assert review_codes <= set(config.UNDEFINED_CODES)
    assert len(review) == 50
    assert set(buckets) == {"L1L", "L2O", "L3L", "L3O", "L4L", "L5R", "LG", "LND"}


# --------------------------------------------------------------------------
# Re-running the build must not leave strays behind
# --------------------------------------------------------------------------


def test_rerun_clears_stale_images_but_keeps_the_download_cache(tmp_path, monkeypatch):
    """A second run with a smaller --target must not leave images from the
    first run in the grade folders.

    Those strays are never overwritten (different sample, different filenames)
    and never listed in metadata.csv, so the training set quietly gains images
    with no provenance row and the statistics stop matching the folders.
    Nothing errors, and a folder listing looks perfectly normal.
    """
    monkeypatch.setattr(config, "DATASET_ROOT", tmp_path)
    monkeypatch.setattr(config, "PROCESSED_DIR", tmp_path / "processed_images")
    monkeypatch.setattr(config, "RAW_DIR", tmp_path / "raw_images")
    monkeypatch.setattr(config, "DUPLICATES_DIR", tmp_path / "duplicates")
    monkeypatch.setattr(config, "REJECTED_DIR", tmp_path / "rejected_images")
    monkeypatch.setattr(config, "REVIEW_DIR", tmp_path / "needs_manual_review")

    stale = config.PROCESSED_DIR / "Grade_C" / "C_L5O_999.jpg"
    stale.parent.mkdir(parents=True)
    stale.write_bytes(b"stale")

    reviewed = config.REVIEW_DIR / "LG" / "review_LG_1.jpg"
    reviewed.parent.mkdir(parents=True)
    reviewed.write_bytes(b"stale")

    cached = config.RAW_DIR / "L1L" / "123_uyui_1.jpg"
    cached.parent.mkdir(parents=True)
    cached.write_bytes(b"downloaded")

    reset_derived_outputs()

    assert not stale.exists()
    assert not reviewed.exists()
    # The download cache is what makes the build resumable - never clear it.
    assert cached.exists(), "raw_images/ must survive so re-runs skip downloads"

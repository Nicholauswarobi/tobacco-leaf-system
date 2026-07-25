"""Regression tests for negative-class stratified sampling.

WHY THIS FILE EXISTS
--------------------
Negative sources differ in size by an order of magnitude: PlantVillage ships
~54,000 crop-leaf images, an Open Images pull is ~4,700. Sampling that combined
pool uniformly puts ~92% crop leaves in the negative class and leaves ~300
images to represent every person, phone, car and desk.

Nothing about that failure is visible from the class totals - both classes look
correctly balanced - but the resulting gate rejects foliage and waves a photo
of a table straight through. These tests keep the round-robin honest.
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from build_verification_dataset import stratified_sample, stratum_key  # noqa: E402


def make_pool(spec: dict[str, int]) -> list[tuple[Path, str]]:
    """Build a fake (path, digest) pool: {folder: image_count}."""
    pool: list[tuple[Path, str]] = []
    for folder, count in spec.items():
        for i in range(count):
            pool.append((Path(folder) / f"img{i}.jpg", f"{folder}-{i}"))
    return pool


def source_of(path: Path) -> str:
    return path.parts[0]


def test_large_source_does_not_swamp_small_one():
    """The core guarantee: a 11x larger source must not take 92% of the budget."""
    pool = make_pool(
        {f"plantvillage/crop_{i}": 1400 for i in range(38)}
        | {f"openimages/class_{i}": 120 for i in range(39)}
    )
    selected, _ = stratified_sample(pool, 3408, seed=42)

    share = Counter(source_of(p) for p, _ in selected)
    openimages_pct = share["openimages"] / len(selected)
    assert 0.4 < openimages_pct < 0.6, (
        f"openimages got {openimages_pct:.1%}; uniform sampling would give ~8%"
    )


def test_budget_is_respected_exactly():
    pool = make_pool({f"src/f{i}": 100 for i in range(10)})
    selected, held = stratified_sample(pool, 250, seed=1)
    assert len(selected) == 250
    assert held == len(pool) - 250


def test_folders_get_near_equal_shares():
    pool = make_pool({f"src/f{i}": 500 for i in range(10)})
    selected, _ = stratified_sample(pool, 300, seed=1)

    per_folder = Counter(str(p.parent) for p, _ in selected)
    assert len(per_folder) == 10
    assert max(per_folder.values()) - min(per_folder.values()) <= 1


def test_small_folders_are_not_padded_and_release_their_turns():
    """A folder with 5 images contributes 5; the rest absorb the remainder."""
    pool = make_pool({"src/tiny": 5, "src/big_a": 500, "src/big_b": 500})
    selected, _ = stratified_sample(pool, 305, seed=1)

    per_folder = Counter(str(p.parent) for p, _ in selected)
    assert per_folder[str(Path("src/tiny"))] == 5
    assert len(selected) == 305


def test_budget_larger_than_pool_returns_everything():
    pool = make_pool({"src/a": 10, "src/b": 10})
    selected, held = stratified_sample(pool, 999, seed=1)
    assert len(selected) == 20
    assert held == 0


def test_zero_budget_selects_nothing():
    pool = make_pool({"src/a": 10})
    selected, held = stratified_sample(pool, 0, seed=1)
    assert selected == []
    assert held == 10


def test_empty_pool_is_safe():
    assert stratified_sample([], 100, seed=1) == ([], 0)


def test_selection_is_deterministic_for_a_seed():
    pool = make_pool({f"src/f{i}": 50 for i in range(6)})
    first, _ = stratified_sample(pool, 120, seed=7)
    second, _ = stratified_sample(pool, 120, seed=7)
    assert [d for _, d in first] == [d for _, d in second]


def test_different_seeds_pick_different_images():
    pool = make_pool({f"src/f{i}": 50 for i in range(6)})
    a, _ = stratified_sample(pool, 60, seed=1)
    b, _ = stratified_sample(pool, 60, seed=2)
    assert [d for _, d in a] != [d for _, d in b]


def test_split_dirs_collapse_into_one_stratum():
    """PlantVillage ships train/ and val/ with identical class names.

    Treating those as two strata would give every crop double the sampling
    weight of an Open Images class, purely because of folder layout.
    """
    assert stratum_key(Path("PlantVillage/train/Tomato___healthy/a.jpg")) == stratum_key(
        Path("PlantVillage/val/Tomato___healthy/b.jpg")
    )


def test_same_class_name_in_different_sources_stays_separate():
    assert stratum_key(Path("plantvillage/Tomato/a.jpg")) != stratum_key(
        Path("openimages/Tomato/a.jpg")
    )


def test_split_collapse_keeps_the_source_mix_even():
    """The real layout: 38 PlantVillage classes x 2 splits vs 39 OI classes."""
    spec = {}
    for split in ("train", "val"):
        for i in range(38):
            spec[f"plantvillage/{split}/crop_{i}"] = 700
    for i in range(39):
        spec[f"openimages/class_{i}"] = 120

    pool = make_pool(spec)
    selected, _ = stratified_sample(pool, 3408, seed=42)

    share = Counter(source_of(p) for p, _ in selected)
    pv_pct = share["plantvillage"] / len(selected)
    # Without the split collapse this lands near 66%.
    assert 0.4 < pv_pct < 0.6, f"plantvillage took {pv_pct:.1%}"


def test_no_duplicates_in_selection():
    pool = make_pool({f"src/f{i}": 40 for i in range(5)})
    selected, _ = stratified_sample(pool, 150, seed=3)
    digests = [d for _, d in selected]
    assert len(digests) == len(set(digests))

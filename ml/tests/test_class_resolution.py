"""Regression tests for Open Images class-name resolution.

Run with:  python -m pytest tests/ -q      (from the ml/ directory)

These use a fixed fake catalogue, so they need no network and no FiftyOne.

WHY THIS FILE EXISTS
--------------------
A permissive fuzzy cutoff (0.75) silently resolved 'Rice' to 'Dice' — they
share 3 of 4 characters. Nothing would have failed: the download would have
succeeded and quietly filled the Not_Tobacco class with photos of dice under a
folder named after rice. Bad matches here are invisible at every later stage,
so they get pinned down at the source.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from download_not_tobacco import resolve, _containment_match  # noqa: E402

# A stand-in for the real 601-class catalogue, holding the entries these tests
# care about — including the near-misses that caused trouble.
CATALOG = [
    "Common sunflower",
    "Dice",
    "Squash (Plant)",
    "Lavender (Plant)",
    "Houseplant",
    "Plant",
    "Tomato",
    "Potato",
    "Mobile phone",
    "Palm tree",
    "Tree",
    "Person",
    "Car",
]


def only(name: str):
    resolved, unresolved = resolve([name], CATALOG)
    return resolved, unresolved


@pytest.mark.parametrize("name", ["Rice", "Maize", "Cassava", "Grass", "Common bean"])
def test_absent_crops_are_skipped_not_guessed(name):
    """Open Images has none of these. Skipping is correct; guessing is not."""
    resolved, unresolved = only(name)
    assert resolved == []
    assert unresolved == [name]


def test_rice_does_not_resolve_to_dice():
    """The specific bug: one-character edit distance on a 4-letter word."""
    resolved, _ = only("Rice")
    assert "Dice" not in resolved


def test_exact_match_wins():
    assert only("Tomato")[0] == ["Tomato"]


def test_case_insensitive_match():
    assert only("tomato")[0] == ["Tomato"]
    assert only("Mobile Phone")[0] == ["Mobile phone"]


@pytest.mark.parametrize(
    "requested,expected",
    [
        ("Sunflower", "Common sunflower"),
        ("Squash", "Squash (Plant)"),
        ("Lavender", "Lavender (Plant)"),
    ],
)
def test_whole_word_containment(requested, expected):
    """Open Images qualifies several concepts; containment beats edit distance."""
    assert only(requested)[0] == [expected]


def test_containment_prefers_the_most_specific_match():
    # "Plant" appears in Plant, Houseplant, Squash (Plant), Lavender (Plant);
    # the exact entry must win.
    assert only("Plant")[0] == ["Plant"]


def test_containment_respects_word_boundaries():
    # "ant" must not match inside "Plant".
    assert _containment_match("ant", CATALOG) is None


def test_duplicates_are_collapsed():
    resolved, _ = resolve(["Tomato", "tomato", "TOMATO"], CATALOG)
    assert resolved == ["Tomato"]


def test_order_is_preserved():
    resolved, _ = resolve(["Person", "Car", "Tomato"], CATALOG)
    assert resolved == ["Person", "Car", "Tomato"]


def test_empty_catalog_disables_validation():
    """If the catalogue cannot be fetched, pass names through rather than block."""
    resolved, unresolved = resolve(["Anything"], [])
    assert resolved == ["Anything"]
    assert unresolved == []

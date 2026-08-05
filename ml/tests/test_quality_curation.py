"""Regression tests for the image quality gates and duplicate detection.

Run with:  python -m pytest tests/ -q      (from the ml/ directory)

WHY THIS FILE EXISTS
--------------------
Duplicate detection is the one cleaning step whose failure is invisible in
every metric that follows. If the same leaf lands in Grade A and again in
Grade B, the split leaks and validation accuracy goes *up*, so nothing looks
wrong. The perceptual hash therefore has to survive a re-encode (a JPEG saved
twice is not byte-identical, so checksums alone miss it) while still telling
two genuinely different leaves apart.

The resolution and blur gates matter for the opposite reason: they are the only
thing standing between the training set and thumbnails or out-of-focus frames,
and a threshold that quietly stops firing is easy to miss.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.quality_dataset import config, curate  # noqa: E402


def _leaf(seed: int, size=(960, 1440)) -> Image.Image:
    """A deterministic, textured, sharp stand-in for a leaf photograph."""
    rng = np.random.default_rng(seed)
    base = rng.integers(40, 215, size=(size[1] // 8, size[0] // 8, 3), dtype=np.uint8)
    return Image.fromarray(base).resize(size, Image.NEAREST)


def _save(image: Image.Image, path: Path, quality: int = 92) -> Path:
    image.save(path, "JPEG", quality=quality)
    return path


# --------------------------------------------------------------------------
# Quality gates
# --------------------------------------------------------------------------


def test_accepts_a_normal_source_image(tmp_path):
    facts = curate.inspect(_save(_leaf(1), tmp_path / "ok.jpg"))
    assert facts["width"], facts["height"] == (960, 1440)
    assert facts["format"] == "JPEG"
    assert facts["sharpness"] >= config.BLUR_VARIANCE_MIN


def test_rejects_below_minimum_resolution(tmp_path):
    small = _save(_leaf(2, size=(400, 600)), tmp_path / "small.jpg")
    with pytest.raises(curate.Rejected) as caught:
        curate.inspect(small)
    assert caught.value.category == "below_min_resolution"


def test_rejects_a_blank_frame(tmp_path):
    blank = Image.new("RGB", (960, 1440), (128, 128, 128))
    with pytest.raises(curate.Rejected) as caught:
        curate.inspect(_save(blank, tmp_path / "blank.jpg"))
    assert caught.value.category == "near_blank"


def test_rejects_a_blurry_frame(tmp_path):
    """Blurred but still high-contrast: it must fail on focus, not on being blank.

    A fine-noise image blurs into flat grey and would trip the blank-frame gate
    instead, which would leave the focus threshold untested.
    """
    rng = np.random.default_rng(3)
    blocks = rng.integers(20, 235, size=(6, 4, 3), dtype=np.uint8)
    blurred = (
        Image.fromarray(blocks)
        .resize((960, 1440), Image.NEAREST)
        .filter(ImageFilter.GaussianBlur(radius=25))
    )
    facts_std = np.asarray(blurred.convert("L"), dtype=np.float32).std()
    assert facts_std > config.MIN_PIXEL_STD  # genuinely not a blank frame

    with pytest.raises(curate.Rejected) as caught:
        curate.inspect(_save(blurred, tmp_path / "blur.jpg"))
    assert caught.value.category == "blurry"


def test_rejects_a_corrupt_file(tmp_path):
    broken = tmp_path / "broken.jpg"
    broken.write_bytes(b"\xff\xd8\xff\xe0 not really a jpeg")
    with pytest.raises(curate.Rejected) as caught:
        curate.inspect(broken)
    assert caught.value.category in {"corrupted", "unreadable"}


def test_rejection_categories_are_filesystem_safe(tmp_path):
    """Categories become folder names under rejected_images/, so they must not
    carry the measured values that vary per image - that once produced one
    folder per distinct measurement."""
    cases = [
        _save(_leaf(20, size=(400, 600)), tmp_path / "small.jpg"),
        _save(_leaf(21, size=(410, 610)), tmp_path / "small2.jpg"),
    ]
    categories = set()
    for path in cases:
        with pytest.raises(curate.Rejected) as caught:
            curate.inspect(path)
        categories.add(caught.value.category)
    assert categories == {"below_min_resolution"}  # one bucket, not two
    assert not (set('<>:"/\\|?*') & set("".join(categories)))


def test_blur_threshold_is_independent_of_image_size(tmp_path):
    """Sharpness is measured at a fixed scale, so a big and a small crop of the
    same content must not straddle the threshold."""
    big = _leaf(4, size=(1200, 1600))
    small = big.resize((600, 800), Image.LANCZOS)
    a = curate.inspect(_save(big, tmp_path / "big.jpg"))["sharpness"]
    b = curate.inspect(_save(small, tmp_path / "small.jpg"))["sharpness"]
    assert min(a, b) > config.BLUR_VARIANCE_MIN
    assert abs(a - b) / max(a, b) < 0.6


# --------------------------------------------------------------------------
# Duplicate detection
# --------------------------------------------------------------------------


def test_dhash_survives_a_re_encode(tmp_path):
    """The failure this guards: a re-saved JPEG has a new checksum but is the
    same leaf, and would otherwise slip into a second grade folder."""
    original = _leaf(5)
    a = curate.inspect(_save(original, tmp_path / "a.jpg", quality=95))
    b = curate.inspect(_save(original, tmp_path / "b.jpg", quality=70))
    assert a["dhash"] != 0
    distance = bin(a["dhash"] ^ b["dhash"]).count("1")
    assert distance <= config.DHASH_MAX_DISTANCE


def test_dhash_separates_different_leaves(tmp_path):
    a = curate.inspect(_save(_leaf(6), tmp_path / "a.jpg"))
    b = curate.inspect(_save(_leaf(7), tmp_path / "b.jpg"))
    distance = bin(a["dhash"] ^ b["dhash"]).count("1")
    assert distance > config.DHASH_MAX_DISTANCE


def test_duplicate_index_reports_what_was_matched():
    index = curate.DuplicateIndex(max_distance=4)
    index.add_exact("md5-1", "A_L1L_1.jpg")
    assert index.check_exact("md5-1") == "A_L1L_1.jpg"
    assert index.check_exact("md5-2") is None

    index.add_near(0b1010101010101010, "A_L1L_1.jpg")
    assert index.check_near(0b1010101010101011) == "A_L1L_1.jpg"  # distance 1
    assert index.check_near(0b0101010101010101) is None           # distance 16


def test_duplicate_index_grows_past_its_initial_capacity():
    """The hash buffer is preallocated; overflowing it must not drop entries."""
    index = curate.DuplicateIndex(max_distance=0, capacity=4)
    for i in range(50):
        index.add_near(i << 8, f"img_{i}.jpg")
    assert index.check_near(49 << 8) == "img_49.jpg"
    assert index.check_near(0) == "img_0.jpg"


# --------------------------------------------------------------------------
# Normalisation
# --------------------------------------------------------------------------


def test_normalise_outputs_rgb_without_metadata(tmp_path):
    src = tmp_path / "src.jpg"
    _leaf(8).convert("L").save(src, "JPEG", quality=95, comment=b"watermark")
    dest = tmp_path / "out" / "A_L1L_1.jpg"
    size = curate.normalise(src, dest)

    with Image.open(dest) as out:
        assert out.mode == "RGB"
        assert out.size == size
        assert not out.info.get("exif")
        assert not out.info.get("icc_profile")


def test_normalise_downscales_only_when_oversized(tmp_path):
    native = _save(_leaf(9, size=(960, 1440)), tmp_path / "native.jpg")
    assert curate.normalise(native, tmp_path / "a.jpg") == (960, 1440)

    huge = _save(_leaf(10, size=(2000, 3000)), tmp_path / "huge.jpg")
    width, height = curate.normalise(huge, tmp_path / "b.jpg")
    assert max(width, height) == config.MAX_LONG_SIDE
    assert abs(width / height - 2000 / 3000) < 0.01  # aspect ratio preserved

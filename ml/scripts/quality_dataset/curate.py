"""Image validation, near-duplicate detection and normalisation.

Nothing here is tobacco-specific; it is the generic "is this image fit to train
on" layer that sits between download and the grade folders.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFile, ImageOps

from . import config

# A handful of source JPEGs have a truncated final scan. Reading them is fine;
# the quality checks below still get a fair look at the pixels.
ImageFile.LOAD_TRUNCATED_IMAGES = True

#: Bits set in each byte value, for vectorised Hamming distance.
_POPCOUNT = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)


class Rejected(Exception):
    """Raised when an image fails a check.

    ``category`` is a stable, filesystem-safe slug used to bucket rejects into
    folders and to group them in the statistics report. The message adds the
    specifics (measured values), which are useful to read but too varied to
    group on - deriving the category by slicing the message apart, as an
    earlier version did, produced a new folder per distinct measurement.
    """

    def __init__(self, category: str, detail: str) -> None:
        super().__init__(f"{category}: {detail}")
        self.category = category
        self.detail = detail


def dhash(image: Image.Image, size: int = 8) -> int:
    """64-bit difference hash - robust to re-encoding and small rescales."""
    small = image.convert("L").resize((size + 1, size), Image.LANCZOS)
    pixels = np.asarray(small, dtype=np.int16)
    bits = (pixels[:, 1:] > pixels[:, :-1]).flatten()
    return int(np.packbits(bits).view(">u8")[0])


def laplacian_variance(image: Image.Image) -> float:
    """Focus measure. Low variance means few edges, i.e. a blurry frame."""
    grey = np.asarray(image.convert("L"), dtype=np.uint8)
    # Downscale first so the threshold does not depend on image size.
    if max(grey.shape) > 512:
        scale = 512 / max(grey.shape)
        grey = cv2.resize(grey, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(grey, cv2.CV_64F).var())


def inspect(path: Path) -> dict:
    """Open an image and run every quality gate.

    Raises :class:`Rejected` with the failing reason, otherwise returns the
    facts the metadata CSV needs plus the perceptual hash.
    """
    try:
        with Image.open(path) as probe:
            probe.verify()  # cheap structural check; invalidates the handle
    except Exception as exc:  # noqa: BLE001 - Pillow raises many types here
        raise Rejected("corrupted", exc.__class__.__name__) from exc

    try:
        image = Image.open(path)
        image.load()
    except Exception as exc:  # noqa: BLE001
        raise Rejected("unreadable", exc.__class__.__name__) from exc

    with image:
        fmt = image.format or "UNKNOWN"
        if fmt not in config.ACCEPTED_FORMATS:
            raise Rejected(
                "unsupported_format",
                f"{fmt} not in {sorted(config.ACCEPTED_FORMATS)}",
            )

        width, height = image.size
        if min(width, height) < config.MIN_SIDE:
            raise Rejected(
                "below_min_resolution",
                f"{width}x{height}, shortest side under {config.MIN_SIDE}px",
            )

        rgb = image.convert("RGB")

        std = float(np.asarray(rgb.convert("L"), dtype=np.float32).std())
        if std < config.MIN_PIXEL_STD:
            raise Rejected("near_blank", f"pixel std {std:.1f}")

        sharpness = laplacian_variance(rgb)
        if sharpness < config.BLUR_VARIANCE_MIN:
            raise Rejected("blurry", f"laplacian variance {sharpness:.1f}")

        return {
            "width": width,
            "height": height,
            "format": fmt,
            "mode": image.mode,
            "sharpness": round(sharpness, 2),
            "pixel_std": round(std, 2),
            "dhash": dhash(rgb),
        }


class DuplicateIndex:
    """Exact (checksum) and near-duplicate (dHash) membership tests.

    Near-duplicate lookup compares against every hash seen so far, vectorised
    over a numpy buffer so the scan stays fast at tens of thousands of images.
    """

    def __init__(
        self,
        max_distance: int = config.DHASH_MAX_DISTANCE,
        capacity: int = 4096,
    ) -> None:
        self.max_distance = max_distance
        self._exact: dict[str, str] = {}
        self._buf = np.zeros(capacity, dtype=np.uint64)
        self._names: list[str] = []

    def check_exact(self, digest: str) -> str | None:
        return self._exact.get(digest)

    def add_exact(self, digest: str, name: str) -> None:
        self._exact.setdefault(digest, name)

    def check_near(self, value: int) -> str | None:
        count = len(self._names)
        if count == 0:
            return None
        xor = np.bitwise_xor(self._buf[:count], np.uint64(value))
        distances = _POPCOUNT[xor.view(np.uint8).reshape(count, 8)].sum(axis=1)
        best = int(distances.argmin())
        if distances[best] <= self.max_distance:
            return self._names[best]
        return None

    def add_near(self, value: int, name: str) -> None:
        count = len(self._names)
        if count == self._buf.size:
            self._buf = np.resize(self._buf, self._buf.size * 2)
        self._buf[count] = np.uint64(value)
        self._names.append(name)


def normalise(src: Path, dest: Path) -> tuple[int, int]:
    """Write ``src`` to ``dest`` as RGB JPEG, downscaled only if oversized.

    EXIF orientation is applied and then all metadata dropped, so downstream
    loaders cannot disagree about which way up a leaf is. Returns the size
    written.
    """
    with Image.open(src) as opened:
        rotated = ImageOps.exif_transpose(opened)
        rgb = rotated.convert("RGB")

        longest = max(rgb.size)
        if longest > config.MAX_LONG_SIDE:
            scale = config.MAX_LONG_SIDE / longest
            new_size = (round(rgb.width * scale), round(rgb.height * scale))
            rgb = rgb.resize(new_size, Image.LANCZOS)

        # Rebuild from raw pixels so no EXIF, ICC profile or comment rides along.
        clean = Image.frombytes("RGB", rgb.size, rgb.tobytes())

    dest.parent.mkdir(parents=True, exist_ok=True)
    clean.save(
        dest,
        config.OUTPUT_FORMAT,
        quality=config.OUTPUT_QUALITY,
        optimize=True,
    )
    return clean.size

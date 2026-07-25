"""
Assemble the Tobacco / Not_Tobacco dataset for the verification model.

Sources
-------
Tobacco (positive):
    ml/data/raw/disease/**          every tobacco leaf image already on disk
    ml/data/raw/quality/**          if present
    --extra-tobacco <dir> ...       any additional folders

Not_Tobacco (negative):
    ml/data/raw/not_tobacco_source/**   from download_not_tobacco.py
    --extra-negatives <dir> ...         PlantVillage, your own photos, anything

Output
------
    ml/data/raw/verification/
        Not_Tobacco/*.jpg
        Tobacco/*.jpg

Folder names are deliberate: Keras' `image_dataset_from_directory` sorts
alphabetically, so Not_Tobacco == index 0 and Tobacco == index 1. The backend
hard-codes that order, so do not rename these folders.

Usage
-----
    python scripts/build_verification_dataset.py
    python scripts/build_verification_dataset.py --max-per-class 3000
    python scripts/build_verification_dataset.py --extra-negatives ../plantvillage
    python scripts/build_verification_dataset.py --append --extra-negatives ./new_photos
"""
from __future__ import annotations

import argparse
import hashlib
import random
import shutil
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
VERIFY_DIR = RAW / "verification"

POSITIVE_DIR = VERIFY_DIR / "Tobacco"
NEGATIVE_DIR = VERIFY_DIR / "Not_Tobacco"

DEFAULT_TOBACCO_SOURCES = [RAW / "disease", RAW / "quality"]
DEFAULT_NEGATIVE_SOURCES = [RAW / "not_tobacco_source"]

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# Images smaller than this on either side are usually icons, sprites or
# thumbnails - they teach the model nothing about leaf texture.
MIN_DIMENSION = 32


def collect(sources: list[Path]) -> list[Path]:
    """Recursively gather image files from every existing source directory."""
    found: list[Path] = []
    for src in sources:
        if not src.exists():
            continue
        found.extend(
            p for p in src.rglob("*")
            if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES
        )
    return sorted(found)


def file_digest(path: Path) -> str | None:
    """Content hash, used to drop exact duplicates.

    The tobacco set was built by copying train/test/valid into one folder, so
    it genuinely does contain repeats; and Open Images classes overlap (a
    'Person' image is often also a 'Car' image).
    """
    h = hashlib.sha256()
    try:
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
    except OSError:
        return None
    return h.hexdigest()


def is_usable(path: Path, verify_images: bool) -> bool:
    """Cheap sanity check - decodable and not a thumbnail."""
    if not verify_images:
        return True
    try:
        from PIL import Image

        with Image.open(path) as im:
            im.verify()
        with Image.open(path) as im:
            w, h = im.size
    except Exception:  # noqa: BLE001 - corrupt file, just skip it
        return False
    return w >= MIN_DIMENSION and h >= MIN_DIMENSION


def dedupe(files: list[Path], label: str, verify_images: bool) -> list[tuple[Path, str]]:
    """Drop unreadable files and exact byte-duplicates. Returns (path, digest) pairs.

    Duplicates are not hypothetical here: reorganize_data.py merges train/test/
    valid into one folder, and Open Images classes overlap heavily (a 'Person'
    photo is frequently also a 'Car' photo). Training on repeats inflates
    validation accuracy because the same image lands on both sides of the split.
    """
    seen: set[str] = set()
    unique: list[tuple[Path, str]] = []
    dupes = 0
    unreadable = 0

    for path in files:
        if not is_usable(path, verify_images):
            unreadable += 1
            continue
        digest = file_digest(path)
        if digest is None:
            unreadable += 1
            continue
        if digest in seen:
            dupes += 1
            continue
        seen.add(digest)
        unique.append((path, digest))

    print(
        f"  {label:<12} scanned={len(files):<6} unique={len(unique):<6} "
        f"exact-duplicates={dupes:<6} unreadable={unreadable}"
    )
    if files and dupes / len(files) > 0.2:
        print(
            f"    note: {dupes / len(files):.0%} of the {label} sources are exact "
            "duplicates - only the unique images are staged."
        )
    return unique


# Directory names that describe a dataset *split* rather than a concept.
# PlantVillage ships train/ and val/ each holding the same 38 classes; without
# this, "Tomato___healthy" counts as two strata and every crop silently gets
# double the sampling weight of an Open Images class.
SPLIT_DIR_NAMES = {"train", "val", "valid", "validation", "test", "images", "data"}


def stratum_key(path: Path) -> tuple[str, ...]:
    """Identify the concept a file belongs to, ignoring split directories.

    PlantVillage/train/Tomato___healthy/x.jpg
    PlantVillage/val/Tomato___healthy/y.jpg
        -> ('plantvillage', 'tomato___healthy')

    Keeping the full parent chain (minus splits) means two sources that happen
    to use the same class name stay separate strata.
    """
    parts = [p for p in path.parent.parts if p.lower() not in SPLIT_DIR_NAMES]
    return tuple(p.lower() for p in parts)


def stratified_sample(
    pending: list[tuple[Path, str]], budget: int, seed: int
) -> tuple[list[tuple[Path, str]], int]:
    """Pick `budget` images spread evenly across their source class folders.

    WHY NOT JUST SHUFFLE
    --------------------
    Sources differ in size by an order of magnitude. PlantVillage ships ~54,000
    crop-leaf images; an Open Images pull is ~4,700. Sampling the combined pool
    uniformly would fill ~92% of the negative class with crop leaves and leave
    roughly 300 images to cover every person, phone, car and household object -
    so the gate would learn to reject foliage and wave a photo of a desk
    straight through.

    Round-robin over class folders instead. Each concept contributes in equal
    turns until its own supply runs out, so a 3,400-image budget spread across
    ~77 folders yields ~44 per concept and a genuinely balanced negative class.
    Folders with less than their share are not padded; their unused turns flow
    to the rest.

    Returns (selected, held_back).
    """
    rng = random.Random(seed)

    strata: dict[tuple[str, ...], list[tuple[Path, str]]] = {}
    for path, digest in pending:
        strata.setdefault(stratum_key(path), []).append((path, digest))

    for items in strata.values():
        rng.shuffle(items)

    # Deterministic stratum order, independent of filesystem iteration order.
    order = sorted(strata.keys())

    selected: list[tuple[Path, str]] = []
    cursor = {key: 0 for key in order}
    exhausted = False
    while len(selected) < budget and not exhausted:
        exhausted = True
        for key in order:
            if len(selected) >= budget:
                break
            idx = cursor[key]
            if idx < len(strata[key]):
                selected.append(strata[key][idx])
                cursor[key] = idx + 1
                exhausted = False

    return selected, len(pending) - len(selected)


def stage(
    unique: list[tuple[Path, str]],
    dest: Path,
    label: str,
    limit: int | None,
    seed: int,
    append: bool,
) -> dict:
    """Subsample and copy already-deduplicated images into `dest`.

    `limit` is the target size of the *class*, not of this run - appending
    twice with --max-per-class 500 leaves 500 images, not 1000.
    """
    dest.mkdir(parents=True, exist_ok=True)

    # What is already staged. Filenames are content-addressed, so the stem is
    # the digest prefix - no need to re-hash a directory that may hold
    # thousands of files.
    staged: set[str] = set()
    if append:
        for path in dest.iterdir():
            if path.suffix.lower() in IMAGE_SUFFIXES:
                staged.add(path.stem)

    pending = [(p, d) for p, d in unique if d[:16] not in staged]

    dropped_to_limit = 0
    if limit is not None:
        room = max(0, limit - len(staged))
        pending, dropped_to_limit = stratified_sample(pending, room, seed)
    else:
        random.Random(seed).shuffle(pending)

    copied = 0
    for path, digest in pending:
        target = dest / f"{digest[:16]}{path.suffix.lower()}"
        if target.exists():
            continue
        try:
            shutil.copy2(path, target)
            copied += 1
        except OSError as exc:
            print(f"    ! copy failed for {path.name}: {exc}")

    total = sum(1 for p in dest.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
    print(
        f"  {label:<12} copied={copied:<6} held-back={dropped_to_limit:<6} on-disk={total}"
    )
    return {
        "copied": copied,
        "total": total,
        "held_back": dropped_to_limit,
        "selected": pending,
    }


def source_breakdown(files: list[Path], root_hint: Path) -> Counter:
    """Count images per immediate sub-folder, for a readable summary."""
    counts: Counter = Counter()
    for f in files:
        try:
            rel = f.relative_to(root_hint)
            counts[rel.parts[0] if len(rel.parts) > 1 else "(root)"] += 1
        except ValueError:
            counts[f.parent.name] += 1
    return counts


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Build the Tobacco / Not_Tobacco verification dataset",
    )
    p.add_argument(
        "--extra-tobacco",
        nargs="+",
        default=[],
        help="Additional directories of tobacco leaf images (searched recursively)",
    )
    p.add_argument(
        "--extra-negatives",
        nargs="+",
        default=[],
        help="Additional directories of non-tobacco images (searched recursively)",
    )
    p.add_argument(
        "--max-per-class",
        type=int,
        default=None,
        help="Cap each class at N images. Default: balance to the smaller class.",
    )
    p.add_argument(
        "--no-balance",
        action="store_true",
        help="Keep the natural class sizes instead of balancing them",
    )
    p.add_argument(
        "--append",
        action="store_true",
        help="Add to the existing verification/ folders instead of rebuilding",
    )
    p.add_argument(
        "--skip-verify",
        action="store_true",
        help="Skip the per-image decode check (faster, but lets corrupt files through)",
    )
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


def main() -> int:
    args = parse_args()

    tobacco_sources = DEFAULT_TOBACCO_SOURCES + [Path(d) for d in args.extra_tobacco]
    negative_sources = DEFAULT_NEGATIVE_SOURCES + [Path(d) for d in args.extra_negatives]

    print("=" * 62)
    print("Building the Tobacco Verification dataset")
    print("=" * 62)

    for label, sources in (("Tobacco", tobacco_sources), ("Not_Tobacco", negative_sources)):
        print(f"\n{label} sources:")
        for s in sources:
            mark = "ok     " if s.exists() else "missing"
            print(f"  [{mark}] {s}")

    tobacco_files = collect(tobacco_sources)
    negative_files = collect(negative_sources)

    print(f"\nFound {len(tobacco_files)} tobacco and {len(negative_files)} non-tobacco images.")

    if not tobacco_files:
        print("\nNo tobacco images found. Run scripts/reorganize_data.py first.")
        return 1

    if not negative_files:
        print(
            "\nNo negative images found. Populate the Not_Tobacco class first:\n"
            "  pip install -r requirements-verification.txt\n"
            "  python scripts/download_not_tobacco.py --per-class 150\n"
            "or point at a folder you already have:\n"
            "  python scripts/build_verification_dataset.py --extra-negatives <dir>"
        )
        return 1

    print("\nNegative-class breakdown:")
    for name, n in source_breakdown(negative_files, RAW / "not_tobacco_source").most_common(30):
        print(f"  {n:>6}  {name}")

    print("\nDeduplicating:")
    verify_images = not args.skip_verify
    negative_unique = dedupe(negative_files, "Not_Tobacco", verify_images)
    tobacco_unique = dedupe(tobacco_files, "Tobacco", verify_images)

    if not tobacco_unique or not negative_unique:
        print("\nOne class has no usable images after deduplication. Aborting.")
        return 1

    # Balance on *unique* counts - raw file counts would over-promise when a
    # source folder is full of repeats.
    limit = args.max_per_class
    if limit is None and not args.no_balance:
        limit = min(len(tobacco_unique), len(negative_unique))
        print(f"\nBalancing both classes to {limit} images (use --no-balance to disable).")

    if not args.append and VERIFY_DIR.exists():
        print(f"\nClearing {VERIFY_DIR} (use --append to keep existing images).")
        shutil.rmtree(VERIFY_DIR)

    print("\nStaging:")
    neg_stats = stage(
        negative_unique, NEGATIVE_DIR, "Not_Tobacco", limit, args.seed, args.append,
    )
    pos_stats = stage(
        tobacco_unique, POSITIVE_DIR, "Tobacco", limit, args.seed, args.append,
    )

    # Show what the negative class is actually made of. A gate trained on 92%
    # crop leaves behaves very differently from one trained on a balanced mix,
    # and that difference is invisible from the totals alone.
    if neg_stats["selected"]:
        per_source: Counter = Counter()
        for path, _digest in neg_stats["selected"]:
            for root in negative_sources:
                try:
                    path.relative_to(root)
                    per_source[root.name] += 1
                    break
                except ValueError:
                    continue
            else:
                per_source["(other)"] += 1

        chosen = sum(per_source.values())
        print("\nNot_Tobacco composition (staged this run):")
        for name, n in per_source.most_common():
            print(f"  {n:>6}  {n / chosen:>5.1%}  {name}")

    pos_total, neg_total = pos_stats["total"], neg_stats["total"]
    print("\n" + "=" * 62)
    print(f"Dataset ready at {VERIFY_DIR}")
    print(f"  Not_Tobacco (class 0): {neg_total}")
    print(f"  Tobacco     (class 1): {pos_total}")
    print("=" * 62)

    if min(pos_total, neg_total) < 200:
        print(
            "\nWarning: fewer than 200 images in the smaller class. The gate will "
            "be unreliable - download more negatives before trusting it."
        )
    ratio = max(pos_total, neg_total) / max(1, min(pos_total, neg_total))
    if ratio > 3:
        print(
            f"\nWarning: classes are imbalanced {ratio:.1f}:1. train_verification.py "
            "applies class weights, but more real negatives beat any reweighting."
        )

    print("\nNext:")
    print("  python scripts/train_verification.py --epochs 20")
    return 0


if __name__ == "__main__":
    sys.exit(main())

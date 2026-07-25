"""
Download the Not_Tobacco negative class from Open Images V7 via FiftyOne.

The verification model needs a negative class that is *broad* - other crops,
plants, animals, people, vehicles, household objects - so that anything which
is not a tobacco leaf lands on the right side of the boundary.

Usage
-----
    # Install the extra deps first (heavy - FiftyOne embeds MongoDB):
    pip install -r requirements-verification.txt

    # Default: every resolvable concept in NEGATIVE_CLASSES, 150 images each
    python scripts/download_not_tobacco.py --per-class 150

    # Custom classes only
    python scripts/download_not_tobacco.py --classes Tomato Potato Banana Car

    # Grow an existing negative set without re-downloading what you have
    python scripts/download_not_tobacco.py --per-class 300 --append

    # See what Open Images actually offers (it is picky about names)
    python scripts/download_not_tobacco.py --list-classes
    python scripts/download_not_tobacco.py --list-classes --filter fruit

Output
------
    ml/data/raw/not_tobacco_source/<Class_Name>/*.jpg

That plain folder tree is the only thing the rest of the pipeline sees, so
FiftyOne is needed for this step alone - build_verification_dataset.py and
train_verification.py have no FiftyOne dependency.

Note on coverage
----------------
Open Images has excellent coverage of objects, animals, people and produce,
but almost none of *crop leaves* (maize, rice, cassava, coffee, tea foliage).
Those are the hardest negatives for a leaf classifier and the most valuable
ones to have. Download a leaf dataset separately - PlantVillage on Kaggle is
the usual choice - and fold it in via:

    python scripts/build_verification_dataset.py --extra-negatives path/to/plantvillage
"""
from __future__ import annotations

import argparse
import difflib
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST_ROOT = ROOT / "data" / "raw" / "not_tobacco_source"

# Concepts requested for the negative class, grouped for readable logging.
# Names are resolved against the live Open Images class list at runtime, so a
# rename upstream degrades to a warning + suggestions instead of a crash.
#
# WHAT OPEN IMAGES DOES NOT HAVE
# ------------------------------
# Verified against the live V7 catalogue (601 classes): there is no Maize,
# Rice, Cassava, Common bean or Grass. Those crop leaves are precisely the
# images users mistakenly submit to a tobacco classifier, and precisely the
# hardest negatives for it to reject. Open Images cannot supply them at any
# --per-class setting.
#
# Cover that gap with a leaf dataset (PlantVillage on Kaggle covers maize,
# tomato, potato and pepper foliage):
#
#     python scripts/build_verification_dataset.py --extra-negatives <dir>
NEGATIVE_CLASSES: dict[str, list[str]] = {
    "crops & produce": [
        "Tomato",
        "Potato",
        "Bell pepper",
        "Banana",
        "Coffee",
        "Tea",
        "Vegetable",
        "Fruit",
        "Squash (Plant)",
        "Cucumber",
        "Broccoli",
        "Cabbage",
        "Carrot",
    ],
    "plants & scenery": [
        "Tree",
        "Flower",
        "Houseplant",
        "Plant",
        "Palm tree",
        "Rose",
        "Common sunflower",
        "Lavender (Plant)",
    ],
    "animals": [
        "Dog",
        "Cat",
        "Bird",
        "Horse",
        "Cattle",
    ],
    "people & objects": [
        "Person",
        "Human face",
        "Car",
        "Mobile phone",
        "Table",
        "Chair",
        "Book",
        "Bottle",
        "Laptop",
        "Building",
        "Bicycle",
        "Clothing",
        "Food",
    ],
}

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _flat_defaults() -> list[str]:
    return [c for group in NEGATIVE_CLASSES.values() for c in group]


def _require_fiftyone():
    """Import FiftyOne with a friendly message if it is missing."""
    try:
        import fiftyone as fo  # noqa: F401
        import fiftyone.zoo as foz
    except ImportError:
        sys.exit(
            "FiftyOne is not installed.\n"
            "  pip install -r requirements-verification.txt\n"
            "(or: pip install fiftyone)"
        )
    return fo, foz


def available_classes() -> list[str]:
    """Every class name Open Images V7 will accept, detections + classifications.

    FiftyOne has moved this helper's signature around between releases, so we
    try the known shapes and fall back to an empty list (which disables
    validation rather than blocking the download).
    """
    import fiftyone.utils.openimages as fouo

    names: set[str] = set()
    for label_type in ("detections", "classifications"):
        for attempt in (
            lambda: fouo.get_classes(version="v7", label_type=label_type),
            lambda: fouo.get_classes(label_type=label_type),
            lambda: fouo.get_classes(version="v7"),
            lambda: fouo.get_classes(),
        ):
            try:
                names.update(attempt())
                break
            except Exception:  # noqa: BLE001 - signature probing, keep trying
                continue
    return sorted(names)


# Fuzzy matching is a last resort and is deliberately strict. At the more
# permissive cutoff of 0.75, 'Rice' matched 'Dice' (they share 3 of 4
# characters) and would have filled the negative set with photos of dice
# labelled as rice. Short words are exactly where edit-distance is least
# trustworthy, so a fuzzy hit must also start with the same letter.
FUZZY_CUTOFF = 0.85


def _containment_match(name: str, catalog: list[str]) -> str | None:
    """Find a catalogue entry containing `name` as a whole word.

    Open Images qualifies several concepts ('Squash (Plant)', 'Common
    sunflower'), so whole-word containment is a far stronger signal than edit
    distance. Prefers the shortest match, which is the most specific.
    """
    pattern = re.compile(rf"\b{re.escape(name.lower())}\b")
    hits = [c for c in catalog if pattern.search(c.lower())]
    return min(hits, key=len) if hits else None


def resolve(requested: list[str], catalog: list[str]) -> tuple[list[str], list[str]]:
    """Map requested names onto real Open Images names.

    Tried in order: exact, case-insensitive, whole-word containment, strict
    fuzzy. Returns (resolved, unresolved) and prints every substitution -
    silent renaming would make a half-downloaded dataset very confusing to
    debug later.
    """
    if not catalog:
        print("  ! Could not read the Open Images class list - skipping validation.")
        return requested, []

    lower = {c.lower(): c for c in catalog}
    resolved: list[str] = []
    unresolved: list[str] = []

    for name in requested:
        if name in catalog:
            resolved.append(name)
            continue

        hit = lower.get(name.lower())
        if hit:
            print(f"  ~ '{name}' -> '{hit}'")
            resolved.append(hit)
            continue

        hit = _containment_match(name, catalog)
        if hit:
            print(f"  ~ '{name}' -> '{hit}'")
            resolved.append(hit)
            continue

        close = difflib.get_close_matches(name, catalog, n=3, cutoff=FUZZY_CUTOFF)
        same_initial = [c for c in close if c[:1].lower() == name[:1].lower()]
        if len(same_initial) == 1:
            print(f"  ~ '{name}' -> '{same_initial[0]}' (fuzzy)")
            resolved.append(same_initial[0])
            continue

        suggestion = f" Did you mean: {', '.join(close)}?" if close else ""
        print(f"  x '{name}' is not an Open Images class - skipped.{suggestion}")
        unresolved.append(name)

    # de-dupe while preserving order
    seen: set[str] = set()
    deduped = [c for c in resolved if not (c in seen or seen.add(c))]
    return deduped, unresolved


def existing_count(class_dir: Path) -> int:
    if not class_dir.exists():
        return 0
    return sum(1 for p in class_dir.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)


def download_class(
    foz,
    oi_class: str,
    per_class: int,
    split: str,
    dest_root: Path,
    append: bool,
    seed: int,
) -> int:
    """Download one Open Images class and copy its images into dest_root.

    Returns the number of newly written files.
    """
    safe = oi_class.replace(" ", "_").replace("/", "_")
    class_dir = dest_root / safe

    have = existing_count(class_dir)
    if append and have >= per_class:
        print(f"  = {oi_class}: {have} already present, target {per_class} - skipped")
        return 0
    if not append and have:
        shutil.rmtree(class_dir)
        have = 0

    want = per_class - have if append else per_class

    try:
        dataset = foz.load_zoo_dataset(
            "open-images-v7",
            split=split,
            label_types=["detections", "classifications"],
            classes=[oi_class],
            # Over-fetch a little: some samples fail to download or are dupes
            # of what we already hold.
            max_samples=int(want * 1.25) + 5,
            shuffle=True,
            seed=seed,
            dataset_name=f"nt_{safe}_{split}_{want}",
        )
    except Exception as exc:  # noqa: BLE001 - one bad class must not kill the run
        print(f"  x {oi_class}: download failed ({exc})")
        return 0

    class_dir.mkdir(parents=True, exist_ok=True)
    written = 0
    for sample in dataset:
        if written >= want:
            break
        src = Path(sample.filepath)
        if not src.exists() or src.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        dst = class_dir / f"{safe}_{src.name}"
        if dst.exists():
            continue
        try:
            shutil.copy2(src, dst)
            written += 1
        except OSError as exc:
            print(f"    ! copy failed for {src.name}: {exc}")

    # The zoo dataset is just a manifest over the cached files; drop it so
    # repeated runs do not pile up FiftyOne databases.
    try:
        dataset.delete()
    except Exception:  # noqa: BLE001
        pass

    print(f"  + {oi_class}: {written} new (total {existing_count(class_dir)})")
    return written


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Download Not_Tobacco negatives from Open Images V7",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        "--classes",
        nargs="+",
        default=None,
        help="Open Images class names to download (default: the built-in negative set)",
    )
    p.add_argument(
        "--add-classes",
        nargs="+",
        default=None,
        help="Extra class names to append to the built-in negative set",
    )
    p.add_argument("--per-class", type=int, default=150, help="Images per class (default: 150)")
    p.add_argument(
        "--split",
        default="validation",
        choices=["train", "validation", "test"],
        help="Open Images split. 'validation' is far smaller to pull than 'train'.",
    )
    p.add_argument(
        "--append",
        action="store_true",
        help="Keep existing images and top each class up to --per-class",
    )
    p.add_argument("--seed", type=int, default=42)
    p.add_argument(
        "--dest",
        default=None,
        help=f"Output directory (default: {DEST_ROOT})",
    )
    p.add_argument(
        "--list-classes",
        action="store_true",
        help="Print the available Open Images class names and exit",
    )
    p.add_argument(
        "--filter",
        default=None,
        help="Substring filter for --list-classes",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    _fo, foz = _require_fiftyone()

    catalog = available_classes()

    if args.list_classes:
        names = catalog
        if args.filter:
            needle = args.filter.lower()
            names = [n for n in names if needle in n.lower()]
        print(f"{len(names)} Open Images V7 classes"
              + (f" matching '{args.filter}'" if args.filter else "") + ":")
        for n in names:
            print(f"  {n}")
        return 0

    requested = args.classes if args.classes else _flat_defaults()
    if args.add_classes:
        requested = requested + args.add_classes

    dest_root = Path(args.dest) if args.dest else DEST_ROOT
    dest_root.mkdir(parents=True, exist_ok=True)

    print("=" * 62)
    print("Not_Tobacco negative download - Open Images V7")
    print("=" * 62)
    print(f"destination : {dest_root}")
    print(f"split       : {args.split}")
    print(f"per class   : {args.per_class}")
    print(f"mode        : {'append' if args.append else 'replace'}")
    print(f"\nResolving {len(requested)} class names...")

    resolved, unresolved = resolve(requested, catalog)
    if not resolved:
        print("\nNo valid classes to download. Try --list-classes to see the options.")
        return 1

    print(f"\nDownloading {len(resolved)} classes...")
    total_new = 0
    for oi_class in resolved:
        total_new += download_class(
            foz, oi_class, args.per_class, args.split, dest_root, args.append, args.seed
        )

    grand_total = sum(
        existing_count(d) for d in dest_root.iterdir() if d.is_dir()
    )

    print("\n" + "=" * 62)
    print(f"Done. {total_new} new images; {grand_total} negatives on disk.")
    if unresolved:
        print(f"Skipped {len(unresolved)} unresolved name(s): {', '.join(unresolved)}")
    print("=" * 62)
    print("\nCrop-leaf negatives (maize, rice, cassava, coffee, tea) are barely")
    print("represented in Open Images and are the hardest negatives for a leaf")
    print("classifier. Fold a leaf dataset in with:")
    print("  python scripts/build_verification_dataset.py --extra-negatives <dir>")
    print("\nNext:")
    print("  python scripts/build_verification_dataset.py")
    print("  python scripts/train_verification.py --epochs 20")
    return 0


if __name__ == "__main__":
    sys.exit(main())

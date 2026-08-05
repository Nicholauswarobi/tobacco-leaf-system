"""Check that the trained verification gate accepts both kinds of tobacco leaf.

Run after training and before deploying:

    python scripts\\check_verification_gate.py

WHY THIS EXISTS
---------------
The gate is trained on folders, so it is easy to train a perfectly good-looking
model - ROC AUC 0.9999, "accepts real tobacco 99.9%" - that has still never
seen a cured leaf, because the cured images were not staged into the Tobacco
class. Every metric printed at the end of training would look excellent, and
every upload to Quality Grading would still be rejected as "not a tobacco
leaf". The training report cannot catch this; only scoring the two kinds of
leaf separately can.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

CHECKS = [
    ("cured leaves (Quality uploads)", ROOT / "data" / "tobacco_quality_dataset" / "raw_images", True),
    ("green leaves (Disease uploads)", ROOT / "data" / "raw" / "disease", True),
    ("not tobacco (must be rejected)", ROOT / "data" / "raw" / "not_tobacco_source", False),
]

#: Below this pass rate a class that should be accepted counts as broken.
MIN_ACCEPT_RATE = 0.90
#: Above this pass rate the negatives are leaking through.
MAX_REJECT_LEAK = 0.10


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--sample", type=int, default=60, help="images per check")
    p.add_argument(
        "--model",
        default=str(ROOT / "saved_models" / "tobacco_verification_model.keras"),
    )
    p.add_argument(
        "--metadata",
        default=str(ROOT / "saved_models" / "verification_metadata.json"),
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    import tensorflow as tf  # imported late so --help stays instant

    model_path, meta_path = Path(args.model), Path(args.metadata)
    if not model_path.exists():
        print(f"ERROR: no model at {model_path}. Train it first.")
        return 1

    model = tf.keras.models.load_model(str(model_path))
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    threshold = meta.get("threshold", 0.5)
    tobacco_index = meta.get("tobacco_index", 1)
    size = model.input_shape[1] or 224

    print(f"model     : {model_path.name}")
    print(f"threshold : {threshold}  (index {tobacco_index} = Tobacco)")
    print()

    failures = []
    for label, folder, should_pass in CHECKS:
        paths = sorted(folder.rglob("*.jpg"))[: args.sample]
        if not paths:
            print(f"  {label:34s} SKIPPED - nothing in {folder}")
            continue

        batch = np.stack([
            np.asarray(
                Image.open(p).convert("RGB").resize((size, size)), dtype="float32"
            )
            for p in paths
        ])
        scores = model.predict(batch, verbose=0)[:, tobacco_index]
        passed = int((scores >= threshold).sum())
        rate = passed / len(paths)

        ok = rate >= MIN_ACCEPT_RATE if should_pass else rate <= MAX_REJECT_LEAK
        print(
            f"  {label:34s} mean P(tobacco)={scores.mean():.4f}  "
            f"passed={passed}/{len(paths)}  {'OK' if ok else 'FAIL'}"
        )
        if not ok:
            failures.append((label, should_pass, rate))

    print()
    if not failures:
        print("All checks passed - safe to deploy.")
        return 0

    print("PROBLEM:")
    for label, should_pass, rate in failures:
        if should_pass:
            print(
                f"  '{label}' passed only {rate:.0%}. Those images are almost "
                "certainly missing from the Tobacco class - re-run "
                "build_verification_dataset.py and check its staged counts."
            )
        else:
            print(
                f"  '{label}' passed {rate:.0%} - the gate is letting "
                "non-tobacco through. Raise the threshold or add negatives."
            )
    return 1


if __name__ == "__main__":
    sys.exit(main())

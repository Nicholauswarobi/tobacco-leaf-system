"""
Evaluate a trained model on a held-out test directory.

Usage:
    python ml/scripts/evaluate.py --task disease --test-dir ml/data/raw/disease_test
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report

ROOT = Path(__file__).resolve().parents[1]


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--task", choices=["disease", "quality"], required=True)
    p.add_argument("--test-dir", required=True)
    p.add_argument("--image-size", type=int, default=224)
    p.add_argument("--batch-size", type=int, default=32)
    return p.parse_args()


def main():
    args = parse_args()
    model_path = ROOT / "saved_models" / f"tobacco_{args.task}_model.h5"
    model = tf.keras.models.load_model(str(model_path))

    ds = tf.keras.utils.image_dataset_from_directory(
        args.test_dir,
        image_size=(args.image_size, args.image_size),
        batch_size=args.batch_size,
        label_mode="categorical",
        shuffle=False,
    )
    class_names = ds.class_names

    y_true, y_pred = [], []
    for x, y in ds:
        preds = model.predict(x, verbose=0)
        y_true.extend(np.argmax(y.numpy(), axis=1))
        y_pred.extend(np.argmax(preds, axis=1))

    report = classification_report(y_true, y_pred, target_names=class_names, output_dict=True)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

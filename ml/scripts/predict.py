"""
Run prediction on a single image from the command line.

Usage:
    python ml/scripts/predict.py --image path/to/leaf.jpg
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

DISEASE_CLASSES = ["Healthy", "Alternaria Leaf Spot", "Cercospora Leaf Spot", "Tobacco Mosaic Virus"]
QUALITY_CLASSES = ["Grade A", "Grade B", "Grade C"]


def preprocess(path: str, size: int = 224) -> np.ndarray:
    img = Image.open(path).convert("RGB").resize((size, size), Image.LANCZOS)
    return np.expand_dims(np.asarray(img, dtype=np.float32), axis=0)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--image", required=True)
    p.add_argument("--image-size", type=int, default=224)
    args = p.parse_args()

    disease = tf.keras.models.load_model(str(ROOT / "saved_models" / "tobacco_disease_model.h5"))
    quality = tf.keras.models.load_model(str(ROOT / "saved_models" / "tobacco_quality_model.h5"))

    x = preprocess(args.image, args.image_size)
    d = disease.predict(x, verbose=0)[0]
    q = quality.predict(x, verbose=0)[0]

    out = {
        "disease": {
            "label": DISEASE_CLASSES[int(np.argmax(d))],
            "confidence": float(np.max(d)),
            "probabilities": dict(zip(DISEASE_CLASSES, [float(v) for v in d])),
        },
        "quality": {
            "grade": QUALITY_CLASSES[int(np.argmax(q))],
            "confidence": float(np.max(q)),
            "probabilities": dict(zip(QUALITY_CLASSES, [float(v) for v in q])),
        },
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()

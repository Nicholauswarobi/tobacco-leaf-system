"""
Model service: wraps the disease CNN and quality hybrid model.

Designed to fail gracefully — if a .keras file isn't present (e.g. before
training), stub predictions are used so the API still returns valid responses
for frontend dev.
"""
from __future__ import annotations
import json
import logging
import hashlib
from pathlib import Path
from typing import List, Tuple

import numpy as np
from PIL import Image

from app.core.config import settings

logger = logging.getLogger("tobacco-api.model")

# Order MUST match the alphabetical folder sort that Keras image_dataset_from_directory
# uses when assigning class indices:
#   index 0 → Alternaria_Leaf_Spot/
#   index 1 → Cercospora_Leaf_Spot/
#   index 2 → Healthy/
DISEASE_CLASSES = [
    "Alternaria Leaf Spot",
    "Cercospora Leaf Spot",
    "Healthy",
]

# Quality classes match training folder structure ['A', 'B', 'C']
QUALITY_CLASSES = ["Grade A", "Grade B", "Grade C"]

# Verification classes follow the alphabetical folder sort produced by
# ml/scripts/build_verification_dataset.py:
#   index 0 → Not_Tobacco/
#   index 1 → Tobacco/
VERIFICATION_CLASSES = ["Not Tobacco", "Tobacco"]
TOBACCO_INDEX = 1


# ---------------------------------------------------------------------------
# Custom Keras layer required by the hybrid ViT-based quality model.
# Must be registered before loading any model that contains this layer.
# ---------------------------------------------------------------------------
def _make_patches_layer():
    """Return the Patches layer class (defined inside to defer TF import)."""
    import tensorflow as tf  # type: ignore

    class Patches(tf.keras.layers.Layer):
        """Extracts non-overlapping image patches — used by the ViT branch."""

        def __init__(self, patch_size, **kwargs):
            super().__init__(**kwargs)
            self.patch_size = patch_size

        def call(self, images):
            batch_size = tf.shape(images)[0]
            patches = tf.image.extract_patches(
                images=images,
                sizes=[1, self.patch_size, self.patch_size, 1],
                strides=[1, self.patch_size, self.patch_size, 1],
                rates=[1, 1, 1, 1],
                padding="VALID",
            )
            patch_dims = patches.shape[-1]
            patches = tf.reshape(patches, [batch_size, -1, patch_dims])
            return patches

        def get_config(self):
            config = super().get_config()
            config.update({"patch_size": self.patch_size})
            return config

    return Patches


class ModelService:
    """Holds the loaded verification, disease and quality Keras models."""

    def __init__(self) -> None:
        self.disease_model = None
        self.quality_model = None
        self.verification_model = None
        self.use_disease_stub = False
        self.use_quality_stub = False
        # No stub for verification: a fabricated "yes, that's tobacco" would
        # defeat the entire point of the gate. When the model is missing the
        # verification service falls back to the colour pre-screen instead.
        self.verification_threshold: float = settings.VERIFICATION_THRESHOLD
        self.verification_metadata: dict = {}
        # Resolved from the loaded model's own input shape — the gate may be
        # trained at a lower resolution than the disease model.
        self.verification_image_size: int = settings.IMAGE_SIZE

    @property
    def use_stub(self) -> bool:
        """True when the disease model is unavailable (legacy compat)."""
        return self.use_disease_stub

    @property
    def verification_loaded(self) -> bool:
        return self.verification_model is not None

    def load_models(self) -> None:
        """Load verification, disease and quality Keras models from disk."""
        from tensorflow.keras.models import load_model  # type: ignore

        Patches = _make_patches_layer()
        custom_objects = {"Patches": Patches}

        # --- verification model (binary Tobacco / Not Tobacco gate) ---
        # Loaded first: it guards every other model. It needs no custom_objects
        # because its grayscale layer is a plain frozen Conv2D (see
        # ml/scripts/model.py::build_grayscale_layer).
        verification_path = Path(settings.VERIFICATION_MODEL_PATH)
        if not verification_path.exists():
            logger.warning(
                "Verification model not found at %s — falling back to the colour "
                "pre-screen. Train it with ml/scripts/train_verification.py.",
                verification_path,
            )
        else:
            self.verification_model = load_model(str(verification_path))
            self.verification_image_size = self._model_input_size(
                self.verification_model, settings.IMAGE_SIZE
            )
            logger.info(
                "Loaded verification model from %s (input %dx%d)",
                verification_path,
                self.verification_image_size,
                self.verification_image_size,
            )
            self._load_verification_metadata()

        # --- disease model ---
        disease_path = Path(settings.DISEASE_MODEL_PATH)
        if not disease_path.exists():
            logger.warning("Disease model not found at %s — using stub.", disease_path)
            self.use_disease_stub = True
        else:
            self.disease_model = load_model(str(disease_path))
            logger.info("Loaded disease model from %s", disease_path)

        # --- quality model (hybrid CNN+ViT) ---
        quality_path = Path(settings.QUALITY_MODEL_PATH)
        if not quality_path.exists():
            logger.warning("Quality model not found at %s — using stub.", quality_path)
            self.use_quality_stub = True
        else:
            self.quality_model = load_model(str(quality_path), custom_objects=custom_objects)
            logger.info("Loaded quality model from %s", quality_path)

    def _load_verification_metadata(self) -> None:
        """Adopt the threshold that train_verification.py calibrated.

        Falls back to the configured default if the sidecar file is absent or
        malformed — a missing metadata file should not take the gate offline.
        """
        meta_path = Path(settings.VERIFICATION_METADATA_PATH)
        if not meta_path.exists():
            logger.info(
                "No verification metadata at %s — using configured threshold %.2f.",
                meta_path, self.verification_threshold,
            )
            return

        try:
            meta = json.loads(meta_path.read_text())
        except (OSError, ValueError) as exc:
            logger.warning("Could not read verification metadata (%s) — using default.", exc)
            return

        self.verification_metadata = meta

        threshold = meta.get("threshold")
        if isinstance(threshold, (int, float)) and 0.0 < float(threshold) < 1.0:
            self.verification_threshold = float(threshold)
            logger.info("Verification threshold set to %.2f from metadata.", self.verification_threshold)
        else:
            logger.warning(
                "Ignoring out-of-range threshold %r in %s — keeping %.2f.",
                threshold, meta_path, self.verification_threshold,
            )

        # A silently reordered class list would invert every decision.
        classes = meta.get("classes")
        if classes and list(classes) != ["Not_Tobacco", "Tobacco"]:
            logger.error(
                "Verification metadata declares classes %s but the service assumes "
                "['Not_Tobacco', 'Tobacco']. Predictions will be inverted — retrain "
                "with the documented folder names.",
                classes,
            )

    # ---------- preprocessing ----------
    @staticmethod
    def _model_input_size(model, default: int) -> int:
        """Read a model's expected square input size from its input shape.

        The verification model may legitimately be trained at a different
        resolution than the disease model (smaller is often plenty for a
        binary gate). Feeding it settings.IMAGE_SIZE regardless would raise a
        shape error at the first upload, so each model is asked what it wants.
        """
        try:
            shape = model.input_shape
            if isinstance(shape, list):  # multi-input models
                shape = shape[0]
            height = shape[1]
            if isinstance(height, int) and height > 0:
                return height
        except (AttributeError, IndexError, TypeError):
            pass
        return default

    @staticmethod
    def preprocess(image: Image.Image, size: int | None = None) -> np.ndarray:
        """Resize to model input size and add batch dim.

        NOTE: Do NOT normalize here. The saved .keras model was exported with
        a Rescaling(1/255) layer baked into the graph by wrap_with_preprocessing()
        in train.py. The model therefore expects raw [0, 255] uint8 pixel values.
        Dividing by 255 again would feed near-zero values and break inference.
        """
        size = size or settings.IMAGE_SIZE
        image = image.convert("RGB").resize((size, size), Image.LANCZOS)
        arr = np.asarray(image, dtype=np.float32)  # raw [0, 255] — model normalizes internally
        return np.expand_dims(arr, axis=0)

    # ---------- inference ----------
    def predict_verification(self, image: Image.Image) -> List[float] | None:
        """Return [P(Not Tobacco), P(Tobacco)], or None if the model is absent.

        Deliberately returns None rather than a stub: guessing here would let
        arbitrary images through the gate, which is the exact failure this
        model exists to prevent. Callers must handle None explicitly.
        """
        if self.verification_model is None:
            return None

        x = self.preprocess(image, size=self.verification_image_size)
        probs = self.verification_model.predict(x, verbose=0)[0]
        return probs.tolist()

    def predict_disease(self, image: Image.Image) -> List[float]:
        """Return disease probabilities as plain Python list."""
        if self.use_disease_stub or self.disease_model is None:
            return self._stub_predict_disease(image)

        x = self.preprocess(image)
        disease_probs = self.disease_model.predict(x, verbose=0)[0]
        return disease_probs.tolist()

    def predict_quality(self, image: Image.Image) -> List[float]:
        """Return quality grade probabilities as plain Python list.

        The hybrid model expects raw [0, 255] float32 pixel values — same as
        how the Streamlit app feeds it: resize → astype(float32) → expand_dims.
        """
        if self.use_quality_stub or self.quality_model is None:
            return self._stub_predict_quality(image)

        x = self.preprocess(image)
        quality_probs = self.quality_model.predict(x, verbose=0)[0]
        return quality_probs.tolist()

    # ---------- stubs for dev ----------
    def _stub_predict_disease(self, image: Image.Image) -> List[float]:
        """Deterministic mock disease predictions seeded from image bytes."""
        buf = image.resize((32, 32)).convert("RGB").tobytes()
        digest = hashlib.sha256(buf).digest()
        rng = np.random.default_rng(int.from_bytes(digest[:8], "big"))

        logits = rng.normal(size=len(DISEASE_CLASSES))
        logits[rng.integers(0, len(DISEASE_CLASSES))] += 3.0
        return self._softmax(logits).tolist()

    def _stub_predict_quality(self, image: Image.Image) -> List[float]:
        """Deterministic mock quality predictions seeded from image bytes."""
        buf = image.resize((32, 32)).convert("RGB").tobytes()
        digest = hashlib.sha256(buf).digest()
        rng = np.random.default_rng(int.from_bytes(digest[:8], "big"))

        logits = rng.normal(size=len(QUALITY_CLASSES))
        logits[rng.integers(0, len(QUALITY_CLASSES))] += 2.5
        return self._softmax(logits).tolist()

    @staticmethod
    def _softmax(x: np.ndarray) -> np.ndarray:
        e = np.exp(x - x.max())
        return e / e.sum()


# singleton
model_service = ModelService()

"""
CNN architectures for tobacco leaf disease + quality classification,
plus the binary Tobacco / Not Tobacco verification model.

Flavors:
  build_simple_cnn       - small from-scratch model for quick experimentation
  build_transfer_cnn     - MobileNetV2 transfer learning, recommended
  build_verification_cnn - binary Tobacco vs Not Tobacco gate

All produce models with softmax outputs over `num_classes`.
"""
from __future__ import annotations
import numpy as np
from tensorflow.keras import layers, models, regularizers
from tensorflow.keras.applications import MobileNetV2

# ITU-R BT.601 luma coefficients - the same transform PIL's .convert("L") uses.
_LUMA = (0.299, 0.587, 0.114)


def build_simple_cnn(
    num_classes: int,
    image_size: int = 224,
    dropout: float = 0.4,
) -> models.Model:
    """Small CNN (~3M params). Fine on a CPU laptop."""
    inputs = layers.Input(shape=(image_size, image_size, 3))

    x = layers.Conv2D(32, 3, activation="relu", padding="same")(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)

    x = layers.Conv2D(64, 3, activation="relu", padding="same")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)

    x = layers.Conv2D(128, 3, activation="relu", padding="same")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)

    x = layers.Conv2D(128, 3, activation="relu", padding="same")(x)
    x = layers.BatchNormalization()(x)
    x = layers.GlobalAveragePooling2D()(x)

    x = layers.Dense(
        128,
        activation="relu",
        kernel_regularizer=regularizers.l2(1e-4),
    )(x)
    x = layers.Dropout(dropout)(x)

    outputs = layers.Dense(num_classes, activation="softmax")(x)
    return models.Model(inputs, outputs, name="tobacco_simple_cnn")


def build_transfer_cnn(
    num_classes: int,
    image_size: int = 224,
    dropout: float = 0.3,
    fine_tune_at: int | None = 100,
) -> models.Model:
    """MobileNetV2 transfer learning. Set fine_tune_at=None to freeze base."""
    base = MobileNetV2(
        input_shape=(image_size, image_size, 3),
        include_top=False,
        weights="imagenet",
    )
    base.trainable = fine_tune_at is not None
    if fine_tune_at is not None:
        for layer in base.layers[:fine_tune_at]:
            layer.trainable = False

    inputs = layers.Input(shape=(image_size, image_size, 3))
    x = base(inputs, training=fine_tune_at is not None)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(dropout)(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    return models.Model(inputs, outputs, name="tobacco_mobilenetv2")


# ---------------------------------------------------------------------------
# Tobacco Verification Model
# ---------------------------------------------------------------------------

def build_grayscale_layer(image_size: int = 224) -> models.Sequential:
    """A frozen RGB -> luma-replicated-to-3-channels layer.

    WHY THIS EXISTS
    ---------------
    Every tobacco image in ml/data/raw/disease/ is stored as RGB but is
    *perfectly* grayscale (R == G == B, verified across the full dataset).
    The Not_Tobacco negatives scraped from Open Images are full colour.

    Train a binary classifier on that as-is and it learns exactly one rule -
    "saturated == not tobacco" - which fails in both directions the moment it
    meets the real world: a grayscale photo of a car sails through, and a
    normal colour photo of a tobacco leaf gets rejected.

    Collapsing both classes to luma *inside the model graph* removes the
    shortcut entirely and forces the network onto texture, venation and shape.
    It also means the deployed model accepts ordinary RGB uploads - the
    conversion travels with the weights, so the backend needs no extra step.

    Implemented as a non-trainable 1x1 Conv2D rather than a Lambda so the
    saved .keras file deserializes with a plain `load_model()` - no
    `custom_objects` argument required anywhere in the backend.
    """
    gray = models.Sequential(
        [
            layers.Input(shape=(image_size, image_size, 3)),
            layers.Conv2D(
                filters=3,
                kernel_size=1,
                use_bias=False,
                trainable=False,
                name="rgb_to_luma",
            ),
        ],
        name="grayscale",
    )
    # kernel shape is (1, 1, in_channels=3, out_channels=3); every output
    # channel gets the same luma weights, so the 3 outputs are identical.
    kernel = np.tile(np.array(_LUMA, dtype="float32").reshape(1, 1, 3, 1), (1, 1, 1, 3))
    gray.get_layer("rgb_to_luma").set_weights([kernel])
    gray.trainable = False
    return gray


def build_verification_cnn(
    image_size: int = 224,
    dropout: float = 0.3,
    fine_tune_at: int | None = 100,
    num_classes: int = 2,
) -> models.Model:
    """Binary Tobacco / Not Tobacco classifier (MobileNetV2 transfer).

    Kept as a 2-way softmax rather than a single sigmoid so it reuses the
    exact same training, evaluation and serving code paths as the disease and
    quality models. Class order follows Keras' alphabetical directory sort:

        index 0 -> Not_Tobacco/
        index 1 -> Tobacco/

    A wider head than the disease model: the negative class is enormously
    more varied (people, cars, other crops), so it needs more capacity to
    separate than three tobacco disease classes do.

    BATCHNORM NOTE
    --------------
    The base is invoked with `training=False` so its BatchNorm layers always
    use their ImageNet moving statistics. This is the documented Keras
    fine-tuning recipe, and skipping it is not a subtle problem: calling the
    base with `training=True` while fine-tuning let the BN batch statistics
    drift away from the moving averages used at evaluation time, which on this
    dataset produced 99.9% training accuracy against 51.5% validation accuracy
    (ROC AUC 0.91 — the ranking was fine, the decision boundary was not).
    Weights below `fine_tune_at` still train; only BN mode is pinned.
    """
    base = MobileNetV2(
        input_shape=(image_size, image_size, 3),
        include_top=False,
        weights="imagenet",
    )
    base.trainable = fine_tune_at is not None
    if fine_tune_at is not None:
        for layer in base.layers[:fine_tune_at]:
            layer.trainable = False

    inputs = layers.Input(shape=(image_size, image_size, 3))
    x = base(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(dropout)(x)
    x = layers.Dense(256, activation="relu", kernel_regularizer=regularizers.l2(1e-4))(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    return models.Model(inputs, outputs, name="tobacco_verification")

"""
Dataset loading & preprocessing for tobacco leaf images.

Expected layout:
    data/raw/disease/
        Healthy/*.jpg
        Alternaria_Leaf_Spot/*.jpg
        Cercospora_Leaf_Spot/*.jpg
        Tobacco_Mosaic_Virus/*.jpg
    data/raw/quality/
        Grade_A/*.jpg
        Grade_B/*.jpg
        Grade_C/*.jpg

`image_dataset_from_directory` handles the rest. Augmentation is layered
on top during training only.
"""
from __future__ import annotations
from pathlib import Path
import tensorflow as tf
from tensorflow.keras import layers


def make_datasets(
    data_dir: str | Path,
    image_size: int = 224,
    batch_size: int = 32,
    val_split: float = 0.2,
    seed: int = 42,
    color_mode: str = "rgb",
    force_rgb: bool = True,
):
    """Return (train_ds, val_ds, class_names)."""
    data_dir = Path(data_dir)
    if not data_dir.exists():
        raise FileNotFoundError(
            f"Dataset directory not found: {data_dir}. "
            "See ml/scripts/data.py docstring for expected layout."
        )

    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=val_split,
        subset="training",
        seed=seed,
        image_size=(image_size, image_size),
        batch_size=batch_size,
        color_mode=color_mode,
        label_mode="categorical",
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=val_split,
        subset="validation",
        seed=seed,
        image_size=(image_size, image_size),
        batch_size=batch_size,
        color_mode=color_mode,
        label_mode="categorical",
    )

    class_names = train_ds.class_names

    if color_mode == "grayscale" and force_rgb:
        # MobileNetV2 (and most backbones) expect 3 channels.
        def _to_rgb(x, y):
            return tf.image.grayscale_to_rgb(x), y

        train_ds = train_ds.map(_to_rgb, num_parallel_calls=tf.data.AUTOTUNE)
        val_ds = val_ds.map(_to_rgb, num_parallel_calls=tf.data.AUTOTUNE)

    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.cache().shuffle(1000).prefetch(AUTOTUNE)
    val_ds = val_ds.cache().prefetch(AUTOTUNE)
    return train_ds, val_ds, class_names


def build_augmentation() -> tf.keras.Sequential:
    """Augmentation block: applied via model.fit, not on disk."""
    return tf.keras.Sequential(
        [
            layers.RandomFlip("horizontal_and_vertical"),
            layers.RandomRotation(0.15),
            layers.RandomZoom(0.1),
            layers.RandomContrast(0.1),
            layers.RandomBrightness(0.1),
        ],
        name="augmentation",
    )


def normalize() -> tf.keras.Sequential:
    return tf.keras.Sequential([layers.Rescaling(1.0 / 255)], name="normalize")

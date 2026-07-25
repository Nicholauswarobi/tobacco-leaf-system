"""
Train both the disease and quality CNNs.

Usage:
    python ml/scripts/train.py --task disease --epochs 30
    python ml/scripts/train.py --task quality --epochs 30 --arch transfer

Outputs:
    ml/saved_models/tobacco_<task>_model.keras       <- final model
    ml/outputs/<task>_training_curves.png            <- accuracy/loss plots
    ml/outputs/<task>_confusion_matrix.png           <- val confusion matrix
    ml/outputs/<task>_metrics.json                   <- precision/recall/f1
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow.keras import callbacks, models, layers
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt

from data import make_datasets, build_augmentation, normalize
from model import build_simple_cnn, build_transfer_cnn


ROOT = Path(__file__).resolve().parents[1]


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument(
        "--task",
        choices=["disease", "quality"],
        required=True,
        help="Which classifier to train",
    )
    p.add_argument(
        "--arch",
        choices=["simple", "transfer"],
        default="transfer",
        help="Model architecture",
    )
    p.add_argument("--epochs", type=int, default=30)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--image-size", type=int, default=224)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument(
        "--grayscale",
        action="store_true",
        help="Load images as grayscale and convert to RGB for the model",
    )
    p.add_argument(
        "--data-dir",
        default=None,
        help="Override default data dir (ml/data/raw/<task>)",
    )
    return p.parse_args()


def wrap_with_preprocessing(
    base_model: tf.keras.Model, image_size: int, training: bool
) -> tf.keras.Model:
    """Bake augmentation+normalization into the model graph.

    This means the *exported* .h5 file expects raw [0,255] pixel arrays —
    matching what the FastAPI service feeds it. (Augmentation is a no-op
    at inference time.)
    """
    inputs = layers.Input(shape=(image_size, image_size, 3))
    x = build_augmentation()(inputs) if training else inputs
    x = normalize()(x)
    outputs = base_model(x)
    return models.Model(inputs, outputs, name=f"{base_model.name}_full")


def plot_history(history, out_path: Path) -> None:
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

    ax1.plot(history.history["accuracy"], label="train")
    ax1.plot(history.history["val_accuracy"], label="val")
    ax1.set_title("Accuracy")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Accuracy")
    ax1.legend()
    ax1.grid(alpha=0.3)

    ax2.plot(history.history["loss"], label="train")
    ax2.plot(history.history["val_loss"], label="val")
    ax2.set_title("Loss")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Loss")
    ax2.legend()
    ax2.grid(alpha=0.3)

    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


def plot_confusion_matrix(cm, class_names, out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(cm, cmap="Greens")
    fig.colorbar(im, ax=ax)
    ax.set_xticks(range(len(class_names)))
    ax.set_yticks(range(len(class_names)))
    ax.set_xticklabels(class_names, rotation=45, ha="right")
    ax.set_yticklabels(class_names)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title("Confusion Matrix (validation)")

    # annotate cells
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j, i, int(cm[i, j]),
                ha="center", va="center",
                color="white" if cm[i, j] > cm.max() / 2 else "black",
            )

    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


def main():
    args = parse_args()

    data_dir = (
        Path(args.data_dir)
        if args.data_dir
        else ROOT / "data" / "raw" / args.task
    )
    out_dir = ROOT / "outputs"
    model_dir = ROOT / "saved_models"
    out_dir.mkdir(parents=True, exist_ok=True)
    model_dir.mkdir(parents=True, exist_ok=True)

    print(f"[train] task={args.task} arch={args.arch} data={data_dir}")

    train_ds, val_ds, class_names = make_datasets(
        data_dir,
        image_size=args.image_size,
        batch_size=args.batch_size,
        color_mode="grayscale" if args.grayscale else "rgb",
        force_rgb=True,
    )
    num_classes = len(class_names)
    print(f"[train] classes ({num_classes}): {class_names}")

    if args.arch == "simple":
        base = build_simple_cnn(num_classes, image_size=args.image_size)
    else:
        base = build_transfer_cnn(num_classes, image_size=args.image_size)

    full = wrap_with_preprocessing(base, args.image_size, training=True)
    full.compile(
        optimizer=tf.keras.optimizers.Adam(args.lr),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    full.summary()

    ckpt_path = model_dir / f"tobacco_{args.task}_model.keras"
    
    # Custom callback to avoid pickle issues with augmentation layers
    class SaveBestModel(callbacks.Callback):
        def __init__(self, filepath, monitor="val_accuracy"):
            super().__init__()
            self.filepath = filepath
            self.monitor = monitor
            self.best = -np.inf
        
        def on_epoch_end(self, epoch, logs=None):
            if logs and logs.get(self.monitor, -np.inf) > self.best:
                self.best = logs[self.monitor]
                self.model.save(str(self.filepath))
                print(f"  ✓ Saved best model (val_accuracy: {self.best:.4f})")
    
    cbs = [
        SaveBestModel(filepath=str(ckpt_path), monitor="val_accuracy"),
        callbacks.EarlyStopping(
            monitor="val_accuracy",
            patience=6,
            restore_best_weights=True,
        ),
        callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=3, min_lr=1e-6
        ),
    ]

    history = full.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        callbacks=cbs,
    )

    # Plots
    plot_history(history, out_dir / f"{args.task}_training_curves.png")

    # Validation evaluation
    y_true, y_pred = [], []
    for batch_x, batch_y in val_ds:
        preds = full.predict(batch_x, verbose=0)
        y_true.extend(np.argmax(batch_y.numpy(), axis=1))
        y_pred.extend(np.argmax(preds, axis=1))

    cm = confusion_matrix(y_true, y_pred)
    plot_confusion_matrix(cm, class_names, out_dir / f"{args.task}_confusion_matrix.png")

    report = classification_report(
        y_true, y_pred, target_names=class_names, output_dict=True
    )
    metrics_path = out_dir / f"{args.task}_metrics.json"
    metrics_path.write_text(json.dumps(report, indent=2))

    print(f"[train] saved model -> {ckpt_path}")
    print(f"[train] metrics     -> {metrics_path}")
    print(f"[train] curves/cm   -> {out_dir}")


if __name__ == "__main__":
    main()

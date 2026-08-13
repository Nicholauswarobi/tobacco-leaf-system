"""
Train the Tobacco Verification Model - a binary Tobacco / Not_Tobacco gate.

This model runs *before* disease detection and quality grading. Its job is to
reject anything that is not a tobacco leaf, so that the closed-world disease
and quality classifiers never see an input they cannot possibly get right.

Usage
-----
    python scripts/build_verification_dataset.py      # once, to stage the data
    python scripts/train_verification.py --epochs 20

    # Tune how aggressively the gate rejects:
    python scripts/train_verification.py --min-reject-recall 0.98

Outputs
-------
    ml/saved_models/tobacco_verification_model.keras
    ml/saved_models/verification_metadata.json    <- class order + threshold
    ml/outputs/verification_training_curves.png
    ml/outputs/verification_confusion_matrix.png
    ml/outputs/verification_threshold_sweep.png
    ml/outputs/verification_metrics.json

Colour shortcut
---------------
Every tobacco image in this project's dataset is perfectly grayscale, while
the Open Images negatives are full colour. Left alone, the network learns
"saturated == not tobacco" and nothing else. build_verification_cnn is
therefore fed through a frozen RGB->luma layer (see model.py), which strips
colour from *both* classes inside the graph. Pass --keep-colour to disable
that, but only once your tobacco positives include real colour photographs.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow.keras import callbacks, layers, models
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from data import make_datasets, build_augmentation  # noqa: E402
from model import build_verification_cnn, build_grayscale_layer  # noqa: E402
from train import plot_history, plot_confusion_matrix  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "raw" / "verification"

# Keras sorts class directories alphabetically: Not_Tobacco < Tobacco.
EXPECTED_CLASSES = ["Not_Tobacco", "Tobacco"]
TOBACCO_INDEX = 1


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train the Tobacco Verification Model")
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--image-size", type=int, default=224)
    # 1e-3 is the right order for training a head from scratch, but it is an
    # order of magnitude too high once MobileNetV2 layers are unfrozen: it
    # drove train loss to 0.04 while val loss climbed past 12.
    p.add_argument("--lr", type=float, default=1e-4)
    p.add_argument(
        "--label-smoothing",
        type=float,
        default=0.05,
        help=(
            "Softens the targets so the model stops emitting saturated 0/1 "
            "scores. Without it the ranking is excellent but every probability "
            "collapses toward zero and no sensible threshold exists."
        ),
    )
    p.add_argument("--val-split", type=float, default=0.2)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--dropout", type=float, default=0.3)
    p.add_argument(
        "--fine-tune-at",
        type=int,
        default=100,
        help="Freeze MobileNetV2 layers below this index (-1 to freeze the whole base)",
    )
    p.add_argument(
        "--keep-colour",
        action="store_true",
        help="Do NOT strip colour in-graph. Only safe once positives include colour photos.",
    )
    p.add_argument(
        "--min-reject-recall",
        type=float,
        default=0.95,
        help=(
            "Minimum share of non-tobacco images the gate must reject when picking "
            "the decision threshold (default: 0.95)"
        ),
    )
    p.add_argument(
        "--data-dir",
        default=None,
        help=f"Override the dataset directory (default: {DATA_DIR})",
    )
    return p.parse_args()


def mobilenet_rescale() -> tf.keras.Sequential:
    """Map [0, 255] to [-1, 1], the range MobileNetV2's ImageNet weights expect.

    data.py::normalize() rescales to [0, 1], which is what the disease and
    quality models use. That is a half-range mismatch against the pretrained
    filters and costs accuracy for no benefit, so the verification model uses
    the range its backbone was actually trained on.
    """
    return tf.keras.Sequential(
        [layers.Rescaling(1.0 / 127.5, offset=-1.0)], name="mobilenet_rescale"
    )


def wrap_verification_model(
    base_model: tf.keras.Model,
    image_size: int,
    strip_colour: bool,
) -> tf.keras.Model:
    """Bake grayscale + augmentation + normalisation into the exported graph.

    The saved .keras therefore accepts raw RGB uint8-valued arrays in [0, 255],
    exactly what backend/app/services/model_service.py::preprocess produces.
    Augmentation layers are inference-time no-ops, so they are harmless here
    and keep this consistent with train.py::wrap_with_preprocessing.
    """
    inputs = layers.Input(shape=(image_size, image_size, 3))
    x = build_grayscale_layer(image_size)(inputs) if strip_colour else inputs
    x = build_augmentation()(x)
    x = mobilenet_rescale()(x)
    outputs = base_model(x)
    return models.Model(inputs, outputs, name="tobacco_verification_full")


def compute_class_weights(data_dir: Path, class_names: list[str]) -> dict[int, float]:
    """Inverse-frequency weights so an imbalanced negative set does not dominate."""
    counts = []
    for name in class_names:
        d = data_dir / name
        counts.append(sum(1 for p in d.iterdir() if p.is_file()) if d.exists() else 0)
    total = sum(counts)
    n = len(counts)
    weights = {
        i: (total / (n * c)) if c else 1.0
        for i, c in enumerate(counts)
    }
    print(f"[verify] class counts: {dict(zip(class_names, counts))}")
    print(f"[verify] class weights: { {k: round(v, 3) for k, v in weights.items()} }")
    return weights


def collect_val_scores(model: tf.keras.Model, val_ds) -> tuple[np.ndarray, np.ndarray]:
    """Return (y_true, p_tobacco) over the whole validation set."""
    y_true: list[int] = []
    p_tobacco: list[float] = []
    for batch_x, batch_y in val_ds:
        probs = model.predict(batch_x, verbose=0)
        y_true.extend(np.argmax(batch_y.numpy(), axis=1).tolist())
        p_tobacco.extend(probs[:, TOBACCO_INDEX].tolist())
    return np.asarray(y_true), np.asarray(p_tobacco)


def sweep_thresholds(
    y_true: np.ndarray,
    p_tobacco: np.ndarray,
    min_reject_recall: float,
) -> tuple[float, list[dict]]:
    """Pick the decision threshold and return the full sweep for reporting.

    The asymmetry matters here. Letting a maize photo through to the disease
    model produces a confident, wrong diagnosis - the exact failure this model
    exists to stop. Rejecting a real leaf just asks the farmer to retake the
    photo. So we require a floor on how much of the negative class we catch,
    then maximise tobacco F1 subject to that.
    """
    rows: list[dict] = []
    for t in np.arange(0.05, 0.96, 0.05):
        pred = (p_tobacco >= t).astype(int)
        tp = int(((pred == 1) & (y_true == 1)).sum())
        fp = int(((pred == 1) & (y_true == 0)).sum())
        fn = int(((pred == 0) & (y_true == 1)).sum())
        tn = int(((pred == 0) & (y_true == 0)).sum())

        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        reject_recall = tn / (tn + fp) if (tn + fp) else 0.0

        rows.append({
            "threshold": round(float(t), 2),
            "tobacco_precision": round(precision, 4),
            "tobacco_recall": round(recall, 4),
            "tobacco_f1": round(f1, 4),
            "not_tobacco_recall": round(reject_recall, 4),
            "true_pos": tp, "false_pos": fp, "true_neg": tn, "false_neg": fn,
        })

    eligible = [r for r in rows if r["not_tobacco_recall"] >= min_reject_recall]
    if eligible:
        best = max(eligible, key=lambda r: r["tobacco_f1"])
    else:
        # Nothing clears the bar - take the strictest gate available and warn.
        best = max(rows, key=lambda r: r["not_tobacco_recall"])
        print(
            f"[verify] WARNING: no threshold rejects {min_reject_recall:.0%} of "
            f"non-tobacco images. Best achievable is "
            f"{best['not_tobacco_recall']:.1%} at threshold {best['threshold']}. "
            "Add more and harder negatives."
        )
    return float(best["threshold"]), rows


def plot_threshold_sweep(rows: list[dict], chosen: float, out_path: Path) -> None:
    ts = [r["threshold"] for r in rows]
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.plot(ts, [r["tobacco_recall"] for r in rows], marker="o", label="Tobacco recall")
    ax.plot(ts, [r["tobacco_precision"] for r in rows], marker="s", label="Tobacco precision")
    ax.plot(ts, [r["not_tobacco_recall"] for r in rows], marker="^", label="Not-Tobacco recall (reject rate)")
    ax.axvline(chosen, color="crimson", linestyle="--", label=f"chosen = {chosen:.2f}")
    ax.set_xlabel("Decision threshold on P(Tobacco)")
    ax.set_ylabel("Score")
    ax.set_title("Verification gate - threshold sweep (validation)")
    ax.set_ylim(0, 1.02)
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir) if args.data_dir else DATA_DIR

    if not data_dir.exists():
        print(
            f"Dataset not found at {data_dir}.\n"
            "Build it first:\n"
            "  python scripts/download_not_tobacco.py --per-class 150\n"
            "  python scripts/build_verification_dataset.py"
        )
        return 1

    out_dir = ROOT / "outputs"
    model_dir = ROOT / "saved_models"
    out_dir.mkdir(parents=True, exist_ok=True)
    model_dir.mkdir(parents=True, exist_ok=True)

    strip_colour = not args.keep_colour
    print("=" * 62)
    print("Training the Tobacco Verification Model")
    print("=" * 62)
    print(f"[verify] data          : {data_dir}")
    print(f"[verify] colour stripped in-graph: {strip_colour}")

    # Colour is deliberately loaded as RGB - the grayscale collapse happens
    # inside the model so it applies identically at training and serving time.
    train_ds, val_ds, class_names = make_datasets(
        data_dir,
        image_size=args.image_size,
        batch_size=args.batch_size,
        val_split=args.val_split,
        seed=args.seed,
        color_mode="rgb",
        force_rgb=False,
    )

    if class_names != EXPECTED_CLASSES:
        print(
            f"\n[verify] ERROR: expected class folders {EXPECTED_CLASSES}, "
            f"found {class_names}.\n"
            "The backend maps index 1 to Tobacco, so the folder names must be "
            "exactly Not_Tobacco/ and Tobacco/."
        )
        return 1
    print(f"[verify] classes       : {class_names} (index {TOBACCO_INDEX} = Tobacco)")

    class_weight = compute_class_weights(data_dir, class_names)

    base = build_verification_cnn(
        image_size=args.image_size,
        dropout=args.dropout,
        fine_tune_at=None if args.fine_tune_at < 0 else args.fine_tune_at,
    )
    full = wrap_verification_model(base, args.image_size, strip_colour)
    full.compile(
        optimizer=tf.keras.optimizers.Adam(args.lr),
        loss=tf.keras.losses.CategoricalCrossentropy(
            label_smoothing=args.label_smoothing
        ),
        metrics=["accuracy"],
    )
    full.summary()

    ckpt_path = model_dir / "tobacco_verification_model.keras"

    class SaveBestModel(callbacks.Callback):
        """Mirrors train.py - saves whole model, avoiding pickle issues."""

        def __init__(self, filepath: str, monitor: str = "val_accuracy"):
            super().__init__()
            self.filepath = filepath
            self.monitor = monitor
            self.best = -np.inf

        def on_epoch_end(self, epoch, logs=None):
            if logs and logs.get(self.monitor, -np.inf) > self.best:
                self.best = logs[self.monitor]
                self.model.save(self.filepath)
                print(f"  saved best model (val_accuracy: {self.best:.4f})")

    cbs = [
        SaveBestModel(str(ckpt_path)),
        callbacks.EarlyStopping(monitor="val_accuracy", patience=5, restore_best_weights=True),
        callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-6),
    ]

    history = full.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        callbacks=cbs,
        class_weight=class_weight,
    )

    plot_history(history, out_dir / "verification_training_curves.png")

    # ---- evaluation -------------------------------------------------------
    y_true, p_tobacco = collect_val_scores(full, val_ds)
    threshold, sweep = sweep_thresholds(y_true, p_tobacco, args.min_reject_recall)
    y_pred = (p_tobacco >= threshold).astype(int)

    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    plot_confusion_matrix(cm, class_names, out_dir / "verification_confusion_matrix.png")
    plot_threshold_sweep(sweep, threshold, out_dir / "verification_threshold_sweep.png")

    report = classification_report(
        y_true, y_pred, labels=[0, 1], target_names=class_names, output_dict=True
    )
    try:
        auc = float(roc_auc_score(y_true, p_tobacco))
    except ValueError:
        auc = float("nan")

    chosen_row = next(r for r in sweep if abs(r["threshold"] - threshold) < 1e-9)
    metrics = {
        "classes": class_names,
        "tobacco_index": TOBACCO_INDEX,
        "chosen_threshold": threshold,
        "min_reject_recall_target": args.min_reject_recall,
        "roc_auc": auc,
        "at_chosen_threshold": chosen_row,
        "classification_report": report,
        "threshold_sweep": sweep,
        "colour_stripped_in_graph": strip_colour,
        "image_size": args.image_size,
    }
    (out_dir / "verification_metrics.json").write_text(json.dumps(metrics, indent=2))

    # The backend reads this to get the class order and threshold, so it never
    # has to hard-code a number that was tuned here.
    metadata = {
        "classes": class_names,
        "tobacco_index": TOBACCO_INDEX,
        "threshold": threshold,
        "image_size": args.image_size,
        "input_range": "[0, 255] raw RGB - normalisation is baked into the graph",
        "colour_stripped_in_graph": strip_colour,
        "roc_auc": auc,
        "not_tobacco_recall": chosen_row["not_tobacco_recall"],
        "tobacco_recall": chosen_row["tobacco_recall"],
    }
    (model_dir / "verification_metadata.json").write_text(json.dumps(metadata, indent=2))

    print("\n" + "=" * 62)
    print("Verification model trained")
    print("=" * 62)
    print(f"  threshold on P(Tobacco) : {threshold:.2f}")
    print(f"  ROC AUC                 : {auc:.4f}")
    print(f"  rejects non-tobacco     : {chosen_row['not_tobacco_recall']:.1%}")
    print(f"  accepts real tobacco    : {chosen_row['tobacco_recall']:.1%}")
    print(f"\n  model    -> {ckpt_path}")
    print(f"  metadata -> {model_dir / 'verification_metadata.json'}")
    print(f"  reports  -> {out_dir}")
    print("\nDeploy it:")
    print("  cp ml/saved_models/tobacco_verification_model.keras backend/saved_models/")
    print("  cp ml/saved_models/verification_metadata.json backend/saved_models/")
    print("  # restart the backend - it picks the model up on startup")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

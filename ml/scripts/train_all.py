"""
Master script to train DISEASE DETECTION MODEL ONLY.

This script:
1. Reorganizes your train/test/valid data into the disease/ folder structure
2. Trains the disease detection model (grayscale → RGB conversion)

Data: DISEASE ONLY
- Input: train/test/valid folders with disease images
- Output: One disease model (ml/saved_models/tobacco_disease_model.keras)

Usage:
    python ml/scripts/train_all.py --epochs 30 --batch-size 32
"""
from __future__ import annotations
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"


def run_script(script_name: str, args: list[str] | None = None) -> bool:
    """Run a Python script and return success status."""
    cmd = [sys.executable, SCRIPTS_DIR / script_name]
    if args:
        cmd.extend(args)
    
    print(f"\n{'='*60}")
    print(f"▶️  Running: {script_name}")
    print(f"{'='*60}")
    
    result = subprocess.run(cmd, cwd=ROOT)
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Train DISEASE model only")
    parser.add_argument("--epochs", type=int, default=30, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--image-size", type=int, default=224, help="Image size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument(
        "--skip-reorganize",
        action="store_true",
        help="Skip data reorganization (data already organized)",
    )
    args = parser.parse_args()

    print("\n" + "="*60)
    print("🌿 Tobacco Leaf Disease Detection Model Training")
    print("="*60)

    # Step 1: Reorganize disease data
    if not args.skip_reorganize:
        if not run_script("reorganize_data.py"):
            print("❌ Failed to reorganize data")
            return 1
    else:
        print("⏭️  Skipping data reorganization")

    # Step 2: Train DISEASE model ONLY
    disease_args = [
        "--task", "disease",
        "--arch", "transfer",
        "--epochs", str(args.epochs),
        "--batch-size", str(args.batch_size),
        "--image-size", str(args.image_size),
        "--lr", str(args.lr),
        "--grayscale",  # Your images are grayscale
    ]
    if not run_script("train.py", disease_args):
        print("❌ Failed to train disease model")
        return 1

    # Done!
    print("\n" + "="*60)
    print("✅ Disease Model Training Complete!")
    print("="*60)
    print("\n✓ Model saved to:")
    print(f"  {ROOT / 'saved_models' / 'tobacco_disease_model.keras'}")
    print("\n✓ Metrics and plots saved to:")
    print(f"  {ROOT / 'outputs'}/")
    print("\nNext steps:")
    print("  1. Copy model to backend/saved_models/")
    print("  2. Restart the FastAPI backend")
    print("  3. Test predictions at http://localhost:8000/docs")
    return 0


if __name__ == "__main__":
    sys.exit(main())

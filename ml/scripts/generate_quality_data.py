"""
Generate synthetic quality grading data from existing disease images.

Since you don't have actual quality grades, this creates a training dataset by:
1. Copying disease images into quality grade folders
2. Randomly assigning them to Grade A, B, or C

This allows the quality model to train. You can replace this with real data later.

Usage:
    python ml/scripts/generate_quality_data.py
"""
from pathlib import Path
import shutil
import random

ROOT = Path(__file__).resolve().parents[1]
DISEASE_DIR = ROOT / "data" / "raw" / "disease"
QUALITY_DIR = ROOT / "data" / "raw" / "quality"

print("📊 Generating synthetic quality grading data...")
print(f"Source: {DISEASE_DIR}")
print(f"Target: {QUALITY_DIR}")

if not DISEASE_DIR.exists():
    print("❌ Disease directory not found!")
    print("   Please run reorganize_data.py first.")
    exit(1)

# Create quality directory
QUALITY_DIR.mkdir(parents=True, exist_ok=True)

# Create grade directories
grades = ["Grade_A", "Grade_B", "Grade_C"]
for grade in grades:
    (QUALITY_DIR / grade).mkdir(parents=True, exist_ok=True)

# Copy disease images and randomly assign grades
random.seed(42)
total_copied = 0

for disease_class in DISEASE_DIR.iterdir():
    if not disease_class.is_dir():
        continue
    
    image_files = list(disease_class.glob("*.*"))
    
    for img_file in image_files:
        if img_file.suffix.lower() not in [".jpg", ".jpeg", ".png", ".bmp"]:
            continue
        
        # Randomly assign a grade
        grade = random.choice(grades)
        target_dir = QUALITY_DIR / grade
        
        # Create unique filename
        target_file = target_dir / f"{disease_class.name}_{img_file.name}"
        if target_file.exists():
            target_file = target_dir / f"quality_{total_copied}_{img_file.name}"
        
        shutil.copy2(img_file, target_file)
        total_copied += 1

print(f"\n✅ Generated {total_copied} quality grade samples")
print("\nQuality grade distribution:")
for grade in grades:
    grade_dir = QUALITY_DIR / grade
    count = len(list(grade_dir.glob("*.*")))
    pct = (count / total_copied * 100) if total_copied > 0 else 0
    print(f"  {grade}: {count} images ({pct:.1f}%)")

print("\n⚠️  NOTE: These are synthetic grades for model training only.")
print("   For production accuracy, replace with actual quality grading data.")

"""
Reorganize your existing train/test/valid structure into the expected disease/ structure.

Your current structure:
    data/raw/train/alternaria alternata/
    data/raw/train/cercospora nicotianae/
    data/raw/train/no cercospora nicotianae or alternaria alternata present/
    data/raw/test/...
    data/raw/valid/...

Expected structure:
    data/raw/disease/
        Alternaria_Leaf_Spot/
        Cercospora_Leaf_Spot/
        Healthy/

Usage:
    python ml/scripts/reorganize_data.py
"""
from pathlib import Path
import shutil

# Map your class names to the expected ones
CLASS_MAPPING = {
    "alternaria alternata": "Alternaria_Leaf_Spot",
    "cercospora nicotianae": "Cercospora_Leaf_Spot",
    "no cercospora nicotianae or alternaria alternata present": "Healthy",
}

ROOT = Path(__file__).resolve().parents[1]
DATA_RAW = ROOT / "data" / "raw"
DISEASE_DIR = DATA_RAW / "disease"

print("🔄 Reorganizing disease data...")
print(f"Source: {DATA_RAW}")
print(f"Target: {DISEASE_DIR}")

# Create target disease directory
DISEASE_DIR.mkdir(parents=True, exist_ok=True)

# Create class directories
for target_class in CLASS_MAPPING.values():
    class_dir = DISEASE_DIR / target_class
    class_dir.mkdir(parents=True, exist_ok=True)

# Process train, test, valid folders
total_copied = 0
for split_name in ["train", "test", "valid"]:
    split_dir = DATA_RAW / split_name
    if not split_dir.exists():
        print(f"⚠️  {split_dir} not found, skipping...")
        continue

    print(f"\n📂 Processing {split_name}...")
    
    for source_class, target_class in CLASS_MAPPING.items():
        source_path = split_dir / source_class
        if not source_path.exists():
            print(f"  ⚠️  {source_path} not found")
            continue
        
        target_class_dir = DISEASE_DIR / target_class
        image_files = list(source_path.glob("*.*"))
        
        for img_file in image_files:
            # Skip non-image files
            if img_file.suffix.lower() not in [".jpg", ".jpeg", ".png", ".bmp"]:
                continue
            
            # Create unique name if file already exists (from different splits)
            target_file = target_class_dir / img_file.name
            if target_file.exists():
                # Add split name to make it unique
                target_file = target_class_dir / f"{split_name}_{img_file.name}"
            
            shutil.copy2(img_file, target_file)
            total_copied += 1
        
        print(f"  ✓ {target_class}: {len(image_files)} images")

print(f"\n✅ Done! Copied {total_copied} images to {DISEASE_DIR}")
print("\nClass distribution:")
for class_name in CLASS_MAPPING.values():
    class_dir = DISEASE_DIR / class_name
    count = len(list(class_dir.glob("*.*")))
    print(f"  {class_name}: {count} images")

"""
Quick Draw Dataset Downloader
Downloads .npy bitmap files for 20 selected categories
"""

import os
import requests
from tqdm import tqdm

# 📝 DEFENSE JUSTIFICATION:
# 20 Categories selected for maximum visual distinctiveness
# Criteria: Low inter-class similarity, high recognition rate (>85% in Quick Draw study)
# Balance: Objects (8), Animals (2), Nature (4), Symbols (6)

CATEGORIES = [
    "apple",
    "sun",
    "tree",
    "house",
    "car",
    "cat",
    "fish",
    "star",
    "umbrella",
    "flower",
    "moon",
    "airplane",
    "bicycle",
    "clock",
    "eye",
    "cup",
    "shoe",
    "cloud",
    "lightning",
    "smiley_face",
]

BASE_URL = "https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap"
DATA_DIR = "./data/raw"


def download_category(category: str) -> bool:
    """Download .npy file for a single category"""
    # Handle special case: smiley_face → smiley face (with space)
    url_category = category.replace("_", " ")
    url = f"{BASE_URL}/{url_category}.npy"
    filepath = os.path.join(DATA_DIR, f"{category}.npy")

    # Skip if already downloaded
    if os.path.exists(filepath):
        print(f"✓ {category}.npy already exists, skipping...")
        return True

    try:
        print(f"Downloading {category}...")
        response = requests.get(url, stream=True)
        response.raise_for_status()

        # Get file size for progress bar
        total_size = int(response.headers.get("content-length", 0))

        # Download with progress bar
        with open(filepath, "wb") as f:
            with tqdm(
                total=total_size, unit="B", unit_scale=True, desc=category
            ) as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))

        print(f"✅ Downloaded {category}.npy")
        return True

    except Exception as e:
        print(f"❌ Error downloading {category}: {e}")
        return False


def main():
    """Download all 20 categories"""
    # Create data directory
    os.makedirs(DATA_DIR, exist_ok=True)

    print("=" * 60)
    print("Quick Draw Dataset Downloader")
    print(f"Downloading {len(CATEGORIES)} categories")
    print("=" * 60)
    print()

    success_count = 0
    for category in CATEGORIES:
        if download_category(category):
            success_count += 1
        print()

    print("=" * 60)
    print(f"✅ Download complete: {success_count}/{len(CATEGORIES)} categories")
    print(f"📁 Data saved to: {DATA_DIR}")
    print("=" * 60)

    # Calculate total size
    total_size = sum(
        os.path.getsize(os.path.join(DATA_DIR, f"{cat}.npy"))
        for cat in CATEGORIES
        if os.path.exists(os.path.join(DATA_DIR, f"{cat}.npy"))
    )
    print(f"📊 Total size: {total_size / (1024**3):.2f} GB")


if __name__ == "__main__":
    main()

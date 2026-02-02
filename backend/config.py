"""
Configuration module for AI Pictionary
Centralizes model configuration and category loading to avoid circular imports
"""

import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Model configuration
MODEL_VERSION = os.getenv("MODEL_VERSION", "v4.0.0")
CATEGORIES = []  # Will be loaded from metadata


def load_categories_from_metadata():
    """Load CATEGORIES dynamically from model metadata JSON file."""
    global CATEGORIES
    try:
        metadata_path = f"./models/quickdraw_{MODEL_VERSION}_metadata.json"
        if os.path.exists(metadata_path):
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
                CATEGORIES = metadata.get("categories", [])
                num_classes = metadata.get("num_classes", len(CATEGORIES))
                print(f"✅ Categories loaded from metadata: {num_classes} classes")
                return True
        else:
            print(f"⚠️  Metadata file not found: {metadata_path}")
            return False
    except Exception as e:
        print(f"⚠️  Error loading categories: {e}")
        return False


# Load categories on module import
load_categories_from_metadata()

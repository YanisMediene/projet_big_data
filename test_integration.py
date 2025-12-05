#!/usr/bin/env python3
"""
Integration Test Script for AI Pictionary

Tests:
1. Backend API health check
2. Model loading status
3. Prediction endpoint with sample image
4. Frontend build status

Usage:
    python test_integration.py
"""

import requests
import base64
import sys
from pathlib import Path

# Configuration
BACKEND_URL = "http://localhost:8000"
TIMEOUT = 5  # seconds


def test_backend_health():
    """Test if backend is running and healthy"""
    print("\n" + "=" * 60)
    print("TEST 1: Backend Health Check")
    print("=" * 60)

    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=TIMEOUT)
        data = response.json()

        print(f"✅ Backend is running")
        print(f"   Status: {data.get('status')}")
        print(f"   Model loaded: {data.get('model_loaded')}")
        print(f"   Version: {data.get('version', 'N/A')}")

        if data.get("model_loaded"):
            print(f"   Model path: {data.get('model_path', 'N/A')}")
            return True
        else:
            print(f"   ⚠️  Model not loaded yet")
            print(
                f"   📝 Train model first: cd ml-training && jupyter notebook notebooks/train_model.ipynb"
            )
            return False

    except requests.exceptions.ConnectionError:
        print(f"❌ Backend not running")
        print(f"   📝 Start backend: cd backend && uvicorn main:app --reload")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_prediction_endpoint():
    """Test prediction with a simple test image"""
    print("\n" + "=" * 60)
    print("TEST 2: Prediction Endpoint")
    print("=" * 60)

    # Create a simple black square (28x28) as test image
    from PIL import Image
    import io

    # Create 28x28 white image with black circle (simulate drawing)
    img = Image.new("L", (28, 28), color=255)
    pixels = img.load()

    # Draw a simple circle pattern
    for x in range(28):
        for y in range(28):
            # Circle equation: (x-14)^2 + (y-14)^2 < 100
            if (x - 14) ** 2 + (y - 14) ** 2 < 100:
                pixels[x, y] = 0  # Black

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    base64_image = base64.b64encode(buffer.getvalue()).decode("utf-8")

    try:
        response = requests.post(
            f"{BACKEND_URL}/predict", json={"image": base64_image}, timeout=TIMEOUT
        )

        if response.status_code == 200:
            data = response.json()
            predictions = data.get("predictions", [])

            print(f"✅ Prediction successful")
            print(f"\n   Top-3 Predictions:")
            for i, pred in enumerate(predictions[:3], 1):
                category = pred["category"]
                confidence = pred["confidence"]
                bar = "█" * int(confidence / 5)
                print(f"   {i}. {category:15s} {confidence:5.1f}% {bar}")

            return True
        else:
            print(f"❌ Prediction failed: HTTP {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to backend")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def check_dataset_status():
    """Check if dataset has been downloaded"""
    print("\n" + "=" * 60)
    print("TEST 3: Dataset Status")
    print("=" * 60)

    data_dir = Path("ml-training/data/raw")

    if not data_dir.exists():
        print(f"❌ Dataset directory not found: {data_dir}")
        print(
            f"   📝 Download dataset: cd ml-training && python scripts/download_dataset.py"
        )
        return False

    categories = [
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

    downloaded = []
    missing = []

    for category in categories:
        file_path = data_dir / f"{category}.npy"
        if file_path.exists():
            size_mb = file_path.stat().st_size / (1024 * 1024)
            downloaded.append((category, size_mb))
        else:
            missing.append(category)

    print(f"   Downloaded: {len(downloaded)}/20 categories")

    if missing:
        print(f"   ⚠️  Missing categories: {', '.join(missing)}")
        print(
            f"   📝 Continue download: cd ml-training && python scripts/download_dataset.py"
        )
        return False
    else:
        total_size = sum(size for _, size in downloaded)
        print(f"   ✅ All 20 categories downloaded ({total_size:.1f} MB)")

        # Check if preprocessed dataset exists
        preprocessed = Path("ml-training/data/processed/quickdraw_20cat.h5")
        if preprocessed.exists():
            size_mb = preprocessed.stat().st_size / (1024 * 1024)
            print(f"   ✅ Preprocessed dataset exists: {size_mb:.1f} MB")
        else:
            print(f"   ⚠️  Preprocessed dataset not found")
            print(
                f"   📝 Run preprocessing: cd ml-training && python scripts/preprocess_dataset.py"
            )

        return True


def check_model_status():
    """Check if trained model exists"""
    print("\n" + "=" * 60)
    print("TEST 4: Model Status")
    print("=" * 60)

    model_path = Path("backend/models/quickdraw_v1.0.0.h5")

    if model_path.exists():
        size_mb = model_path.stat().st_size / (1024 * 1024)
        print(f"   ✅ Model exists: {size_mb:.1f} MB")
        print(f"   Path: {model_path}")
        return True
    else:
        print(f"   ❌ Model not found: {model_path}")
        print(
            f"   📝 Train model: cd ml-training && jupyter notebook notebooks/train_model.ipynb"
        )
        return False


def check_frontend_status():
    """Check if frontend is running"""
    print("\n" + "=" * 60)
    print("TEST 5: Frontend Status")
    print("=" * 60)

    try:
        response = requests.get("http://localhost:3000", timeout=TIMEOUT)
        if response.status_code == 200:
            print(f"   ✅ Frontend is running on http://localhost:3000")
            return True
        else:
            print(f"   ⚠️  Frontend returned HTTP {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Frontend not running")
        print(f"   📝 Start frontend: cd frontend && npm start")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def main():
    """Run all integration tests"""
    print("\n" + "=" * 60)
    print("AI PICTIONARY - INTEGRATION TEST SUITE")
    print("=" * 60)

    results = {
        "Dataset": check_dataset_status(),
        "Model": check_model_status(),
        "Backend Health": test_backend_health(),
        "Frontend": check_frontend_status(),
    }

    # Only test prediction if backend is healthy
    if results["Backend Health"]:
        results["Prediction"] = test_prediction_endpoint()
    else:
        results["Prediction"] = None

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    for test_name, passed in results.items():
        if passed is None:
            status = "⏭️  SKIPPED"
        elif passed:
            status = "✅ PASSED"
        else:
            status = "❌ FAILED"
        print(f"   {status:12s} {test_name}")

    # Overall status
    passed_tests = sum(1 for p in results.values() if p is True)
    total_tests = sum(1 for p in results.values() if p is not None)

    print(f"\n   Total: {passed_tests}/{total_tests} tests passed")

    if passed_tests == total_tests:
        print("\n   🎉 All systems operational!")
        print("\n   Next steps:")
        print("   1. Open http://localhost:3000 in browser")
        print("   2. Draw something on canvas")
        print("   3. Check predictions appear")
        return 0
    else:
        print("\n   ⚠️  Some systems need attention (see steps above)")
        return 1


if __name__ == "__main__":
    sys.exit(main())

"""
Active Learning Retraining Pipeline
Fetches corrections from Firestore, merges with Quick Draw dataset,
fine-tunes the CNN model, and deploys new version to Firebase Storage
"""

import os
import sys
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.optimizers import Adam
import h5py
from datetime import datetime
import json

# Firebase Admin
import firebase_admin
from firebase_admin import credentials, firestore, storage

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class ActiveLearningPipeline:
    """
    Active Learning Pipeline for model retraining
    """

    def __init__(
        self,
        service_account_path: str = None,
        storage_bucket: str = "ai-pictionary-4f8f2.appspot.com",
    ):
        """
        Initialize pipeline with Firebase credentials

        Args:
            service_account_path: Path to Firebase service account JSON
            storage_bucket: Firebase Storage bucket name
        """
        # Initialize Firebase Admin
        if not firebase_admin._apps:
            if service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
            else:
                # Use default credentials
                cred = credentials.ApplicationDefault()

            firebase_admin.initialize_app(cred, {"storageBucket": storage_bucket})

        self.db = firestore.client()
        self.bucket = storage.bucket()

        # Categories (20 Quick Draw classes)
        self.categories = [
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
        self.category_to_idx = {cat: idx for idx, cat in enumerate(self.categories)}

    def fetch_corrections(self, min_count: int = 500, model_version: str = "v1.0.0"):
        """
        Fetch corrections from Firestore

        Args:
            min_count: Minimum number of corrections required
            model_version: Model version to filter by

        Returns:
            List of correction documents
        """
        print(f"\n📥 Fetching corrections from Firestore (min: {min_count})...")

        query = (
            self.db.collection("corrections")
            .where("modelVersion", "==", model_version)
            .limit(min_count * 2)
        )  # Fetch more to ensure we have enough

        corrections = []
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            corrections.append(data)

        print(f"✓ Found {len(corrections)} corrections")

        if len(corrections) < min_count:
            raise ValueError(
                f"Not enough corrections: {len(corrections)} < {min_count}. "
                f"Need at least {min_count} to retrain."
            )

        return corrections[:min_count]

    def download_correction_images(self, corrections):
        """
        Download correction images from Firebase Storage

        Args:
            corrections: List of correction documents

        Returns:
            Tuple of (images, labels)
        """
        print(f"\n📦 Downloading {len(corrections)} images from Storage...")

        images = []
        labels = []

        for i, correction in enumerate(corrections):
            try:
                # Download image
                blob_path = correction["imageStoragePath"]
                blob = self.bucket.blob(blob_path)
                image_bytes = blob.download_as_bytes()

                # Decode image (assuming PNG base64)
                from PIL import Image
                import io

                img = Image.open(io.BytesIO(image_bytes))
                img = img.convert("L")  # Grayscale
                img = img.resize((28, 28), Image.LANCZOS)

                # Convert to numpy array
                img_array = np.array(img)

                # Invert colors (Canvas white bg → Dataset black bg)
                img_array = 255.0 - img_array

                # Normalize [0-255] → [0-1]
                img_array = img_array / 255.0

                images.append(img_array)

                # Get label index
                corrected_label = correction["correctedLabel"]
                if corrected_label in self.category_to_idx:
                    labels.append(self.category_to_idx[corrected_label])
                else:
                    print(f"⚠️  Unknown category: {corrected_label}, skipping")
                    images.pop()  # Remove last image

                if (i + 1) % 100 == 0:
                    print(f"   Downloaded {i + 1}/{len(corrections)} images")

            except Exception as e:
                print(f"⚠️  Error downloading {correction.get('drawingId')}: {e}")
                continue

        print(f"✓ Downloaded {len(images)} valid images")

        # Convert to numpy arrays
        X = np.array(images).reshape(-1, 28, 28, 1)
        y = np.array(labels)

        return X, y

    def load_original_dataset(self, dataset_path: str = "../data/quickdraw_20cat.h5"):
        """
        Load original Quick Draw dataset

        Args:
            dataset_path: Path to HDF5 dataset

        Returns:
            Tuple of (X_train, y_train, X_val, y_val, X_test, y_test)
        """
        print(f"\n📚 Loading original Quick Draw dataset from {dataset_path}...")

        with h5py.File(dataset_path, "r") as f:
            X_train = f["train/images"][:]
            y_train = f["train/labels"][:]
            X_val = f["val/images"][:]
            y_val = f["val/labels"][:]
            X_test = f["test/images"][:]
            y_test = f["test/labels"][:]

        print(f"✓ Loaded dataset:")
        print(f"   Train: {X_train.shape}")
        print(f"   Val:   {X_val.shape}")
        print(f"   Test:  {X_test.shape}")

        return X_train, y_train, X_val, y_val, X_test, y_test

    def merge_datasets(self, X_original, y_original, X_corrections, y_corrections):
        """
        Merge original dataset with corrections

        Args:
            X_original: Original images
            y_original: Original labels
            X_corrections: Correction images
            y_corrections: Correction labels

        Returns:
            Tuple of (X_combined, y_combined)
        """
        print(f"\n🔀 Merging datasets...")
        print(f"   Original:    {X_original.shape}")
        print(f"   Corrections: {X_corrections.shape}")

        X_combined = np.concatenate([X_original, X_corrections], axis=0)
        y_combined = np.concatenate([y_original, y_corrections], axis=0)

        print(f"✓ Combined:   {X_combined.shape}")

        return X_combined, y_combined

    def load_current_model(self, model_path: str = "../models/quickdraw_v1.0.0.h5"):
        """
        Load current production model

        Args:
            model_path: Path to model file

        Returns:
            Loaded Keras model
        """
        print(f"\n🔧 Loading current model from {model_path}...")

        model = keras.models.load_model(model_path)

        print(f"✓ Model loaded:")
        print(f"   Parameters: {model.count_params():,}")
        model.summary()

        return model

    def fine_tune_model(
        self,
        model,
        X_train,
        y_train,
        X_val,
        y_val,
        epochs: int = 5,
        batch_size: int = 128,
        learning_rate: float = 0.0001,
    ):
        """
        Fine-tune model on combined dataset

        Args:
            model: Keras model to fine-tune
            X_train: Training images
            y_train: Training labels
            X_val: Validation images
            y_val: Validation labels
            epochs: Number of training epochs
            batch_size: Batch size
            learning_rate: Learning rate

        Returns:
            Tuple of (model, history)
        """
        print(f"\n🎓 Fine-tuning model...")
        print(f"   Epochs: {epochs}")
        print(f"   Batch size: {batch_size}")
        print(f"   Learning rate: {learning_rate}")

        # Freeze convolutional layers (only retrain dense layers)
        for layer in model.layers[:-1]:
            layer.trainable = False

        # Compile with low learning rate
        model.compile(
            optimizer=Adam(learning_rate=learning_rate),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )

        # Convert labels to categorical
        y_train_cat = keras.utils.to_categorical(y_train, num_classes=20)
        y_val_cat = keras.utils.to_categorical(y_val, num_classes=20)

        # Train
        history = model.fit(
            X_train,
            y_train_cat,
            validation_data=(X_val, y_val_cat),
            epochs=epochs,
            batch_size=batch_size,
            verbose=1,
        )

        print(f"✓ Fine-tuning complete")

        return model, history

    def validate_model(self, model, X_test, y_test, current_accuracy: float):
        """
        Validate model accuracy and compare with current production

        Args:
            model: Fine-tuned model
            X_test: Test images
            y_test: Test labels
            current_accuracy: Current production model accuracy

        Returns:
            Test accuracy
        """
        print(f"\n📊 Validating model on test set...")

        # Convert labels
        y_test_cat = keras.utils.to_categorical(y_test, num_classes=20)

        # Evaluate
        test_loss, test_acc = model.evaluate(X_test, y_test_cat, verbose=0)

        print(f"✓ Test Results:")
        print(f"   Loss:     {test_loss:.4f}")
        print(f"   Accuracy: {test_acc:.4f} ({test_acc * 100:.2f}%)")
        print(f"   Previous: {current_accuracy:.4f} ({current_accuracy * 100:.2f}%)")

        improvement = test_acc - current_accuracy
        print(f"   Change:   {improvement:+.4f} ({improvement * 100:+.2f}%)")

        if test_acc < current_accuracy - 0.02:  # 2% drop threshold
            raise ValueError(
                f"Model accuracy dropped too much: {test_acc:.4f} < {current_accuracy:.4f}. "
                f"Not deploying new model."
            )

        return test_acc

    def increment_version(self, current_version: str = "v1.0.0") -> str:
        """
        Increment model version

        Args:
            current_version: Current version (e.g., 'v1.0.0')

        Returns:
            New version (e.g., 'v1.0.1')
        """
        # Parse version
        parts = current_version.replace("v", "").split(".")
        major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])

        # Increment patch version
        patch += 1

        new_version = f"v{major}.{minor}.{patch}"
        print(f"\n📌 Version: {current_version} → {new_version}")

        return new_version

    def save_model(self, model, version: str, save_dir: str = "../models"):
        """
        Save model locally

        Args:
            model: Keras model to save
            version: Model version
            save_dir: Directory to save model

        Returns:
            Path to saved model
        """
        os.makedirs(save_dir, exist_ok=True)
        model_path = os.path.join(save_dir, f"quickdraw_{version}.h5")

        print(f"\n💾 Saving model to {model_path}...")
        model.save(model_path)
        print(f"✓ Model saved")

        return model_path

    def upload_to_storage(self, model_path: str, version: str, metadata: dict):
        """
        Upload model to Firebase Storage and update Firestore metadata

        Args:
            model_path: Local path to model file
            version: Model version
            metadata: Model metadata (accuracy, loss, etc.)
        """
        print(f"\n☁️  Uploading to Firebase Storage...")

        # Upload model file
        blob_path = f"models/production/{version}/quickdraw_{version}.h5"
        blob = self.bucket.blob(blob_path)
        blob.upload_from_filename(model_path, content_type="application/x-hdf5")
        print(f"✓ Model uploaded to {blob_path}")

        # Upload metadata JSON
        metadata_blob_path = f"models/production/{version}/metadata.json"
        metadata_blob = self.bucket.blob(metadata_blob_path)
        metadata_json = json.dumps(metadata, indent=2)
        metadata_blob.upload_from_string(metadata_json, content_type="application/json")
        print(f"✓ Metadata uploaded to {metadata_blob_path}")

        # Update Firestore metadata
        doc_ref = self.db.collection("models").document(version)
        doc_ref.set(
            {
                "version": version,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "active": True,
                "storagePath": blob_path,
                "metrics": metadata,
            }
        )
        print(f"✓ Firestore metadata updated")

    def run_pipeline(
        self,
        min_corrections: int = 500,
        current_version: str = "v1.0.0",
        current_accuracy: float = 0.925,
        epochs: int = 5,
    ):
        """
        Execute complete retraining pipeline

        Args:
            min_corrections: Minimum corrections required
            current_version: Current model version
            current_accuracy: Current model accuracy
            epochs: Training epochs

        Returns:
            Tuple of (new_version, new_accuracy)
        """
        print("=" * 60)
        print("🚀 ACTIVE LEARNING RETRAINING PIPELINE")
        print("=" * 60)

        try:
            # 1. Fetch corrections
            corrections = self.fetch_corrections(min_corrections, current_version)

            # 2. Download images
            X_corrections, y_corrections = self.download_correction_images(corrections)

            # 3. Load original dataset
            X_train, y_train, X_val, y_val, X_test, y_test = (
                self.load_original_dataset()
            )

            # 4. Merge datasets
            X_train_merged, y_train_merged = self.merge_datasets(
                X_train, y_train, X_corrections, y_corrections
            )

            # 5. Load current model
            model = self.load_current_model()

            # 6. Fine-tune
            model, history = self.fine_tune_model(
                model, X_train_merged, y_train_merged, X_val, y_val, epochs=epochs
            )

            # 7. Validate
            new_accuracy = self.validate_model(model, X_test, y_test, current_accuracy)

            # 8. Increment version
            new_version = self.increment_version(current_version)

            # 9. Save model
            model_path = self.save_model(model, new_version)

            # 10. Upload to Firebase
            metadata = {
                "test_accuracy": float(new_accuracy),
                "test_loss": float(history.history["val_loss"][-1]),
                "training_samples": int(len(X_train_merged)),
                "correction_samples": int(len(X_corrections)),
                "epochs": epochs,
                "previous_version": current_version,
                "previous_accuracy": current_accuracy,
            }
            self.upload_to_storage(model_path, new_version, metadata)

            print("\n" + "=" * 60)
            print("✅ RETRAINING PIPELINE COMPLETED SUCCESSFULLY")
            print("=" * 60)
            print(f"   New Version: {new_version}")
            print(f"   Accuracy:    {new_accuracy:.4f} ({new_accuracy * 100:.2f}%)")
            print(f"   Improvement: {(new_accuracy - current_accuracy) * 100:+.2f}%")
            print("=" * 60)

            return new_version, new_accuracy

        except Exception as e:
            print("\n" + "=" * 60)
            print("❌ RETRAINING PIPELINE FAILED")
            print("=" * 60)
            print(f"   Error: {str(e)}")
            print("=" * 60)
            raise


if __name__ == "__main__":
    # Configuration
    SERVICE_ACCOUNT_PATH = "../../backend/serviceAccountKey.json"
    MIN_CORRECTIONS = 500
    CURRENT_VERSION = "v1.0.0"
    CURRENT_ACCURACY = 0.925  # 92.5%
    EPOCHS = 5

    # Run pipeline
    pipeline = ActiveLearningPipeline(service_account_path=SERVICE_ACCOUNT_PATH)

    new_version, new_accuracy = pipeline.run_pipeline(
        min_corrections=MIN_CORRECTIONS,
        current_version=CURRENT_VERSION,
        current_accuracy=CURRENT_ACCURACY,
        epochs=EPOCHS,
    )

    print(f"\n✓ Deployed new model: {new_version} with accuracy {new_accuracy:.4f}")

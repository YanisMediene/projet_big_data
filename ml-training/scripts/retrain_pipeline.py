"""
Active Learning Retraining Pipeline
Fetches user drawings from Firestore, merges with Quick Draw dataset,
fine-tunes the CNN model, and deploys new version to Firebase Storage

**Trigger Conditions:**
- At least 500 NEW drawings since last training
- Called by Cloud Scheduler weekly (or manually via admin endpoint)
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
import base64
from io import BytesIO
from PIL import Image

# Firebase Admin
import firebase_admin
from firebase_admin import credentials, firestore, storage

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class ActiveLearningPipeline:
    """
    Active Learning Pipeline for model retraining using user drawings.
    
    **Key Features:**
    - Checks minimum 500 new drawings threshold before training
    - Loads user drawings from Firestore (base64 format)
    - Merges with original Quick Draw dataset
    - Fine-tunes existing model
    - Validates improvement before deploying
    - Marks drawings as used after successful training
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
        
        # Categories will be loaded from metadata
        self.categories = []
        self.category_to_idx = {}
        
        # Track drawings used in this training
        self._drawings_used = []

    def load_categories_from_metadata(self, model_version: str = "v4.0.0"):
        """Load categories from model metadata file."""
        try:
            metadata_path = f"../../backend/models/quickdraw_{model_version}_metadata.json"
            if os.path.exists(metadata_path):
                with open(metadata_path, "r") as f:
                    metadata = json.load(f)
                    self.categories = metadata.get("categories", [])
                    self.category_to_idx = {cat.lower(): idx for idx, cat in enumerate(self.categories)}
                    print(f"✅ Loaded {len(self.categories)} categories from metadata")
            else:
                print(f"⚠️ Metadata not found, using default 50 categories")
                # Fallback to default categories
                self._load_default_categories()
        except Exception as e:
            print(f"⚠️ Error loading categories: {e}")
            self._load_default_categories()
    
    def _load_default_categories(self):
        """Load default 50 categories."""
        self.categories = [
            "cat", "dog", "fish", "bird", "butterfly", "elephant", "horse", "rabbit", "shark", "bee",
            "bear", "frog", "apple", "banana", "pizza", "hamburger", "cake", "ice cream", "carrot", "pineapple",
            "airplane", "car", "bicycle", "train", "bus", "sailboat", "tree", "flower", "sun", "cloud",
            "mountain", "rainbow", "book", "chair", "cup", "telephone", "clock", "key", "umbrella", "shoe",
            "camera", "guitar", "circle", "star", "moon", "smiley_face", "house", "castle", "lighthouse", "the eiffel tower"
        ]
        self.category_to_idx = {cat.lower(): idx for idx, cat in enumerate(self.categories)}

    def check_training_threshold(self, min_drawings: int = 500) -> dict:
        """
        Check if there are enough new drawings to trigger retraining.
        
        Args:
            min_drawings: Minimum number of new drawings required
            
        Returns:
            Dict with threshold check results
        """
        print(f"\n🔍 Checking training threshold (min: {min_drawings} drawings)...")
        
        # Count new (unused) drawings
        query = (
            self.db.collection("user_drawings")
            .where("usedForTraining", "==", False)
        )
        
        new_count = sum(1 for _ in query.stream())
        
        # Get last training info
        last_training = self._get_last_training_info()
        
        result = {
            "new_drawings_count": new_count,
            "min_required": min_drawings,
            "ready_for_training": new_count >= min_drawings,
            "last_training": last_training
        }
        
        print(f"   New drawings available: {new_count}")
        print(f"   Minimum required: {min_drawings}")
        print(f"   Ready for training: {'✅ Yes' if result['ready_for_training'] else '❌ No'}")
        
        if last_training:
            print(f"   Last training: {last_training.get('completedAt', 'Unknown')}")
        
        return result

    def _get_last_training_info(self) -> dict:
        """Get info about the last training run."""
        try:
            query = (
                self.db.collection("training_runs")
                .order_by("completedAt", direction=firestore.Query.DESCENDING)
                .limit(1)
            )
            
            for doc in query.stream():
                return doc.to_dict()
            
            return None
        except Exception as e:
            print(f"⚠️ Error getting last training info: {e}")
            return None

    def fetch_user_drawings(self, limit: int = 5000) -> list:
        """
        Fetch user drawings from Firestore (new collection format).

        Args:
            limit: Maximum number of drawings to fetch

        Returns:
            List of drawing documents
        """
        print(f"\n📥 Fetching user drawings from Firestore (limit: {limit})...")

        query = (
            self.db.collection("user_drawings")
            .where("usedForTraining", "==", False)
            .limit(limit)
        )

        drawings = []
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            drawings.append(data)

        print(f"✓ Found {len(drawings)} user drawings")
        
        # Store IDs for marking as used later
        self._drawings_used = [d["id"] for d in drawings]

        return drawings

    def process_user_drawings(self, drawings: list) -> tuple:
        """
        Process user drawings from Firestore (base64 format).

        Args:
            drawings: List of drawing documents from Firestore

        Returns:
            Tuple of (images, labels) as numpy arrays
        """
        print(f"\n🔄 Processing {len(drawings)} user drawings...")

        images = []
        labels = []
        category_counts = {}

        for i, drawing in enumerate(drawings):
            try:
                # Get base64 image data
                img_base64 = drawing.get("imageBase64", "")
                if not img_base64:
                    continue
                
                # Decode base64
                img_bytes = base64.b64decode(img_base64)
                img = Image.open(BytesIO(img_bytes)).convert("L")
                
                # Ensure 28x28
                if img.size != (28, 28):
                    img = img.resize((28, 28), Image.LANCZOS)
                
                # Convert to numpy array and normalize
                img_array = np.array(img, dtype=np.float32) / 255.0
                
                # Get label
                category = drawing.get("targetCategory", "").lower()
                if category not in self.category_to_idx:
                    print(f"⚠️ Unknown category '{category}', skipping")
                    continue
                
                label_idx = self.category_to_idx[category]
                
                images.append(img_array)
                labels.append(label_idx)
                
                # Track category distribution
                category_counts[category] = category_counts.get(category, 0) + 1

                if (i + 1) % 500 == 0:
                    print(f"   Processed {i + 1}/{len(drawings)} drawings")

            except Exception as e:
                print(f"⚠️ Error processing drawing {drawing.get('id')}: {e}")
                continue

        print(f"✓ Processed {len(images)} valid drawings")
        print(f"   Category distribution: {len(category_counts)} categories")
        
        # Show top categories
        sorted_cats = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        for cat, count in sorted_cats:
            print(f"      {cat}: {count}")

        # Convert to numpy arrays
        X = np.array(images).reshape(-1, 28, 28, 1)
        y = np.array(labels)

        return X, y

    def load_original_dataset(self, dataset_path: str = "../data/quickdraw_50cat.h5"):
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

    def merge_datasets(self, X_original, y_original, X_user, y_user, user_weight: int = 3):
        """
        Merge original dataset with user drawings.
        User drawings are weighted more heavily to prioritize recent data.

        Args:
            X_original: Original images
            y_original: Original labels
            X_user: User drawing images
            y_user: User drawing labels
            user_weight: How many times to duplicate user drawings (default 3x)

        Returns:
            Tuple of (X_combined, y_combined)
        """
        print(f"\n🔀 Merging datasets (user weight: {user_weight}x)...")
        print(f"   Original:    {X_original.shape}")
        print(f"   User:        {X_user.shape}")

        # Duplicate user drawings to increase their weight
        X_user_weighted = np.tile(X_user, (user_weight, 1, 1, 1))
        y_user_weighted = np.tile(y_user, user_weight)

        X_combined = np.concatenate([X_original, X_user_weighted], axis=0)
        y_combined = np.concatenate([y_original, y_user_weighted], axis=0)
        
        # Shuffle the combined dataset
        indices = np.random.permutation(len(X_combined))
        X_combined = X_combined[indices]
        y_combined = y_combined[indices]

        print(f"✓ Combined:     {X_combined.shape}")
        print(f"   Added {len(X_user) * user_weight:,} weighted user samples")

        return X_combined, y_combined

    def load_current_model(self, model_path: str = "../../backend/models/quickdraw_v4.0.0.h5"):
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

        # Freeze early convolutional layers (only retrain later layers)
        for layer in model.layers[:6]:  # Freeze first 6 layers
            layer.trainable = False

        # Compile with low learning rate
        model.compile(
            optimizer=Adam(learning_rate=learning_rate),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )

        # Train with sparse categorical (not one-hot)
        history = model.fit(
            X_train,
            y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=batch_size,
            verbose=1,
        )

        print(f"✓ Fine-tuning complete")

        return model, history
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

        # Evaluate with sparse labels
        test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)

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

    def save_model(self, model, version: str, save_dir: str = "../../backend/models"):
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

    def mark_drawings_as_used(self):
        """Mark user drawings as used for training."""
        if not self._drawings_used:
            return 0
        
        print(f"\n📝 Marking {len(self._drawings_used)} drawings as used...")
        
        batch = self.db.batch()
        count = 0
        
        for drawing_id in self._drawings_used:
            doc_ref = self.db.collection("user_drawings").document(drawing_id)
            batch.update(doc_ref, {"usedForTraining": True})
            count += 1
            
            if count % 500 == 0:
                batch.commit()
                batch = self.db.batch()
        
        if count % 500 != 0:
            batch.commit()
        
        print(f"✓ Marked {count} drawings as used")
        return count

    def save_training_run(self, metadata: dict):
        """Save training run info to Firestore."""
        try:
            doc_ref = self.db.collection("training_runs").document()
            doc_ref.set({
                **metadata,
                "completedAt": firestore.SERVER_TIMESTAMP
            })
            print(f"✓ Training run saved: {doc_ref.id}")
        except Exception as e:
            print(f"⚠️ Error saving training run: {e}")

    def run_pipeline(
        self,
        min_drawings: int = 500,
        current_version: str = "v4.0.0",
        current_accuracy: float = 0.90,
        epochs: int = 5,
        force: bool = False
    ):
        """
        Execute complete retraining pipeline

        Args:
            min_drawings: Minimum drawings required to trigger training
            current_version: Current model version
            current_accuracy: Current model accuracy
            epochs: Training epochs
            force: Force training even if threshold not met

        Returns:
            Tuple of (new_version, new_accuracy) or None if not trained
        """
        print("=" * 60)
        print("🚀 ACTIVE LEARNING RETRAINING PIPELINE")
        print("=" * 60)

        try:
            # Load categories from metadata
            self.load_categories_from_metadata(current_version)
            
            # 1. Check threshold
            threshold_check = self.check_training_threshold(min_drawings)
            
            if not threshold_check["ready_for_training"] and not force:
                print("\n⏸️  Not enough new drawings for retraining.")
                print(f"   Current: {threshold_check['new_drawings_count']}")
                print(f"   Required: {min_drawings}")
                print("   Use force=True to override.")
                return None
            
            # 2. Fetch user drawings
            drawings = self.fetch_user_drawings(limit=5000)
            
            if len(drawings) < min_drawings and not force:
                print(f"\n⏸️  Only {len(drawings)} drawings available, need {min_drawings}")
                return None

            # 3. Process user drawings
            X_user, y_user = self.process_user_drawings(drawings)

            # 4. Load original dataset
            X_train, y_train, X_val, y_val, X_test, y_test = (
                self.load_original_dataset()
            )

            # 5. Merge datasets (user drawings weighted 3x)
            X_train_merged, y_train_merged = self.merge_datasets(
                X_train, y_train, X_user, y_user, user_weight=3
            )

            # 6. Load current model
            model = self.load_current_model()

            # 7. Fine-tune
            model, history = self.fine_tune_model(
                model, X_train_merged, y_train_merged, X_val, y_val, epochs=epochs
            )

            # 8. Validate
            new_accuracy = self.validate_model(model, X_test, y_test, current_accuracy)

            # 9. Increment version
            new_version = self.increment_version(current_version)

            # 10. Save model
            model_path = self.save_model(model, new_version)

            # 11. Save metadata locally
            metadata = {
                "test_accuracy": float(new_accuracy),
                "test_loss": float(history.history["val_loss"][-1]),
                "training_samples": int(len(X_train_merged)),
                "user_drawings_used": int(len(X_user)),
                "epochs": epochs,
                "previous_version": current_version,
                "previous_accuracy": current_accuracy,
                "categories": self.categories,
                "num_classes": len(self.categories)
            }
            
            metadata_path = os.path.join(
                os.path.dirname(model_path),
                f"quickdraw_{new_version}_metadata.json"
            )
            with open(metadata_path, "w") as f:
                json.dump(metadata, f, indent=2)
            print(f"✓ Metadata saved: {metadata_path}")

            # 12. Upload to Firebase
            self.upload_to_storage(model_path, new_version, metadata)
            
            # 13. Mark drawings as used
            self.mark_drawings_as_used()
            
            # 14. Save training run info
            self.save_training_run({
                "version": new_version,
                "accuracy": new_accuracy,
                "drawingsUsed": len(X_user),
                "previousVersion": current_version
            })

            print("\n" + "=" * 60)
            print("✅ RETRAINING PIPELINE COMPLETED SUCCESSFULLY")
            print("=" * 60)
            print(f"   New Version: {new_version}")
            print(f"   Accuracy:    {new_accuracy:.4f} ({new_accuracy * 100:.2f}%)")
            print(f"   Improvement: {(new_accuracy - current_accuracy) * 100:+.2f}%")
            print(f"   User Drawings Used: {len(X_user)}")
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
    MIN_DRAWINGS = 500  # Minimum new drawings required
    CURRENT_VERSION = "v4.0.0"
    CURRENT_ACCURACY = 0.90  # 90%
    EPOCHS = 5
    FORCE = False  # Set to True to force training even without enough drawings

    # Run pipeline
    pipeline = ActiveLearningPipeline(service_account_path=SERVICE_ACCOUNT_PATH)

    result = pipeline.run_pipeline(
        min_drawings=MIN_DRAWINGS,
        current_version=CURRENT_VERSION,
        current_accuracy=CURRENT_ACCURACY,
        epochs=EPOCHS,
        force=FORCE
    )

    if result:
        new_version, new_accuracy = result
        print(f"\n✓ Deployed new model: {new_version} with accuracy {new_accuracy:.4f}")
    else:
        print(f"\n⏸️ Training skipped - not enough new drawings (need {MIN_DRAWINGS})")


"""
Train CNN Model for Quick Draw Classification - Version 4
Supports dynamic number of categories and integration with user drawings from Firestore

Features:
- Support for 50+ categories (dynamically loaded)
- Integration with Firestore user_drawings collection
- Fusion of Quick Draw dataset + user drawings
- Weighted training to prioritize user drawings (3x weight)
- Model versioning and metadata generation
"""

import os
import sys
import h5py
import numpy as np
import json
import base64
from io import BytesIO
from PIL import Image
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, classification_report
from datetime import datetime
import seaborn as sns

# TensorFlow imports
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"  # Suppress TF warnings
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

# Firebase imports (optional - for loading user drawings)
try:
    import firebase_admin
    from firebase_admin import credentials, firestore

    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("⚠️  Firebase not available - training without user drawings")

print("=" * 80)
print("Quick Draw CNN Training - Version 4.0")
print("=" * 80)
print(f"TensorFlow version: {tf.__version__}")
print(f"GPU available: {tf.config.list_physical_devices('GPU')}")
print("=" * 80)


class QuickDrawTrainerV4:
    """
    Advanced trainer for Quick Draw classification with user drawing integration.
    """

    def __init__(
        self,
        data_path: str = "../data/quickdraw_50cat.h5",
        model_save_dir: str = "../../backend/models",
        version: str = "v4.0.0",
        service_account_path: str = None,
    ):
        """
        Initialize the trainer.

        Args:
            data_path: Path to HDF5 dataset
            model_save_dir: Directory to save trained models
            version: Model version string
            service_account_path: Path to Firebase service account for user drawings
        """
        self.data_path = data_path
        self.model_save_dir = model_save_dir
        self.version = version
        self.service_account_path = service_account_path

        # Training hyperparameters
        self.batch_size = 128
        self.epochs = 20
        self.learning_rate = 0.001

        # Will be set after loading data
        self.categories = []
        self.num_classes = 0
        self.model = None

        # Initialize Firebase if available
        self.db = None
        if (
            FIREBASE_AVAILABLE
            and service_account_path
            and os.path.exists(service_account_path)
        ):
            self._init_firebase(service_account_path)

    def _init_firebase(self, service_account_path: str):
        """Initialize Firebase connection."""
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            print("✅ Firebase initialized for user drawings")
        except Exception as e:
            print(f"⚠️  Firebase initialization failed: {e}")
            self.db = None

    def load_dataset(self) -> tuple:
        """
        Load the Quick Draw HDF5 dataset.

        Returns:
            Tuple of (X_train, y_train, X_val, y_val, X_test, y_test)
        """
        print(f"\n📂 Loading dataset from: {self.data_path}")

        with h5py.File(self.data_path, "r") as f:
            X_train = f["train/images"][:]
            y_train = f["train/labels"][:]
            X_val = f["val/images"][:]
            y_val = f["val/labels"][:]
            X_test = f["test/images"][:]
            y_test = f["test/labels"][:]

            # Load categories if available in dataset
            if "categories" in f.attrs:
                self.categories = list(f.attrs["categories"])
            elif "metadata" in f and "categories" in f["metadata"]:
                self.categories = list(f["metadata/categories"][:])

        self.num_classes = len(np.unique(y_train))

        print(f"✓ Dataset loaded")
        print(f"  Train: {X_train.shape[0]:,} samples")
        print(f"  Val:   {X_val.shape[0]:,} samples")
        print(f"  Test:  {X_test.shape[0]:,} samples")
        print(f"  Classes: {self.num_classes}")

        return X_train, y_train, X_val, y_val, X_test, y_test

    def load_user_drawings(self, limit: int = 5000) -> tuple:
        """
        Load user drawings from Firestore.

        Args:
            limit: Maximum number of drawings to load

        Returns:
            Tuple of (images, labels) as numpy arrays, or (None, None) if unavailable
        """
        if not self.db:
            print("⚠️  Firebase not available - skipping user drawings")
            return None, None

        print(f"\n📥 Loading user drawings from Firestore (limit: {limit})...")

        try:
            query = (
                self.db.collection("user_drawings")
                .where("usedForTraining", "==", False)
                .limit(limit)
            )

            images = []
            labels = []
            drawing_ids = []

            for doc in query.stream():
                data = doc.to_dict()

                # Decode base64 image
                try:
                    img_base64 = data.get("imageBase64", "")
                    if not img_base64:
                        continue

                    # Decode and convert to numpy array
                    img_bytes = base64.b64decode(img_base64)
                    img = Image.open(BytesIO(img_bytes)).convert("L")
                    img_array = np.array(img, dtype=np.float32)

                    # Ensure 28x28
                    if img_array.shape != (28, 28):
                        img = img.resize((28, 28), Image.LANCZOS)
                        img_array = np.array(img, dtype=np.float32)

                    # Normalize to [0, 1]
                    img_array = img_array / 255.0

                    # Get label
                    category = data.get("targetCategory", "").lower()
                    if category in self.categories:
                        label_idx = self.categories.index(category)
                    else:
                        # Skip unknown categories
                        continue

                    images.append(img_array)
                    labels.append(label_idx)
                    drawing_ids.append(doc.id)

                except Exception as e:
                    print(f"⚠️  Error processing drawing {doc.id}: {e}")
                    continue

            if len(images) == 0:
                print("⚠️  No valid user drawings found")
                return None, None

            # Convert to numpy arrays
            X_user = np.array(images).reshape(-1, 28, 28, 1)
            y_user = np.array(labels)

            print(f"✓ Loaded {len(images)} user drawings")

            # Store drawing IDs for later marking as used
            self._user_drawing_ids = drawing_ids

            return X_user, y_user

        except Exception as e:
            print(f"❌ Error loading user drawings: {e}")
            return None, None

    def merge_datasets(
        self,
        X_original: np.ndarray,
        y_original: np.ndarray,
        X_user: np.ndarray,
        y_user: np.ndarray,
        user_weight: int = 3,
    ) -> tuple:
        """
        Merge original dataset with user drawings.
        User drawings are duplicated to increase their weight in training.

        Args:
            X_original: Original training images
            y_original: Original training labels
            X_user: User drawing images
            y_user: User drawing labels
            user_weight: How many times to duplicate user drawings

        Returns:
            Tuple of (X_merged, y_merged)
        """
        print(f"\n🔀 Merging datasets (user weight: {user_weight}x)...")
        print(f"   Original: {X_original.shape}")
        print(f"   User:     {X_user.shape}")

        # Duplicate user drawings to increase weight
        X_user_weighted = np.tile(X_user, (user_weight, 1, 1, 1))
        y_user_weighted = np.tile(y_user, user_weight)

        # Merge
        X_merged = np.concatenate([X_original, X_user_weighted], axis=0)
        y_merged = np.concatenate([y_original, y_user_weighted], axis=0)

        # Shuffle
        indices = np.random.permutation(len(X_merged))
        X_merged = X_merged[indices]
        y_merged = y_merged[indices]

        print(f"✓ Merged:   {X_merged.shape}")
        print(f"   Added {len(X_user) * user_weight:,} user samples")

        return X_merged, y_merged

    def build_model(self) -> keras.Model:
        """
        Build the CNN model architecture.

        Returns:
            Compiled Keras model
        """
        print(f"\n🏗️  Building CNN model for {self.num_classes} classes...")

        model = keras.Sequential(
            [
                # Input layer
                layers.Input(shape=(28, 28, 1)),
                # Conv Block 1
                layers.Conv2D(
                    32, (3, 3), activation="relu", padding="same", name="conv1_1"
                ),
                layers.Conv2D(
                    32, (3, 3), activation="relu", padding="same", name="conv1_2"
                ),
                layers.MaxPooling2D((2, 2), name="pool1"),
                layers.BatchNormalization(name="bn1"),
                # Conv Block 2
                layers.Conv2D(
                    64, (3, 3), activation="relu", padding="same", name="conv2_1"
                ),
                layers.Conv2D(
                    64, (3, 3), activation="relu", padding="same", name="conv2_2"
                ),
                layers.MaxPooling2D((2, 2), name="pool2"),
                layers.BatchNormalization(name="bn2"),
                # Conv Block 3
                layers.Conv2D(
                    128, (3, 3), activation="relu", padding="same", name="conv3_1"
                ),
                layers.Conv2D(
                    128, (3, 3), activation="relu", padding="same", name="conv3_2"
                ),
                layers.MaxPooling2D((2, 2), name="pool3"),
                layers.BatchNormalization(name="bn3"),
                # Flatten and Dense
                layers.Flatten(name="flatten"),
                layers.Dense(256, activation="relu", name="dense1"),
                layers.Dropout(0.5, name="dropout1"),
                layers.Dense(128, activation="relu", name="dense2"),
                layers.Dropout(0.3, name="dropout2"),
                # Output
                layers.Dense(self.num_classes, activation="softmax", name="output"),
            ],
            name="QuickDrawCNN_v4",
        )

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=self.learning_rate),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )

        print("\n📋 Model Summary:")
        model.summary()

        self.model = model
        return model

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
    ) -> keras.callbacks.History:
        """
        Train the model.

        Args:
            X_train: Training images
            y_train: Training labels
            X_val: Validation images
            y_val: Validation labels

        Returns:
            Training history
        """
        print(f"\n🚀 Starting training...")
        print(f"   Batch size: {self.batch_size}")
        print(f"   Epochs: {self.epochs}")
        print(f"   Learning rate: {self.learning_rate}")
        print("=" * 80)

        model_path = os.path.join(self.model_save_dir, f"quickdraw_{self.version}.h5")

        callbacks = [
            EarlyStopping(
                monitor="val_loss", patience=5, restore_best_weights=True, verbose=1
            ),
            ModelCheckpoint(
                model_path, monitor="val_accuracy", save_best_only=True, verbose=1
            ),
            ReduceLROnPlateau(
                monitor="val_loss", factor=0.5, patience=3, min_lr=1e-6, verbose=1
            ),
        ]

        history = self.model.fit(
            X_train,
            y_train,
            batch_size=self.batch_size,
            epochs=self.epochs,
            validation_data=(X_val, y_val),
            callbacks=callbacks,
            verbose=1,
        )

        print("\n" + "=" * 80)
        print("✅ Training complete!")
        print("=" * 80)

        return history

    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> dict:
        """
        Evaluate the model on test set.

        Args:
            X_test: Test images
            y_test: Test labels

        Returns:
            Dictionary with evaluation metrics
        """
        print("\n📊 Evaluating on test set...")

        test_loss, test_accuracy = self.model.evaluate(X_test, y_test, verbose=0)

        print(f"  Test Loss: {test_loss:.4f}")
        print(f"  Test Accuracy: {test_accuracy * 100:.2f}%")

        return {"test_loss": float(test_loss), "test_accuracy": float(test_accuracy)}

    def save_metadata(self, metrics: dict, user_drawings_count: int = 0):
        """
        Save model metadata JSON file.

        Args:
            metrics: Dictionary with test metrics
            user_drawings_count: Number of user drawings used in training
        """
        metadata = {
            "version": self.version,
            "created_at": datetime.now().isoformat(),
            "test_accuracy": metrics["test_accuracy"],
            "categories": self.categories,
            "num_classes": self.num_classes,
            "user_drawings_used": user_drawings_count,
            "architecture": "QuickDrawCNN_v4",
        }

        metadata_path = os.path.join(
            self.model_save_dir, f"quickdraw_{self.version}_metadata.json"
        )

        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        print(f"✓ Metadata saved: {metadata_path}")

    def mark_drawings_as_used(self):
        """Mark user drawings as used in Firestore."""
        if not self.db or not hasattr(self, "_user_drawing_ids"):
            return

        print(f"\n📝 Marking {len(self._user_drawing_ids)} drawings as used...")

        batch = self.db.batch()
        count = 0

        for drawing_id in self._user_drawing_ids:
            doc_ref = self.db.collection("user_drawings").document(drawing_id)
            batch.update(doc_ref, {"usedForTraining": True})
            count += 1

            if count % 500 == 0:
                batch.commit()
                batch = self.db.batch()

        if count % 500 != 0:
            batch.commit()

        print(f"✓ Marked {count} drawings as used")

    def run_full_training(self, include_user_drawings: bool = True) -> dict:
        """
        Run the complete training pipeline.

        Args:
            include_user_drawings: Whether to include user drawings from Firestore

        Returns:
            Dictionary with training results
        """
        # Load dataset
        X_train, y_train, X_val, y_val, X_test, y_test = self.load_dataset()

        # Load user drawings if requested
        user_drawings_count = 0
        if include_user_drawings:
            X_user, y_user = self.load_user_drawings()

            if X_user is not None and len(X_user) > 0:
                user_drawings_count = len(X_user)
                X_train, y_train = self.merge_datasets(
                    X_train, y_train, X_user, y_user, user_weight=3
                )

        # Build model
        self.build_model()

        # Train
        history = self.train(X_train, y_train, X_val, y_val)

        # Evaluate
        metrics = self.evaluate(X_test, y_test)

        # Save metadata
        self.save_metadata(metrics, user_drawings_count)

        # Mark drawings as used
        if include_user_drawings and user_drawings_count > 0:
            self.mark_drawings_as_used()

        return {
            "version": self.version,
            "metrics": metrics,
            "user_drawings_used": user_drawings_count,
            "history": history.history,
        }


def main():
    """Main entry point for training."""
    # Configuration
    DATA_PATH = "../data/quickdraw_50cat.h5"
    MODEL_SAVE_DIR = "../../backend/models"
    VERSION = "v4.0.0"
    SERVICE_ACCOUNT_PATH = "../../backend/serviceAccountKey.json"

    # Check if data exists
    if not os.path.exists(DATA_PATH):
        print(f"❌ Dataset not found: {DATA_PATH}")
        print("   Please run the data preparation script first.")
        sys.exit(1)

    # Create trainer
    trainer = QuickDrawTrainerV4(
        data_path=DATA_PATH,
        model_save_dir=MODEL_SAVE_DIR,
        version=VERSION,
        service_account_path=SERVICE_ACCOUNT_PATH,
    )

    # Run training
    results = trainer.run_full_training(include_user_drawings=True)

    print("\n" + "=" * 80)
    print("🎉 TRAINING COMPLETE!")
    print("=" * 80)
    print(f"   Version: {results['version']}")
    print(f"   Test Accuracy: {results['metrics']['test_accuracy'] * 100:.2f}%")
    print(f"   User Drawings Used: {results['user_drawings_used']}")
    print("=" * 80)


if __name__ == "__main__":
    main()

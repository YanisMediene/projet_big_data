"""
Train CNN Model for Quick Draw Classification
"""

import os
import sys
import h5py
import numpy as np
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, classification_report
import seaborn as sns

# TensorFlow imports
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Suppress TF warnings
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

print("=" * 80)
print("Quick Draw CNN Training")
print("=" * 80)
print(f"TensorFlow version: {tf.__version__}")
print(f"GPU available: {tf.config.list_physical_devices('GPU')}")
print("=" * 80)

# Configuration
DATA_PATH = '../ml-training/data/quickdraw_20cat.h5'
MODEL_SAVE_PATH = '../backend/models/quickdraw_v1.0.0.h5'
BATCH_SIZE = 128
EPOCHS = 15
LEARNING_RATE = 0.001

CATEGORIES = [
    'apple', 'sun', 'tree', 'house', 'car',
    'cat', 'fish', 'star', 'umbrella', 'flower',
    'moon', 'airplane', 'bicycle', 'clock', 'eye',
    'cup', 'shoe', 'cloud', 'lightning', 'smiley_face'
]

print(f"\n📂 Loading dataset from: {DATA_PATH}")

# Load HDF5 dataset
with h5py.File(DATA_PATH, 'r') as f:
    X_train = f['train/images'][:]
    y_train = f['train/labels'][:]
    X_val = f['val/images'][:]
    y_val = f['val/labels'][:]
    X_test = f['test/images'][:]
    y_test = f['test/labels'][:]

print(f"✓ Dataset loaded")
print(f"  Train: {X_train.shape[0]:,} samples")
print(f"  Val:   {X_val.shape[0]:,} samples")
print(f"  Test:  {X_test.shape[0]:,} samples")

# Verify data range
print(f"\n📊 Data statistics:")
print(f"  Train min: {X_train.min():.3f}, max: {X_train.max():.3f}")
print(f"  Labels range: {y_train.min()} - {y_train.max()}")

# Build Simple CNN model
print("\n🏗️  Building Simple CNN model...")

model = keras.Sequential([
    # Input layer
    layers.Input(shape=(28, 28, 1)),
    
    # Conv Block 1
    layers.Conv2D(32, (3, 3), activation='relu', padding='same', name='conv1'),
    layers.MaxPooling2D((2, 2), name='pool1'),
    
    # Conv Block 2
    layers.Conv2D(64, (3, 3), activation='relu', padding='same', name='conv2'),
    layers.MaxPooling2D((2, 2), name='pool2'),
    
    # Flatten and Dense
    layers.Flatten(name='flatten'),
    layers.Dropout(0.5, name='dropout'),
    layers.Dense(20, activation='softmax', name='output')
], name='SimpleCNN')

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=LEARNING_RATE),
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

print("\n📋 Model Summary:")
model.summary()

# Calculate total parameters
trainable_params = sum([tf.size(w).numpy() for w in model.trainable_weights])
print(f"\n📊 Total trainable parameters: {trainable_params:,}")

# Callbacks
print("\n⚙️  Setting up callbacks...")

callbacks = [
    EarlyStopping(
        monitor='val_loss',
        patience=3,
        restore_best_weights=True,
        verbose=1
    ),
    ModelCheckpoint(
        MODEL_SAVE_PATH,
        monitor='val_accuracy',
        save_best_only=True,
        verbose=1
    ),
    ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=2,
        min_lr=1e-6,
        verbose=1
    )
]

# Train model
print("\n🚀 Starting training...")
print(f"  Batch size: {BATCH_SIZE}")
print(f"  Epochs: {EPOCHS}")
print(f"  Learning rate: {LEARNING_RATE}")
print("=" * 80)

history = model.fit(
    X_train, y_train,
    batch_size=BATCH_SIZE,
    epochs=EPOCHS,
    validation_data=(X_val, y_val),
    callbacks=callbacks,
    verbose=1
)

print("\n" + "=" * 80)
print("✅ Training complete!")
print("=" * 80)

# Evaluate on test set
print("\n📊 Evaluating on test set...")
test_loss, test_accuracy = model.evaluate(X_test, y_test, verbose=0)
print(f"  Test Loss: {test_loss:.4f}")
print(f"  Test Accuracy: {test_accuracy * 100:.2f}%")

# Generate predictions for confusion matrix
print("\n🔍 Generating predictions for confusion matrix...")
y_pred_proba = model.predict(X_test, batch_size=BATCH_SIZE, verbose=0)
y_pred = np.argmax(y_pred_proba, axis=1)

# Classification report
print("\n📈 Classification Report:")
print(classification_report(y_test, y_pred, target_names=CATEGORIES, digits=3))

# Confusion matrix
print("\n📊 Generating confusion matrix...")
cm = confusion_matrix(y_test, y_pred)

# Save confusion matrix plot
plt.figure(figsize=(14, 12))
sns.heatmap(
    cm,
    annot=True,
    fmt='d',
    cmap='Blues',
    xticklabels=[cat.replace('_', ' ').title() for cat in CATEGORIES],
    yticklabels=[cat.replace('_', ' ').title() for cat in CATEGORIES],
    cbar_kws={'label': 'Count'}
)
plt.title('Confusion Matrix - Quick Draw CNN', fontsize=16, pad=20)
plt.xlabel('Predicted Category', fontsize=12)
plt.ylabel('True Category', fontsize=12)
plt.xticks(rotation=45, ha='right')
plt.yticks(rotation=0)
plt.tight_layout()

cm_path = os.path.join(os.path.dirname(MODEL_SAVE_PATH), 'confusion_matrix_v1.0.0.png')
plt.savefig(cm_path, dpi=150, bbox_inches='tight')
print(f"✓ Confusion matrix saved: {cm_path}")

# Training history plots
print("\n📊 Generating training history plots...")
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Accuracy plot
ax1.plot(history.history['accuracy'], label='Train Accuracy', linewidth=2)
ax1.plot(history.history['val_accuracy'], label='Val Accuracy', linewidth=2)
ax1.set_title('Model Accuracy', fontsize=14)
ax1.set_xlabel('Epoch', fontsize=12)
ax1.set_ylabel('Accuracy', fontsize=12)
ax1.legend(loc='lower right')
ax1.grid(True, alpha=0.3)

# Loss plot
ax2.plot(history.history['loss'], label='Train Loss', linewidth=2)
ax2.plot(history.history['val_loss'], label='Val Loss', linewidth=2)
ax2.set_title('Model Loss', fontsize=14)
ax2.set_xlabel('Epoch', fontsize=12)
ax2.set_ylabel('Loss', fontsize=12)
ax2.legend(loc='upper right')
ax2.grid(True, alpha=0.3)

plt.tight_layout()
history_path = os.path.join(os.path.dirname(MODEL_SAVE_PATH), 'training_history_v1.0.0.png')
plt.savefig(history_path, dpi=150, bbox_inches='tight')
print(f"✓ Training history saved: {history_path}")

# Model info
print("\n" + "=" * 80)
print("📦 Model Information")
print("=" * 80)
print(f"  Model version: v1.0.0")
print(f"  Model saved: {MODEL_SAVE_PATH}")
print(f"  Architecture: Simple CNN")
print(f"  Parameters: {trainable_params:,}")
print(f"  Input shape: (28, 28, 1)")
print(f"  Output classes: 20")
print(f"  Training samples: {X_train.shape[0]:,}")
print(f"  Test accuracy: {test_accuracy * 100:.2f}%")
print(f"  Test loss: {test_loss:.4f}")
print("=" * 80)

print("\n✅ All done! Model ready for deployment.")
print(f"\n💡 Next steps:")
print(f"  1. Start backend: cd backend && uvicorn main:app --reload")
print(f"  2. Test prediction: curl -X POST http://localhost:8000/predict -H 'Content-Type: application/json' -d '@test_image.json'")
print(f"  3. Open frontend: cd frontend && npm start")

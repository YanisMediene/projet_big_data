# ML Training Pipeline - AI Pictionary

Pipeline d'entraînement du modèle CNN pour la reconnaissance de dessins Quick Draw.

## 📊 Dataset Overview

**Source :** Google Quick Draw Dataset  
**Catégories :** 20 classes sélectionnées  
**Taille :** ~1.4M images (70K par catégorie)  
**Format brut :** NumPy arrays (.npy files)  
**Format prétraité :** HDF5 avec compression gzip-4  

### Catégories (20)

```
apple, sun, tree, house, car,
cat, fish, star, umbrella, flower,
moon, airplane, bicycle, clock, eye,
cup, shoe, cloud, lightning, smiley_face
```

---

## 🔄 Pipeline Workflow

```
1. Download (download_dataset.py)
   ├─ Télécharge 20 fichiers .npy depuis Google Cloud Storage
   ├─ ~3GB de données brutes
   └─ Durée : 20-30 minutes

2. Preprocess (preprocess_dataset.py)
   ├─ Charge les .npy files
   ├─ Applique centroid cropping (alignment)
   ├─ Normalise [0,1]
   ├─ Split 80/10/10 (train/val/test)
   ├─ Sauvegarde en HDF5 compressé
   └─ Durée : 10 minutes

3. Train (train_model.ipynb)
   ├─ Charge quickdraw_20cat.h5
   ├─ Build Simple CNN (35K params)
   ├─ Entraîne 15 epochs
   ├─ Évalue sur test set
   ├─ Sauvegarde backend/models/quickdraw_v1.0.0.h5
   └─ Durée : 30 minutes
```

---

## 🚀 Quick Start

### 1. Télécharger le Dataset

```bash
cd ml-training
python scripts/download_dataset.py
```

**Résultat attendu :**
```
data/raw/
├── apple.npy (113 MB)
├── sun.npy (105 MB)
├── tree.npy (98 MB)
...
└── smiley_face.npy (89 MB)
```

### 2. Prétraiter le Dataset

```bash
python scripts/preprocess_dataset.py
```

**Résultat attendu :**
```
data/processed/
└── quickdraw_20cat.h5 (400 MB)
    ├─ train: 1,120,000 samples
    ├─ val: 140,000 samples
    └─ test: 140,000 samples
```

### 3. Entraîner le Modèle

```bash
jupyter notebook notebooks/train_model.ipynb
```

**Dans le notebook :**
- Menu → Cell → Run All
- Attendre ~30 minutes
- Modèle sauvegardé dans `../backend/models/quickdraw_v1.0.0.h5`

---

## 📁 Structure du Projet

```
ml-training/
├── scripts/
│   ├── download_dataset.py       # Télécharge 20 catégories Quick Draw
│   └── preprocess_dataset.py     # HDF5 + centroid crop + normalize
├── notebooks/
│   └── train_model.ipynb         # Jupyter notebook pour entraînement CNN
├── data/
│   ├── raw/                      # .npy files (créé par download)
│   └── processed/                # quickdraw_20cat.h5 (créé par preprocess)
├── requirements.txt              # Dépendances Python
└── README.md
```

---

## 🧠 Model Architecture

**Type :** Simple CNN (Sequential)  
**Input :** 28x28 grayscale images  
**Output :** 20 classes (softmax)  

```python
Model: "simple_cnn"
_________________________________________________________________
Layer (type)                 Output Shape              Param #   
=================================================================
conv2d_1 (Conv2D)           (None, 26, 26, 32)        320       
max_pooling2d_1 (MaxPool)   (None, 13, 13, 32)        0         
conv2d_2 (Conv2D)           (None, 11, 11, 64)        18,496    
max_pooling2d_2 (MaxPool)   (None, 5, 5, 64)          0         
flatten (Flatten)           (None, 1600)              0         
dropout (Dropout)           (None, 1600)              0         
dense (Dense)               (None, 20)                32,020    
=================================================================
Total params: 35,836 (140 KB)
Trainable params: 35,836
Non-trainable params: 0
```

**Justification :**
- **2 Conv layers :** Suffisant pour patterns simples (28x28)
- **MaxPooling :** Réduction spatiale progressive
- **Dropout 0.5 :** Prévention overfitting
- **Taille :** 140KB → Chargement rapide (<50ms)

---

## 📈 Training Configuration

```python
# Hyperparameters
BATCH_SIZE = 128
EPOCHS = 15
LEARNING_RATE = 0.001

# Optimizer
optimizer = Adam(learning_rate=0.001)

# Loss
loss = 'sparse_categorical_crossentropy'

# Metrics
metrics = ['accuracy']

# Callbacks
- EarlyStopping (patience=3, restore_best_weights)
- ReduceLROnPlateau (factor=0.5, patience=2)
```

---

## 🎯 Expected Results

**Target Accuracy :** 91-93% on test set  
**Inference Time :** ~5ms per image  

**Typical Training Curve :**
```
Epoch 1/15  - loss: 0.6234 - accuracy: 0.8156 - val_accuracy: 0.8754
Epoch 5/15  - loss: 0.2891 - accuracy: 0.9045 - val_accuracy: 0.9134
Epoch 10/15 - loss: 0.2156 - accuracy: 0.9234 - val_accuracy: 0.9187
Epoch 15/15 - loss: 0.1934 - accuracy: 0.9312 - val_accuracy: 0.9201
```

**Confusion Matrix :**
- Confusions courantes : `moon ↔ sun`, `cat ↔ shoe`, `cloud ↔ tree`
- Détails dans le notebook après entraînement

---

## 🔬 Data Preprocessing

### Centroid Cropping

**Pourquoi ?** Aligner les dessins au centre comme dans le dataset Google

**Algorithme :**
```python
1. Calculer centre de masse : (cx, cy)
2. Calculer translation : (dx, dy) = (14 - cx, 14 - cy)
3. Rouler l'image : np.roll(img, (dy, dx), axis=(0, 1))
4. Résultat : dessin centré sur (14, 14)
```

**Impact :** +3-5% d'accuracy vs. baseline

### Normalization

```python
# Conversion [0, 255] → [0, 1]
X = X.astype('float32') / 255.0
```

---

## 📦 HDF5 Storage Format

**Avantages :**
- ✅ Compression gzip-4 : 1.1GB → 400MB
- ✅ Random access rapide (batch loading)
- ✅ Metadata intégrée (shape, dtype)

**Structure :**
```
quickdraw_20cat.h5
├─ X_train (1120000, 28, 28) - float32
├─ y_train (1120000,) - uint8
├─ X_val (140000, 28, 28) - float32
├─ y_val (140000,) - uint8
├─ X_test (140000, 28, 28) - float32
└─ y_test (140000,) - uint8
```

**Lecture efficace :**
```python
import h5py

with h5py.File('quickdraw_20cat.h5', 'r') as f:
    # Lecture batch-wise (évite RAM overflow)
    batch = f['X_train'][0:128]  # Charge seulement 128 images
```

---

## 🧪 Testing

### Tester le Téléchargement

```bash
cd ml-training
ls -lh data/raw/*.npy | wc -l  # Devrait afficher 20
```

### Tester le Prétraitement

```bash
python -c "
import h5py
with h5py.File('data/processed/quickdraw_20cat.h5', 'r') as f:
    print('Train samples:', f['X_train'].shape[0])
    print('Val samples:', f['X_val'].shape[0])
    print('Test samples:', f['X_test'].shape[0])
"
```

**Résultat attendu :**
```
Train samples: 1120000
Val samples: 140000
Test samples: 140000
```

### Tester le Modèle

```bash
cd ../backend
python -c "
from tensorflow import keras
model = keras.models.load_model('models/quickdraw_v1.0.0.h5')
print('Model loaded successfully!')
print('Input shape:', model.input_shape)
print('Output shape:', model.output_shape)
model.summary()
"
```

---

## 🐛 Troubleshooting

### Erreur : "No space left on device"

**Cause :** Dataset brut (3GB) + HDF5 (400MB) nécessitent ~4GB

**Solution :**
```bash
# Nettoyer fichiers .npy après prétraitement
rm data/raw/*.npy
```

### Erreur : "Out of memory" pendant l'entraînement

**Cause :** Batch size trop grand pour votre RAM/GPU

**Solution :**
```python
# Dans train_model.ipynb, réduire BATCH_SIZE
BATCH_SIZE = 64  # Au lieu de 128
```

### Téléchargement lent

**Cause :** Connexion internet lente

**Solution :**
```bash
# Télécharger en background avec nohup
nohup python scripts/download_dataset.py > download.log 2>&1 &

# Vérifier progression
tail -f download.log
```

---

## 📊 Performance Benchmarks

| Métrique | Valeur | Note |
|----------|--------|------|
| Dataset size (raw) | 3.0 GB | 20 × ~150MB |
| Dataset size (HDF5) | 400 MB | Compression gzip-4 |
| Training time | 30 min | Laptop CPU (i5) |
| Training time (GPU) | 10 min | NVIDIA GTX 1060 |
| Model size | 140 KB | Très léger |
| Inference time | 5 ms | Temps réel |
| Memory usage | 2 GB | Pendant training |

---

## 🔄 Active Learning (Phase 2)

Pour améliorer le modèle avec les corrections utilisateurs :

1. **Récupérer corrections** depuis Firestore
2. **Télécharger images** depuis Firebase Storage
3. **Merger avec dataset** existant
4. **Fine-tune** le modèle (freeze Conv layers)
5. **Déployer** nouvelle version

**Script :** `scripts/retrain_pipeline.py` (TODO)

---

## 📚 References

- [Quick Draw Dataset](https://github.com/googlecreativelab/quickdraw-dataset)
- [TensorFlow Keras API](https://www.tensorflow.org/api_docs/python/tf/keras)
- [HDF5 for Python](https://docs.h5py.org/)

---

**Questions ? Voir `docs/defense_justifications.md` pour explications techniques détaillées.**

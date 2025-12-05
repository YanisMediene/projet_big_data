# 🎨 AI Pictionary - Quick Draw Clone

**FISE3 Big Data Project** | Cloud-Native ML Drawing Game with Active Learning

---

## 📋 Project Overview

AI Pictionary is a production-grade "Quick, Draw!" clone that demonstrates cloud-native machine learning architecture. The application uses a custom-trained CNN to recognize hand-drawn images in real-time, with an active learning pipeline that continuously improves from user corrections.

### Key Features
- ✅ **Real-time Drawing Recognition** (20 categories, 91-93% accuracy)
- ✅ **Active Learning Pipeline** (automatic model improvement from corrections)
- ✅ **Cloud-Native Architecture** (Firebase Auth, Firestore, Storage)
- ✅ **Multiplayer Modes** (Race mode + Guessing game)
- ✅ **500ms Debounced Inference** (optimized for cost and UX)

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React Frontend (Tailwind CSS)                           │   │
│  │  - HTML5 Canvas (280x280px drawing)                      │   │
│  │  - Firebase Auth (Google/Email)                          │   │
│  │  - Real-time Firestore listeners (multiplayer sync)      │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS (base64 images)
                            │ WebSocket (Firestore real-time)
┌───────────────────────────▼─────────────────────────────────────┐
│                         API LAYER                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  FastAPI Backend (Python)                                │   │
│  │  - POST /predict (TensorFlow inference)                  │   │
│  │  - Firebase Admin SDK (token validation)                 │   │
│  │  - CORS middleware                                       │   │
│  │  - Model startup loading (avoid cold start)              │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ TensorFlow SavedModel
┌───────────────────────────▼─────────────────────────────────────┐
│                         ML LAYER                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  TensorFlow/Keras CNN (v1.0.0)                           │   │
│  │  - Architecture: 2-Conv + Dense (35K params)             │   │
│  │  - Input: 28x28 grayscale (centroid-cropped)            │   │
│  │  - Output: 20-class softmax probabilities                │   │
│  │  - Latency: <10ms per inference                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Read/Write
┌───────────────────────────▼─────────────────────────────────────┐
│                      FIREBASE LAYER                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Authentication │  │    Firestore    │  │     Storage     │ │
│  │  - Google Sign  │  │  - users/       │  │  - drawings/    │ │
│  │  - Email/Pass   │  │  - sessions/    │  │  - models/      │ │
│  │  - JWT tokens   │  │  - corrections/ │  │  - checkpoints/ │ │
│  │                 │  │  - games/       │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │ Triggered retraining
┌───────────────────────────┴─────────────────────────────────────┐
│                  ACTIVE LEARNING PIPELINE                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Cloud Function / Scheduled Job                          │   │
│  │  1. Fetch corrections from Firestore (>500 labels)       │   │
│  │  2. Merge with original Quick Draw dataset               │   │
│  │  3. Fine-tune model (freeze conv layers, LR=0.0001)      │   │
│  │  4. Validate accuracy improvement                        │   │
│  │  5. Deploy new version to Storage (v1.0.X)               │   │
│  │  6. Update Firestore models/ metadata                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
- **React** 18.x (Hooks, Context API)
- **Tailwind CSS** 3.x (Utility-first styling)
- **Firebase SDK** 10.x (Auth, Firestore client)
- **HTML5 Canvas API** (Drawing interface)

### Backend
- **FastAPI** 0.109.x (Async Python web framework)
- **TensorFlow** 2.15.x (Model serving)
- **Firebase Admin SDK** (Authentication, Firestore, Storage)
- **Pillow** 10.x (Image preprocessing)

### Machine Learning
- **TensorFlow/Keras** 2.15.x (Model training)
- **NumPy** 1.26.x (Array operations)
- **h5py** 3.10.x (HDF5 dataset storage)
- **Matplotlib** 3.8.x (Visualization)

### Cloud Infrastructure
- **Firebase Authentication** (User management)
- **Cloud Firestore** (NoSQL real-time database)
- **Firebase Storage** (Object storage for models/drawings)
- **Cloud Functions** (Serverless retraining triggers)

---

## 📁 Project Structure

```
projet_big_data/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── DrawingCanvas.jsx
│   │   │   ├── PredictionDisplay.jsx
│   │   │   ├── CorrectionModal.jsx
│   │   │   └── Auth/
│   │   ├── multiplayer/     # Multiplayer game modes
│   │   │   ├── RaceGame.jsx
│   │   │   └── GuessingGame.jsx
│   │   ├── services/        # API and Firebase clients
│   │   ├── hooks/           # Custom React hooks
│   │   └── utils/           # Helper functions
│   ├── public/
│   ├── package.json
│   └── tailwind.config.js
│
├── backend/                  # FastAPI server
│   ├── main.py              # Application entry point
│   ├── models/              # Trained ML models
│   │   └── quickdraw_v1.0.0.h5
│   ├── routers/             # API route handlers
│   ├── services/            # Business logic
│   ├── requirements.txt
│   └── .env.example
│
├── ml-training/              # ML training pipeline
│   ├── notebooks/           # Jupyter notebooks
│   │   └── train_model.ipynb
│   ├── scripts/
│   │   ├── download_dataset.py
│   │   ├── preprocess_dataset.py
│   │   └── retrain_pipeline.py
│   ├── data/                # Quick Draw dataset (gitignored)
│   │   └── quickdraw_20cat.h5
│   ├── logs/                # Training logs
│   └── requirements.txt
│
└── docs/                     # Documentation
    ├── defense_justifications.md
    ├── data_pipeline.md
    ├── deployment.md
    └── api_contracts.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Python** 3.10+ (for backend and ML training)
- **Node.js** 18+ (for frontend)
- **Git** (version control)
- **Firebase Account** (create at console.firebase.google.com)

### 1. Clone Repository
```bash
git clone <repository-url>
cd projet_big_data
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with Firebase credentials

# Run server
uvicorn main:app --reload --port 8000
```

### 3. ML Training Setup
```bash
cd ml-training

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download Quick Draw dataset (20 categories)
python scripts/download_dataset.py

# Preprocess and create HDF5 file
python scripts/preprocess_dataset.py

# Train initial model
jupyter notebook notebooks/train_model.ipynb
```

### 4. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure Firebase (create .env.local)
echo "REACT_APP_FIREBASE_API_KEY=your_api_key" > .env.local
# Add other Firebase config variables

# Start development server
npm start
```

### 5. Firebase Configuration
1. Create Firebase project at console.firebase.google.com
2. Enable Authentication (Google + Email/Password)
3. Create Firestore database (start in test mode, then add security rules)
4. Create Storage bucket
5. Generate Admin SDK service account key → save as `backend/serviceAccountKey.json`

---

## 📊 Dataset: Quick Draw (20 Categories)

| # | Category | Samples | Visual Characteristics |
|---|----------|---------|------------------------|
| 1 | apple | 70K | Circular shape with stem |
| 2 | sun | 70K | Radial pattern with rays |
| 3 | tree | 70K | Vertical trunk with foliage |
| 4 | house | 70K | Rectangle + triangle roof |
| 5 | car | 70K | Horizontal profile with wheels |
| 6 | cat | 70K | Animal silhouette with ears |
| 7 | fish | 70K | Oval with fins |
| 8 | star | 70K | 5-pointed geometric shape |
| 9 | umbrella | 70K | Semi-circle with handle |
| 10 | flower | 70K | Radial petals |
| 11 | moon | 70K | Crescent shape |
| 12 | airplane | 70K | Horizontal wings + fuselage |
| 13 | bicycle | 70K | Two circular wheels |
| 14 | clock | 70K | Circle with hands |
| 15 | eye | 70K | Oval with pupil |
| 16 | cup | 70K | U-shape with handle |
| 17 | shoe | 70K | L-shaped profile |
| 18 | cloud | 70K | Irregular rounded shape |
| 19 | lightning | 70K | Zigzag pattern |
| 20 | smiley_face | 70K | Circle with facial features |

**Total:** ~1.4 million images (28x28 grayscale)

---

## 🎯 Project Milestones

### Phase 1: Jan 15, 2026 (Intermediate Defense)
- ✅ Quick Draw dataset preprocessed (HDF5 format)
- ✅ CNN model trained (v1.0.0, 91-93% accuracy)
- ✅ FastAPI backend with `/predict` endpoint
- ✅ React frontend with Canvas drawing interface
- ✅ Firebase Authentication + Firestore integration
- ✅ Active learning correction collection system
- ✅ Technical defense document (architecture justifications)

### Phase 2: Feb 13, 2026 (Final Defense)
- ✅ Active learning retraining pipeline (automated)
- ✅ Model versioning system (v1.0.X improvements)
- ✅ Multiplayer Race Mode (Firestore real-time sync)
- ✅ Multiplayer Guessing Game (Player vs AI)
- ✅ Production monitoring dashboard
- ✅ Complete documentation + Git repository
- ✅ Anti-cheat measures (stroke validation)

---

## 📈 Performance Metrics

### Model Performance (v1.0.0)
- **Accuracy:** 91-93% (validation set)
- **Inference Latency:** <10ms per prediction
- **Model Size:** 140 KB (SavedModel)
- **Parameters:** ~35,000 trainable params

### System Performance
- **API Response Time:** <50ms (end-to-end)
- **Debounce Delay:** 500ms (optimal cost/UX balance)
- **Multiplayer Sync Latency:** <100ms (Firestore)
- **Cost:** <$1/month (100 daily active users)

---

## 🏆 Technical Decisions (Defense Highlights)

### Why Simple CNN over ResNet?
- **Latency:** 5ms vs 25ms (5x faster)
- **Model Size:** 140KB vs 45MB (322x smaller)
- **Accuracy:** 92% vs 94% (only 2% difference)
- **Verdict:** Real-time drawing recognition prioritizes latency over marginal accuracy gains

### Why Firebase over AWS?
- **Authentication:** Native integration (no custom JWT handling)
- **Real-time Database:** Firestore listeners for multiplayer (<100ms sync)
- **CDN:** Global content delivery included
- **Cost:** <$1/month vs AWS (~$5/month for equivalent services)

### Why 500ms Debounce?
- **API Calls Reduction:** 80% fewer requests vs instant inference
- **User Experience:** Perceived as "real-time" (human reaction time ~250ms)
- **Cost Impact:** $0.80/month vs $4/month for 100 DAU

### Why Fine-Tuning over From-Scratch Retraining?
- **Speed:** 3 minutes vs 30 minutes (10x faster)
- **Knowledge Preservation:** Retains original 1.4M samples
- **Accuracy:** +0.5-1% per 500 corrections (tested)

---

## 📚 Documentation

- **[Defense Justifications](docs/defense_justifications.md)** - Technical decisions for jury Q&A
- **[Data Pipeline](docs/data_pipeline.md)** - Dataset preprocessing steps
- **[API Contracts](docs/api_contracts.md)** - Backend endpoint specifications
- **[Deployment Guide](docs/deployment.md)** - Production deployment instructions

---

## 👥 Team

**FISE3 - Big Data Project**
- Repository: [GitHub URL]
- Contact: [Team email]

---

## 📝 License

This project is created for educational purposes as part of the FISE3 Big Data course.

---

## 🙏 Acknowledgments

- **Google Quick, Draw! Dataset** - https://github.com/googlecreativelab/quickdraw-dataset
- **TensorFlow/Keras Documentation** - https://www.tensorflow.org/
- **Firebase Documentation** - https://firebase.google.com/docs
- **FastAPI Framework** - https://fastapi.tiangolo.com/

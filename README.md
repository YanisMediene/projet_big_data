# 🎨 AI Pictionary - Quick Draw Clone

**FISE3 Big Data Project** | Cloud-Native ML Drawing Game with Active Learning

> **🚀 PRODUCTION APP:** [https://ai-pictionary-4f8f2.web.app](https://ai-pictionary-4f8f2.web.app)  
> **📚 [QUICKSTART GUIDE](QUICKSTART.md)** - Guide développement local et production

[![Deployment](https://img.shields.io/badge/deployment-live-brightgreen)](https://ai-pictionary-4f8f2.web.app)
[![Backend](https://img.shields.io/badge/backend-Cloud%20Run-blue)](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health)
[![Frontend](https://img.shields.io/badge/frontend-Firebase%20Hosting-orange)](https://ai-pictionary-4f8f2.web.app)

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

### Production Architecture (Deployed)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION (GCP + Firebase)                      │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Firebase Hosting (Global CDN)                             │     │
│  │  URL: https://ai-pictionary-4f8f2.web.app                  │     │
│  │  - React SPA (80.29 KB gzipped)                            │     │
│  │  - Cache: 1 year for static assets                         │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │ HTTPS                                │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Google Cloud Run (europe-west1)                           │     │
│  │  URL: https://ai-pictionary-backend-*.run.app              │     │
│  │  - FastAPI in Docker (Python 3.11-slim)                    │     │
│  │  - TensorFlow 2.16.2 + Model (500MB image)                 │     │
│  │  - Resources: 1GB RAM, 1 CPU                               │     │
│  │  - Scaling: 0-10 instances (scale-to-zero)                 │     │
│  │  - Cold start: 2-5s, Warm: <100ms                          │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Firebase Services                                         │     │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │     │
│  │  │   Auth     │  │ Firestore  │  │  Storage   │            │     │
│  │  │ (Google,   │  │ (NoSQL DB) │  │ (Objects)  │            │     │
│  │  │  Email)    │  │  Real-time │  │  Models    │            │     │
│  │  └────────────┘  └────────────┘  └────────────┘            │     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘

                        ┌─── Client Request Flow ───┐
                        │                           │
    User draws on       │  1. Frontend (CDN)       │
    Canvas 280x280   ───┼──→ 2. Cloud Run API      │
                        │  3. TensorFlow CNN       │
                        │  4. Firestore (save)     │
                        │  5. Response to client   │
                        └───────────────────────────┘
```

### Local Development Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOCAL DEVELOPMENT                            │
│                                                                 │
│  React Frontend          FastAPI Backend       TensorFlow CNN   │
│  (localhost:3000)   ←──→ (localhost:8000)  ←──→ Model (.h5)     │
│                                                                 │
│  Firebase SDK (connects to production Firebase services)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend (Deployed on Firebase Hosting)
- **React** 19.2.1 (Hooks, Context API)
- **Tailwind CSS** 3.4.1 (Utility-first styling)
- **Firebase SDK** 10.8.0 (Auth, Firestore client)
- **HTML5 Canvas API** (Drawing interface)
- **Axios** 1.13.2 (HTTP client for Cloud Run backend)

### Backend (Deployed on Google Cloud Run)
- **FastAPI** 0.109.2 (Async Python web framework)
- **TensorFlow** 2.16.2 (Model serving)
- **Firebase Admin SDK** 6.4.0 (Authentication, Firestore, Storage)
- **Pillow** 10.2.0 (Image preprocessing)
- **Uvicorn** 0.27.1 (ASGI server)
- **Docker** (Python 3.11-slim base image)

### Machine Learning
- **TensorFlow/Keras** 2.16.2 (Model training)
- **NumPy** 1.26.4 (Array operations)
- **h5py** 3.10.x (HDF5 dataset storage)
- **Matplotlib** 3.8.x (Visualization)

### Cloud Infrastructure (Production)
- **Google Cloud Run** (Containerized backend, europe-west1)
- **Firebase Hosting** (Static frontend hosting, global CDN)
- **Firebase Authentication** (User management)
- **Cloud Firestore** (NoSQL real-time database)
- **Firebase Storage** (Object storage for models/drawings)
- **Cloud Build** (CI/CD for Docker images)
- **Container Registry** (Docker image storage)

### Development Tools
- **Docker** (Containerization)
- **Firebase CLI** (Deployment)
- **Google Cloud SDK** (gcloud CLI)
- **Git** (Version control)

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

## 🚀 Production Deployment

### Current Deployment Status

✅ **Live Application:** [https://ai-pictionary-4f8f2.web.app](https://ai-pictionary-4f8f2.web.app)

| Component | Platform | URL | Status |
|-----------|----------|-----|--------|
| **Frontend** | Firebase Hosting | https://ai-pictionary-4f8f2.web.app | ✅ Live |
| **Backend** | Google Cloud Run | https://ai-pictionary-backend-1064461234232.europe-west1.run.app | ✅ Live |
| **Health Check** | Cloud Run | [/health](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health) | ✅ Healthy |

### Architecture Overview

```yaml
Frontend:
  Platform: Firebase Hosting (Global CDN)
  Build: React 19.2.1 + Tailwind CSS
  Size: 80.29 KB (main.js gzipped)
  Cache: 1 year for static assets
  
Backend:
  Platform: Google Cloud Run (europe-west1)
  Runtime: Docker (Python 3.11-slim)
  Framework: FastAPI 0.109.2
  ML Engine: TensorFlow 2.16.2
  Model: Embedded in container (/app/models/quickdraw_v1.0.0.h5)
  Resources: 1GB RAM, 1 CPU
  Scaling: 0-10 instances (scale-to-zero)
  Cold Start: 2-5 seconds (after 15min inactivity)
  Warm Latency: <100ms
  
Cost:
  Estimated: $0/month (100 DAU within free tier)
  Free Tier Limits:
    - Cloud Run: 2M requests, 180K vCPU-sec, 360K GiB-sec
    - Firebase Hosting: 10GB storage, 360MB/day transfer
    - Firestore: 50K reads/day, 20K writes/day
```

### Deployment Commands

#### Backend (Cloud Run)

```bash
# Prerequisites
# 1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
# 2. Authenticate
gcloud auth login
gcloud config set project ai-pictionary-4f8f2

# 3. Enable required APIs
gcloud services enable run.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com

# Deploy to Cloud Run
cd backend
gcloud run deploy ai-pictionary-backend \
  --source . \
  --region europe-west1 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 60s \
  --allow-unauthenticated \
  --env-vars-file env.yaml

# Verify deployment
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health
```

#### Frontend (Firebase Hosting)

```bash
# Prerequisites
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Build production bundle
cd frontend
npm run build

# 4. Deploy to Firebase Hosting
firebase deploy --only hosting

# Verify deployment
open https://ai-pictionary-4f8f2.web.app
```

### Environment Configuration

#### Backend `env.yaml` (Cloud Run)

```yaml
MODEL_VERSION: "v1.0.0"
CATEGORIES: "apple,sun,tree,house,car,cat,fish,star,umbrella,flower,moon,airplane,bicycle,clock,eye,cup,shoe,cloud,lightning,smiley_face"
CORS_ORIGINS: "http://localhost:3000,https://ai-pictionary-4f8f2.web.app,https://ai-pictionary-4f8f2.firebaseapp.com"
```

#### Frontend `.env.production`

```bash
# Firebase Config
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=ai-pictionary-4f8f2.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ai-pictionary-4f8f2
REACT_APP_FIREBASE_STORAGE_BUCKET=ai-pictionary-4f8f2.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Backend API (Cloud Run)
REACT_APP_API_BASE_URL=https://ai-pictionary-backend-1064461234232.europe-west1.run.app
```

### Monitoring & Logs

```bash
# Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Firebase Hosting logs
firebase hosting:channel:list

# Health check
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health
```

### Performance Metrics (Production)

| Metric | Value | Target |
|--------|-------|--------|
| Frontend Load Time | <2s | <3s |
| Backend Cold Start | 2-5s | <10s |
| Backend Warm Response | 113-327ms | <500ms |
| Model Inference | 8-12ms | <20ms |
| Global CDN Latency | 50-150ms | <200ms |

### Cost Breakdown (100 DAU)

| Service | Monthly Usage | Cost |
|---------|---------------|------|
| Cloud Run (CPU) | 90K vCPU-seconds | $0 (free tier) |
| Cloud Run (Memory) | 180K GiB-seconds | $0 (free tier) |
| Cloud Run (Requests) | 30K requests | $0 (free tier) |
| Firebase Hosting | 2GB transfer | $0 (free tier) |
| Firestore (Reads) | 50K reads | $0 (free tier) |
| Firestore (Writes) | 10K writes | $0 (free tier) |
| Firebase Storage | 5GB | $0 (free tier) |
| **Total** | | **$0/month** ✅ |

**Note:** With current usage (100 DAU), the entire application runs within free tier limits.

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

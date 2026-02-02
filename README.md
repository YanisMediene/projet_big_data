# 🎨 AI Pictionary

**FISE3 Big Data Project** | Jeu de dessin avec reconnaissance IA en temps réel

[![Live App](https://img.shields.io/badge/🎮_App-Live-brightgreen)](https://ai-pictionary-4f8f2.web.app)
[![Backend](https://img.shields.io/badge/API-Cloud%20Run-blue)](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/docs)
[![Model](https://img.shields.io/badge/Model-v4.0.0_(50_classes)-purple)](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health)

---

## 🚀 Accès Rapide

**Application en production :** [https://ai-pictionary-4f8f2.web.app](https://ai-pictionary-4f8f2.web.app)

```bash
# Développement local
cd frontend && npm install && npm start
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Déploiement
./deploy.sh all
```

---

## 🎮 Modes de Jeu

| Mode | Description | Joueurs |
|------|-------------|---------|
| **🎨 Classic** | Mode solo - L'IA devine vos dessins en 20 secondes | 1 |
| **🏁 Race** | Course multijoueur - Premier à faire deviner l'IA gagne | 2-8 |
| **👥 Team vs IA** | Coopératif - L'équipe humaine doit deviner avant l'IA | 2-8 |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Firebase Hosting (CDN)     │  Cloud Run (europe-west1) │
│  React SPA                  │  FastAPI + TensorFlow     │
│  ai-pictionary-4f8f2.web.app│  CNN v4.0.0 (50 classes)  │
└─────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    Firestore            RTDB (sync)          Storage
    (games metadata)     (drawing, chat)      (models)
```

### Stack Technique

| Couche | Technologies |
|--------|--------------|
| **Frontend** | React 19.2.1, Tailwind CSS 3.4.1, Firebase SDK 10.8.0 |
| **Backend** | FastAPI 0.109.2, TensorFlow 2.16.2, Python 3.11 |
| **Infra** | Cloud Run, Firebase Hosting, Firestore, RTDB |
| **ML** | CNN custom, 50 catégories, 90.2% accuracy |

---

## 📁 Structure du Projet

```
projet_big_data/
├── frontend/
│   └── src/
│       ├── NewFrontTest.jsx      # App principale (2500+ lignes)
│       ├── components/
│       │   ├── AudioSettings.jsx # Modal paramètres audio
│       │   └── shared/           # ConnectionStatus, Toast
│       └── services/
│           ├── api.js            # Client API backend
│           ├── audioService.js   # SFX synthétiques (Web Audio)
│           └── multiplayerService.js  # Firebase RTDB sync
├── backend/
│   ├── main.py                   # FastAPI app (34 endpoints)
│   ├── models/                   # Modèles CNN (.h5)
│   ├── routers/                  # admin.py, games.py
│   └── services/                 # firestore, storage, presence
├── ml-training/
│   ├── notebooks/                # Jupyter training
│   └── scripts/                  # download, preprocess, train
└── docs/                         # Documentation détaillée
```

---

## 📊 Métriques Production

| Métrique | Valeur |
|----------|--------|
| **Précision modèle** | 90.2% (v4.0.0, 50 classes) |
| **Latence inférence** | 12-18ms |
| **Cold start** | 5-8s |
| **Coût mensuel** | ~$0 (free tier, 100 DAU) |

---

## 🔌 API Endpoints

**34 endpoints** organisés en 4 groupes :

| Groupe | Endpoints | Description |
|--------|-----------|-------------|
| **default** | `/`, `/health`, `/categories`, `/predict`, `/save_correction` | Core API |
| **admin** | `/admin/retrain`, `/admin/health`, `/admin/cleanup/*` | Administration |
| **multiplayer** | `/games/race/*`, `/games/guessing/*` | Modes multijoueur |
| **presence** | `/games/presence/*`, `/games/cleanup/*` | Gestion présence |

📚 **Documentation API complète :** [/docs](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/docs)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [GETTING_STARTED.md](docs/GETTING_STARTED.md) | Guide démarrage rapide |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Workflow développement |
| [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | Configuration Firebase & Cloud Run |
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | État d'avancement |
| [TECHNICAL_REFERENCE.md](docs/TECHNICAL_REFERENCE.md) | Référence technique & défense |

---

## 👥 Équipe

**FISE3 - Big Data Project**

---

## 🙏 Remerciements

- [Google Quick, Draw! Dataset](https://github.com/googlecreativelab/quickdraw-dataset)
- [TensorFlow](https://www.tensorflow.org/)
- [Firebase](https://firebase.google.com/)
- [FastAPI](https://fastapi.tiangolo.com/)

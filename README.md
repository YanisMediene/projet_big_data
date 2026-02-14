# 🎨 AI Pictionary

**FISE3 Big Data Project** | Jeu de dessin avec reconnaissance IA en temps réel et Active Learning

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

## ✨ Fonctionnalités Phares

* **Reconnaissance Temps Réel** : Inférence CNN sous la barre des 11ms (10.27ms mesurés) pour 50 catégories.
* **Préprocessing Avancé** : Redimensionnement LANCZOS et recentrage par centroïde (+3.1% de précision).
* **Active Learning Pipeline** : Collecte automatique des dessins utilisateurs pour réentraîner le modèle intelligemment.
* **Système Audio Intégré** : SFX synthétiques (Web Audio API) et annonces vocales TTS sans aucun fichier audio externe.
* **Synchronisation RTDB** : Latence de 20-50ms pour l'affichage des dessins en direct dans les modes multijoueurs.

---

## 🎮 Modes de Jeu

| Mode | Description | Joueurs |
| --- | --- | --- |
| **🎨 Classic** | Mode solo - L'IA devine vos dessins en 20 secondes | 1 |
| **🏁 Race** | Course multijoueur - Premier à faire deviner l'IA gagne | 2-8 |
| **👥 Team vs IA** | Coopératif - L'équipe humaine doit deviner avant l'IA | 2-8 |
| **🧪 Free Canvas** | Test libre et illimité pour contribuer à l'Active Learning en sauvegardant ses dessins | 1 |
| **♾️ Infinite** | Jeu sans fin avec auto-sauvegarde à 85% de confiance et ciblage des catégories faibles | 1 |

---

## 🏗️ Architecture

L'application repose sur une architecture Cloud-Native orientée performances et scalabilité.

```text
┌─────────────────────────────────────────────────────────┐
│  Firebase Hosting (CDN)     │  Cloud Run (europe-west1) │
│  React SPA                  │  FastAPI + TensorFlow     │
│  ai-pictionary-4f8f2.web.app│  CNN v4.0.0 (50 classes)  │
└─────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    Firestore            RTDB (sync)          Storage
    (games, dessins)     (drawing, chat)      (models)

```

### Stack Technique

| Couche | Technologies |
| --- | --- |
| **Frontend** | React 19.2.1, Tailwind CSS 3.4.1, Firebase SDK 10.8.0 |
| **Backend** | FastAPI 0.109.2, TensorFlow 2.16.2, Python 3.11 |
| **Infra** | Cloud Run, Firebase Hosting, Firestore, Realtime Database (RTDB) |
| **ML** | CNN VGG profond (6 couches, 2.35M params), 50 catégories |

---

## 📁 Structure du Projet

```text
projet_big_data/
├── frontend/
│   └── src/
│       ├── NewFrontTest.jsx      # App principale (Machine à états monolythique)
│       ├── components/           # AudioSettings, ConnectionStatus, Toast
│       └── services/
│           ├── api.js            # Client API backend
│           ├── audioService.js   # SFX synthétiques & TTS (Web Audio)
│           └── multiplayerService.js # Firebase RTDB sync
├── backend/
│   ├── main.py                   # FastAPI app (38 endpoints)
│   ├── models/                   # Modèles CNN (.h5)
│   ├── routers/                  # admin.py, games.py
│   └── services/                 # firestore, storage, presence
├── ml-training/
│   ├── notebooks/                # Jupyter training
│   └── scripts/                  # download, preprocess, train_model_v4.py, retrain_pipeline.py
└── docs/                         # Documentation détaillée

```

---

## 📊 Métriques Production

| Métrique | Valeur ciblée | Valeur actuelle (v4.0.0) |
| --- | --- | --- |
| **Précision modèle (Test Acc)** | > 85% | 93.79% |
| **F1-Score (Macro)** | > 85% | 93.81% |
| **Latence Inférence CNN** | < 50ms | 10.27ms |
| **Latence End-to-End** | < 500ms | 120-350ms |
| **Taille du modèle** | < 50MB | 28.3 MO |
| **Coût mensuel estimé** | < $10 | ~$0 (free tier, 100 DAU) |

---

## 🔌 API Endpoints

**38 endpoints** organisés en 6 groupes :

| Groupe | Base Path | Endpoints | Description |
| --- | --- | --- | --- |
| **Core** | `/` | 5 | Health check, infos, prédictions et sauvegarde corrections |
| **Active Learning** | `/drawings/`, `/categories/` | 3 | Collecte de dessins et récupération de stats/ciblage |
| **Admin** | `/admin/` | 6 | Déclenchement retrain ML, cleanup des bases, suppression de rooms |
| **Race Mode** | `/games/race/` | 8 | Logique du mode compétitif |
| **Guessing Mode** | `/games/guessing/` | 11 | Logique du mode Team vs IA |
| **Presence** | `/games/presence/` | 5 | Gestion des déconnexions et heartbeat |

📚 **Documentation API Swagger complète :** [/docs](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/docs)

---

## 📚 Documentation

| Document | Description |
| --- | --- |
| [GETTING_STARTED.md](https://www.google.com/search?q=docs/GETTING_STARTED.md) | Guide démarrage rapide |
| [DEVELOPMENT.md](https://www.google.com/search?q=docs/DEVELOPMENT.md) | Workflow développement local et environnements |
| [INFRASTRUCTURE.md](https://www.google.com/search?q=docs/INFRASTRUCTURE.md) | Configuration Firebase, Cloud Run et RTDB |
| [PROJECT_STATUS.md](https://www.google.com/search?q=docs/PROJECT_STATUS.md) | État d'avancement des phases et nouvelles features |
| [TECHNICAL_REFERENCE.md](https://www.google.com/search?q=docs/TECHNICAL_REFERENCE.md) | Architecture détaillée, décisions techniques et analyse des coûts |

---

## 👥 Équipe

**FISE3 - Projet Big Data**
Réalisé par : Yanis MEDIENE, Yassin MERMRI, Nassera ZOULEIRI et Nassim EL ATMIOUI.

---

## 🙏 Remerciements

* [Google Quick, Draw! Dataset](https://github.com/googlecreativelab/quickdraw-dataset)
* [TensorFlow](https://www.tensorflow.org/)
* [Firebase](https://firebase.google.com/)
* [FastAPI](https://fastapi.tiangolo.com/)
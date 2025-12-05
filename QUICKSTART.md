# 🚀 Quick Start Guide - AI Pictionary

Guide rapide pour utiliser l'application AI Pictionary en production ou développer localement.

---

## ✨ Quick Start - Production (0 minutes)

### Option 1: Utiliser l'Application Déployée (Recommandé)

**Accès instantané :**

🌐 **Application Live:** [https://ai-pictionary-4f8f2.web.app](https://ai-pictionary-4f8f2.web.app)

**Caractéristiques :**
- ✅ Aucune installation nécessaire
- ✅ Backend déployé sur Google Cloud Run (europe-west1)
- ✅ Frontend hébergé sur Firebase Hosting (CDN global)
- ✅ Modèle CNN pré-entraîné (91-93% accuracy)
- ✅ 20 catégories disponibles (apple, sun, tree, house, car, etc.)
- ✅ Gratuit (dans les limites du free tier)

**Tester l'API Backend :**

```bash
# Vérifier la santé du backend
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health

# Réponse attendue:
{
  "status": "healthy",
  "model_version": "v1.0.0",
  "model_loaded": true,
  "categories_count": 20
}
```

**URLs Production :**

| Service | URL | Statut |
|---------|-----|--------|
| Frontend | https://ai-pictionary-4f8f2.web.app | ✅ Live |
| Backend API | https://ai-pictionary-backend-1064461234232.europe-west1.run.app | ✅ Live |
| Health Check | [/health](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health) | ✅ Healthy |
| API Docs (Swagger) | [/docs](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/docs) | 📚 Available |

**Performances Production :**
- **Latence frontend :** <2s (chargement initial)
- **Latence backend (warm) :** 113-327ms
- **Cold start :** 2-5s (après 15min d'inactivité)
- **Inférence CNN :** 8-12ms
- **Coût :** $0/mois (100 utilisateurs dans le free tier)

---

## 🛠️ Quick Start - Développement Local (70 minutes)

### Quand utiliser le développement local ?

- ✅ Modifier le code frontend/backend
- ✅ Entraîner un nouveau modèle
- ✅ Tester des changements avant déploiement
- ✅ Développer de nouvelles fonctionnalités
- ✅ Debugger l'application

### Prérequis
- Python 3.8+
- Node.js 16+
- ~4GB d'espace disque
- Connexion internet

### Étape 1 : Télécharger le Dataset (20-30 min)

```bash
cd ml-training
python scripts/download_dataset.py
```

**Note :** Le téléchargement s'exécute en arrière-plan. Passez à l'étape suivante pendant ce temps.

### Étape 2 : Installer les Dépendances

**Backend :**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend :**
```bash
cd frontend
npm install
```

### Étape 3 : Prétraiter le Dataset (10 min)

```bash
cd ml-training
python scripts/preprocess_dataset.py
```

**Résultat attendu :** Fichier `data/processed/quickdraw_20cat.h5` (~400MB)

### Étape 4 : Entraîner le Modèle (30 min)

```bash
cd ml-training
jupyter notebook notebooks/train_model.ipynb
```

**Instructions :**
1. Ouvrir le notebook dans le navigateur
2. Menu → "Cell" → "Run All"
3. Attendre la fin de l'entraînement (15 epochs)
4. Le modèle sera sauvegardé dans `backend/models/quickdraw_v1.0.0.h5`

### Étape 5 : Lancer l'Application

**Terminal 1 - Backend :**
```bash
cd backend
uvicorn main:app --reload
```

**Terminal 2 - Frontend :**
```bash
cd frontend
npm start
```

### Étape 6 : Tester

1. Ouvrir http://localhost:3000
2. Dessiner sur le canvas
3. Voir les prédictions en temps réel !

---

## 🧪 Test d'Intégration

### Test de l'Application Production

**Vérifier que l'application production fonctionne :**

```bash
# Backend health check
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health

# Résultat attendu:
{
  "status": "healthy",
  "model_version": "v1.0.0",
  "model_loaded": true,
  "categories_count": 20
}

# Frontend (ouvrir dans le navigateur)
open https://ai-pictionary-4f8f2.web.app
```

### Test de l'Application Locale

Vérifier que tous les composants locaux fonctionnent :

```bash
python test_integration.py
```

**Résultat attendu :**
```
✅ PASSED  Dataset
✅ PASSED  Model
✅ PASSED  Backend Health (localhost:8000)
✅ PASSED  Frontend (localhost:3000)
✅ PASSED  Prediction

🎉 All systems operational!
```

---

## 📚 Architecture Simplifiée

### Production (Déployé)

```
         USERS (Global)
              │
              ▼
┌───────────────────────────────┐
│  Firebase Hosting (CDN)     │
│  ai-pictionary-4f8f2.web.app│
│  React SPA (80KB gzipped)   │
└──────────────┬────────────────┘
              │ HTTPS
              ▼
┌───────────────────────────────┐
│  Google Cloud Run           │
│  (europe-west1)             │
│  FastAPI + TensorFlow       │
│  Docker (500MB image)       │
│  Scale: 0-10 instances      │
└──────────────┬────────────────┘
              │
              ▼
┌───────────────────────────────┐
│  Firebase Services          │
│  - Auth (Google, Email)     │
│  - Firestore (NoSQL)        │
│  - Storage (Objects)        │
└───────────────────────────────┘
```

### Développement Local

```
┌─────────────┐      HTTP/REST       ┌─────────────┐
│   React     │ ←─────────────────────→  │  FastAPI    │
│   Frontend  │   POST /predict      │  Backend    │
│  (Port 3000)│                      │ (Port 8000)│
└─────────────┘                      └─────────────┘
      │                                     │
      │                                     │
      ▼                                     ▼
  Canvas 280x280                    TensorFlow Model
  Debounce 500ms                    quickdraw_v1.0.0.h5
                                    (50K params, 5ms)
                                    
  Firebase SDK ─────────────────────────────────→ Production Firebase
  (connects to cloud)                           (Auth, Firestore, Storage)
```

---

## 🎯 Workflow Utilisateur

1. **Dessiner** sur canvas (280x280px)
2. **Attendre 500ms** (debounce automatique)
3. **API appelle** `/predict` avec image base64
4. **Backend** :
   - Prétraite l'image (centroid crop, normalize)
   - Exécute le modèle CNN
   - Retourne top-3 prédictions
5. **Frontend affiche** :
   - 🟢 Vert si confiance >85%
   - 🟡 Jaune si 70-85%
   - 🔴 Rouge si <70% → Modal de correction

---

## 🐛 Dépannage

### Backend : "Model not loaded"
```bash
# Vérifier que le modèle existe
ls -lh backend/models/quickdraw_v1.0.0.h5

# Si absent, entraîner le modèle
cd ml-training
jupyter notebook notebooks/train_model.ipynb
```

### Frontend : "Backend offline"
```bash
# Démarrer le backend
cd backend
uvicorn main:app --reload

# Vérifier le health check
curl http://localhost:8000/health
```

### Dataset : Téléchargement lent
```bash
# Vérifier la progression
cd ml-training/data/raw
ls -lh *.npy | wc -l  # Devrait afficher 20
```

### Port déjà utilisé
```bash
# Backend (port 8000)
lsof -ti:8000 | xargs kill -9

# Frontend (port 3000)
lsof -ti:3000 | xargs kill -9
```

---

## 📊 Métriques de Performance

| Métrique | Valeur | Note |
|----------|--------|------|
| Taille modèle | 140KB | Très léger |
| Paramètres | 35K | Simple CNN |
| Inférence | 5ms | Temps réel |
| Accuracy cible | 91-93% | Sur test set |
| Debounce | 500ms | UX optimisée |
| Dataset | 1.4M images | 20 catégories |

---

## 🎓 Catégories Disponibles (20)

```
apple, sun, tree, house, car,
cat, fish, star, umbrella, flower,
moon, airplane, bicycle, clock, eye,
cup, shoe, cloud, lightning, smiley_face
```

---

## 🔄 Workflow de Développement

### Mode Développement Local
```bash
# Terminal 1
cd backend && uvicorn main:app --reload

# Terminal 2
cd frontend && npm start
```

### Mode Production (Local Build)
```bash
# Build frontend
cd frontend && npm run build

# Test production build locally
npx serve -s build
```

---

## 🚀 Déploiement Production

### Prérequis

1. **Google Cloud SDK**
   ```bash
   # Installation (macOS/Linux)
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   
   # Authentification
   gcloud auth login
   gcloud config set project ai-pictionary-4f8f2
   ```

2. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

### Déployer le Backend (Cloud Run)

```bash
cd backend

# Activer les APIs nécessaires
gcloud services enable run.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com

# Déployer
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

# Vérifier
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health
```

**Fichier `backend/env.yaml` requis :**

```yaml
MODEL_VERSION: "v1.0.0"
CATEGORIES: "apple,sun,tree,house,car,cat,fish,star,umbrella,flower,moon,airplane,bicycle,clock,eye,cup,shoe,cloud,lightning,smiley_face"
CORS_ORIGINS: "http://localhost:3000,https://ai-pictionary-4f8f2.web.app,https://ai-pictionary-4f8f2.firebaseapp.com"
```

### Déployer le Frontend (Firebase Hosting)

```bash
cd frontend

# Créer .env.production avec l'URL Cloud Run
echo "REACT_APP_API_BASE_URL=https://ai-pictionary-backend-1064461234232.europe-west1.run.app" >> .env.production

# Ajouter config Firebase
cat >> .env.production << EOF
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=ai-pictionary-4f8f2.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ai-pictionary-4f8f2
REACT_APP_FIREBASE_STORAGE_BUCKET=ai-pictionary-4f8f2.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
EOF

# Build
npm run build

# Déployer
firebase use ai-pictionary-4f8f2
firebase deploy --only hosting

# Vérifier
open https://ai-pictionary-4f8f2.web.app
```

### Fichiers de Configuration Requis

**`firebase.json` (racine du projet) :**

```json
{
  "hosting": {
    "public": "frontend/build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [{"key": "Cache-Control", "value": "max-age=31536000"}]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [{"key": "Cache-Control", "value": "max-age=31536000"}]
      }
    ]
  }
}
```

**`.firebaserc` (racine du projet) :**

```json
{
  "projects": {
    "default": "ai-pictionary-4f8f2"
  }
}
```

**`backend/Dockerfile` :**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    PORT=8080

RUN apt-get update && apt-get install -y libgomp1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY models/ ./models/
COPY serviceAccountKey.json .

EXPOSE 8080

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1
```

### Monitoring

```bash
# Logs Cloud Run
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Logs Firebase Hosting
firebase hosting:channel:list

# Métriques Cloud Run
gcloud run services describe ai-pictionary-backend --region europe-west1
```

---

## 📚 Documentation Complète

- **Backend API :** `backend/README.md`
- **Frontend :** `frontend/README.md`
- **ML Training :** `ml-training/README.md`
- **Firebase Setup :** `docs/firebase_setup.md`
- **Data Pipeline :** `docs/data_pipeline.md`
- **Defense Justifications :** `docs/defense_justifications.md`

---

## ⏱️ Temps Estimé Total

| Étape | Durée | Parallélisable |
|-------|-------|----------------|
| Téléchargement dataset | 20-30 min | ✅ (pendant installation) |
| Installation dépendances | 5 min | ✅ |
| Prétraitement dataset | 10 min | ❌ |
| Entraînement modèle | 30 min | ❌ |
| Test application | 5 min | ❌ |
| **TOTAL** | **~70 min** | |

**Astuce :** Lancez le téléchargement du dataset en premier, puis installez les dépendances pendant ce temps.

---

## ✅ Checklist Avant Défense

### Production (Recommandé)
- [ ] Application production accessible (https://ai-pictionary-4f8f2.web.app)
- [ ] Backend health check OK (https://ai-pictionary-backend-*.run.app/health)
- [ ] Prédictions en temps réel fonctionnelles
- [ ] Modal de correction apparaît (<85% confiance)
- [ ] Documentation de défense lue (defense_justifications.md)
- [ ] Architecture Cloud Run + Firebase Hosting comprise
- [ ] Coûts production documentés ($0/mois pour 100 DAU)

### Développement Local (Optionnel)
- [ ] Dataset téléchargé (20 catégories)
- [ ] Dataset prétraité (quickdraw_20cat.h5)
- [ ] Modèle entraîné (quickdraw_v1.0.0.h5)
- [ ] Backend fonctionne (curl http://localhost:8000/health)
- [ ] Frontend fonctionne (http://localhost:3000)
- [ ] Prédictions en temps réel testées
- [ ] Modal de correction testé
- [ ] Firebase configuré

---

## 🎯 Prochaines Étapes (Phase 2)

### Fonctionnalités à Développer

1. **Active Learning Pipeline** (2-3 jours)
   - Script retrain_pipeline.py
   - Récupération corrections Firestore (>500 labels)
   - Fine-tuning automatisé (freeze conv layers, LR=0.0001)
   - Déploiement nouveau modèle sur Cloud Run
   - Trigger: Cloud Scheduler ou manuel

2. **Modes Multijoueurs** (3-4 jours)
   - **Race mode** : Premier à 85% confiance gagne
   - **Guessing game** : Joueur dessine, autres devinent
   - Firestore real-time listeners (onSnapshot)
   - Lobby system + scoring

3. **Améliorations Production** (2-3 jours)
   - CI/CD avec GitHub Actions
   - Monitoring Firebase Analytics
   - Cloud Run min-instances=1 (optionnel, +$5/mois)
   - Cache optimisé frontend
   - Error tracking (Sentry)

### Timeline Estimée
- **Semaine 1 (Jan 15-22)** : Active Learning
- **Semaine 2-3 (Jan 22-Feb 5)** : Multiplayer modes
- **Semaine 4 (Feb 5-13)** : Production improvements + tests finaux

### Ressources

- **Architecture Cloud :** docs/defense_justifications.md (section Cloud Run)
- **Firebase Config :** docs/firebase_setup.md
- **Data Pipeline :** docs/data_pipeline.md
- **Backend API :** backend/README.md
- **Frontend Components :** frontend/README.md

---

**Questions ? Consultez `docs/defense_justifications.md` pour toutes les justifications techniques !**

# 🚀 Getting Started - AI Pictionary

Guide complet pour démarrer avec AI Pictionary : de l'accès en production au développement local.

---

## 📋 Table des Matières

1. [Option 1 : Production](#option-1--production-0-min)
2. [Option 2 : Développement Local](#option-2--développement-local)
3. [Workflow Quotidien](#workflow-quotidien)
4. [Architecture](#architecture)
5. [Tests & Vérification](#tests--vérification)
6. [Dépannage](#dépannage)

---

## Option 1 : Production (0 min)

### ✨ Accès Instantané

**Application Live :** [https://ai-pictionary-4f8f2.web.app](https://ai-pictionary-4f8f2.web.app)

**Caractéristiques :**
- ✅ Aucune installation nécessaire
- ✅ Backend sur Google Cloud Run (europe-west1)
- ✅ Frontend sur Firebase Hosting (CDN global)
- ✅ Modèle CNN v4.0.0 (50 classes, 90.2% accuracy)
- ✅ 3 modes de jeu (Classic, Race, Team vs IA)
- ✅ Gratuit (free tier)

### 📊 URLs & Statuts

| Service | URL |
|---------|-----|
| **Frontend** | https://ai-pictionary-4f8f2.web.app |
| **Backend API** | https://ai-pictionary-backend-1064461234232.europe-west1.run.app |
| **API Docs** | /docs |

### 🧪 Test Rapide

```bash
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health
```

**Réponse attendue :**
```json
{
  "status": "healthy",
  "model_version": "v4.0.0",
  "model_loaded": true,
  "categories_count": 50
}
```

### 📈 Performances Production

| Métrique | Valeur |
|----------|--------|
| Latence backend (warm) | 120-350ms |
| Cold start | 5-8s |
| Inférence CNN | 12-18ms |
| Coût | ~$0/mois (100 DAU) |

---

## Option 2 : Développement Local

### 🎯 Quand utiliser le développement local ?

- Modifier le code frontend/backend
- Entraîner un nouveau modèle
- Tester des changements avant déploiement
- Debugger l'application

### Prérequis

- Python 3.8+
- Node.js 16+
- ~4GB d'espace disque

### 📥 Étape 1 : Installer les Dépendances (5 min)

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

### ⚙️ Étape 2 : Configurer l'Environnement

**Backend (.env) :**
```bash
cd backend
cp .env.example .env

# Générer clé admin
openssl rand -hex 32
# Ajouter dans .env : ADMIN_API_KEY=<clé>
```

**Frontend (.env.local) :**
```bash
# Créer frontend/.env.local avec :
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_PROJECT_ID=ai-pictionary-4f8f2
REACT_APP_FIREBASE_DATABASE_URL=https://ai-pictionary-4f8f2-default-rtdb.firebaseio.com
REACT_APP_API_BASE_URL=http://localhost:8000
```

### 🚀 Étape 3 : Lancer l'Application

**Terminal 1 - Backend :**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend :**
```bash
cd frontend
npm start
```

### ✅ Étape 4 : Tester

1. Ouvrir http://localhost:3000
2. Choisir un mode de jeu
3. Dessiner sur le canvas
4. Voir les prédictions en temps réel !

---

## (Optionnel) Entraîner un Nouveau Modèle

### 📦 Télécharger le Dataset (20-30 min)

```bash
cd ml-training
python scripts/download_dataset.py
```

### ⚙️ Prétraiter le Dataset (10 min)

```bash
cd ml-training
python scripts/preprocess_dataset.py
```

**Résultat :** `data/quickdraw_20cat.h5` (~400MB)

### 🧠 Entraîner le Modèle (30 min)

```bash
cd ml-training
jupyter notebook notebooks/train_model.ipynb
```

---

## Workflow Quotidien

### 🌅 Matin : Développement

```bash
git pull origin main
cd frontend
npm start
```

### 🌃 Soir : Déploiement

```bash
./deploy.sh frontend    # Juste le frontend
./deploy.sh backend     # Juste le backend
./deploy.sh all         # Tout déployer
```

Le script gère automatiquement :
- Sauvegarde `.env.local` → `.env.local.bak`
- Build avec `.env.production`
- Restaure `.env.local`

---

## Architecture

### 🏗️ Architecture Production

```
         USERS (Global)
              │
              ▼
┌───────────────────────────────┐
│  Firebase Hosting (CDN)       │
│  React SPA                    │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│  Google Cloud Run             │
│  FastAPI + TensorFlow         │
│  (europe-west1)               │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│  Firebase Services            │
│  - Firestore (games, scores)  │
│  - RTDB (multiplayer sync)    │
│  - Storage (models)           │
└───────────────────────────────┘
```

### 🎮 Modes de Jeu

| Mode | Description | Joueurs |
|------|-------------|---------|
| **Classic** | Solo contre l'IA | 1 |
| **Race** | Course - premier à faire deviner | 2-8 |
| **Team vs IA** | Équipe vs IA qui devine | 2-8 |

### 🎓 Catégories (50)

```
airplane, apple, axe, banana, baseball bat, basketball,
bear, bed, bench, bicycle, bird, book, bread, bridge,
broccoli, bus, butterfly, cake, camera, candle, car,
cat, chair, clock, cloud, coffee cup, dog, door, donut,
envelope, eye, fish, flower, fork, grapes, hamburger,
hot dog, house, ice cream, key, laptop, leaf, moon, mountain,
pizza, rainbow, star, strawberry, tree, umbrella
```

---

## Tests & Vérification

### 🧪 Test Production

```bash
# Health check
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health

# Catégories
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/categories
```

### 🧪 Test Local

```bash
# Health check
curl http://localhost:8000/health

# Prédiction
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/png;base64,..."}'
```

### ✅ Checklist de Vérification

**Backend :**
- [ ] `backend/.env` existe
- [ ] `ADMIN_API_KEY` configurée
- [ ] `backend/serviceAccountKey.json` existe
- [ ] Backend démarre sur port 8000

**Frontend :**
- [ ] Frontend démarre sur port 3000
- [ ] Canvas dessin fonctionne
- [ ] Prédictions temps réel
- [ ] Modes multiplayer accessibles

---

## Dépannage

### 🐛 Problèmes Courants

#### Port déjà utilisé

```bash
lsof -ti:8000 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend
```

#### CORS errors

Vérifier `backend/env.yaml` :
```yaml
CORS_ORIGINS: "https://ai-pictionary-4f8f2.web.app,http://localhost:3000"
```

#### Modèle ne charge pas

Vérifier que les fichiers existent :
```bash
ls backend/models/
# Doit contenir : quickdraw_v4.0.0.h5, quickdraw_v4.0.0_metadata.json
```

#### Firebase connection error

Vérifier `backend/serviceAccountKey.json` et les variables Firebase dans `.env.local`.

---

## 📚 Documentation Complémentaire

- [DEVELOPMENT.md](DEVELOPMENT.md) — Workflow développement détaillé
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) — Configuration Firebase & Cloud Run
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — État d'avancement
- [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md) — Référence technique

# 💻 Development Guide

Guide complet du workflow de développement, de la configuration locale au déploiement production.

---

## 📋 Table des Matières

1. [Structure & Configuration](#structure--configuration)
2. [Environnement de Développement](#environnement-de-développement)
3. [Workflow Quotidien](#workflow-quotidien)
4. [Tests & Validation](#tests--validation)
5. [Déploiement](#déploiement)
6. [Dépannage](#dépannage)

---

## Structure & Configuration

### 📁 Fichiers de Configuration

```
projet_big_data/
├── frontend/
│   ├── .env.local              # ❌ Git ignoré - Dev local
│   ├── .env.production         # ✅ Versionné - Production
│   └── .env.production.local   # ❌ Git ignoré - Overrides production
├── backend/
│   ├── .env                    # ❌ Git ignoré - Config locale
│   ├── .env.example            # ✅ Versionné - Template
│   └── env.yaml                # ✅ Versionné - Cloud Run config
└── deploy.sh                   # ✅ Versionné - Script déploiement
```

### 🔑 Variables d'Environnement

#### Frontend (.env.local)

```bash
# Firebase
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=ai-pictionary-4f8f2.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ai-pictionary-4f8f2
REACT_APP_FIREBASE_STORAGE_BUCKET=ai-pictionary-4f8f2.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abcd...

# Firebase Realtime Database (multiplayer)
REACT_APP_FIREBASE_DATABASE_URL=https://ai-pictionary-4f8f2-default-rtdb.firebaseio.com

# Backend API
REACT_APP_API_BASE_URL=http://localhost:8000

# Émulateurs (optionnel)
REACT_APP_USE_EMULATOR=true
REACT_APP_USE_RTDB_EMULATOR=true
```

#### Backend (.env)

```bash
# Admin API Key (générer avec: openssl rand -hex 32)
ADMIN_API_KEY=your_secure_random_key_here

# Firebase
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://ai-pictionary-4f8f2-default-rtdb.firebaseio.com

# Émulateurs Firebase (développement local)
USE_FIRESTORE_EMULATOR=false
USE_RTDB_EMULATOR=false

# Environnement
ENVIRONMENT=development
DEBUG=True

# Model (v4.0.0 = 50 classes par défaut)
MODEL_VERSION=v4.0.0
MODEL_PATH=./models/quickdraw_v4.0.0.h5
```

### 🔄 Switcher entre les Versions du Modèle

**Le système charge automatiquement le modèle et les catégories** basé sur `MODEL_VERSION`.

| Version | Classes | Accuracy | Usage |
|---------|---------|----------|-------|
| v1.0.0 | 20 | 91-93% | Tests légers |
| v4.0.0 | 50 | 90.2% | **Production (défaut)** |
| v3.0.0 | 345 | 73.2% | Toutes catégories |

**Développement Local :** `backend/.env`
```bash
MODEL_VERSION=v4.0.0
```

**Production (Cloud Run) :** `backend/env.yaml`
```yaml
MODEL_VERSION: "v4.0.0"
```

**Après modification :** Redémarrer le serveur backend + hard refresh navigateur (`Cmd+Shift+R`).

---

## Environnement de Développement

### 1️⃣ Développement Local

#### Terminal 1 : Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

#### Terminal 2 : Frontend

```bash
cd frontend
npm start
```

#### Terminal 3 : Émulateurs Firebase (Optionnel)

```bash
firebase emulators:start
```

**Ports par défaut :**
- Firestore : `localhost:8080`
- RTDB : `localhost:9000`
- UI : `localhost:4000`

### 2️⃣ Vérification Configuration

```bash
# Backend : Vérifier que le modèle charge
curl http://localhost:8000/health
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

---

## Workflow Quotidien

### 📅 Routine de Développement

#### 🌅 Matin : Setup

```bash
# 1. Pull derniers changements
git pull origin main

# 2. Installer nouvelles dépendances (si modifié)
cd frontend && npm install
cd ../backend && pip install -r requirements.txt

# 3. Lancer environnement dev
cd frontend
npm start
```

#### 🌆 Développement

```bash
# Créer branche feature
git checkout -b feature/nouvelle-fonctionnalite

# Développer, tester, itérer...

# Commits réguliers
git add .
git commit -m "feat: ajout nouvelle fonctionnalité"
```

#### 🌃 Fin de Journée

```bash
# Pousser changements
git push origin feature/nouvelle-fonctionnalite

# Si feature terminée et mergée sur main :
git checkout main
git pull origin main

# Déployer (optionnel)
./deploy.sh all
```

---

## Tests & Validation

### 📋 Checklist Frontend

- [ ] Canvas dessin fonctionne (souris + tactile)
- [ ] Prédictions temps réel
- [ ] Top-3 probabilités affichées
- [ ] Sélection mode de jeu (Classic/Race/Team)
- [ ] Création lobby multiplayer
- [ ] Rejoindre partie par code
- [ ] Chat temps réel (Team vs IA)
- [ ] Audio SFX et TTS fonctionnels
- [ ] AudioSettings modal

### 📋 Checklist Backend

- [ ] `/health` retourne 200 + model_loaded
- [ ] `/predict` retourne prédictions
- [ ] `/categories` retourne 50 catégories
- [ ] `/games/race/*` endpoints fonctionnels
- [ ] `/games/guessing/*` endpoints fonctionnels
- [ ] `/games/presence/*` endpoints fonctionnels
- [ ] `/admin/*` (avec ADMIN_API_KEY)

### 🧪 Tests en Conditions Réelles

```bash
# Terminal 1 : Backend avec logs
cd backend
python -m uvicorn main:app --reload --log-level debug

# Terminal 2 : Frontend
cd frontend
npm start

# Terminal 3 : Monitorer Firestore
# Firebase Console → Firestore → Observer collections games
```

---

## Déploiement

### 🚀 Option A : Script Automatisé (✅ Recommandé)

```bash
# À la racine du projet
./deploy.sh frontend    # Frontend uniquement
./deploy.sh backend     # Backend uniquement
./deploy.sh firestore   # Règles Firestore uniquement
./deploy.sh all         # Tout déployer
```

### 🚀 Option B : Scripts npm (Frontend uniquement)

```bash
cd frontend
npm run build:prod
npm run deploy
```

### 🚢 Frontend (Firebase Hosting)

```bash
cd frontend
npm run build
firebase deploy --only hosting
```

### 🚢 Backend (Cloud Run)

```bash
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
```

### 🚢 Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 📊 Vérification Post-Déploiement

```bash
# Frontend accessible
curl -I https://ai-pictionary-4f8f2.web.app

# Backend accessible
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health
```

---

## Dépannage

### 🐛 Problèmes Courants

#### Frontend utilise localhost en production

**Cause :** `.env.local` prioritaire sur `.env.production`

**Solution :**
```bash
cd frontend
rm -rf build node_modules/.cache
npm run build:prod
```

#### "Emulators not running" en dev

**Solution :**
```bash
firebase emulators:start
```

#### CORS errors en production

**Solution :** Vérifier `backend/env.yaml` → `CORS_ORIGINS`

```yaml
CORS_ORIGINS: "https://ai-pictionary-4f8f2.web.app,https://ai-pictionary-4f8f2.firebaseapp.com"
```

#### Port déjà utilisé

```bash
# Backend (8000)
lsof -ti:8000 | xargs kill -9

# Frontend (3000)
lsof -ti:3000 | xargs kill -9
```

---

## 📝 Bonnes Pratiques

### ✅ À FAIRE

1. **Commiter `.env.production`** (config publique)
2. **NE JAMAIS commiter** `.env.local`, `.env`, `serviceAccountKey.json`
3. **Utiliser scripts** pour déployer (`./deploy.sh`)
4. **Tester localement** avant déployer

### ❌ À ÉVITER

1. ❌ Commiter secrets dans `.env.production`
2. ❌ Déployer sans tester localement
3. ❌ Mettre URLs production dans `.env.local`

---

## 📊 Récapitulatif

| Environnement | Fichier | Backend URL | Firebase | Commande |
|---------------|---------|-------------|----------|----------|
| **Dev Local** | `.env.local` | `localhost:8000` | Émulateurs | `npm start` |
| **Production** | `.env.production` | Cloud Run URL | Firebase réel | `./deploy.sh` |

---

## 📚 Documentation Complémentaire

- [GETTING_STARTED.md](GETTING_STARTED.md) — Guide démarrage rapide
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) — Configuration Firebase & Cloud Run
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — État d'avancement
- [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md) — Référence technique

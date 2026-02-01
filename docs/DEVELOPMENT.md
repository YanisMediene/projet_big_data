# 💻 Development Guide

Guide complet du workflow de développement, de la configuration locale au déploiement production.

---

## 📋 Table des Matières

1. [Structure & Configuration](#structure--configuration)
2. [Environnement de Développement](#environnement-de-développement)
3. [Workflow Quotidien](#workflow-quotidien)
4. [Étapes de Finalisation Phase 2](#étapes-de-finalisation-phase-2)
5. [Tests & Validation](#tests--validation)
6. [Déploiement](#déploiement)
7. [Optimisations Avancées](#optimisations-avancées)
8. [Dépannage](#dépannage)

---

## Structure & Configuration

### 📁 Fichiers de Configuration

```
projet_big_data/
├── frontend/
│   ├── .env.local              # ❌ Git ignoré - Dev local (émulateurs)
│   ├── .env.production         # ✅ Versionné - Production (Firebase/Cloud Run)
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
# Firebase (émulateurs ou production)
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=ai-pictionary-4f8f2.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ai-pictionary-4f8f2
REACT_APP_FIREBASE_STORAGE_BUCKET=ai-pictionary-4f8f2.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abcd...

# Backend API (local ou production)
REACT_APP_API_BASE_URL=http://localhost:8000
# OU pour tester contre production :
# REACT_APP_API_BASE_URL=https://ai-pictionary-backend-1064461234232.europe-west1.run.app

# Émulateurs (optionnel)
REACT_APP_USE_EMULATOR=true
```

#### Backend (.env)

```bash
# Admin API Key (générer avec: openssl rand -hex 32)
ADMIN_API_KEY=your_secure_random_key_here

# Firebase
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json

# Environnement
ENVIRONMENT=development
DEBUG=True

# Model
MODEL_VERSION=v1.0.0
MODEL_PATH=./models/quickdraw_v1.0.0.h5
```

### 🔄 Switcher entre les Versions du Modèle

**Le système charge automatiquement le modèle et les catégories** basé sur `MODEL_VERSION`.

#### Développement Local

**Fichier :** `backend/.env`

```bash
# Pour utiliser le modèle 20 classes (v1.0.0)
MODEL_VERSION=v1.0.0

# Pour utiliser le modèle 345 classes (v3.0.0)
MODEL_VERSION=v3.0.0
```

#### Production (Cloud Run)

**Fichier :** `backend/env.yaml`

```yaml
# Pour utiliser le modèle 20 classes
MODEL_VERSION: "v1.0.0"

# Pour utiliser le modèle 345 classes
MODEL_VERSION: "v3.0.0"
```

#### Ce qui est chargé automatiquement

Le système charge :
- **Modèle :** `./models/quickdraw_{MODEL_VERSION}.h5`
- **Catégories :** `./models/quickdraw_{MODEL_VERSION}_metadata.json`

**Exemple :**
- `MODEL_VERSION=v1.0.0` → 20 classes (apple, sun, tree, ...)
- `MODEL_VERSION=v3.0.0` → 345 classes (aircraft carrier, airplane, ...)

**Après modification :** 

1. **Redémarrer le serveur backend**
   ```bash
   cd backend
   uvicorn main:app --reload --port 8000
   ```

2. **Rafraîchir le frontend (hard refresh)**
   - **Mac :** `Cmd + Shift + R`
   - **Windows/Linux :** `Ctrl + Shift + R`
   
   ⚠️ Le navigateur cache les catégories. Un simple F5 ne suffit pas !

---

## Environnement de Développement

### 1️⃣ Développement Local

#### Terminal 1 : Backend Local (Optionnel)

```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Que fait ce command ?**
- Lance FastAPI avec hot-reload
- Port 8000 (CORS configuré pour localhost:3000)
- Charge le modèle TensorFlow au démarrage

#### Terminal 2 : Frontend Local

```bash
cd frontend
npm start
```

**Configuration active :** `.env.local`
- Firebase : Émulateurs OU production (selon `REACT_APP_USE_EMULATOR`)
- Backend : `http://localhost:8000`
- Hot-reload activé

#### Terminal 3 : Émulateurs Firebase (Optionnel)

```bash
# À la racine du projet
firebase emulators:start
```

**Ports par défaut :**
- Firestore : `localhost:8080`
- Auth : `localhost:9099`
- UI : `localhost:4000`

**💡 Conseil :** Utiliser émulateurs pour tester auth/firestore sans affecter production.

---

### 2️⃣ Vérification Configuration

```bash
# Backend : Vérifier que le modèle charge
curl http://localhost:8000/health

# Réponse attendue :
{
  "status": "healthy",
  "model_version": "v1.0.0",
  "model_loaded": true,
  "categories_count": 20
}

# Frontend : Ouvrir navigateur
open http://localhost:3000
```

---

## Workflow Quotidien

### 📅 Routine de Développement

#### 🌅 Matin : Setup

```bash
# 1. Pull derniers changements
git pull origin main

# 2. Installer nouvelles dépendances (si package.json modifié)
cd frontend && npm install
cd ../backend && pip install -r requirements.txt

# 3. Lancer environnement dev
cd frontend
npm start  # ✅ Utilise .env.local automatiquement
```

#### 🌆 Développement

```bash
# Créer branche feature
git checkout -b feature/nouvelle-fonctionnalite

# Développer, tester, itérer...
# L'app utilise émulateurs + localhost:8000

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
./deploy.sh all  # Script gère tout automatiquement
```

---

### 🚀 Déploiement

#### Option A : Script Automatisé (✅ Recommandé)

```bash
# À la racine du projet
./deploy.sh frontend    # Frontend uniquement
./deploy.sh backend     # Backend uniquement
./deploy.sh firestore   # Règles Firestore uniquement
./deploy.sh all         # Tout déployer
```

**Avantages :**
- ✅ Gère automatiquement `.env.local`
- ✅ Build avec bonne config
- ✅ Déploie sur Firebase/Cloud Run
- ✅ Restaure environnement local

**Ce que fait le script :**
1. Sauvegarde `.env.local` → `.env.local.bak`
2. Build avec `.env.production`
3. Deploy sur Firebase/Cloud Run
4. Restaure `.env.local.bak` → `.env.local`

#### Option B : Scripts npm (Frontend uniquement)

```bash
cd frontend

# Build de production
npm run build:prod

# Build + Deploy Firebase
npm run deploy

# Build + Deploy complet
npm run deploy:full
```

#### Option C : Manuelle (❌ Non recommandé)

```bash
# Frontend
cd frontend
mv .env.local .env.local.bak
npm run build
mv .env.local.bak .env.local
cd ..
firebase deploy --only hosting

# Backend
cd backend
gcloud run deploy ai-pictionary-backend \
  --source . \
  --region europe-west1 \
  --env-vars-file env.yaml
```

---

## Étapes de Finalisation Phase 2

### ✅ ÉTAPE 1 : Configuration Backend (15 min)

#### 1.1 Créer fichier .env

```bash
cd backend
cp .env.example .env
```

#### 1.2 Générer Admin API Key

```bash
openssl rand -hex 32
# Exemple sortie : 8f3a9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a
```

#### 1.3 Éditer backend/.env

```bash
# Remplacer par la clé générée
ADMIN_API_KEY=8f3a9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a

# Vérifier chemin Firebase
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json

# Mode dev
DEBUG=True
ENVIRONMENT=development
```

#### 1.4 Vérifier serviceAccountKey.json

```bash
ls backend/serviceAccountKey.json

# Si absent, télécharger depuis :
# Firebase Console → Project Settings → Service Accounts → Generate new private key
```

---

### ✅ ÉTAPE 2 : Installer React Router (10 min)

```bash
cd frontend
npm install react-router-dom

# Vérifier installation
npm list react-router-dom
# Devrait afficher : react-router-dom@6.x.x
```

---

### ✅ ÉTAPE 3 : Intégrer React Router (30 min)

#### 3.1 Structure de Routing

**Routes à implémenter :**
- `/` - Page principale (dessin)
- `/multiplayer` - Lobby multiplayer
- `/multiplayer/race/:gameId` - Race Mode
- `/multiplayer/guessing/:gameId` - Guessing Game
- `/settings` - Settings utilisateur

#### 3.2 Exemple App.js avec Routing

```javascript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DrawingCanvas from './components/DrawingCanvas';
import MultiplayerLobby from './components/Multiplayer/MultiplayerLobby';
import GuessingGame from './components/Multiplayer/GuessingGame';
import Settings from './components/Settings/Settings';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DrawingCanvas />} />
        <Route path="/multiplayer" element={<MultiplayerLobby />} />
        <Route path="/multiplayer/guessing/:gameId" element={<GuessingGame />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}
```

#### 3.3 Tester Routes

```bash
cd frontend
npm start

# Tester dans navigateur :
# http://localhost:3000/
# http://localhost:3000/settings
# http://localhost:3000/multiplayer
```

---

### ✅ ÉTAPE 4 : Intégrer Settings dans DrawingCanvas (20 min)

#### 4.1 Utiliser useSettings Hook

```javascript
import { useSettings } from '../hooks/useSettings';

function DrawingCanvas() {
  const { settings } = useSettings();
  
  // Utiliser settings :
  const { 
    streamingPredictions,    // true/false
    predictionDebounce,      // 100-1000ms
    confidenceThreshold,     // 50-95%
    autoShowModal            // true/false
  } = settings;
  
  // Implémenter logique...
}
```

#### 4.2 Tester Streaming Mode

1. Aller dans `/settings`
2. Activer "Streaming Predictions"
3. Dessiner → Vérifier prédictions automatiques
4. Désactiver → Vérifier bouton "Get Prediction" apparaît

---

### ✅ ÉTAPE 5 : Tests End-to-End Guessing Game (45 min)

#### 5.1 Démarrer Services

```bash
# Terminal 1 : Backend
cd backend
python -m uvicorn main:app --reload --port 8000

# Terminal 2 : Frontend
cd frontend
npm start
```

#### 5.2 Scénarios de Test

**Test 1 : Créer Partie**
1. Naviguer vers `/multiplayer`
2. Cliquer "Create Guessing Game"
3. Vérifier création lobby dans Firestore
4. Copier URL partie

**Test 2 : Rejoindre (2ème utilisateur)**
1. Ouvrir fenêtre incognito
2. Se connecter avec autre compte
3. Coller URL partie
4. Cliquer "Join Game"

**Test 3 : Jouer Partie Complète**
1. Joueur 1 : "Start Game"
2. Drawer : Dessiner catégorie affichée
3. Guesser : Taper réponse
4. Vérifier :
   - ✅ Prédictions IA affichées
   - ✅ Chat fonctionne
   - ✅ Timer décompte (90s)
   - ✅ Scores mis à jour
   - ✅ Round suivant démarre

**Test 4 : Victoire Humains**
1. Deviner avant IA ≥85%
2. Vérifier message victoire
3. Vérifier scores finaux

**Test 5 : Victoire IA**
1. Ne pas deviner
2. Attendre IA ≥85%
3. Vérifier IA gagne

---

### ✅ ÉTAPE 6 : Cloud Scheduler (OPTIONNEL - Production)

⚠️ **Uniquement pour production déployée sur Cloud Run**

#### 6.1 Prérequis

- Backend déployé sur Cloud Run
- Projet Google Cloud configuré

#### 6.2 Activer API

```bash
gcloud auth login
gcloud config set project ai-pictionary-4f8f2
gcloud services enable cloudscheduler.googleapis.com
```

#### 6.3 Créer Job Hebdomadaire

```bash
PROJECT_ID="ai-pictionary-4f8f2"
REGION="europe-west1"
SERVICE_URL="https://ai-pictionary-backend-1064461234232.europe-west1.run.app"
ADMIN_API_KEY="<votre_admin_api_key>"

gcloud scheduler jobs create http retrain-model-weekly \
  --location=${REGION} \
  --schedule="0 2 * * 0" \
  --time-zone="Europe/Paris" \
  --uri="${SERVICE_URL}/admin/retrain" \
  --http-method=POST \
  --headers="Authorization=Bearer ${ADMIN_API_KEY}" \
  --description="Réentraînement hebdomadaire CNN" \
  --attempt-deadline=3600s \
  --project=${PROJECT_ID}
```

#### 6.4 Tester Manuellement

```bash
gcloud scheduler jobs run retrain-model-weekly --location=europe-west1
```

---

## Tests & Validation

### 📋 Checklist Frontend

- [ ] Settings : Save/Load fonctionne
- [ ] Settings : Reset to defaults
- [ ] Guessing Game : Créer lobby
- [ ] Guessing Game : Rejoindre lobby
- [ ] Guessing Game : Dessiner
- [ ] Guessing Game : Deviner
- [ ] Guessing Game : Chat temps réel
- [ ] Guessing Game : Prédictions IA
- [ ] Guessing Game : Victoire humains/IA
- [ ] Navigation entre pages (routing)
- [ ] Streaming predictions ON/OFF
- [ ] Modal correction apparaît (<85%)

### 📋 Checklist Backend

- [ ] `/health` retourne 200 + model_loaded
- [ ] `/admin/retrain` (avec ADMIN_API_KEY)
- [ ] `/games/guessing/create`
- [ ] `/games/guessing/join`
- [ ] `/games/guessing/start`
- [ ] `/games/guessing/submit-guess`
- [ ] `/games/guessing/chat`
- [ ] Rate limiting (100 req/min)
- [ ] Firestore writes correctes

### 🧪 Tests en Conditions Réelles

```bash
# Terminal 1 : Backend avec logs
cd backend
python -m uvicorn main:app --reload --log-level debug

# Terminal 2 : Frontend
cd frontend
npm start

# Terminal 3 : Monitorer Firestore
# Firebase Console → Firestore → Observer collections games, sessions
```

### 📊 Vérification Post-Déploiement

```bash
# 1. Frontend accessible
curl -I https://ai-pictionary-4f8f2.web.app

# 2. Backend accessible
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health

# 3. Firestore rules déployées
firebase firestore:rules get
```

**Consoles à vérifier :**
- Firebase : https://console.firebase.google.com/project/ai-pictionary-4f8f2
- Cloud Run : https://console.cloud.google.com/run?project=ai-pictionary-4f8f2

---

## Déploiement

### 🚢 Frontend (Firebase Hosting)

```bash
cd frontend

# Build
npm run build

# Vérifier taille bundle
ls -lh build/static/js/*.js

# Déployer
firebase deploy --only hosting

# Ou via script
cd ..
./deploy.sh frontend
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

# Ou via script
cd ..
./deploy.sh backend
```

### 🚢 Firestore Rules

```bash
firebase deploy --only firestore:rules

# Ou via script
./deploy.sh firestore
```

---

## Optimisations Avancées

### ⚡ Code Splitting (Optionnel)

```javascript
import { lazy, Suspense } from 'react';

const Settings = lazy(() => import('./components/Settings/Settings'));
const GuessingGame = lazy(() => import('./components/Multiplayer/GuessingGame'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/multiplayer/guessing/:gameId" element={<GuessingGame />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
```

**Gains attendus :** -30% taille bundle initial

### 📱 PWA Setup (Optionnel)

#### 1. Créer manifest.json

```json
{
  "name": "AI Pictionary",
  "short_name": "Pictionary",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#4F46E5",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 2. Register Service Worker

```javascript
// index.js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}
```

### 🎛️ Firebase Remote Config (Optionnel)

```javascript
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';

const remoteConfig = getRemoteConfig();
await fetchAndActivate(remoteConfig);

const debounce = getValue(remoteConfig, 'prediction_debounce').asNumber();
const threshold = getValue(remoteConfig, 'confidence_threshold').asNumber();
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

**Cause :** Émulateurs Firebase non démarrés

**Solution :**
```bash
firebase emulators:start
```

#### CORS errors en production

**Cause :** Backend non configuré pour domaine frontend

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

#### React Router 404 après deploy

**Cause :** Firebase Hosting rewrites manquants

**Solution :** Vérifier `firebase.json` :

```json
{
  "hosting": {
    "public": "frontend/build",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

---

## 📝 Bonnes Pratiques

### ✅ À FAIRE

1. **Commiter `.env.production`** (config publique)
   ```bash
   git add frontend/.env.production backend/env.yaml
   ```

2. **NE JAMAIS commiter** `.env.local`, `.env`, `serviceAccountKey.json`

3. **Utiliser scripts** pour déployer
   ```bash
   ./deploy.sh frontend  # Au lieu de commandes manuelles
   ```

4. **Tester localement** avant déployer
   ```bash
   npm start  # Vérifier tout fonctionne
   ```

5. **Vérifier variables env**
   ```bash
   cat frontend/.env.production
   ```

### ❌ À ÉVITER

1. ❌ Éditer manuellement `.env.local` avant build
2. ❌ Commiter secrets dans `.env.production`
3. ❌ Déployer sans tester localement
4. ❌ Oublier restaurer `.env.local` après build manuel
5. ❌ Mettre URLs production dans `.env.local`

---

## 📊 Récapitulatif

| Environnement | Fichier | Backend URL | Firebase | Commande |
|---------------|---------|-------------|----------|----------|
| **Dev Local** | `.env.local` | `localhost:8000` | Émulateurs | `npm start` |
| **Production** | `.env.production` | Cloud Run URL | Firebase réel | `./deploy.sh` |

**Règle d'or :** Utilisez les scripts automatisés (`./deploy.sh` ou `npm run deploy`) pour éviter les erreurs ! 🎯

---

## 📚 Documentation Complémentaire

- **[GETTING_STARTED.md](GETTING_STARTED.md)** — Guide démarrage rapide
- **[INFRASTRUCTURE.md](INFRASTRUCTURE.md)** — Configuration Firebase & Cloud Run
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** — État d'avancement
- **[TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md)** — Justifications techniques
- **[SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md)** — Procédures sécurité

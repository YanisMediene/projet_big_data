# 🏗️ Infrastructure & Deployment Guide

Guide pour configurer Firebase, Cloud Run, et les services associés.

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Firebase Setup](#firebase-setup)
3. [Firebase Realtime Database](#firebase-realtime-database)
4. [Cloud Run Deployment](#cloud-run-deployment)
5. [API Endpoints](#api-endpoints)
6. [Variables d'Environnement](#variables-denvironnement)
7. [Monitoring & Logs](#monitoring--logs)
8. [Dépannage](#dépannage)

---

## Vue d'ensemble

### Architecture Infrastructure

| Service | Usage | Localisation |
|---------|-------|--------------|
| **Firestore Database** | Games metadata, corrections | europe-west1 |
| **Firebase Realtime Database** | Multiplayer sync (drawing, chat, presence) | us-central1 |
| **Firebase Storage** | Drawings, models | europe-west1 |
| **Firebase Hosting** | Frontend CDN | Global |
| **Google Cloud Run** | Backend API (FastAPI + TensorFlow) | europe-west1 |

> ⚠️ **Note :** Firebase Authentication est configuré mais **non utilisé** dans l'application actuelle. Les joueurs s'identifient par pseudo + emoji sans compte persistant. Voir [archive/AUTHENTICATION.md](archive/AUTHENTICATION.md) pour la documentation archivée.

### URLs Production

| Service | URL |
|---------|-----|
| **Frontend** | https://ai-pictionary-4f8f2.web.app |
| **Backend API** | https://ai-pictionary-backend-1064461234232.europe-west1.run.app |
| **API Docs** | /docs |

---

## Firebase Setup

### Étape 1 : Créer un Projet Firebase

1. Visiter https://console.firebase.google.com/
2. **"Add project"** → Nom : `ai-pictionary`
3. Google Analytics : Optionnel

### Étape 2 : Firestore Database

1. **"Firestore Database"** → **"Create database"**
2. Mode : **Production**
3. Localisation : **europe-west1**

**Collections :**

| Collection | Usage |
|------------|-------|
| `games` | Metadata parties (mode, players, status) |
| `corrections` | Corrections utilisateurs pour retraining |

### Étape 3 : Firebase Storage

1. **"Storage"** → **"Get started"**
2. Localisation : **europe-west1**

**Structure :**
```
/drawings/
/models/
  /production/
```

### Étape 4 : Service Account Key

1. Project Settings → **"Service accounts"**
2. **"Generate new private key"**
3. Sauvegarder : `backend/serviceAccountKey.json`

⚠️ **NE JAMAIS commiter ce fichier !**

### Étape 5 : Firebase Config (Frontend)

1. Project Settings → **"Add app"** (Web)
2. Copier config dans `frontend/.env.local` :

```bash
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_PROJECT_ID=ai-pictionary-4f8f2
REACT_APP_FIREBASE_STORAGE_BUCKET=ai-pictionary-4f8f2.appspot.com
REACT_APP_FIREBASE_DATABASE_URL=https://ai-pictionary-4f8f2-default-rtdb.firebaseio.com
```

---

## Firebase Realtime Database

### Pourquoi RTDB ?

Pour le mode **Team vs IA**, la synchronisation en temps réel du canvas nécessite des updates à **100ms**. Firestore ne supporte pas cette fréquence efficacement.

**Comparaison :**

| Aspect | Firestore | Realtime DB ✅ |
|--------|-----------|----------------|
| Latence updates | ~500ms | ~100ms |
| Sync canvas | ❌ Trop lent | ✅ Temps réel |
| Coût par write | $0.18/100K | $0 (free tier) |
| Structure | Flexible queries | Arbre JSON |

### Structure RTDB

```
games/
└── ${roomCode}/
    ├── currentDrawing        # PNG base64 (sync toutes les 100ms)
    ├── currentCategory       # Catégorie à dessiner
    ├── currentRound          # Numéro du round actuel
    ├── currentDrawerId       # ID du dessinateur actuel
    ├── aiGuessedCorrectly    # Boolean - IA a trouvé ?
    ├── gameStatus            # "lobby" | "playing" | "ended"
    ├── chat/                 # Messages des guessers
    │   └── ${messageId}/
    │       ├── text
    │       ├── sender
    │       └── timestamp
    ├── players/
    │   └── ${playerId}/
    │       ├── name
    │       ├── avatar (emoji)
    │       ├── score
    │       ├── isReady
    │       └── isOnline
    └── presence/
        └── ${playerId}/
            ├── lastSeen
            └── isOnline
```

### Activer RTDB

1. Firebase Console → **"Realtime Database"**
2. **"Create database"**
3. Localisation : **us-central1** (seule option gratuite)
4. Mode : **Locked** (on ajoutera les règles)

### Règles RTDB

Dans Firebase Console → Realtime Database → **Rules** :

```json
{
  "rules": {
    "games": {
      "$gameId": {
        ".read": true,
        ".write": true,
        "players": {
          "$playerId": {
            ".write": true
          }
        },
        "chat": {
          ".write": true
        },
        "presence": {
          "$playerId": {
            ".write": true
          }
        }
      }
    }
  }
}
```

### Frontend Integration

```javascript
// frontend/src/services/multiplayerService.js
import { getDatabase, ref, set, onValue, push } from 'firebase/database';

const db = getDatabase();

// Créer une partie
export const createGame = async (gameMode, playerName, playerEmoji) => {
  const roomCode = generateRoomCode();
  const playerId = generatePlayerId();
  
  await set(ref(db, `games/${roomCode}`), {
    gameMode,
    currentRound: 0,
    gameStatus: 'lobby',
    players: {
      [playerId]: {
        name: playerName,
        avatar: playerEmoji,
        score: 0,
        isReady: false,
        isOnline: true
      }
    }
  });
  
  return { roomCode, playerId };
};

// Sync canvas en temps réel
export const updateDrawing = async (roomCode, imageData) => {
  await set(ref(db, `games/${roomCode}/currentDrawing`), imageData);
};

// Écouter les changements
export const subscribeToGame = (roomCode, callback) => {
  const gameRef = ref(db, `games/${roomCode}`);
  return onValue(gameRef, (snapshot) => {
    callback(snapshot.val());
  });
};
```

---

## Cloud Run Deployment

### Prérequis

```bash
# Installer Google Cloud SDK
curl https://sdk.cloud.google.com | bash

# Login
gcloud auth login
gcloud config set project ai-pictionary-4f8f2

# Activer APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### Fichier env.yaml

```yaml
MODEL_VERSION: "v4.0.0"
MODEL_PATH: "/app/models/quickdraw_v4.0.0.h5"
FIREBASE_DATABASE_URL: "https://ai-pictionary-4f8f2-default-rtdb.firebaseio.com"
CORS_ORIGINS: "http://localhost:3000,https://ai-pictionary-4f8f2.web.app"
FIREBASE_CREDENTIALS_PATH: "./serviceAccountKey.json"
ADMIN_API_KEY: "your_secure_admin_key_here"
```

### Déployer

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

### Vérifier

```bash
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health
```

---

## API Endpoints

### Vue d'ensemble (34 endpoints)

| Groupe | Count | Base Path |
|--------|-------|-----------|
| Core | 5 | `/` |
| Admin | 6 | `/admin/` |
| Race Mode | 8 | `/games/race/` |
| Guessing Mode | 11 | `/games/guessing/` |
| Presence | 5 | `/games/presence/` |

### Core (5)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/` | Root - Info API |
| GET | `/health` | Health Check |
| GET | `/categories` | Get Categories (50) |
| POST | `/predict` | Predict Drawing |
| POST | `/save_correction` | Save Correction |

### Admin (6)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/admin/retrain` | Trigger Retrain |
| GET | `/admin/retrain/status/{job_id}` | Get Retrain Status |
| GET | `/admin/health` | Admin Health |
| POST | `/admin/cleanup/abandoned-games` | Cleanup Abandoned Games |
| POST | `/admin/cleanup/sync-presence/{game_id}` | Sync Presence |
| DELETE | `/admin/games/{game_id}` | Delete Game |

### Race Mode (8)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/games/race/create` | Create Race Game |
| POST | `/games/race/join` | Join Race Game |
| POST | `/games/race/start` | Start Race Game |
| POST | `/games/race/submit-drawing` | Submit Drawing |
| GET | `/games/race/{game_id}` | Get Game State |
| POST | `/games/race/timeout` | Race Timeout |
| GET | `/games/race/lobby/list` | List Lobbies |
| POST | `/games/race/leave` | Leave Game |

### Guessing Mode (11)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/games/guessing/create` | Create Game |
| POST | `/games/guessing/join` | Join Game |
| POST | `/games/guessing/start` | Start Game |
| POST | `/games/guessing/submit-guess` | Submit Guess |
| POST | `/games/guessing/chat` | Send Chat |
| POST | `/games/guessing/update-canvas` | Update Canvas |
| POST | `/games/guessing/ai-prediction` | AI Prediction |
| GET | `/games/guessing/{game_id}` | Get Game State |
| GET | `/games/guessing/lobby/list` | List Lobbies |
| POST | `/games/guessing/timeout` | Timeout |
| POST | `/games/guessing/leave` | Leave Game |

### Presence (5)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/games/presence/online` | Set Online |
| POST | `/games/presence/offline` | Set Offline |
| POST | `/games/presence/heartbeat` | Heartbeat |
| GET | `/games/presence/{game_id}` | Get Presence |
| POST | `/games/cleanup/stale-players/{game_id}` | Cleanup Stale |

---

## Variables d'Environnement

### Backend (.env)

```bash
ADMIN_API_KEY=<openssl rand -hex 32>
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://ai-pictionary-4f8f2-default-rtdb.firebaseio.com
MODEL_VERSION=v4.0.0
ENVIRONMENT=development
DEBUG=True
```

### Frontend (.env.local)

```bash
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_PROJECT_ID=ai-pictionary-4f8f2
REACT_APP_FIREBASE_DATABASE_URL=https://ai-pictionary-4f8f2-default-rtdb.firebaseio.com
REACT_APP_API_BASE_URL=http://localhost:8000
```

### Production (env.yaml)

```yaml
MODEL_VERSION: "v4.0.0"
CORS_ORIGINS: "https://ai-pictionary-4f8f2.web.app"
ADMIN_API_KEY: "<your-key>"
```

---

## Monitoring & Logs

### Cloud Run Logs

```bash
# Voir logs récents
gcloud run services logs read ai-pictionary-backend --region europe-west1

# Logs en temps réel
gcloud run services logs tail ai-pictionary-backend --region europe-west1
```

### Console URLs

- **Cloud Run :** https://console.cloud.google.com/run?project=ai-pictionary-4f8f2
- **Firebase :** https://console.firebase.google.com/project/ai-pictionary-4f8f2

### Métriques

| Métrique | Valeur Normale |
|----------|----------------|
| Latence warm | 120-350ms |
| Cold start | 5-8s |
| Inférence CNN | 12-18ms |
| Memory | ~500MB |

---

## Dépannage

### CORS Errors

Vérifier `CORS_ORIGINS` dans `env.yaml` inclut le domaine frontend :
```yaml
CORS_ORIGINS: "https://ai-pictionary-4f8f2.web.app,http://localhost:3000"
```

### Cold Start Lent

Si >10s, augmenter `--min-instances 1` pour garder une instance warm.

### RTDB Connection Failed

1. Vérifier `REACT_APP_FIREBASE_DATABASE_URL` dans `.env.local`
2. Vérifier règles RTDB (pas trop restrictives)
3. Vérifier quota RTDB (Firebase Console)

### Model Not Loading

1. Vérifier `MODEL_VERSION` correspond aux fichiers existants
2. Vérifier `backend/models/quickdraw_v4.0.0.h5` existe
3. Vérifier `backend/models/quickdraw_v4.0.0_metadata.json` existe

---

## 📚 Documentation Complémentaire

- [GETTING_STARTED.md](GETTING_STARTED.md) — Guide démarrage rapide
- [DEVELOPMENT.md](DEVELOPMENT.md) — Workflow développement
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — État d'avancement
- [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md) — Référence technique

# 🏗️ Infrastructure & Deployment Guide

Guide complet pour configurer Firebase, déployer sur Cloud Run, et mettre en place l'automatisation.

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Firebase Setup](#firebase-setup)
3. [Cloud Run Deployment](#cloud-run-deployment)
4. [Cloud Scheduler (Automatisation)](#cloud-scheduler-automatisation)
5. [Variables d'Environnement](#variables-denvironnement)
6. [Monitoring & Logs](#monitoring--logs)
7. [Sécurité](#sécurité)
8. [Dépannage](#dépannage)

---

## Vue d'ensemble

### Architecture Infrastructure

AI Pictionary utilise une architecture cloud moderne :

| Service | Usage | Localisation |
|---------|-------|--------------|
| **Firebase Authentication** | Google + Email/Password auth | Global |
| **Firestore Database** | NoSQL (users, sessions, corrections, games) | europe-west1 |
| **Firebase Realtime Database** | Multiplayer sync (Team vs IA, drawing, chat, presence) | us-central1 |
| **Firebase Storage** | Drawings, models, datasets | europe-west1 |
| **Firebase Hosting** | Frontend CDN | Global |
| **Google Cloud Run** | Backend API (FastAPI + TensorFlow) | europe-west1 |
| **Cloud Scheduler** | Active Learning automation (weekly) | europe-west1 |
| **Cloud Build** | Docker image CI/CD | europe-west1 |

### URLs Production Actuelles

| Service | URL | Statut |
|---------|-----|--------|
| **Frontend** | https://ai-pictionary-4f8f2.web.app | ✅ Live |
| **Backend API** | https://ai-pictionary-backend-1064461234232.europe-west1.run.app | ✅ Live |
| **Health Check** | [/health](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health) | ✅ Healthy |
| **API Docs** | [/docs](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/docs) | 📚 Available |

---

## Firebase Setup

### Étape 1 : Créer un Projet Firebase

#### 1.1 Console Firebase

Visitez : https://console.firebase.google.com/

#### 1.2 Créer Nouveau Projet

1. Cliquer sur **"Add project"**
2. Nom du projet : `ai-pictionary` (ou votre choix)
3. Google Analytics : **Optionnel** (recommandé pour tracking)
4. Cliquer sur **"Create project"**

---

### Étape 2 : Activer Authentication

#### 2.1 Navigation

1. Dans Firebase Console, cliquer sur **"Authentication"** (sidebar gauche)
2. Cliquer sur **"Get started"**

#### 2.2 Méthodes de Connexion

**Google Sign-In :**
1. Onglet **"Sign-in method"**
2. Cliquer sur **"Google"**
3. Toggle **"Enable"**
4. Email support : votre email
5. **"Save"**

**Email/Password :**
1. Cliquer sur **"Email/Password"**
2. Activer :
   - ✅ Email/Password
   - ✅ Email link (optionnel, passwordless)
3. **"Save"**

---

### Étape 3 : Créer Firestore Database

#### 3.1 Navigation

1. **"Firestore Database"** (sidebar)
2. **"Create database"**

#### 3.2 Mode Database

- **Production mode** ✅ (recommandé)
  - Sécurisé par défaut
  - Rules ajoutées plus tard

#### 3.3 Localisation

Choisir région la plus proche de vos utilisateurs :
- **us-central1** (Iowa, USA)
- **europe-west1** (Belgium, Europe) ✅ Choix actuel
- **asia-northeast1** (Tokyo, Asia)

⚠️ **La localisation ne peut pas être changée après !**

#### 3.4 Collections Initiales

**Collection : `users`**
```
users/{userId}
  - displayName: string
  - email: string
  - photoURL: string
  - createdAt: timestamp
  - statistics: map
    - totalDrawings: number (0)
    - correctGuesses: number (0)
    - gamesPlayed: number (0)
    - winRate: number (0.0)
```

**Collection : `sessions`**
```
sessions/{sessionId}
  - userId: string
  - mode: string ("solo" | "race" | "guessing")
  - startTime: timestamp
  - endTime: timestamp
  - category: string
  - score: number
  - status: string ("active" | "completed")

  → Subcollection: drawings/{drawingId}
    - imageUrl: string
    - timestamp: timestamp
    - prediction: string
    - confidence: number
    - correctLabel: string
    - wasCorrect: boolean
```

**Collection : `corrections`**
```
corrections/{correctionId}
  - drawingId: string
  - sessionId: string
  - originalPrediction: string
  - correctedLabel: string
  - userId: string
  - timestamp: timestamp
  - modelVersion: string
  - imageStoragePath: string
```

**Collection : `models`**
```
models/{version}
  - version: string (e.g., "v1.0.0")
  - createdAt: timestamp
  - storagePath: string
  - active: boolean
  - metrics: map
    - accuracy: number
    - loss: number
    - trainingSamples: number
    - corrections: number
```

**Collection : `games`** (multiplayer)
```
games/{gameId}
  - mode: string ("race" | "guessing")
  - category: string
  - players: array
    - {userId: string, displayName: string, status: string}
  - currentDrawerId: string
  - startTime: timestamp
  - endTime: timestamp
  - winner: string
  - status: string

  → Subcollection: turns/{turnId}
    - playerId: string
    - drawingData: string (base64)
    - prediction: string
    - timestamp: timestamp
    - score: number
```

---

### Étape 4 : Firestore Security Rules

#### 4.1 Onglet Rules

Cliquer sur **"Rules"** dans Firestore

#### 4.2 Règles de Sécurité

Remplacer les règles par défaut avec :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isOwner(userId);
    }
    
    // Sessions collection
    match /sessions/{sessionId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if isOwner(resource.data.userId);
      
      // Drawings subcollection
      match /drawings/{drawingId} {
        allow read: if isSignedIn();
        allow write: if isSignedIn();
      }
    }
    
    // Corrections collection
    match /corrections/{correctionId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if isOwner(resource.data.userId);
    }
    
    // Models collection (read-only for clients)
    match /models/{version} {
      allow read: if true;  // Public read access
      allow write: if false;  // Only backend can write
    }
    
    // Games collection (multiplayer)
    match /games/{gameId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update: if isSignedIn() && 
                       request.auth.uid in resource.data.players[].userId;
      
      // Turns subcollection
      match /turns/{turnId} {
        allow read: if isSignedIn();
        allow write: if isSignedIn();
      }
    }
  }
}
```

#### 4.3 Publier

Cliquer sur **"Publish"**

---

### Étape 5 : Firebase Storage

#### 5.1 Navigation

1. **"Storage"** (sidebar)
2. **"Get started"**

#### 5.2 Mode Sécurité

- **Production mode** ✅

#### 5.3 Localisation

**Utiliser la même région que Firestore** (europe-west1) pour performance

#### 5.4 Structure Dossiers

Créer manuellement :
```
/drawings
  /raw
  /processed
/models
  /production
    /current
    /archived
  /training
/datasets
  /quick_draw_original
  /corrections
```

---

### Étape 6 : Storage Security Rules

#### 6.1 Onglet Rules

Cliquer sur **"Rules"** dans Storage

#### 6.2 Règles de Sécurité

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Drawings: authenticated users can upload
    match /drawings/{sessionId}/{drawingId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Models: public read, backend-only write
    match /models/{allPaths=**} {
      allow read: if true;  // Public access (model download)
      allow write: if false;  // Only backend with admin SDK
    }
    
    // Datasets: backend-only access
    match /datasets/{allPaths=**} {
      allow read, write: if false;  // Admin SDK only
    }
  }
}
```

#### 6.3 Publier

---

### Étape 7 : Service Account Key (Backend)

#### 7.1 Project Settings

1. Cliquer sur **gear icon** ⚙️ → "Project settings"
2. Onglet **"Service accounts"**

#### 7.2 Générer Clé

1. **"Generate new private key"**
2. **"Generate key"**
3. Sauvegarder : `serviceAccountKey.json`

#### 7.3 Ajouter au Backend

```bash
# Déplacer vers backend/
mv ~/Downloads/serviceAccountKey.json backend/

# ⚠️ NE JAMAIS commiter ce fichier !
# Déjà dans .gitignore: *serviceAccountKey*.json
```

#### 7.4 Backend .env

```bash
# backend/.env
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
```

---

### Étape 8 : Firebase Config (Frontend)

#### 8.1 Ajouter Web App

1. Project Settings → **"Add app"**
2. Sélectionner **Web** (</> icon)
3. App nickname : `ai-pictionary-web`
4. ✅ Firebase Hosting (optionnel)
5. **"Register app"**

#### 8.2 Copier Config

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "ai-pictionary-4f8f2.firebaseapp.com",
  projectId: "ai-pictionary-4f8f2",
  storageBucket: "ai-pictionary-4f8f2.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

#### 8.3 Frontend .env.local

```bash
REACT_APP_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_FIREBASE_AUTH_DOMAIN=ai-pictionary-4f8f2.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ai-pictionary-4f8f2
REACT_APP_FIREBASE_STORAGE_BUCKET=ai-pictionary-4f8f2.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

---

### Étape 9 : Firestore Indexes

Pour requêtes performantes, créer indexes composites :

#### 9.1 Onglet Indexes

**"Indexes"** dans Firestore

#### 9.2 Créer Indexes

**Index 1 : Corrections par version et timestamp**
- Collection : `corrections`
- Champs :
  - `modelVersion` (Ascending)
  - `timestamp` (Descending)

**Index 2 : Sessions par user et timestamp**
- Collection : `sessions`
- Champs :
  - `userId` (Ascending)
  - `startTime` (Descending)

**Index 3 : Games par status et timestamp**
- Collection : `games`
- Champs :
  - `status` (Ascending)
  - `startTime` (Descending)

#### 9.3 Auto-création

Firebase suggère indexes quand requêtes échouent. Accepter suggestions dans console.

---

## Cloud Run Deployment

### Pourquoi Cloud Run ?

**Cloud Run vs Cloud Functions :**

| Aspect | Cloud Run ✅ | Cloud Functions |
|--------|--------------|------------------|
| **Container Support** | Custom Dockerfile | Buildpacks only |
| **Memory Limit** | 32 GB | 16 GB |
| **TensorFlow Model** | ✅ 500MB+ image OK | ⚠️ Complex setup |
| **Cold Start** | 2-5s (predictable) | 3-8s (variable) |
| **Scaling Control** | min/max instances | Auto only |
| **Cost (100 DAU)** | $0 (free tier) | $0 (free tier) |

**Verdict :** Cloud Run choisi pour :
- TensorFlow 2.16.2 + model = ~500MB Docker image
- Contrôle précis startup container (load model once)
- Cold starts prévisibles vs initialization variable
- Déploiement Docker = tests locaux possibles

---

### Étape 1 : Installer Google Cloud SDK

**macOS/Linux :**
```bash
# Télécharger et installer
curl https://sdk.cloud.google.com | bash

# Redémarrer shell
exec -l $SHELL

# Vérifier
gcloud --version
```

**Windows :**
1. Télécharger : https://cloud.google.com/sdk/docs/install
2. Exécuter `GoogleCloudSDKInstaller.exe`
3. Suivre wizard

---

### Étape 2 : Authentification

```bash
# Login Google Cloud
gcloud auth login

# Définir project ID (utiliser votre Firebase project ID)
gcloud config set project ai-pictionary-4f8f2

# Vérifier config
gcloud config list
```

---

### Étape 3 : Activer APIs

```bash
gcloud services enable run.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

### Étape 4 : Fichier env.yaml

Créer `backend/env.yaml` :

```yaml
# Model configuration
MODEL_VERSION: "v1.0.0"
MODEL_PATH: "/app/models/quickdraw_v1.0.0.h5"

# Categories (20 Quick Draw classes)
CATEGORIES: "apple,sun,tree,house,car,cat,fish,star,umbrella,flower,moon,airplane,bicycle,clock,eye,cup,shoe,cloud,lightning,smiley_face"

# CORS configuration
CORS_ORIGINS: "http://localhost:3000,https://ai-pictionary-4f8f2.web.app,https://ai-pictionary-4f8f2.firebaseapp.com"

# Firebase credentials path
FIREBASE_CREDENTIALS_PATH: "./serviceAccountKey.json"

# Admin API key (générer avec: openssl rand -hex 32)
ADMIN_API_KEY: "your_secure_admin_key_here"
```

**Notes Importantes :**
- Utiliser **guillemets** pour toutes les valeurs
- Listes **séparées par virgules** (pas d'espaces)
- **Pas d'arrays** dans env.yaml (limitation gcloud)

---

### Étape 5 : Dockerfile

Créer `backend/Dockerfile` :

```dockerfile
# Python 3.11 (compatible TensorFlow 2.16.2)
FROM python:3.11-slim

WORKDIR /app

# TensorFlow optimization
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    PORT=8080

# System dependencies (TensorFlow requis)
RUN apt-get update && apt-get install -y \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY main.py .
COPY models/ ./models/
COPY middleware/ ./middleware/
COPY routers/ ./routers/
COPY services/ ./services/
COPY monitoring.py .
COPY serviceAccountKey.json .

EXPOSE 8080

# Start command
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1
```

---

### Étape 6 : .dockerignore

Créer `backend/.dockerignore` :

```
__pycache__
*.pyc
*.pyo
*.pyd
.Python
venv/
env/
.env
.env.local
.git
.gitignore
README.md
.DS_Store
*.log
*.sqlite
```

---

### Étape 7 : Déployer sur Cloud Run

```bash
cd backend

# Deploy avec source-based deployment
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

**Paramètres Expliqués :**

| Paramètre | Valeur | Raison |
|-----------|--------|--------|
| `--source .` | Répertoire actuel | Build Docker automatique |
| `--region europe-west1` | Belgium, Europe | Faible latence EU |
| `--memory 1Gi` | 1GB RAM | Suffisant TF + model |
| `--cpu 1` | 1 vCPU | Adéquat pour inférence |
| `--min-instances 0` | Scale-to-zero | Optimisation coût ($0/mois) |
| `--max-instances 10` | Max 10 containers | Gérer pics trafic |
| `--timeout 60s` | 60 secondes | Permettre cold starts |
| `--allow-unauthenticated` | Accès public | Pas d'auth requise API |
| `--env-vars-file env.yaml` | Config env | Variables → container |

**Processus Déploiement :**
1. Cloud Build crée image Docker (~5 min)
2. Image → Container Registry
3. Cloud Run déploie container
4. URL service générée

**Sortie Attendue :**
```
Building using Dockerfile and deploying container to Cloud Run service...
✅ Deploying new service... Done.
✅ Creating Revision... Done.
✅ Routing traffic... Done.

Service URL: https://ai-pictionary-backend-1064461234232.europe-west1.run.app
```

---

### Étape 8 : Vérifier Déploiement

```bash
# Health check
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health

# Réponse attendue :
{
  "status": "healthy",
  "model_version": "v1.0.0",
  "model_loaded": true,
  "categories_count": 20
}

# Test prediction
curl -X POST https://ai-pictionary-backend-1064461234232.europe-west1.run.app/predict \
  -H "Content-Type: application/json" \
  -d '{"image": "your_base64_image_here"}'
```

---

### Étape 9 : Redéployer (Mises à Jour)

Quand vous modifiez le code backend :

```bash
cd backend

# Même commande de déploiement
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

**Cloud Build met en cache les layers** → Déploiements suivants plus rapides (~2 min)

---

### Étape 10 : Optimisation Coûts

**Free Tier Limits (par mois) :**
- **CPU time :** 180,000 vCPU-seconds
- **Memory :** 360,000 GiB-seconds
- **Requests :** 2,000,000

**Usage Actuel (100 DAU) :**
- CPU : ~90,000 vCPU-seconds (✅ dans free tier)
- Memory : ~180,000 GiB-seconds (✅ dans free tier)
- Requests : ~30,000 (✅ dans free tier)

**Coût :** $0/mois ✅

**Optionnel : Éliminer Cold Starts**

Définir `--min-instances 1` pour garder 1 instance warm :

```bash
gcloud run deploy ai-pictionary-backend \
  --min-instances 1 \
  # ... autres params
```

**Coût :** +$5.40/mois (1 instance × 24/7)

---

## Cloud Scheduler (Automatisation)

Configuration pipeline de réentraînement ML automatique.

### Prérequis

- Projet Google Cloud configuré
- Backend déployé sur Cloud Run avec endpoint `/admin/retrain`
- Variable `ADMIN_API_KEY` configurée

---

### Étape 1 : Activer Cloud Scheduler API

```bash
gcloud services enable cloudscheduler.googleapis.com
```

---

### Étape 2 : Créer Job Hebdomadaire

#### Option A : Via gcloud CLI (Recommandé)

```bash
# Variables
PROJECT_ID="ai-pictionary-4f8f2"
REGION="europe-west1"
SERVICE_URL="https://ai-pictionary-backend-1064461234232.europe-west1.run.app"
ADMIN_API_KEY="your_secure_admin_key_here"  # Générer avec: openssl rand -hex 32

# Créer job
gcloud scheduler jobs create http retrain-model-weekly \
  --location=${REGION} \
  --schedule="0 2 * * 0" \
  --time-zone="Europe/Paris" \
  --uri="${SERVICE_URL}/admin/retrain" \
  --http-method=POST \
  --headers="Authorization=Bearer ${ADMIN_API_KEY}" \
  --description="Réentraînement hebdomadaire CNN avec Active Learning" \
  --attempt-deadline=3600s \
  --project=${PROJECT_ID}
```

#### Option B : Via Console

1. [Cloud Scheduler Console](https://console.cloud.google.com/cloudscheduler)
2. **"Créer un job"**
3. Configuration :
   - **Nom :** `retrain-model-weekly`
   - **Région :** `europe-west1`
   - **Fréquence (Cron) :** `0 2 * * 0` (Dimanche 2h)
   - **Fuseau horaire :** `Europe/Paris`
   - **Type :** HTTP
   - **URL :** `https://votre-backend.run.app/admin/retrain`
   - **Méthode :** POST
   - **En-têtes :** `Authorization: Bearer VOTRE_ADMIN_API_KEY`
   - **Timeout :** 3600s (1 heure)

---

### Étape 3 : Format Cron

```
┌───────────── minute (0 - 59)
│ ┌───────────── heure (0 - 23)
│ │ ┌───────────── jour du mois (1 - 31)
│ │ │ ┌───────────── mois (1 - 12)
│ │ │ │ ┌───────────── jour de la semaine (0 - 6) (Dimanche = 0)
│ │ │ │ │
0 2 * * 0  → Chaque dimanche à 2h00
```

**Exemples :**
- **Hebdomadaire (dimanche 2h) :** `0 2 * * 0`
- **Bi-hebdomadaire :** `0 2 */14 * *`
- **Mensuel (1er du mois) :** `0 2 1 * *`
- **Quotidien (3h) :** `0 3 * * *`
- **Toutes les 6 heures :** `0 */6 * * *`

---

### Étape 4 : Générer Admin API Key

```bash
# Clé aléatoire 32 bytes (64 caractères hex)
openssl rand -hex 32

# Exemple sortie :
# 8f3a9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a
```

Ajouter à `backend/env.yaml` et redéployer Cloud Run.

---

### Étape 5 : Tester Manuellement

**Via gcloud CLI :**
```bash
gcloud scheduler jobs run retrain-model-weekly --location=europe-west1
```

**Via curl :**
```bash
curl -X POST https://votre-backend.run.app/admin/retrain \
  -H "Authorization: Bearer VOTRE_ADMIN_API_KEY"
```

**Réponse attendue :**
```json
{
  "status": "triggered",
  "message": "Model retraining pipeline started in background",
  "triggered_at": "2024-12-06T10:30:00",
  "job_id": "retrain_20241206_103000"
}
```

---

### Étape 6 : Monitoring

**Voir logs exécution :**
```bash
gcloud scheduler jobs describe retrain-model-weekly --location=europe-west1
```

**Historique exécutions :**
```bash
gcloud logging read "resource.type=cloud_scheduler_job AND \
  resource.labels.job_id=retrain-model-weekly" \
  --limit=10 \
  --format=json
```

**Logs backend pendant réentraînement :**
```bash
gcloud run logs read ai-pictionary-backend --limit=100
```

---

## Variables d'Environnement

### Backend Production (env.yaml)

```yaml
MODEL_VERSION: "v1.0.0"
MODEL_PATH: "/app/models/quickdraw_v1.0.0.h5"
CATEGORIES: "apple,sun,tree,house,car,cat,fish,star,umbrella,flower,moon,airplane,bicycle,clock,eye,cup,shoe,cloud,lightning,smiley_face"
CORS_ORIGINS: "http://localhost:3000,https://ai-pictionary-4f8f2.web.app,https://ai-pictionary-4f8f2.firebaseapp.com"
FIREBASE_CREDENTIALS_PATH: "./serviceAccountKey.json"
ADMIN_API_KEY: "8fa535ee53c2b26791139f60086404080fc6955869794994a37a0edf440a1f5f"
ENVIRONMENT: "production"
DEBUG: "False"
```

### Frontend Production (.env.production)

```bash
# Firebase config
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=ai-pictionary-4f8f2.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ai-pictionary-4f8f2
REACT_APP_FIREBASE_STORAGE_BUCKET=ai-pictionary-4f8f2.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abcd...

# Backend API (Cloud Run)
REACT_APP_API_BASE_URL=https://ai-pictionary-backend-1064461234232.europe-west1.run.app
```

### Frontend Local (.env.local)

```bash
# Mêmes variables Firebase que production

# Backend API (local ou production selon besoin)
REACT_APP_API_BASE_URL=http://localhost:8000
# OU pour tester contre production :
# REACT_APP_API_BASE_URL=https://ai-pictionary-backend-1064461234232.europe-west1.run.app
```

---

## Monitoring & Logs

### Cloud Run Logs

**Streaming temps réel :**
```bash
gcloud logging tail "resource.type=cloud_run_revision" --format=json
```

**Derniers 50 logs :**
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

**Filtrer par sévérité :**
```bash
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit 20
```

### Métriques Cloud Run

```bash
# Détails service
gcloud run services describe ai-pictionary-backend --region europe-west1

# Métriques
gcloud monitoring time-series list \
  --filter='resource.type="cloud_run_revision"' \
  --format=json
```

### Firebase Logs

**Console Firebase :** https://console.firebase.google.com/project/ai-pictionary-4f8f2/

- **Authentication :** Usage statistics
- **Firestore :** Read/Write metrics
- **Storage :** Bandwidth & operations

---

## Sécurité

### Checklist Sécurité

- ✅ Service account key **NON** dans Git
- ✅ Firestore security rules restreignent write aux owners
- ✅ Storage rules : public read models, auth write drawings
- ✅ Frontend API keys dans `.env.local` (non commités)
- ✅ Production mode Firestore/Storage
- ✅ Indexes composites créés
- ✅ ADMIN_API_KEY sécurisée (32+ bytes)
- ✅ CORS configuré (origins autorisées uniquement)
- ✅ Rate limiting activé (100 req/min)

### Rotation ADMIN_API_KEY

```bash
# 1. Générer nouvelle clé
openssl rand -hex 32

# 2. Mettre à jour backend/env.yaml
nano backend/env.yaml

# 3. Redéployer Cloud Run
cd backend
gcloud run deploy ai-pictionary-backend \
  --source . \
  --region europe-west1 \
  --env-vars-file env.yaml \
  # ... autres params

# 4. Mettre à jour Cloud Scheduler
gcloud scheduler jobs update http retrain-model-weekly \
  --location=europe-west1 \
  --headers="Authorization=Bearer NOUVELLE_CLÉ"
```

---

## Dépannage

### Erreur : "Permission denied" Firestore

**Solution :** Vérifier security rules. User authentifié ?
```javascript
import { getAuth } from 'firebase/auth';
const user = getAuth().currentUser;
console.log('Current user:', user);  // Ne doit pas être null
```

### Erreur : "Storage bucket not found"

**Solution :** Vérifier `storageBucket` config = Firebase console

### Erreur : "Index not found" queries

**Solution :** Créer index composite dans Firestore console ou cliquer lien erreur

### Cloud Run : Cold Start Lent

**Solution :** Augmenter `--min-instances 1` (coût +$5/mois)

### Cloud Run : Out of Memory

**Solution :** Augmenter `--memory 2Gi` (vérifier coût)

### Backend : Model not loaded

```bash
# Vérifier logs
gcloud run logs read ai-pictionary-backend --limit=20

# Vérifier modèle dans image Docker
gcloud run services describe ai-pictionary-backend --region europe-west1
```

### Frontend : CORS Error

**Solution :** Ajouter origin dans `backend/env.yaml` → `CORS_ORIGINS`

---

## Résumé Déploiement

### Temps Estimé

| Étape | Durée |
|-------|-------|
| Firebase setup | 30-45 min |
| Cloud Run deployment | 15-20 min |
| Cloud Scheduler setup | 10 min |
| Tests & vérification | 10 min |
| **TOTAL** | **65-85 min** |

### Prochaines Étapes

1. ✅ Firebase configuré
2. ✅ Cloud Run déployé
3. ✅ Cloud Scheduler activé (optionnel)
4. ⏳ Intégrer Firebase Auth dans React
5. ⏳ Implémenter Firestore CRUD
6. ⏳ Tester sync temps réel multiplayer

---

## Références

- **[GETTING_STARTED.md](GETTING_STARTED.md)** — Guide démarrage rapide
- **[DEVELOPMENT.md](DEVELOPMENT.md)** — Workflow développement
- **[TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md)** — Justifications techniques
- **[SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md)** — Procédures sécurité

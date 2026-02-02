# 🚀 Getting Started - AI Pictionary

Guide complet pour démarrer avec AI Pictionary : de l'accès instantané en production au développement local avancé.

---

## 📋 Table des Matières

1. [Option 1 : Production (0 min)](#option-1-production-0-min)
2. [Option 2 : Développement Local (70 min)](#option-2-développement-local-70-min)
3. [Option 3 : Quick Setup Phase 2 (15 min)](#option-3-quick-setup-phase-2-15-min)
4. [Workflow Quotidien](#workflow-quotidien)
5. [Architecture](#architecture)
6. [Tests & Vérification](#tests--vérification)
7. [Dépannage](#dépannage)

---

## Option 1 : Production (0 min)

### ✨ Accès Instantané

**Application Live :** [https://ai-pictionary-4f8f2.web.app](https://ai-pictionary-4f8f2.web.app)

**Caractéristiques :**
- ✅ Aucune installation nécessaire
- ✅ Backend déployé sur Google Cloud Run (europe-west1)
- ✅ Frontend hébergé sur Firebase Hosting (CDN global)
- ✅ Modèle CNN pré-entraîné (91-93% accuracy)
- ✅ 20 catégories disponibles
- ✅ Gratuit (dans les limites du free tier)

### 📊 URLs & Statuts

| Service | URL | Statut |
|---------|-----|--------|
| **Frontend** | https://ai-pictionary-4f8f2.web.app | ✅ Live |
| **Backend API** | https://ai-pictionary-backend-1064461234232.europe-west1.run.app | ✅ Live |
| **Health Check** | [/health](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health) | ✅ Healthy |
| **API Docs** | [/docs](https://ai-pictionary-backend-1064461234232.europe-west1.run.app/docs) | 📚 Available |

### 🧪 Test Rapide

```bash
# Vérifier la santé du backend
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health

# Réponse attendue :
{
  "status": "healthy",
  "model_version": "v1.0.0",
  "model_loaded": true,
  "categories_count": 20
}
```

### 📈 Performances Production

| Métrique | Valeur | Note |
|----------|--------|------|
| **Latence frontend** | <2s | Chargement initial |
| **Latence backend (warm)** | 113-327ms | Réponse API |
| **Cold start** | 2-5s | Après 15min d'inactivité |
| **Inférence CNN** | 8-12ms | Temps réel |
| **Coût** | $0/mois | 100 utilisateurs (free tier) |
| **Taille bundle** | 80KB | Gzipped |

---

## Option 2 : Développement Local (70 min)

### 🎯 Quand utiliser le développement local ?

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

### 📦 Étape 1 : Télécharger le Dataset (20-30 min)

```bash
cd ml-training
python scripts/download_dataset.py
```

**💡 Astuce :** Le téléchargement s'exécute en arrière-plan. Passez aux étapes suivantes pendant ce temps.

### 📥 Étape 2 : Installer les Dépendances (5 min)

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

### ⚙️ Étape 3 : Prétraiter le Dataset (10 min)

```bash
cd ml-training
python scripts/preprocess_dataset.py
```

**Résultat attendu :** Fichier `data/quickdraw_20cat.h5` (~400MB)

### 🧠 Étape 4 : Entraîner le Modèle (30 min)

```bash
cd ml-training
jupyter notebook notebooks/train_model.ipynb
```

**Instructions :**
1. Ouvrir le notebook dans le navigateur
2. Menu → "Cell" → "Run All"
3. Attendre la fin de l'entraînement (15 epochs)
4. Le modèle sera sauvegardé dans `backend/models/quickdraw_v1.0.0.h5`

**💡 Note :** Par défaut, le système utilise le modèle v4.0.0 (50 classes, 90.2% accuracy). Pour utiliser le modèle v1.0.0 (20 classes) ou v3.0.0 (345 classes) déjà entraîné, modifiez `MODEL_VERSION=v1.0.0` ou `MODEL_VERSION=v3.0.0` dans `backend/.env`

### 🚀 Étape 5 : Lancer l'Application (2 min)

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

### ✅ Étape 6 : Tester

1. Ouvrir http://localhost:3000
2. Dessiner sur le canvas
3. Voir les prédictions en temps réel !

### ⏱️ Temps Estimé Total

| Étape | Durée | Parallélisable |
|-------|-------|----------------|
| Téléchargement dataset | 20-30 min | ✅ (pendant installation) |
| Installation dépendances | 5 min | ✅ |
| Prétraitement dataset | 10 min | ❌ |
| Entraînement modèle | 30 min | ❌ |
| Test application | 5 min | ❌ |
| **TOTAL** | **~70 min** | |

---

## Option 3 : Quick Setup Phase 2 (15 min)

### 🎯 Objectif
Activer toutes les nouvelles fonctionnalités (Settings, Multiplayer, Routing) en **15 minutes**.

### 🚀 Option A : Script Automatique (RECOMMANDÉ)

```bash
cd /Users/mediene/Informatique/SEM9/projet_big_data
./setup_phase2.sh
```

**Ce script fait automatiquement :**
- ✅ Crée `backend/.env` avec ADMIN_API_KEY sécurisée
- ✅ Installe `react-router-dom`
- ✅ Remplace `App.js` par la version avec routing
- ✅ Vérifie tous les composants

**Après le script :**
```bash
# Terminal 1 : Backend
cd backend
python -m uvicorn main:app --reload

# Terminal 2 : Frontend
cd frontend
npm start
```

**Tester :**
- 🎨 Dessin : http://localhost:3000/
- 🎮 Multiplayer : http://localhost:3000/multiplayer
- ⚙️ Settings : http://localhost:3000/settings

### 🛠️ Option B : Manuel (si script échoue)

#### 1. Backend Setup (5 min)

```bash
cd backend

# Copier .env
cp .env.example .env

# Générer clé admin
openssl rand -hex 32
# Copier le résultat

# Éditer .env
nano .env
# Remplacer : ADMIN_API_KEY=<coller_la_clé>
# Sauvegarder : Ctrl+O, Enter, Ctrl+X
```

#### 2. Frontend Setup (10 min)

```bash
cd frontend

# Installer React Router
npm install react-router-dom

# Backup ancien App.js
cp src/App.js src/App.js.backup

# Remplacer par nouveau App.js
cp src/App.ROUTER.js src/App.js
```

#### 3. Démarrer (2 min)

```bash
# Terminal 1
cd backend
python -m uvicorn main:app --reload

# Terminal 2
cd frontend
npm start
```

### ✅ Checklist de Vérification Phase 2

**Backend :**
- [ ] `backend/.env` existe
- [ ] `ADMIN_API_KEY` configurée (32+ caractères)
- [ ] `backend/serviceAccountKey.json` existe
- [ ] Backend démarre sans erreur sur port 8000

**Frontend :**
- [ ] `react-router-dom` installé
- [ ] `App.js` contient `<Router>`, `<Routes>`, `<Route>`
- [ ] Frontend démarre sans erreur sur port 3000
- [ ] Navigation fonctionne entre pages

**Firebase Realtime Database (pour Team vs IA) :**
- [ ] `REACT_APP_FIREBASE_DATABASE_URL` configuré dans `.env`
- [ ] Règles RTDB déployées (`firebase deploy --only database`)
- [ ] Émulateur RTDB démarré si dev local (`REACT_APP_USE_RTDB_EMULATOR=true`)

**Tests Rapides :**
- [ ] Page principale (/) affiche le canvas
- [ ] Page multiplayer (/multiplayer) accessible
- [ ] Page settings (/settings) affiche les options
- [ ] Prédictions temps réel fonctionnent
- [ ] Modal de correction apparaît (<85% confiance)
- [ ] Mode Team vs IA : viewers voient le dessin en temps réel

---

## Workflow Quotidien

### 📋 Workflow Simple (sans confusion)

**Vous n'avez PAS besoin de switcher manuellement les `.env` !** Les scripts gèrent tout automatiquement.

### 🌅 Matin : Développement

```bash
git pull origin main
cd frontend
npm start
# 🎨 Codez tranquillement...
```

### 🌆 Après-midi : Tests & Commits

```bash
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin main
```

### 🌃 Soir : Déploiement (si feature terminée)

```bash
./deploy.sh frontend    # Juste le frontend
# OU
./deploy.sh all         # Tout déployer
```

### 🔄 Ce Qui Se Passe Automatiquement

Quand vous faites `./deploy.sh frontend` :

1. ✅ **Sauvegarde** `.env.local` → `.env.local.bak`
2. ✅ **Build** avec `.env.production` (URLs de prod)
3. ✅ **Deploy** sur Firebase Hosting
4. ✅ **Restaure** `.env.local.bak` → `.env.local`

**Résultat :** Votre environnement local reste intact ! 🎉

### 📁 Fichiers à Gérer

| Fichier | Git | Usage | Contenu |
|---------|-----|-------|---------|
| `.env.production` | ✅ Commiter | Build prod | URLs Cloud Run + Firebase |
| `.env.local` | ❌ Ignorer | Dev local | Émulateurs + localhost |
| `.env.local.bak` | ❌ Ignorer | Temporaire | Auto-généré par script |

### 🎓 Conseils Pro

#### ✅ À Faire Tous Les Jours

```bash
# Matin
git pull

# Développement
npm start  # Utilise .env.local automatiquement

# Fin de journée (si nécessaire)
./deploy.sh frontend  # Gère .env automatiquement
```

#### ✅ Avant un Deploy

```bash
# 1. Tester localement
npm start

# 2. Vérifier que tout marche
# (navigation, features, etc.)

# 3. Déployer
./deploy.sh frontend
```

#### ❌ Ne JAMAIS Faire

```bash
# ❌ Éditer .env.local avant build
# ❌ Commiter .env.local
# ❌ Mettre des URLs de prod dans .env.local
# ❌ Copier manuellement .env.production vers .env
```

---

## Architecture

### 🏗️ Architecture Production

```
         USERS (Global)
              │
              ▼
┌───────────────────────────────┐
│  Firebase Hosting (CDN)       │
│  ai-pictionary-4f8f2.web.app  │
│  React SPA (80KB gzipped)     │
└──────────────┬────────────────┘
               │ HTTPS
               ▼
┌───────────────────────────────┐
│  Google Cloud Run             │
│  (europe-west1)               │
│  FastAPI + TensorFlow         │
│  Docker (500MB image)         │
│  Scale: 0-10 instances        │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│  Firebase Services            │
│  - Auth (Google, Email)       │
│  - Firestore (NoSQL)          │
│  - Storage (Objects)          │
└───────────────────────────────┘
```

### 💻 Architecture Développement Local

```
┌─────────────┐      HTTP/REST       ┌─────────────┐
│   React     │ ←─────────────────────→  │  FastAPI    │
│   Frontend  │   POST /predict      │  Backend    │
│  (Port 3000)│                      │ (Port 8000) │
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

### 🎯 Workflow Utilisateur

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

### 🎓 Catégories Disponibles (20)

```
apple, sun, tree, house, car,
cat, fish, star, umbrella, flower,
moon, airplane, bicycle, clock, eye,
cup, shoe, cloud, lightning, smiley_face
```

---

## Tests & Vérification

### 🧪 Test Production

```bash
# Backend health check
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health

# Résultat attendu :
{
  "status": "healthy",
  "model_version": "v1.0.0",
  "model_loaded": true,
  "categories_count": 20
}

# Frontend (ouvrir dans le navigateur)
open https://ai-pictionary-4f8f2.web.app
```

### 🧪 Test Local

```bash
# Backend
curl http://localhost:8000/health

# Frontend
open http://localhost:3000
```

### 🧪 Test d'Intégration Complet

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

### ✅ Checklist Avant Défense

**Production (Recommandé) :**
- [ ] Application production accessible
- [ ] Backend health check OK
- [ ] Prédictions en temps réel fonctionnelles
- [ ] Modal de correction apparaît (<85% confiance)
- [ ] Documentation défense lue ([TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md))
- [ ] Architecture Cloud Run + Firebase comprise
- [ ] Coûts production documentés ($0/mois pour 100 DAU)

**Développement Local (Optionnel) :**
- [ ] Dataset téléchargé (20 catégories)
- [ ] Dataset prétraité (quickdraw_20cat.h5)
- [ ] Modèle entraîné (quickdraw_v1.0.0.h5)
- [ ] Backend fonctionne (localhost:8000)
- [ ] Frontend fonctionne (localhost:3000)
- [ ] Prédictions testées
- [ ] Modal de correction testé

---

## Dépannage

### 🐛 Problèmes Courants

#### Backend : "Model not loaded"

```bash
# Vérifier que le modèle existe
ls -lh backend/models/quickdraw_v1.0.0.h5

# Si absent, entraîner le modèle
cd ml-training
jupyter notebook notebooks/train_model.ipynb
```

#### Frontend : "Backend offline"

```bash
# Démarrer le backend
cd backend
uvicorn main:app --reload

# Vérifier le health check
curl http://localhost:8000/health
```

#### Dataset : Téléchargement lent

```bash
# Vérifier la progression
cd ml-training/data/raw
ls -lh *.npy | wc -l  # Devrait afficher 20
```

#### Port déjà utilisé

```bash
# Backend (port 8000)
lsof -ti:8000 | xargs kill -9

# Frontend (port 3000)
lsof -ti:3000 | xargs kill -9
```

#### Phase 2 : React Router non installé

```bash
cd frontend
npm install react-router-dom
```

#### Phase 2 : ADMIN_API_KEY manquante

```bash
cd backend
openssl rand -hex 32
# Ajouter le résultat dans backend/.env :
# ADMIN_API_KEY=<clé_générée>
```

#### serviceAccountKey.json manquant

```bash
# Télécharger depuis Firebase Console
# https://console.firebase.google.com/project/ai-pictionary-4f8f2/settings/serviceaccounts
# Copier dans backend/serviceAccountKey.json
```

---

## 📊 Métriques de Performance

| Métrique | Valeur | Note |
|----------|--------|------|
| **Taille modèle** | 140KB | Très léger |
| **Paramètres** | 35K | Simple CNN |
| **Inférence** | 5ms | Temps réel |
| **Accuracy** | 91-93% | Sur test set |
| **Debounce** | 500ms | UX optimisée |
| **Dataset** | 1.4M images | 20 catégories |
| **Bundle size** | 80KB | Gzipped |

---

## 📚 Documentation Complémentaire

- **[INFRASTRUCTURE.md](INFRASTRUCTURE.md)** — Configuration Firebase & Cloud Run
- **[DEVELOPMENT.md](DEVELOPMENT.md)** — Workflow développement avancé
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** — État d'avancement du projet
- **[TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md)** — Justifications techniques & ML
- **[SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md)** — Procédures de sécurité

---

## 🎯 Prochaines Étapes

Consultez [PROJECT_STATUS.md](PROJECT_STATUS.md) pour voir l'état actuel et la roadmap complète.

**Questions ?** Consultez [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md) pour toutes les justifications techniques !

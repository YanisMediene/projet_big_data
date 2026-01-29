# 🚀 Guide de Finalisation - Actions Requises

## Vue d'ensemble
Ce guide liste toutes les actions nécessaires pour finaliser et déployer les fonctionnalités Phase 2.

---

## ✅ ÉTAPE 1: Configuration Backend Local (15 min)

### 1.1 Créer le fichier .env
```bash
cd /Users/mediene/Informatique/SEM9/projet_big_data/backend
cp .env.example .env
```

### 1.2 Générer l'Admin API Key
```bash
# Générer une clé sécurisée
openssl rand -hex 32
```

### 1.3 Éditer backend/.env
Ouvrir `backend/.env` et mettre à jour:
```bash
# Remplacer par la clé générée
ADMIN_API_KEY=<votre_clé_générée_avec_openssl>

# Vérifier que le chemin Firebase est correct
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json

# Si vous testez en local
DEBUG=True
ENVIRONMENT=development
```

### 1.4 Vérifier que serviceAccountKey.json existe
```bash
ls backend/serviceAccountKey.json
# Si absent, télécharger depuis Firebase Console:
# Firebase Console → Project Settings → Service Accounts → Generate new private key
```

---

## ✅ ÉTAPE 2: Installer React Router (10 min)

### 2.1 Installer la dépendance
```bash
cd /Users/mediene/Informatique/SEM9/projet_big_data/frontend
npm install react-router-dom
```

### 2.2 Vérifier l'installation
```bash
npm list react-router-dom
# Devrait afficher: react-router-dom@6.x.x
```

---

## ✅ ÉTAPE 3: Intégrer React Router dans App.js (30 min)

### 3.1 Créer la structure de routing
Je vais créer le fichier App.js mis à jour avec toutes les routes.

**Nouvelles routes à ajouter:**
- `/` - Page principale (dessin)
- `/multiplayer` - Lobby multiplayer
- `/multiplayer/race/:gameId` - Race Mode
- `/multiplayer/guessing/:gameId` - Guessing Game
- `/settings` - Settings utilisateur
- `/analytics` - Analytics (si existe)

### 3.2 Tester les routes
Après modification, tester:
```bash
cd frontend
npm start
# Naviguer vers http://localhost:3000/settings
# Naviguer vers http://localhost:3000/multiplayer
```

---

## ✅ ÉTAPE 4: Intégrer Settings dans DrawingCanvas (20 min)

### 4.1 Importer useSettings
Le DrawingCanvas doit utiliser les settings pour:
- `streamingPredictions` - Mode streaming vs manuel
- `predictionDebounce` - Délai entre prédictions
- `confidenceThreshold` - Seuil pour modal correction

### 4.2 Tester le streaming mode
1. Aller dans Settings
2. Activer "Streaming Predictions"
3. Dessiner → Vérifier prédictions automatiques
4. Désactiver → Vérifier bouton manuel apparaît

---

## ✅ ÉTAPE 5: Tester Guessing Game End-to-End (45 min)

### 5.1 Démarrer Backend
```bash
cd /Users/mediene/Informatique/SEM9/projet_big_data/backend
python -m uvicorn main:app --reload --port 8000
```

### 5.2 Démarrer Frontend
```bash
cd /Users/mediene/Informatique/SEM9/projet_big_data/frontend
npm start
```

### 5.3 Test Scenario
**Test 1: Créer une partie**
1. Naviguer vers `/multiplayer`
2. Cliquer "Create Guessing Game"
3. Vérifier création lobby Firestore
4. Copier l'URL de la partie

**Test 2: Rejoindre avec 2ème utilisateur**
1. Ouvrir fenêtre incognito
2. Se connecter avec autre compte
3. Naviguer vers l'URL copiée
4. Cliquer "Join Game"

**Test 3: Jouer une partie complète**
1. Joueur 1: Cliquer "Start Game"
2. Drawer: Dessiner la catégorie affichée
3. Guesser: Taper réponse dans input
4. Vérifier:
   - ✅ Prédictions IA s'affichent
   - ✅ Chat fonctionne
   - ✅ Timer décompte
   - ✅ Scores se mettent à jour
   - ✅ Round suivant démarre

**Test 4: Victoire Humains**
1. Deviner avant IA atteint 85%
2. Vérifier message victoire
3. Vérifier scores finaux

**Test 5: Victoire IA**
1. Ne pas deviner
2. Attendre IA atteindre 85%
3. Vérifier IA gagne le round

---

## ✅ ÉTAPE 6: Configuration Cloud Scheduler (OPTIONNEL - Production uniquement)

⚠️ **Ne faire QUE si vous déployez en production**

### 6.1 Prérequis
- Backend déployé sur Cloud Run
- Projet Google Cloud configuré
- Budget défini (éviter coûts)

### 6.2 Activer Cloud Scheduler API
```bash
gcloud auth login
gcloud config set project ai-pictionary-4f8f2

# Activer l'API
gcloud services enable cloudscheduler.googleapis.com
```

### 6.3 Créer le Job de Réentraînement
```bash
# Variables
PROJECT_ID="ai-pictionary-4f8f2"
REGION="europe-west1"
SERVICE_URL="https://votre-backend.run.app"  # URL Cloud Run
ADMIN_API_KEY="<votre_admin_api_key_du_.env>"

# Créer job hebdomadaire (dimanche 2h)
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

### 6.4 Tester le Job manuellement
```bash
gcloud scheduler jobs run retrain-model-weekly --location=europe-west1
```

### 6.5 Vérifier les logs
```bash
gcloud scheduler jobs describe retrain-model-weekly --location=europe-west1
```

---

## ✅ ÉTAPE 7: Tests Finaux (30 min)

### 7.1 Checklist Frontend
- [ ] Settings: Save/Load fonctionne
- [ ] Settings: Reset to defaults fonctionne
- [ ] Guessing Game: Créer lobby
- [ ] Guessing Game: Rejoindre lobby
- [ ] Guessing Game: Dessiner
- [ ] Guessing Game: Deviner
- [ ] Guessing Game: Chat temps réel
- [ ] Guessing Game: Prédictions IA
- [ ] Guessing Game: Victoire humains/IA
- [ ] Navigation entre pages (routing)

### 7.2 Checklist Backend
- [ ] Endpoint /admin/retrain (avec ADMIN_API_KEY)
- [ ] Endpoint /games/guessing/create
- [ ] Endpoint /games/guessing/join
- [ ] Endpoint /games/guessing/start
- [ ] Endpoint /games/guessing/submit-guess
- [ ] Endpoint /games/guessing/chat
- [ ] Rate limiting fonctionne
- [ ] Firestore écrit correctement

### 7.3 Tester en conditions réelles
```bash
# Terminal 1: Backend avec logs
cd backend
python -m uvicorn main:app --reload --log-level debug

# Terminal 2: Frontend
cd frontend
npm start

# Terminal 3: Monitorer Firestore
# Firebase Console → Firestore → Observer les collections
```

---

## ✅ ÉTAPE 8: Optimizations (OPTIONNEL - 3-4h)

### 8.1 Code Splitting
Implémenter React.lazy pour:
- Settings
- GuessingGame
- RaceMode
- Analytics

### 8.2 PWA Setup
1. Créer `public/service-worker.js`
2. Créer `public/manifest.json`
3. Register service worker dans `index.js`

### 8.3 Firebase Remote Config
1. Activer dans Firebase Console
2. Ajouter paramètres: debounce, threshold, streaming
3. Intégrer dans Settings.jsx

---

## ✅ ÉTAPE 9: Déploiement Production (2-3h)

### 9.1 Frontend (Firebase Hosting)
```bash
cd frontend
npm run build

# Vérifier taille bundle
ls -lh build/static/js/*.js

# Déployer
firebase deploy --only hosting
```

### 9.2 Backend (Cloud Run ou Heroku)

**Option A: Cloud Run**
```bash
cd backend
gcloud run deploy ai-pictionary-backend \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars ADMIN_API_KEY=${ADMIN_API_KEY}
```

**Option B: Heroku**
```bash
cd backend
heroku create ai-pictionary-backend
heroku config:set ADMIN_API_KEY=${ADMIN_API_KEY}
git push heroku main
```

### 9.3 Configurer CORS
Mettre à jour `backend/.env`:
```bash
CORS_ORIGINS=https://votre-app.web.app,https://votre-app.firebaseapp.com
```

---

## 📋 CHECKLIST FINALE

### Configuration
- [ ] backend/.env créé avec ADMIN_API_KEY
- [ ] serviceAccountKey.json présent
- [ ] react-router-dom installé
- [ ] App.js mis à jour avec routes

### Tests
- [ ] Settings fonctionnels
- [ ] Guessing Game jouable
- [ ] Chat temps réel fonctionne
- [ ] Prédictions IA s'affichent
- [ ] Navigation entre pages OK

### Production (Optionnel)
- [ ] Cloud Scheduler configuré
- [ ] Frontend déployé (Firebase)
- [ ] Backend déployé (Cloud Run/Heroku)
- [ ] Monitoring configuré

---

## 🆘 Troubleshooting

### Problème: "Cannot find module 'react-router-dom'"
```bash
cd frontend
npm install react-router-dom
```

### Problème: "ADMIN_API_KEY not configured"
```bash
cd backend
openssl rand -hex 32  # Copier résultat
nano .env  # Ajouter: ADMIN_API_KEY=<résultat>
```

### Problème: "Firebase serviceAccountKey.json not found"
1. Firebase Console → Project Settings
2. Service Accounts → Generate new private key
3. Télécharger et placer dans `backend/serviceAccountKey.json`

### Problème: "Port 8000 already in use"
```bash
# Trouver processus
lsof -ti:8000
# Tuer processus
kill -9 $(lsof -ti:8000)
```

### Problème: Guessing Game ne charge pas
1. Vérifier backend démarre sans erreur
2. Vérifier routes dans App.js
3. Vérifier console navigateur (F12)
4. Vérifier Firestore rules permettent read/write

---

## ⏱️ Temps Estimé Total

| Étape | Temps | Priorité |
|-------|-------|----------|
| Config Backend (.env) | 15 min | 🔴 CRITIQUE |
| Install React Router | 10 min | 🔴 CRITIQUE |
| Routing App.js | 30 min | 🔴 CRITIQUE |
| Settings Integration | 20 min | 🟡 IMPORTANT |
| Test Guessing Game | 45 min | 🔴 CRITIQUE |
| Cloud Scheduler | 30 min | 🟢 OPTIONNEL |
| Tests Finaux | 30 min | 🟡 IMPORTANT |
| Optimizations | 3-4h | 🟢 OPTIONNEL |
| Déploiement | 2-3h | 🟢 OPTIONNEL |

**Minimum viable**: 2h (étapes critiques uniquement)  
**Complet avec tests**: 4h  
**Production-ready**: 8-10h

---

## 🎯 Prochaine Action Immédiate

**Commencer par:**
1. Créer backend/.env (copier de .env.example)
2. Générer ADMIN_API_KEY avec openssl
3. Installer react-router-dom dans frontend

Voulez-vous que je vous aide à implémenter ces étapes maintenant ? 🚀

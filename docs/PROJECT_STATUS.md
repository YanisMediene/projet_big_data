# 📊 Project Status - AI Pictionary

Vue d'ensemble de l'état d'avancement du projet et des fonctionnalités implémentées.

**Dernière mise à jour :** Janvier 2025  
**Phase actuelle :** Production

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Phase 1 - MVP](#phase-1---mvp-100)
3. [Phase 2 - Features Avancées](#phase-2---features-avancées)
4. [Architecture Frontend](#architecture-frontend)
5. [API Backend](#api-backend)
6. [Technologies](#technologies)

---

## Vue d'ensemble

### 🎯 Mission du Projet

Application web de dessin avec reconnaissance par CNN :
- Prédictions temps réel TensorFlow (50 catégories, 90.2% accuracy)
- Modes multijoueurs (Race Mode + Team vs IA)
- Infrastructure cloud scalable (Firebase + Cloud Run + RTDB)

### 🌐 URLs Production

| Service | URL |
|---------|-----|
| **Frontend** | https://ai-pictionary-4f8f2.web.app |
| **Backend API** | https://ai-pictionary-backend-1064461234232.europe-west1.run.app |
| **API Docs** | /docs |

---

## Phase 1 - MVP (100%)

### ✅ Frontend React

- Canvas HTML5 plein écran (souris/tactile)
- Prédictions temps réel avec debounce (500ms)
- Affichage top-3 probabilités
- Design responsive (Tailwind CSS)
- Déployé sur Firebase Hosting

### ✅ Backend FastAPI

**Endpoints Core :**
- `GET /` - Informations API
- `GET /health` - Health check + model status
- `GET /categories` - Liste des 50 catégories
- `POST /predict` - Inférence CNN (12-18ms)
- `POST /save_correction` - Sauvegarde corrections

**Performance :**
- Latence warm : 120-350ms
- Cold start : 5-8s
- Inférence CNN : 12-18ms

### ✅ Machine Learning

**Modèle v4.0.0 (Production) :**

| Version | Classes | Accuracy | Taille |
|---------|---------|----------|--------|
| v1.0.0 | 20 | 91-93% | 140 KB |
| v4.0.0 | 50 | 90.2% | 30.1 MB |
| v3.0.0 | 345 | 73.2% | 30.1 MB |

### ✅ Infrastructure

**Services Firebase :**
- Hosting (CDN global)
- Firestore (games, corrections)
- Realtime Database (multiplayer sync)
- Storage (models, drawings)

**Google Cloud :**
- Cloud Run (backend autoscaling 0-10 instances)
- Cloud Build (Docker CI/CD)

**Coût :** ~$0/mois (free tier, 100 DAU)

---

## Phase 2 - Features Avancées

### ❌ 1. Authentification (Non implémenté)

> Voir [docs/archive/AUTHENTICATION.md](archive/AUTHENTICATION.md) pour la documentation archivée.

**État actuel :** Les joueurs sont identifiés par pseudo + emoji (sans compte persistant).

**Raison :** Simplification de l'expérience utilisateur - pas de friction à l'entrée.

---

### ⚠️ 2. Active Learning Pipeline (Partiel)

**Backend :** ✅ Prêt
- `POST /save_correction` - Sauvegarde corrections
- `POST /admin/retrain` - Déclenche pipeline ML

**Frontend :** ⚠️ Non visible dans l'UI actuelle

---

### ✅ 3. Admin Routes (100%)

| Route | Méthode | Description |
|-------|---------|-------------|
| `/admin/retrain` | POST | Déclenche pipeline ML |
| `/admin/retrain/status/{job_id}` | GET | Status job retraining |
| `/admin/health` | GET | Health check admin |
| `/admin/cleanup/abandoned-games` | POST | Nettoie games abandonnées |
| `/admin/cleanup/sync-presence/{game_id}` | POST | Sync présence RTDB → Firestore |
| `/admin/games/{game_id}` | DELETE | Supprime une game |

**Sécurité :** Bearer token (ADMIN_API_KEY)

---

### ✅ 4. Race Mode - Multiplayer (100%)

**Concept :** Course compétitive - premier à faire deviner l'IA gagne le round.

| Route | Méthode | Description |
|-------|---------|-------------|
| `/games/race/create` | POST | Créer lobby |
| `/games/race/join` | POST | Rejoindre partie |
| `/games/race/start` | POST | Démarrer jeu |
| `/games/race/submit-drawing` | POST | Soumettre dessin |
| `/games/race/{game_id}` | GET | État partie |
| `/games/race/timeout` | POST | Timeout round |
| `/games/race/lobby/list` | GET | Liste lobbies |
| `/games/race/leave` | POST | Quitter partie |

**Règles :**
- 2-8 joueurs en compétition simultanée
- Même catégorie pour tous par round
- Premier à 85% confiance gagne le round
- 6 rounds total

---

### ✅ 5. Team vs IA Mode (100%)

**Concept :** Mode coopératif - l'équipe humaine doit deviner avant l'IA.

**Endpoints Guessing :**

| Route | Méthode | Description |
|-------|---------|-------------|
| `/games/guessing/create` | POST | Créer lobby |
| `/games/guessing/join` | POST | Rejoindre |
| `/games/guessing/start` | POST | Démarrer |
| `/games/guessing/submit-guess` | POST | Soumettre guess |
| `/games/guessing/chat` | POST | Message chat |
| `/games/guessing/update-canvas` | POST | Sync canvas |
| `/games/guessing/ai-prediction` | POST | Prédiction IA |
| `/games/guessing/{game_id}` | GET | État partie |
| `/games/guessing/lobby/list` | GET | Liste lobbies |
| `/games/guessing/timeout` | POST | Timeout |
| `/games/guessing/leave` | POST | Quitter |

**Endpoints Présence :**

| Route | Méthode | Description |
|-------|---------|-------------|
| `/games/presence/online` | POST | Marquer online |
| `/games/presence/offline` | POST | Marquer offline |
| `/games/presence/heartbeat` | POST | Heartbeat |
| `/games/presence/{game_id}` | GET | Status présence |
| `/games/cleanup/stale-players/{game_id}` | POST | Cleanup inactifs |

**Architecture RTDB :**
```
games/${roomCode}/
├── currentDrawing      # PNG base64 (sync 100ms)
├── chat/               # Messages guessers
├── currentRound
├── currentDrawerId
├── aiGuessedCorrectly
├── players/
│   └── ${playerId}/
│       ├── name, avatar, score
│       └── isOnline
└── presence/
```

---

### ⚠️ 6. User Settings (Partiel)

**Implémenté :**
- `AudioSettings.jsx` - Modal paramètres audio (SFX, TTS, volume)

**Non implémenté :**
- Page Settings séparée (`/settings`)
- Streaming predictions toggle
- Theme (Light/Dark)

---

### ✅ 7. Système Audio (100%)

**Fichier :** `frontend/src/services/audioService.js` (517 lignes)

- SFX synthétiques (Web Audio API) - pas de fichiers externes
- Text-to-Speech (TTS) pour annonces
- Contrôle volume + Toggle SFX/TTS indépendants
- Persistance préférences (localStorage)

**Sons disponibles :**
- `roundSuccess`, `gameWin`, `playerReady`, `teamWin`
- `roundFail`, `aiWins`
- `startDrawing`, `clearCanvas`, `chatMessage`, `buttonClick`
- `tick`, `tickUrgent`, `countdownBeep`
- `roundStart`, `playerJoin`, `drawerRotate`

---

## Architecture Frontend

### Fichier Principal Monolithique

**`frontend/src/NewFrontTest.jsx`** (2502 lignes)

Contient tous les composants inline :
- `WelcomeScreen` - Écran d'accueil avec check backend
- `GameModeSelection` - Sélection mode (Classic/Race/Team)
- `TransitionOverlay` - Transition entre rounds
- `MultiplayerFlow` - Lobby et waiting room
- `PlayingScreen` - Canvas + prédictions + chat
- `GameOverScreen` - Résultats finaux

**States Machine :**
```
WELCOME → MODE_SELECT → LOBBY_FLOW → PLAYING → GAME_OVER
                              ↑          │
                              └──────────┘ (new game)
```

### Composants Séparés

| Fichier | Description |
|---------|-------------|
| `components/AudioSettings.jsx` | Modal paramètres audio |
| `components/shared/ConnectionStatus.jsx` | Indicateur connexion |
| `components/shared/Toast.jsx` | Notifications toast |

### Services

| Fichier | Description |
|---------|-------------|
| `services/api.js` | Client API backend (axios) |
| `services/audioService.js` | SFX synthétiques (Web Audio API) |
| `services/multiplayerService.js` | Firebase RTDB multiplayer |

---

## API Backend

### Vue d'ensemble

**34 endpoints** organisés en 5 groupes :

| Groupe | Endpoints |
|--------|-----------|
| Core (default) | 5 |
| Administration | 6 |
| Multiplayer Race | 8 |
| Multiplayer Guessing | 11 |
| Présence | 5 |

Voir `/docs` sur l'API pour la documentation OpenAPI complète.

---

## Technologies

### Frontend
| Tech | Version | Usage |
|------|---------|-------|
| React | 19.2.1 | UI Framework |
| Tailwind CSS | 3.4.1 | Styling |
| Firebase SDK | 10.8.0 | Firestore, RTDB |
| Axios | 1.13.2 | HTTP Client |
| Lucide React | 0.562.0 | Icons |

### Backend
| Tech | Version | Usage |
|------|---------|-------|
| FastAPI | 0.109.2 | Web Framework |
| TensorFlow | 2.16.2 | ML Inference |
| Firebase Admin | 6.4.0 | Firestore, Storage |
| Pillow | 10.2.0 | Image Processing |
| Uvicorn | 0.27.1 | ASGI Server |

### Infrastructure
| Service | Usage |
|---------|-------|
| Firebase Hosting | Frontend CDN |
| Cloud Run | Backend (europe-west1) |
| Firestore | Game metadata, corrections |
| Realtime Database | Multiplayer sync |
| Firebase Storage | Models, drawings |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [GETTING_STARTED.md](GETTING_STARTED.md) | Guide démarrage rapide |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Workflow développement |
| [INFRASTRUCTURE.md](INFRASTRUCTURE.md) | Configuration Firebase & Cloud Run |
| [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md) | Référence technique |

---

*Dernière mise à jour : Janvier 2025*

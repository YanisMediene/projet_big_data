# 📚 Technical Reference Guide

**AI Pictionary - Big Data Project FISE3**  
**Version:** 2.1.0  
**Last Updated:** Février 2025

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Decisions](#architecture-decisions)
3. [Architecture Frontend Monolithique](#architecture-frontend-monolithique)
4. [Système Audio](#système-audio)
5. [Système Multiplayer](#système-multiplayer)
6. [Data Pipeline & ML](#data-pipeline--ml)
7. [Performance Optimizations](#performance-optimizations)
8. [Cost Analysis](#cost-analysis)

---

## Executive Summary

### Project Overview

AI Pictionary est une application cloud-native de reconnaissance de dessins inspirée de "Quick, Draw!" de Google. Le système démontre :
- Inférence CNN en temps réel (<20ms de latence)
- Architecture cloud-native (Firebase + Cloud Run + Realtime Database)
- Modes multijoueurs avec sync temps réel

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React + Tailwind CSS | 19.2.1 / 3.4.1 |
| **Backend** | FastAPI (Python) | 0.109.2 |
| **ML Engine** | TensorFlow/Keras | 2.16.2 |
| **Cloud** | Firebase + Cloud Run | 10.8.0 / europe-west1 |
| **Real-time Sync** | Firebase RTDB | 10.8.0 |

### Key Performance Metrics

**Model v4.0.0 (Production) :**

| Metric | Value | Target |
|--------|-------|--------|
| Model Accuracy | 90.2% | >85% ✅ |
| Inference Latency | 12-18ms | <50ms ✅ |
| End-to-End Latency | 120-350ms | <500ms ✅ |
| Model Size | 30.1 MB | <50MB ✅ |
| Monthly Cost (100 DAU) | ~$0 | <$10 ✅ |
| Cold Start Time | 5-8s | <10s ✅ |

### Model Versions

| Version | Classes | Accuracy | Size | Usage |
|---------|---------|----------|------|-------|
| v1.0.0 | 20 | 91-93% | 140 KB | Tests |
| **v4.0.0** | 50 | 90.2% | 30.1 MB | **Production** |
| v3.0.0 | 345 | 73.2% | 30.1 MB | All classes |

---

## Architecture Decisions

### 1. FastAPI vs Flask vs Django

| Framework | Verdict | Rationale |
|-----------|---------|-----------|
| **FastAPI** | ✅ Choisi | Async native, auto OpenAPI docs, Pydantic validation |
| Flask | ❌ | WSGI (non async), pas de docs auto |
| Django | ❌ | Trop lourd pour API-only |

### 2. Firebase vs AWS vs GCP

| Aspect | Firebase ✅ | AWS | GCP |
|--------|-------------|-----|-----|
| Setup | 5 min | 30+ min | 15 min |
| Real-time | Built-in | WebSocket manuel | Firestore |
| Cost (100 DAU) | <$1/month | ~$5/month | ~$3/month |

### 3. Cloud Run vs Cloud Functions

| Aspect | Cloud Run ✅ | Cloud Functions |
|--------|--------------|-----------------|
| Container Support | Custom Dockerfile | Buildpacks only |
| Memory Limit | 32 GB | 16 GB |
| TensorFlow 500MB+ | ✅ OK | ⚠️ Complex |
| Cold Start | 5-8s (prévisible) | 3-8s (variable) |

### 4. Firestore vs RTDB pour Drawing Sync

| Aspect | Firestore | RTDB ✅ |
|--------|-----------|---------|
| Latency | 100-200ms | 20-50ms |
| Update Frequency | 1/sec limit | 10+/sec |
| Use Case | Game state | Drawing sync |

**Architecture Decision :**
- **Firestore :** Games metadata, corrections (persistent)
- **RTDB :** Drawing sync, chat, presence (ephemeral real-time)

---

## Architecture Frontend Monolithique

### Pourquoi Monolithique ?

Le frontend utilise une architecture monolithique intentionnelle dans `NewFrontTest.jsx` (~3000 lignes).

**Avantages :**
- État global partagé entre tous les composants inline
- Pas de prop drilling complexe
- Transitions d'état fluides entre les phases du jeu
- Développement rapide pour MVP

**Composants Inline :**
- `WelcomeScreen` - Écran d'accueil + backend health check
- `GameModeSelection` - Sélection Classic/Race/Team/Free Canvas/Infinite
- `TransitionOverlay` - Animations entre rounds
- `MultiplayerFlow` - Lobby et waiting room
- `PlayingScreen` - Canvas + prédictions + chat
- `FreeCanvasScreen` - Mode test libre (Active Learning)
- `InfiniteGameScreen` - Mode sans fin (Active Learning)
- `GameOverScreen` - Résultats finaux

### State Machine

```
WELCOME → MODE_SELECT → LOBBY_FLOW → PLAYING → GAME_OVER
                │             ↑          │
                │             └──────────┘ (new game)
                │
                ├─→ FREE_CANVAS (test libre)
                └─→ INFINITE (mode sans fin)
```

**États du jeu (`gameState`) :**
- `WELCOME` - Page d'accueil, vérifie backend
- `MODE_SELECT` - Choix du mode (Classic, Race, Team, Free Canvas, Infinite)
- `LOBBY_FLOW` - Création/join partie multiplayer
- `PLAYING` - Partie en cours
- `FREE_CANVAS` - Mode test libre
- `INFINITE` - Mode sans fin
- `GAME_OVER` - Écran final avec scores

**Modes (`gameMode`) :**
- `CLASSIC` - Solo contre l'IA
- `RACE` - Course entre joueurs
- `TEAM` - Équipe vs IA (guessing)
- `FREE_CANVAS` - Test libre (contribue à l'Active Learning)
- `INFINITE` - Mode sans fin (contribue à l'Active Learning)

### Composants Séparés

Seuls 3 composants sont extraits car réutilisables :

| Fichier | Lignes | Usage |
|---------|--------|-------|
| `AudioSettings.jsx` | ~150 | Modal paramètres audio |
| `shared/ConnectionStatus.jsx` | ~50 | Indicateur connexion backend |
| `shared/Toast.jsx` | ~80 | Notifications toast |

### Services

| Service | Lignes | Responsabilité |
|---------|--------|----------------|
| `api.js` | ~100 | Client API backend (axios) |
| `audioService.js` | 517 | SFX synthétiques (Web Audio API) |
| `multiplayerService.js` | 688 | Firebase RTDB multiplayer |

---

## Système Audio

### Architecture

Le système audio utilise **Web Audio API** pour générer des sons synthétiques - aucun fichier audio externe requis.

**Fichier :** `frontend/src/services/audioService.js` (517 lignes)

### Fonctionnalités

- **SFX synthétiques** - Générés via oscillateurs Web Audio API
- **Text-to-Speech (TTS)** - Pour annonces vocales des catégories
- **Contrôle volume** - Indépendant pour SFX et TTS
- **Debounce TTS** - Évite le spam d'annonces
- **Persistance** - Préférences sauvées dans localStorage

### Sons Disponibles

| Catégorie | Sons |
|-----------|------|
| **Succès** | `roundSuccess`, `gameWin`, `playerReady`, `teamWin` |
| **Échec** | `roundFail`, `aiWins` |
| **Actions** | `startDrawing`, `clearCanvas`, `chatMessage`, `buttonClick` |
| **Timers** | `tick`, `tickUrgent`, `countdownBeep` |
| **Transitions** | `roundStart`, `playerJoin`, `drawerRotate` |

### Implémentation

```javascript
// Exemple de générateur de son synthétique
const playRoundSuccess = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
  oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
  oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.3);
};
```

### AudioSettings Modal

```javascript
// Extrait de AudioSettings.jsx
const AudioSettings = ({ isOpen, onClose }) => {
  const { sfxEnabled, ttsEnabled, volume, setSfxEnabled, setTtsEnabled, setVolume } = useAudio();
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Toggle label="Sound Effects" value={sfxEnabled} onChange={setSfxEnabled} />
      <Toggle label="Voice Announcements" value={ttsEnabled} onChange={setTtsEnabled} />
      <Slider label="Volume" value={volume} onChange={setVolume} />
    </Modal>
  );
};
```

---

## Système Multiplayer

### Architecture RTDB

```
games/${roomCode}/
├── currentDrawing        # PNG base64 (sync 100ms)
├── currentCategory       # Catégorie à dessiner
├── currentRound          # Numéro du round
├── currentDrawerId       # ID du dessinateur
├── aiGuessedCorrectly    # Boolean
├── gameStatus            # "lobby" | "playing" | "ended"
├── chat/                 # Messages
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
```

### multiplayerService.js

**Fonctions principales :**

```javascript
// Génération identifiants
export const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array(6).fill().map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export const generatePlayerId = () => {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Création de partie
export const createGame = async (gameMode, playerName, playerEmoji) => {
  const roomCode = generateRoomCode();
  const playerId = generatePlayerId();
  
  await set(ref(db, `games/${roomCode}`), {
    gameMode,
    currentRound: 0,
    gameStatus: 'lobby',
    players: {
      [playerId]: { name: playerName, avatar: playerEmoji, score: 0, isReady: false }
    }
  });
  
  return { roomCode, playerId };
};

// Rejoindre partie
export const joinGame = async (roomCode, playerName, playerEmoji) => { ... };

// Sync drawing (appelé toutes les 100ms)
export const updateDrawing = async (roomCode, imageData) => {
  await set(ref(db, `games/${roomCode}/currentDrawing`), imageData);
};

// Souscription aux updates
export const subscribeToGame = (roomCode, callback) => {
  return onValue(ref(db, `games/${roomCode}`), (snapshot) => {
    callback(snapshot.val());
  });
};
```

### Identification Joueurs

Les joueurs s'identifient par **pseudo + emoji** sans compte persistant :

```javascript
// Sélection avatar dans NewFrontTest.jsx
const EMOJI_OPTIONS = ['😀', '😎', '🤖', '🎨', '🦊', '🐱', '🦁', '🐸', '🦄', '🌟'];

const [playerName, setPlayerName] = useState('');
const [playerEmoji, setPlayerEmoji] = useState('😀');
```

**Avantages :**
- Pas de friction à l'entrée
- Pas de gestion de comptes
- Expérience instantanée

---

## Active Learning Pipeline

### Architecture

Le système d'Active Learning permet d'améliorer le modèle avec les dessins des utilisateurs.

```
┌─────────────────────────────────────────────────────────────────┐
│                       COLLECTE DE DONNÉES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   FREE CANVAS          INFINITE MODE                             │
│   ┌─────────┐          ┌─────────────┐                          │
│   │ Test    │          │ Auto-save   │                          │
│   │ libre   │          │ @ 85%       │                          │
│   └────┬────┘          │ confiance   │                          │
│        │               └──────┬──────┘                          │
│        │                      │                                  │
│        └──────────┬──────────┘                                  │
│                   │                                              │
│                   ▼                                              │
│         POST /drawings/save                                      │
│                   │                                              │
│                   ▼                                              │
│         Firestore: user_drawings                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     PIPELINE RETRAINING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Cloud Scheduler (hebdomadaire)                                 │
│            │                                                     │
│            ▼                                                     │
│   retrain_pipeline.py                                            │
│            │                                                     │
│            ├─→ Check seuil (500 dessins non utilisés)           │
│            │                                                     │
│            ▼                                                     │
│   train_model_v4.py (si seuil atteint)                          │
│            │                                                     │
│            ├─→ Charge QuickDraw + user_drawings                  │
│            ├─→ Entraîne CNN                                      │
│            └─→ Upload nouveau modèle                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Endpoints Active Learning

| Route | Méthode | Description |
|-------|---------|-------------|
| `/drawings/save` | POST | Sauvegarde dessin pour training |
| `/drawings/stats` | GET | Stats dessins collectés |
| `/categories/weak` | GET | Catégories avec faible confiance |

### SaveDrawingRequest Schema

```python
class SaveDrawingRequest(BaseModel):
    image_data: str      # Base64 PNG
    category: str        # Catégorie du dessin
    confidence: float    # Confiance de la prédiction
    was_correct: bool    # Si la prédiction était correcte (optionnel)
```

### Firestore Schema

```
user_drawings/{docId}
├── image_data: string         # Base64 PNG
├── category: string           # Catégorie
├── confidence: number         # Confiance [0-1]
├── was_correct: boolean       # Correcte ou non
├── used_for_training: boolean # Déjà utilisé
├── timestamp: timestamp       # Date création
└── user_agent: string         # Info navigateur
```

### Sélection Intelligente (Mode Infinite)

Le mode Infinite priorise les catégories où le modèle est faible :

```javascript
// Algorithme de sélection
const getNextCategory = async () => {
  const weakCategories = await api.get('/categories/weak');
  
  if (weakCategories.length > 0 && Math.random() < 0.7) {
    // 70% chance de cibler une catégorie faible
    return weakCategories[Math.floor(Math.random() * weakCategories.length)];
  }
  
  // 30% chance aléatoire
  return allCategories[Math.floor(Math.random() * allCategories.length)];
};
```

### Training Script (train_model_v4.py)

```python
class QuickDrawTrainerV4:
    def load_data(self, include_user_drawings=False):
        # Charge données QuickDraw
        X, y = self.load_quickdraw_data()
        
        if include_user_drawings:
            # Charge dessins utilisateurs depuis Firestore
            user_X, user_y = self.load_user_drawings()
            X = np.concatenate([X, user_X])
            y = np.concatenate([y, user_y])
        
        return X, y
    
    def train(self):
        # Architecture CNN v4
        model = self.build_model()
        model.fit(X_train, y_train, validation_data=(X_val, y_val))
        return model
```

---

## Data Pipeline & ML

### Pipeline Overview

```
STAGE 1: Download Raw Data
└── ml-training/scripts/download_dataset.py
└── Output: 70K images × 20/50/345 categories

STAGE 2: Preprocess & Create HDF5
└── ml-training/scripts/preprocess_dataset.py
└── Centroid cropping + Normalization
└── Output: quickdraw_*.h5

STAGE 3: Train CNN Model
└── ml-training/notebooks/train_model*.ipynb
└── Output: quickdraw_v*.h5
```

### CNN Architecture (v4.0.0)

```python
model = Sequential([
    # Conv Block 1
    Conv2D(32, (3, 3), activation='relu', input_shape=(28, 28, 1)),
    MaxPooling2D((2, 2)),
    
    # Conv Block 2
    Conv2D(64, (3, 3), activation='relu'),
    MaxPooling2D((2, 2)),
    
    # Conv Block 3
    Conv2D(64, (3, 3), activation='relu'),
    
    # Dense
    Flatten(),
    Dense(128, activation='relu'),
    Dropout(0.5),
    Dense(50, activation='softmax')  # 50 classes
])
```

**Métriques :**
- Parameters : ~200K
- Training Time : 30 min (GPU)
- Accuracy : 90.2%

### Centroid Cropping (+3% accuracy)

Recentre les dessins par centre de masse :

```python
def apply_centroid_crop(img):
    mask = img > 25  # Binary mask
    y_indices, x_indices = np.nonzero(mask)
    
    center_y = int(np.mean(y_indices))
    center_x = int(np.mean(x_indices))
    
    shift_y = 14 - center_y
    shift_x = 14 - center_x
    
    return np.roll(np.roll(img, shift_y, axis=0), shift_x, axis=1)
```

---

## Performance Optimizations

### Frontend

| Optimization | Impact |
|--------------|--------|
| Debounce predictions (500ms) | Réduit appels API 80% |
| Canvas offscreen rendering | -30% CPU |
| React.memo sur composants | -20% re-renders |

### Backend

| Optimization | Impact |
|--------------|--------|
| Model loaded at startup | 5ms vs 2000ms per request |
| Uvicorn workers | Parallelism |
| TensorFlow XLA | -15% inference time |

### Network

| Optimization | Impact |
|--------------|--------|
| Gzip responses | -70% payload size |
| CDN (Firebase Hosting) | <100ms latency globally |
| RTDB location (us-central1) | <50ms sync |

---

## Cost Analysis

### Monthly Cost Breakdown (100 DAU)

| Service | Usage | Cost |
|---------|-------|------|
| Firebase Hosting | 10GB bandwidth | $0 |
| Firestore | 50K reads, 10K writes | $0 |
| Firebase RTDB | 1GB data | $0 |
| Cloud Run | 500K requests, 100 CPU-hours | $0 |
| **Total** | | **~$0** |

### Scaling Projections

| DAU | Estimated Monthly Cost |
|-----|------------------------|
| 100 | $0 (free tier) |
| 1,000 | $5-10 |
| 10,000 | $50-100 |
| 100,000 | $500-1,000 |

---

## 📚 Documentation Complémentaire

- [GETTING_STARTED.md](GETTING_STARTED.md) — Guide démarrage rapide
- [DEVELOPMENT.md](DEVELOPMENT.md) — Workflow développement
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — État d'avancement
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) — Configuration Firebase & Cloud Run

# 🗓️ AI Pictionary - Roadmap des Fonctionnalités Non Implémentées

**Date:** 5 décembre 2025  
**Version actuelle:** 1.0.0 (Production)  
**Prochaine phase:** Phase 2 (Janvier-Février 2026)

---

## 📋 État Actuel de l'Application

### ✅ Fonctionnalités Déployées (Phase 1)

| Composant | Statut | Détails |
|-----------|--------|---------|
| Frontend React | ✅ Déployé | Firebase Hosting (https://ai-pictionary-4f8f2.web.app) |
| Backend FastAPI | ✅ Déployé | Cloud Run (europe-west1) |
| Modèle CNN v1.0.0 | ✅ Entraîné | 91-93% accuracy, 50K params, 20 catégories |
| Canvas Drawing | ✅ Fonctionnel | 280x280px, debounce 500ms |
| Prédictions temps réel | ✅ Fonctionnel | Top-3 predictions, <350ms latency |
| Modal de correction | ✅ Fonctionnel | Affichage si confiance <85% |
| Firebase Auth | ✅ Configuré | Google Sign-In + Email/Password |
| Firestore Database | ✅ Configuré | Collections (users, sessions, corrections) |
| Firebase Storage | ✅ Configuré | Structure créée (drawings/, models/) |
| Docker Backend | ✅ Configuré | Python 3.11-slim + TensorFlow 2.16.2 |
| Cloud Run Deployment | ✅ Configuré | 1GB RAM, 0-10 instances, scale-to-zero |
| Production Monitoring | ✅ Opérationnel | Health check, logs Cloud Run |

---

## ❌ Fonctionnalités Non Implémentées

### 1. Active Learning Pipeline (Priorité: HAUTE)

**Objectif:** Améliorer automatiquement le modèle CNN à partir des corrections utilisateurs.

#### 1.1 Collecte et Stockage des Corrections

| Composant | Statut | Description |
|-----------|--------|-------------|
| CorrectionModal UI | ✅ Existe | Interface de correction (20 catégories) |
| Sauvegarde Firestore | ❌ Manquant | Enregistrement corrections dans `corrections/` collection |
| Stockage dessins Firebase Storage | ❌ Manquant | Upload images corrigées vers `drawings/corrections/` |
| Metadata tracking | ❌ Manquant | userId, timestamp, modelVersion, confidence |

**À implémenter:**
```javascript
// frontend/src/components/CorrectionModal.jsx
const handleSubmitCorrection = async (correctedLabel) => {
  // 1. Sauvegarder dans Firestore
  await addDoc(collection(db, 'corrections'), {
    drawingId: generateId(),
    originalPrediction: predictions[0].label,
    correctedLabel: correctedLabel,
    confidence: predictions[0].confidence,
    userId: auth.currentUser.uid,
    timestamp: serverTimestamp(),
    modelVersion: 'v1.0.0'
  });
  
  // 2. Upload image vers Storage
  const storageRef = ref(storage, `drawings/corrections/${drawingId}.png`);
  await uploadString(storageRef, canvasDataURL, 'data_url');
};
```

#### 1.2 Script de Retraining

| Fichier | Statut | Description |
|---------|--------|-------------|
| `ml-training/scripts/retrain_pipeline.py` | ❌ Manquant | Script principal retraining |
| Fetching corrections Firestore | ❌ Manquant | Récupération >500 corrections |
| Merge avec dataset original | ❌ Manquant | Combiner Quick Draw + corrections |
| Fine-tuning CNN | ❌ Manquant | Freeze conv layers, LR=0.0001, 5 epochs |
| Validation accuracy | ❌ Manquant | Test sur held-out Quick Draw data |
| Model versioning | ❌ Manquant | Incrémentation v1.0.X |
| Upload nouveau modèle | ❌ Manquant | Firebase Storage `models/production/` |
| Update Firestore metadata | ❌ Manquant | Collection `models/` avec version info |

**Algorithme attendu:**
```python
# ml-training/scripts/retrain_pipeline.py
def retrain_model_from_corrections():
    # 1. Fetch corrections from Firestore
    corrections = fetch_corrections(min_count=500)
    
    # 2. Download corrected images from Storage
    images = download_correction_images(corrections)
    
    # 3. Preprocess (centroid crop, normalize)
    X_corrections, y_corrections = preprocess_corrections(images)
    
    # 4. Load original dataset
    X_original, y_original = load_quickdraw_dataset()
    
    # 5. Merge datasets
    X_combined = np.concatenate([X_original, X_corrections])
    y_combined = np.concatenate([y_original, y_corrections])
    
    # 6. Load current model
    model = tf.keras.models.load_model('models/quickdraw_v1.0.0.h5')
    
    # 7. Freeze convolutional layers
    for layer in model.layers[:-1]:
        layer.trainable = False
    
    # 8. Fine-tune (low LR)
    model.compile(optimizer=Adam(lr=0.0001), loss='categorical_crossentropy')
    model.fit(X_combined, y_combined, epochs=5, validation_split=0.1)
    
    # 9. Validate accuracy improvement
    test_acc = model.evaluate(X_test, y_test)
    if test_acc > current_accuracy:
        # 10. Save new version
        new_version = increment_version('v1.0.0')  # → v1.0.1
        model.save(f'models/quickdraw_{new_version}.h5')
        
        # 11. Upload to Firebase Storage
        upload_to_storage(model, f'models/production/{new_version}/')
        
        # 12. Update Firestore metadata
        update_model_metadata(new_version, test_acc)
    
    return new_version, test_acc
```

#### 1.3 Déclenchement Automatique

| Méthode | Statut | Description |
|---------|--------|-------------|
| Cloud Scheduler (Cron) | ❌ Manquant | Déclenchement hebdomadaire (dimanche 2h) |
| Cloud Function (HTTP) | ❌ Manquant | Trigger manuel via endpoint |
| Firestore Trigger | ❌ Manquant | Auto-trigger quand 500 corrections atteintes |
| Notification Slack/Email | ❌ Manquant | Alerte fin retraining (succès/échec) |

**Configuration Cloud Scheduler attendue:**
```bash
gcloud scheduler jobs create http retrain-model-weekly \
  --schedule="0 2 * * 0" \
  --uri="https://europe-west1-ai-pictionary-4f8f2.cloudfunctions.net/retrainModel" \
  --http-method=POST \
  --time-zone="Europe/Paris"
```

#### 1.4 Déploiement Nouveau Modèle

| Composant | Statut | Description |
|-----------|--------|-------------|
| Hot-swap modèle Cloud Run | ❌ Manquant | Rechargement sans redéploiement container |
| Model versioning API | ❌ Manquant | Endpoint `GET /model/version` |
| Rollback automatique | ❌ Manquant | Retour v1.0.0 si accuracy drop >2% |
| A/B Testing | ❌ Manquant | 10% traffic → nouveau modèle |

---

### 2. Modes Multijoueurs (Priorité: MOYENNE)

**Objectif:** Ajouter des modes de jeu compétitifs et collaboratifs.

#### 2.1 Race Mode (Course à la Prédiction)

| Composant | Statut | Description |
|-----------|--------|-------------|
| Lobby système | ❌ Manquant | Salle d'attente 2-4 joueurs |
| Catégorie aléatoire | ❌ Manquant | Sélection commune pour tous |
| Timer synchronisé | ❌ Manquant | Compte à rebours 60 secondes |
| Prédiction temps réel | ❌ Manquant | Affichage confiance live pour tous |
| Premier à 85% gagne | ❌ Manquant | Détection gagnant instantané |
| Leaderboard | ❌ Manquant | Classement global (wins/losses) |
| Firestore real-time sync | ❌ Manquant | onSnapshot sur `games/{gameId}` |

**Structure Firestore attendue:**
```javascript
games/{gameId}
  - mode: "race"
  - category: "apple"
  - players: [
      {userId: "user1", displayName: "Alice", status: "drawing"},
      {userId: "user2", displayName: "Bob", status: "drawing"}
    ]
  - startTime: timestamp
  - endTime: null
  - winner: null
  - turns: [
      {playerId: "user1", confidence: 0.78, timestamp: ...},
      {playerId: "user2", confidence: 0.92, timestamp: ...}
    ]
```

#### 2.2 Guessing Game (Humains vs IA)

**Concept:** Une équipe de joueurs humains affronte une IA pour deviner ce que dessine un joueur. Le premier (humain ou IA) à identifier correctement le dessin gagne des points.

| Composant | Statut | Description |
|-----------|--------|-------------|
| Équipe humaine (2-5 joueurs) | ❌ Manquant | Joueurs collaboratifs qui partagent un chat pour deviner |
| IA adversaire | ❌ Manquant | Modèle CNN qui fait des prédictions en temps réel |
| 1 Dessinateur humain | ❌ Manquant | Joueur qui dessine la catégorie secrète |
| Canvas partagé temps réel | ❌ Manquant | Stream dessin visible par humains + IA simultanément |
| Chat équipe humaine | ❌ Manquant | Communication entre joueurs pour coordonner réponses |
| Prédictions IA visibles | ❌ Manquant | Affichage live des top-3 prédictions IA (confiance %) |
| Système de points | ❌ Manquant | +10 pts si humains devinent avant IA, +5 pts si IA gagne |
| Timer par round | ❌ Manquant | 90 secondes max par dessin |
| Rotation dessinateur | ❌ Manquant | Chaque joueur dessine à tour de rôle |
| Leaderboard Humains vs IA | ❌ Manquant | Score global : Victoires humains vs Victoires IA |
| Firestore real-time sync | ❌ Manquant | onSnapshot sur `games/{gameId}/strokes` et `aiPredictions` |

**Règles du jeu:**
1. Un joueur humain dessine une catégorie secrète (ex: "tree")
2. L'équipe humaine voit le dessin en temps réel et discute dans le chat
3. L'IA fait des prédictions automatiques toutes les 500ms
4. **Victoire humaine:** Un joueur tape la bonne réponse dans le chat AVANT que l'IA atteigne 85% de confiance
5. **Victoire IA:** L'IA atteint 85% de confiance sur la bonne catégorie AVANT qu'un humain devine
6. Match en plusieurs rounds (5-10 dessins), l'équipe avec le plus de points gagne

**Interface attendue:**
```
┌─────────────────────────────────────────────────────────────┐
│  🎨 Guessing Game: Humains vs IA         Round 3/5          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐          ┌──────────────────────────┐ │
│  │                  │          │  🤖 Prédictions IA        │ │
│  │   Canvas 280x280 │          │  1. Cat      92% ✅ WIN!  │ │
│  │   (Dessinateur:  │          │  2. Dog      78%          │ │
│  │    Alice)        │          │  3. Tree     45%          │ │
│  │                  │          │                           │ │
│  └──────────────────┘          │  ⏱️ Temps: 24s            │ │
│                                └──────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  💬 Chat Équipe Humaine                             │   │
│  │  Bob: "c'est un chat?"                               │   │
│  │  Charlie: "oui les oreilles!"                        │   │
│  │  Bob: "cat" ❌ Trop tard! IA a gagné                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  📊 Score:  👥 Humains: 12 pts  |  🤖 IA: 18 pts            │
└─────────────────────────────────────────────────────────────┘
```

**Structure Firestore attendue:**
```javascript
games/{gameId}
  - mode: "humanVsAI"
  - secretCategory: "cat"  // Visible uniquement par drawer
  - currentDrawerId: "user1"
  - roundNumber: 3
  - totalRounds: 5
  - roundTimer: 90
  - roundStartTime: timestamp
  - winner: null  // "humans" | "ai" | null (en cours)
  - teams: {
      humans: {
        players: ["user1", "user2", "user3"],
        score: 12,
        roundsWon: 2
      },
      ai: {
        modelVersion: "v1.0.0",
        score: 18,
        roundsWon: 3
      }
    }
  - strokes: [  // Subcollection - dessin en temps réel
      {x: [10,20,30], y: [15,25,35], timestamp: ...}
    ]
  - aiPredictions: [  // Subcollection - prédictions IA
      {
        predictions: [
          {label: "cat", confidence: 0.92},
          {label: "dog", confidence: 0.78}
        ],
        timestamp: ...,
        strokeCount: 15
      }
    ]
  - humanGuesses: [  // Subcollection - tentatives humaines
      {playerId: "user2", guess: "dog", timestamp: ..., correct: false},
      {playerId: "user2", guess: "cat", timestamp: ..., correct: true, tooLate: true}
    ]
```

**Logique de victoire:**
```javascript
// backend/game_logic.py
def check_round_winner(game_state):
    # Vérifier victoire IA (confiance >= 85%)
    latest_ai_prediction = game_state.aiPredictions[-1]
    if latest_ai_prediction.predictions[0].confidence >= 0.85:
        if latest_ai_prediction.predictions[0].label == game_state.secretCategory:
            return {
                winner: "ai",
                reason: f"IA a deviné '{game_state.secretCategory}' avec {latest_ai_prediction.predictions[0].confidence}% de confiance",
                time: latest_ai_prediction.timestamp - game_state.roundStartTime
            }
    
    # Vérifier victoire humaine (guess correcte avant IA)
    for guess in game_state.humanGuesses:
        if guess.correct and not guess.tooLate:
            return {
                winner: "humans",
                reason: f"{guess.playerName} a deviné '{game_state.secretCategory}'",
                time: guess.timestamp - game_state.roundStartTime
            }
    
    # Timeout (90s) - personne n'a gagné
    if current_time - game_state.roundStartTime > 90:
        return {
            winner: "draw",
            reason: "Temps écoulé, personne n'a deviné"
        }
    
    return None  # Round en cours
```

**Avantages de ce mode:**
- ✅ Crée une compétition excitante Humains vs Machine
- ✅ Démontre les capacités du modèle CNN en temps réel
- ✅ Encourage la collaboration entre joueurs humains
- ✅ Permet de tester les limites du modèle (dessins ambigus)
- ✅ Réutilise l'infrastructure de prédictions existante

---

### 3. Améliorations UX/UI (Priorité: BASSE)

#### 3.1 Interface Utilisateur

| Fonctionnalité | Statut | Description |
|----------------|--------|-------------|
| **Prédictions streaming continues** | ❌ Manquant | Inférence toutes les 500ms pendant le dessin (vs debounce après arrêt) |
| **Toggle modal correction** | ❌ Manquant | Paramètre ON/OFF pour désactiver affichage automatique modal <85% |
| Dark mode | ❌ Manquant | Toggle light/dark theme |
| Animations Canvas | ❌ Manquant | Particules lors prédiction correcte |
| Sound effects | ❌ Manquant | Sons success/failure |
| Tutoriel interactif | ❌ Manquant | Guide premier dessin (onboarding) |
| Historique dessins | ❌ Manquant | Galerie dessins précédents (Firestore) |
| Export PNG | ❌ Manquant | Bouton télécharger dessin |
| Undo/Redo | ❌ Manquant | Annuler derniers strokes |
| Brush size/color | ❌ Manquant | Personnalisation pinceau |
| Touch gestures | ✅ Existe | Mais optimisations possibles |

**Détails Prédictions Streaming:**
```javascript
// frontend/src/components/DrawingCanvas.jsx
let streamingInterval;

const enableStreamingPredictions = () => {
  // Lancer prédictions continues toutes les 500ms
  streamingInterval = setInterval(async () => {
    if (isDrawing) {  // Uniquement si l'utilisateur dessine
      const imageData = canvasRef.current.toDataURL();
      const predictions = await api.predict(imageData);
      updatePredictionsUI(predictions);  // Mise à jour live sans modal
    }
  }, 500);
};

const disableStreamingPredictions = () => {
  clearInterval(streamingInterval);
  // Retour au debounce 500ms classique après arrêt du dessin
};

// Event listeners
canvas.addEventListener('mousedown', enableStreamingPredictions);
canvas.addEventListener('mouseup', disableStreamingPredictions);
```

**Avantages:**
- ✅ Feedback en temps réel (2 prédictions/seconde)
- ✅ L'utilisateur voit le modèle "comprendre" en direct
- ✅ Améliore engagement sans surcharger l'API

**Inconvénients:**
- ⚠️ Latence réseau critique (nécessite <200ms backend)
- ⚠️ Consommation batterie accrue (mobile)

**Solution hybride recommandée:**
- Mode "Streaming" activable via toggle (désactivé par défaut)
- Utiliser WebSocket pour réduire overhead HTTP
- Throttling intelligent si nécessaire

**Détails Toggle Modal Correction:**
```javascript
// frontend/src/components/Settings.jsx
const [autoShowCorrectionModal, setAutoShowCorrectionModal] = useState(true);

// Sauvegarder préférence dans localStorage
useEffect(() => {
  localStorage.setItem('autoShowCorrectionModal', autoShowCorrectionModal);
}, [autoShowCorrectionModal]);

// Dans DrawingCanvas.jsx
const shouldShowModal = (predictions) => {
  const userPreference = localStorage.getItem('autoShowCorrectionModal') === 'true';
  const lowConfidence = predictions[0].confidence < 0.85;
  
  return userPreference && lowConfidence;
};

if (shouldShowModal(predictions)) {
  setShowCorrectionModal(true);
} else {
  // Afficher uniquement les prédictions, pas de modal
  updatePredictionsDisplay(predictions);
}
```

**Interface Settings attendue:**
```jsx
<SettingsPage>
  <Section title="Prédictions">
    <Toggle 
      label="Prédictions streaming (pendant le dessin)"
      value={streamingMode}
      onChange={setStreamingMode}
      description="Inférence toutes les 500ms (consomme + de batterie)"
    />
  </Section>
  
  <Section title="Apprentissage Actif">
    <Toggle 
      label="Afficher automatiquement le modal de correction"
      value={autoShowCorrectionModal}
      onChange={setAutoShowCorrectionModal}
      description="Proposer de corriger quand confiance <85%"
    />
    <Slider 
      label="Seuil de confiance pour modal"
      min={50}
      max={95}
      value={confidenceThreshold}
      onChange={setConfidenceThreshold}
      disabled={!autoShowCorrectionModal}
    />
  </Section>
</SettingsPage>
```

#### 3.2 Dashboard Utilisateur

| Composant | Statut | Description |
|-----------|--------|-------------||
| **Page Settings/Préférences** | ❌ Manquant | Configuration prédictions streaming, modal auto, seuil confiance |
| Profil utilisateur | ❌ Manquant | Avatar, bio, statistiques |
| Statistiques détaillées | ❌ Manquant | Accuracy par catégorie, progression |
| Badges/Achievements | ❌ Manquant | "100 dessins", "Streak 7 jours" |
| Graph progression | ❌ Manquant | Évolution accuracy dans le temps |

**Structure Firestore pour Settings:**
```javascript
users/{userId}
  - displayName: string
  - email: string
  - settings: {
      streamingPredictions: false,  // Prédictions continues 500ms
      autoShowCorrectionModal: true,  // Toggle modal auto
      confidenceThreshold: 85,  // Seuil personnalisé (50-95%)
      darkMode: false,
      soundEffects: true,
      language: "fr"
    }
  - statistics: {...}
```

---

### 4. Optimisations Performance (Priorité: BASSE)

#### 4.1 Frontend

| Optimisation | Statut | Description |
|--------------|--------|-------------|
| **WebSocket pour streaming** | ❌ Manquant | Connexion persistante pour prédictions continues (vs HTTP polling) |
| Code splitting | ❌ Manquant | Lazy load components (React.lazy) |
| Service Worker | ❌ Manquant | Offline support (PWA) |
| Image lazy loading | ❌ Manquant | Defer non-critical images |
| Canvas WebGL | ❌ Manquant | Rendering GPU (vs CPU) |
| Debounce adaptatif | ❌ Manquant | Adaptatif selon confiance (vs fixe 500ms) |

**Justification WebSocket:**
- HTTP polling 500ms = 2 requêtes/sec × overhead 500 bytes = 1 KB/s
- WebSocket = 1 connexion persistante, 200 bytes/message = 0.4 KB/s ✅ 60% réduction

#### 4.2 Backend

| Optimisation | Statut | Description |
|--------------|--------|-------------|
| Model quantization | ❌ Manquant | TensorFlow Lite (140KB → 35KB) |
| Batch inference | ❌ Manquant | Grouper requêtes simultanées |
| Redis cache | ❌ Manquant | Cache prédictions fréquentes |
| Cloud Run min-instances=1 | ❌ Manquant | Éliminer cold starts (+$5/mois) |
| GPU inference | ❌ Manquant | Cloud Run GPU (pour scaling >1000 DAU) |

---

### 5. Monitoring & Analytics (Priorité: MOYENNE)

#### 5.1 Métriques Production

| Outil | Statut | Description |
|-------|--------|-------------|
| Firebase Analytics | ❌ Manquant | User behavior tracking |
| Error tracking (Sentry) | ❌ Manquant | Crash reports frontend/backend |
| Cloud Monitoring | ❌ Manquant | Dashboards Cloud Run metrics |
| Custom metrics | ❌ Manquant | Accuracy par catégorie, latence P95 |
| Alerts | ❌ Manquant | Slack notification si error rate >5% |

#### 5.2 A/B Testing

| Test | Statut | Description |
|------|--------|-------------|
| Debounce timing | ❌ Manquant | Test 300ms vs 500ms vs 700ms |
| Confidence threshold | ❌ Manquant | Modal à 80% vs 85% vs 90% |
| UI variations | ❌ Manquant | Différentes couleurs barres confiance |

---

### 6. Sécurité & Conformité (Priorité: HAUTE)

#### 6.1 Sécurité

| Mesure | Statut | Description |
|--------|--------|-------------|
| Rate limiting API | ❌ Manquant | Max 10 prédictions/min/user |
| CAPTCHA | ❌ Manquant | Protection spam corrections |
| Content moderation | ❌ Manquant | Filtrage dessins inappropriés (Cloud Vision API) |
| Firestore security rules | ✅ Configuré | Mais à renforcer (validation schema) |
| Secrets management | ❌ Manquant | Google Secret Manager (vs env.yaml) |

#### 6.2 Conformité RGPD

| Exigence | Statut | Description |
|----------|--------|-------------|
| Cookie consent | ❌ Manquant | Bannière consentement cookies |
| Data export | ❌ Manquant | Endpoint télécharger données user |
| Data deletion | ❌ Manquant | Suppression compte + données |
| Privacy policy | ❌ Manquant | Page politique confidentialité |
| Terms of service | ❌ Manquant | CGU application |

---

### 7. CI/CD & DevOps (Priorité: MOYENNE)

#### 7.1 Automation

| Pipeline | Statut | Description |
|----------|--------|-------------|
| GitHub Actions | ❌ Manquant | CI/CD automatique sur push |
| Automated tests | ❌ Manquant | Jest (frontend), Pytest (backend) |
| Linting | ❌ Manquant | ESLint, Prettier, Black |
| Pre-commit hooks | ❌ Manquant | Validation avant commit |
| Staging environment | ❌ Manquant | Env test avant prod |

#### 7.2 Infrastructure as Code

| Outil | Statut | Description |
|-------|--------|-------------|
| Terraform | ❌ Manquant | IaC pour Cloud Run, Firebase |
| Docker Compose | ❌ Manquant | Dev local avec services (Redis, PostgreSQL) |
| Kubernetes (optionnel) | ❌ Manquant | Migration Cloud Run → GKE si scaling >10K DAU |

---

## 📅 Timeline Estimée Phase 2

### Janvier 2026 (Semaine 1-2)
- ✅ **Active Learning Pipeline** (8-10 jours)
  - Script retrain_pipeline.py
  - Cloud Scheduler setup
  - Sauvegarde corrections Firestore/Storage
  - Fine-tuning automatisé
  - Tests validation accuracy

### Janvier-Février 2026 (Semaine 3-4)
- ✅ **User Settings & UX Improvements** (6-8 jours)
  - Page Settings/Préférences utilisateur
  - Toggle prédictions streaming (500ms)
  - Toggle modal correction automatique
  - Seuil confiance personnalisable (50-95%)
  - WebSocket pour streaming (vs HTTP polling)
  - Sauvegarde préférences Firestore

### Février 2026 (Semaine 5-6)
- ✅ **Modes Multijoueurs** (10-12 jours)
  - Race Mode (lobby, timer, leaderboard)
  - Guessing Game Humains vs IA (équipe, chat, prédictions temps réel, système points)
  - Firestore real-time listeners
  - Tests multiplayer latency

### Février 2026 (Semaine 6)
- ✅ **Optimisations & Monitoring** (5-7 jours)
  - Firebase Analytics
  - Error tracking (Sentry)
  - Rate limiting
  - Performance optimizations

### Post-Phase 2 (Mars 2026+)
- ⏳ **UX/UI Améliorations** (optionnel)
- ⏳ **RGPD Conformité** (si commercialisation)
- ⏳ **CI/CD Pipeline** (si équipe élargie)

---

## 🎯 Priorités Défense (15 janvier 2026)

### Critiques pour Défense
1. ✅ Application production fonctionnelle
2. ✅ Documentation complète (100+ pages)
3. ✅ Architecture Cloud Run + Firebase Hosting
4. ❌ **Active Learning Pipeline** (au moins script retrain_pipeline.py)
5. ❌ **User Settings** (toggle modal correction, seuil personnalisable)
6. ❌ **Démo prédictions streaming** (200ms continuous inference)

### Optionnels pour Défense
- Multiplayer Race Mode (prototype minimal)
- Monitoring/Analytics (peut être simulé)
- RGPD/Sécurité avancée (mentionné en roadmap)
- CI/CD (nice-to-have)

---

## 📝 Notes Importantes

1. **Active Learning** est la fonctionnalité **prioritaire absolue** pour Phase 2
   - Démontrer amélioration continue du modèle
   - Justification scientifique du projet

2. **User Settings** améliore UX de façon significative
   - Toggle modal correction = flexibilité utilisateur
   - Prédictions streaming (500ms) = engagement sans surcharge API
   - WebSocket = réduction coût API 60%

3. **Multiplayer Humains vs IA** est un différenciateur fort
   - Mode de jeu unique et engageant
   - Démontre les capacités du modèle en compétition
   - Proof of concept suffisant pour défense
   - Firestore real-time sync déjà compris

4. **Optimisations** peuvent être postposées
   - Application déjà performante (<350ms latency)
   - Free tier suffisant pour 100 DAU

5. **Sécurité/RGPD** important si commercialisation
   - Mentionner en roadmap suffit pour défense académique

---

**Dernière mise à jour:** 6 décembre 2025  
**Prochaine revue:** 15 janvier 2026 (Défense Intermédiaire)

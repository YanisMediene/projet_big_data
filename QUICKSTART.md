# 🚀 Quick Start Guide - AI Pictionary

Guide rapide pour lancer l'application AI Pictionary en 5 minutes.

## ⚡ Démarrage Rapide (Application Complète)

### Prérequis
- Python 3.8+
- Node.js 16+
- ~4GB d'espace disque
- Connexion internet

### Étape 1 : Télécharger le Dataset (20-30 min)

```bash
cd ml-training
python scripts/download_dataset.py
```

**Note :** Le téléchargement s'exécute en arrière-plan. Passez à l'étape suivante pendant ce temps.

### Étape 2 : Installer les Dépendances

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

### Étape 3 : Prétraiter le Dataset (10 min)

```bash
cd ml-training
python scripts/preprocess_dataset.py
```

**Résultat attendu :** Fichier `data/processed/quickdraw_20cat.h5` (~400MB)

### Étape 4 : Entraîner le Modèle (30 min)

```bash
cd ml-training
jupyter notebook notebooks/train_model.ipynb
```

**Instructions :**
1. Ouvrir le notebook dans le navigateur
2. Menu → "Cell" → "Run All"
3. Attendre la fin de l'entraînement (15 epochs)
4. Le modèle sera sauvegardé dans `backend/models/quickdraw_v1.0.0.h5`

### Étape 5 : Lancer l'Application

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

### Étape 6 : Tester

1. Ouvrir http://localhost:3000
2. Dessiner sur le canvas
3. Voir les prédictions en temps réel !

---

## 🧪 Test d'Intégration

Vérifier que tous les composants fonctionnent :

```bash
python test_integration.py
```

**Résultat attendu :**
```
✅ PASSED  Dataset
✅ PASSED  Model
✅ PASSED  Backend Health
✅ PASSED  Frontend
✅ PASSED  Prediction

🎉 All systems operational!
```

---

## 📦 Architecture Simplifiée

```
┌─────────────┐      HTTP/REST       ┌─────────────┐
│   React     │ ←─────────────────→  │  FastAPI    │
│   Frontend  │   POST /predict      │  Backend    │
│  (Port 3000)│                      │ (Port 8000) │
└─────────────┘                      └─────────────┘
      │                                     │
      │                                     │
      ▼                                     ▼
  Canvas 280x280                    TensorFlow Model
  Debounce 500ms                    quickdraw_v1.0.0.h5
                                    (35K params, 5ms)
```

---

## 🎯 Workflow Utilisateur

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

---

## 🐛 Dépannage

### Backend : "Model not loaded"
```bash
# Vérifier que le modèle existe
ls -lh backend/models/quickdraw_v1.0.0.h5

# Si absent, entraîner le modèle
cd ml-training
jupyter notebook notebooks/train_model.ipynb
```

### Frontend : "Backend offline"
```bash
# Démarrer le backend
cd backend
uvicorn main:app --reload

# Vérifier le health check
curl http://localhost:8000/health
```

### Dataset : Téléchargement lent
```bash
# Vérifier la progression
cd ml-training/data/raw
ls -lh *.npy | wc -l  # Devrait afficher 20
```

### Port déjà utilisé
```bash
# Backend (port 8000)
lsof -ti:8000 | xargs kill -9

# Frontend (port 3000)
lsof -ti:3000 | xargs kill -9
```

---

## 📊 Métriques de Performance

| Métrique | Valeur | Note |
|----------|--------|------|
| Taille modèle | 140KB | Très léger |
| Paramètres | 35K | Simple CNN |
| Inférence | 5ms | Temps réel |
| Accuracy cible | 91-93% | Sur test set |
| Debounce | 500ms | UX optimisée |
| Dataset | 1.4M images | 20 catégories |

---

## 🎓 Catégories Disponibles (20)

```
apple, sun, tree, house, car,
cat, fish, star, umbrella, flower,
moon, airplane, bicycle, clock, eye,
cup, shoe, cloud, lightning, smiley_face
```

---

## 🔄 Workflow de Développement

### Mode Développement
```bash
# Terminal 1
cd backend && uvicorn main:app --reload

# Terminal 2
cd frontend && npm start
```

### Mode Production
```bash
# Build frontend
cd frontend && npm run build

# Déployer sur Firebase
firebase deploy --only hosting
```

---

## 📚 Documentation Complète

- **Backend API :** `backend/README.md`
- **Frontend :** `frontend/README.md`
- **ML Training :** `ml-training/README.md`
- **Firebase Setup :** `docs/firebase_setup.md`
- **Data Pipeline :** `docs/data_pipeline.md`
- **Defense Justifications :** `docs/defense_justifications.md`

---

## ⏱️ Temps Estimé Total

| Étape | Durée | Parallélisable |
|-------|-------|----------------|
| Téléchargement dataset | 20-30 min | ✅ (pendant installation) |
| Installation dépendances | 5 min | ✅ |
| Prétraitement dataset | 10 min | ❌ |
| Entraînement modèle | 30 min | ❌ |
| Test application | 5 min | ❌ |
| **TOTAL** | **~70 min** | |

**Astuce :** Lancez le téléchargement du dataset en premier, puis installez les dépendances pendant ce temps.

---

## ✅ Checklist Avant Défense

- [ ] Dataset téléchargé (20 catégories)
- [ ] Dataset prétraité (quickdraw_20cat.h5)
- [ ] Modèle entraîné (quickdraw_v1.0.0.h5)
- [ ] Backend fonctionne (curl http://localhost:8000/health)
- [ ] Frontend fonctionne (http://localhost:3000)
- [ ] Prédictions en temps réel testées
- [ ] Modal de correction apparaît (<85%)
- [ ] Documentation de défense lue (defense_justifications.md)
- [ ] Firebase configuré (optionnel pour Phase 1)

---

## 🎯 Prochaines Étapes (Phase 2)

1. **Firebase Configuration** (30-45 min)
   - Suivre `docs/firebase_setup.md`
   - Authentification Google + Email/Password
   - Firestore + Storage setup

2. **Active Learning Pipeline** (2-3 heures)
   - Récupération corrections Firestore
   - Fine-tuning automatisé
   - Déploiement nouveau modèle

3. **Modes Multijoueurs** (3-4 heures)
   - Race mode (premier à 85%)
   - Guessing game (drawer vs guessers)
   - Real-time sync Firestore

---

**Questions ? Consultez `docs/defense_justifications.md` pour toutes les justifications techniques !**

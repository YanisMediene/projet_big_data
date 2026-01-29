# ⚡ Quick Start - Finalisation Phase 2

## 🎯 Objectif
Activer toutes les nouvelles fonctionnalités en **15 minutes**.

---

## 🚀 Option A: Script Automatique (RECOMMANDÉ)

### Exécuter le script de setup
```bash
cd /Users/mediene/Informatique/SEM9/projet_big_data
./setup_phase2.sh
```

**Ce script fait automatiquement:**
- ✅ Crée `backend/.env` avec ADMIN_API_KEY sécurisée
- ✅ Installe `react-router-dom`
- ✅ Remplace `App.js` par la version avec routing
- ✅ Vérifie tous les composants

### Après le script
```bash
# Terminal 1: Backend
cd backend
python -m uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm start
```

### Tester
- 🎨 Dessin: http://localhost:3000/
- 🎮 Multiplayer: http://localhost:3000/multiplayer
- ⚙️ Settings: http://localhost:3000/settings

---

## 🛠️ Option B: Manuel (si script échoue)

### 1. Backend Setup (5 min)
```bash
cd backend

# Copier .env
cp .env.example .env

# Générer clé admin
openssl rand -hex 32
# Copier le résultat

# Éditer .env
nano .env
# Remplacer: ADMIN_API_KEY=<coller_la_clé>
# Sauvegarder: Ctrl+O, Enter, Ctrl+X
```

### 2. Frontend Setup (10 min)
```bash
cd frontend

# Installer React Router
npm install react-router-dom

# Backup ancien App.js
cp src/App.js src/App.js.backup

# Remplacer par nouveau App.js
cp src/App.ROUTER.js src/App.js
```

### 3. Démarrer (2 min)
```bash
# Terminal 1
cd backend
python -m uvicorn main:app --reload

# Terminal 2
cd frontend
npm start
```

---

## ✅ Checklist de Vérification

### Backend
- [ ] `backend/.env` existe
- [ ] `ADMIN_API_KEY` configurée (32+ caractères)
- [ ] `backend/serviceAccountKey.json` existe
- [ ] Backend démarre sans erreur sur port 8000

### Frontend
- [ ] `react-router-dom` installé
- [ ] `App.js` contient `<Router>`, `<Routes>`, `<Route>`
- [ ] Frontend démarre sans erreur sur port 3000
- [ ] Navigation fonctionne entre pages

### Tests Rapides
- [ ] Aller sur `/` → Interface dessin s'affiche
- [ ] Aller sur `/multiplayer` → Lobby s'affiche
- [ ] Aller sur `/settings` → Paramètres s'affichent (si connecté)
- [ ] Dessiner → Prédictions s'affichent
- [ ] Créer partie Guessing Game → Lobby créé

---

## 🐛 Troubleshooting Express

### "Cannot find module 'react-router-dom'"
```bash
cd frontend
npm install react-router-dom
npm start
```

### "ADMIN_API_KEY not configured"
```bash
cd backend
openssl rand -hex 32  # Copier résultat
echo "ADMIN_API_KEY=<coller_ici>" >> .env
```

### "serviceAccountKey.json not found"
1. Aller sur: https://console.firebase.google.com
2. Project Settings → Service Accounts
3. Generate new private key
4. Télécharger → Renommer → Placer dans `backend/`

### Port 8000 occupé
```bash
lsof -ti:8000 | xargs kill -9
```

### Port 3000 occupé
```bash
lsof -ti:3000 | xargs kill -9
```

---

## 🎮 Test Complet Guessing Game (10 min)

### Scénario de test
1. **Utilisateur 1** (fenêtre normale):
   - Se connecter avec compte Firebase
   - Aller sur `/multiplayer`
   - Créer Guessing Game
   - Copier URL de la partie

2. **Utilisateur 2** (fenêtre incognito):
   - Se connecter avec autre compte
   - Coller URL de la partie
   - Rejoindre

3. **Utilisateur 1**:
   - Cliquer "Start Game"

4. **Drawer** (celui qui a la catégorie affichée):
   - Dessiner la catégorie

5. **Guesser** (autre joueur):
   - Taper réponse dans input
   - Envoyer

6. **Vérifier**:
   - [ ] Prédictions IA s'affichent (panneau droit)
   - [ ] Chat fonctionne (panneau gauche)
   - [ ] Timer décompte
   - [ ] Scores se mettent à jour
   - [ ] Round suivant démarre
   - [ ] Écran victoire s'affiche

---

## 📊 Fonctionnalités Activées

### ✅ User Settings
- Streaming predictions ON/OFF
- Auto-show modal ON/OFF
- Confidence threshold (50-95%)
- Prediction debounce (100-1000ms)
- Sound effects ON/OFF
- Theme (light/dark/auto)

### ✅ Guessing Game
- Lobby création/join
- 2-5 joueurs vs IA
- Rotation dessinateur
- Prédictions IA temps réel
- Chat équipe
- Scoring équipe + individuel
- Timer 90s
- Victoire humains/IA

### ✅ Navigation
- Route `/` - Dessin
- Route `/multiplayer` - Lobby
- Route `/multiplayer/race/:id` - Race Mode
- Route `/multiplayer/guessing/:id` - Guessing Game
- Route `/settings` - Paramètres (auth requis)

---

## 🚀 Prochaines Étapes (Optionnel)

### Court Terme (1-2h)
- [ ] Tester toutes les fonctionnalités
- [ ] Corriger bugs trouvés
- [ ] Améliorer UX/UI

### Moyen Terme (3-4h)
- [ ] Implémenter code splitting (React.lazy)
- [ ] Setup PWA (service worker)
- [ ] Ajouter Firebase Remote Config

### Long Terme (1-2 jours)
- [ ] Déployer frontend (Firebase Hosting)
- [ ] Déployer backend (Cloud Run)
- [ ] Setup monitoring (Sentry)
- [ ] Configurer Cloud Scheduler

---

## 📚 Documentation

- `FINALIZATION_GUIDE.md` - Guide complet détaillé
- `ADVANCED_OPTIMIZATIONS.md` - Optimizations production
- `IMPLEMENTATION_STATUS.md` - Status features
- `PHASE2_SUMMARY.md` - Résumé exécutif

---

## 💡 Conseils

**✅ À faire:**
- Tester chaque fonctionnalité individuellement
- Vérifier logs backend (erreurs Firestore, etc.)
- Utiliser 2 navigateurs pour tester multiplayer
- Consulter console navigateur (F12) pour erreurs

**❌ À éviter:**
- Modifier App.js sans backup
- Oublier de démarrer backend avant frontend
- Tester multiplayer seul (besoin 2 joueurs min)
- Déployer sans tester en local d'abord

---

## 🎉 Succès!

Si tout fonctionne:
- ✅ Settings sauvegardés dans Firestore
- ✅ Guessing Game jouable
- ✅ Chat temps réel
- ✅ Prédictions IA affichées
- ✅ Navigation fluide

**→ Vous êtes prêt pour le déploiement production!** 🚀

---

**Besoin d'aide?** Consultez `FINALIZATION_GUIDE.md` ou ouvrez une issue sur GitHub.

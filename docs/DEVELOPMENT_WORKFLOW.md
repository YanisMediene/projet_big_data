# 🔧 Guide de Développement & Déploiement

## 📁 Structure des Fichiers de Configuration

```
frontend/
  ├── .env.local              # ❌ Git ignoré - Config locale (émulateurs)
  ├── .env.production         # ✅ Versionné - Config production (Firebase/Cloud Run)
  └── .env.production.local   # ❌ Git ignoré - Overrides production (si besoin)
```

## 🎯 Workflow Recommandé

### 1️⃣ Développement Local

```bash
# Terminal 1 : Backend local (optionnel)
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 : Frontend local
cd frontend
npm start
# ✅ Utilise automatiquement .env.local (émulateurs Firebase + localhost:8000)
```

**Configuration active** : `.env.local`
- Firebase : Émulateurs (localhost)
- Backend : `http://localhost:8000`
- `REACT_APP_USE_EMULATOR=true`

---

### 2️⃣ Déploiement Production

#### Option A : Script automatisé (Recommandé) ✅

```bash
# À la racine du projet
./deploy.sh frontend    # Frontend uniquement
./deploy.sh backend     # Backend uniquement
./deploy.sh firestore   # Règles Firestore uniquement
./deploy.sh all         # Tout déployer
```

**Avantages** :
- ✅ Gère automatiquement le `.env.local`
- ✅ Build avec la bonne config
- ✅ Déploie sur Firebase/Cloud Run
- ✅ Restaure votre environnement local

#### Option B : Scripts npm (Frontend uniquement)

```bash
cd frontend

# Build de production (gère automatiquement .env.local)
npm run build:prod

# Build + Deploy Firebase
npm run deploy

# Build + Deploy Firebase complet (hosting + firestore + functions)
npm run deploy:full
```

#### Option C : Manuelle (Non recommandée)

```bash
# Frontend
cd frontend
mv .env.local .env.local.bak  # Sauvegarder
npm run build                  # Build avec .env.production
mv .env.local.bak .env.local  # Restaurer
cd ..
firebase deploy --only hosting

# Backend
cd backend
gcloud run deploy ai-pictionary-backend --source . --region europe-west1
```

---

## 🔐 Bonnes Pratiques

### ✅ À FAIRE

1. **Toujours commiter `.env.production`** (config publique)
   ```bash
   git add frontend/.env.production
   git commit -m "Update production config"
   ```

2. **Ne JAMAIS commiter `.env.local`** (secrets, config locale)
   - Déjà dans `.gitignore`
   - Contient des clés de développement

3. **Utiliser les scripts** pour déployer
   ```bash
   ./deploy.sh frontend  # Au lieu de commandes manuelles
   ```

4. **Tester localement avant de déployer**
   ```bash
   npm start  # Vérifier que tout fonctionne
   ```

5. **Vérifier les variables d'environnement**
   ```bash
   # Voir ce qui sera utilisé
   cat frontend/.env.production
   ```

### ❌ À ÉVITER

1. ❌ Éditer manuellement `.env.local` avant chaque build
2. ❌ Commiter des secrets ou clés API dans `.env.production`
3. ❌ Déployer sans tester localement
4. ❌ Oublier de restaurer `.env.local` après un build manuel
5. ❌ Mettre des URLs de production dans `.env.local`

---

## 🚀 Workflow Complet Exemple

### Développement d'une nouvelle feature

```bash
# 1. Créer une branche
git checkout -b feature/nouvelle-fonctionnalite

# 2. Développer localement
cd frontend
npm start  # Utilise .env.local automatiquement

# 3. Tester
# L'app utilise les émulateurs et localhost:8000

# 4. Commiter les changements
git add .
git commit -m "feat: ajout nouvelle fonctionnalité"

# 5. Pousser
git push origin feature/nouvelle-fonctionnalite

# 6. Une fois mergé sur main, déployer
git checkout main
git pull origin main
./deploy.sh all  # Déploie tout automatiquement
```

---

## 🔧 Configuration des Émulateurs Firebase (Développement Local)

Pour utiliser les émulateurs Firebase localement :

```bash
# Terminal 1 : Lancer les émulateurs
firebase emulators:start

# Terminal 2 : Lancer l'app
cd frontend
npm start
# ✅ .env.local contient REACT_APP_USE_EMULATOR=true
```

**Ports par défaut** :
- Firestore : `localhost:8080`
- Auth : `localhost:9099`
- UI : `localhost:4000`

---

## 📊 Vérification Post-Déploiement

Après un déploiement, vérifier :

```bash
# 1. Frontend accessible
curl -I https://ai-pictionary-4f8f2.web.app

# 2. Backend accessible
curl https://ai-pictionary-backend-1064461234232.europe-west1.run.app/health

# 3. Firestore rules déployées
firebase firestore:rules get
```

**Consoles à vérifier** :
- Firebase : https://console.firebase.google.com/project/ai-pictionary-4f8f2
- Cloud Run : https://console.cloud.google.com/run?project=ai-pictionary-4f8f2

---

## 🐛 Troubleshooting

### Problème : Frontend utilise localhost en production

**Cause** : `.env.local` a pris la priorité sur `.env.production`

**Solution** :
```bash
cd frontend
rm -rf build node_modules/.cache
npm run build:prod  # Utilise le script qui gère .env.local
```

### Problème : "Emulators not running" en dev local

**Cause** : Émulateurs Firebase non démarrés

**Solution** :
```bash
firebase emulators:start
```

### Problème : CORS errors en production

**Cause** : Backend non configuré pour accepter le domaine frontend

**Solution** : Vérifier CORS dans `backend/main.py`

---

## 📝 Résumé

| Environnement | Fichier utilisé | Backend URL | Firebase | Commande |
|---------------|-----------------|-------------|----------|----------|
| **Dev Local** | `.env.local` | `localhost:8000` | Émulateurs | `npm start` |
| **Production** | `.env.production` | Cloud Run URL | Firebase réel | `npm run build:prod` ou `./deploy.sh` |

**Règle d'or** : Utilisez les scripts automatisés (`./deploy.sh` ou `npm run deploy`) pour éviter les erreurs ! 🎯

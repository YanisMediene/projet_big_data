# 🔒 Guide de Remédiation : Clé API Exposée

## 📊 Statut

| Étape | Status | Description |
|-------|--------|-------------|
| 1. Identification | ✅ | 2 fichiers compromis identifiés |
| 2. Révocation | ⏳ **À FAIRE** | Régénérer la clé dans Firebase |
| 3. Retrait du code | ✅ | Clés retirées des fichiers |
| 4. Nettoyage Git | ⏳ **À FAIRE** | Script prêt |
| 5. Restrictions | ⏳ **À FAIRE** | À configurer après |

---

## 🚨 ÉTAPES IMMÉDIATES (DANS L'ORDRE)

### 1️⃣ RÉGÉNÉRER LA CLÉ API (URGENT - 5 min)

```bash
# Ouvrir Firebase Console
open https://console.firebase.google.com/project/ai-pictionary-4f8f2/settings/general
```

**Dans la console Firebase :**

1. **Paramètres du projet** (icône engrenage)
2. Onglet **"Général"**
3. Scrollez vers **"Vos applications"**
4. Trouvez votre Web App
5. Cliquez sur l'icône des paramètres (⚙️) → **"Voir la config"**
6. **Notez toutes les valeurs** (ne pas fermer cette fenêtre !)

**Copier dans `.secrets.local` :**
```bash
# Éditer le fichier
nano .secrets.local

# Copier la nouvelle clé :
NEW_FIREBASE_API_KEY=AIzaSy... (votre nouvelle clé)
```

**Mettre à jour `.env.production` :**
```bash
# Éditer le fichier
nano frontend/.env.production

# Remplacer YOUR_FIREBASE_API_KEY_HERE par la nouvelle clé
```

---

### 2️⃣ RESTREINDRE LA CLÉ API (5 min)

Retourner dans Firebase Console → **Paramètres du projet** :

1. Trouvez votre Web App
2. Cliquez **"Ajouter des restrictions"**
3. Ajoutez vos domaines autorisés :
   ```
   ✅ ai-pictionary-4f8f2.web.app
   ✅ ai-pictionary-4f8f2.firebaseapp.com
   ✅ localhost (pour dev local)
   ```
4. **Sauvegarder**

---

### 3️⃣ VÉRIFIER QUE L'ANCIENNE CLÉ EST BIEN SUPPRIMÉE (1 min)

```bash
cd /Users/mediene/Informatique/SEM9/projet_big_data

# Vérifier qu'aucun fichier ne contient l'ancienne clé
grep -r "YOUR_FIREBASE_API_KEY_HERE" . --exclude-dir=node_modules --exclude-dir=.git

# Devrait retourner seulement .secrets.local (fichier ignoré par Git)
```

---

### 4️⃣ COMMITER LE RETRAIT DES CLÉS (2 min)

```bash
# Voir les changements
git status

# Ajouter les fichiers nettoyés
git add docs/DEPLOYMENT_PHASE2.md
git add frontend/.env.production
git add .gitignore

# Commiter
git commit -m "security: remove compromised API keys from codebase"
```

⚠️ **NE PAS PUSH ENCORE !** L'ancienne clé est encore dans l'historique Git.

---

### 5️⃣ NETTOYER L'HISTORIQUE GIT (10 min)

**Option A : Script automatique (Recommandé)**

```bash
# Exécuter le script de nettoyage
./clean-git-history.sh

# Suivre les instructions affichées
```

**Option B : Manuelle avec BFG**

```bash
# Installer BFG Repo Cleaner
brew install bfg

# Créer une backup
cp -r . ../projet_big_data_backup

# Nettoyer l'historique
echo "YOUR_FIREBASE_API_KEY_HERE" > secrets.txt
bfg --replace-text secrets.txt .git
rm secrets.txt

# Nettoyer
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

---

### 6️⃣ VÉRIFIER LE NETTOYAGE (1 min)

```bash
# Vérifier que la clé n'est plus dans l'historique
git log --all --full-history -S "YOUR_FIREBASE_API_KEY_HERE"

# Devrait retourner : (rien) ou commits de nettoyage uniquement
```

---

### 7️⃣ FORCE PUSH VERS GITHUB (2 min)

⚠️ **ATTENTION : Cette opération réécrit l'historique public !**

```bash
# Vérifier le remote
git remote -v

# Force push
git push origin main --force

# Si vous avez d'autres branches
git push origin --all --force
git push origin --tags --force
```

---

### 8️⃣ TESTER L'APPLICATION (5 min)

```bash
# Build et test local
cd frontend
npm run build:prod

# Déployer
cd ..
./deploy.sh frontend

# Vérifier que l'app fonctionne
open https://ai-pictionary-4f8f2.web.app
```

---

## 🛡️ PRÉVENTION FUTURE

### 1. Installer git-secrets (Détection automatique)

```bash
# Installer git-secrets
brew install git-secrets

# Configurer dans le repo
cd /Users/mediene/Informatique/SEM9/projet_big_data
git secrets --install

# Ajouter des patterns Firebase
git secrets --add 'AIzaSy[A-Za-z0-9_-]{33}'
git secrets --add 'projects/[^/]+/serviceAccounts/'
git secrets --add '[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com'

# Tester
git secrets --scan-history
```

### 2. Pre-commit Hook

Créer `.git/hooks/pre-commit` :

```bash
#!/bin/bash

# Chercher des secrets avant chaque commit
if git secrets --scan -r .; then
    exit 0
else
    echo "⚠️  SECRETS DÉTECTÉS ! Commit bloqué."
    exit 1
fi
```

### 3. GitHub Secret Scanning (Déjà actif)

✅ GitHub scanne automatiquement et envoie des alertes
✅ GitGuardian surveille aussi votre repo

---

## 📋 Checklist Finale

Avant de considérer le problème résolu :

- [ ] ✅ Nouvelle clé API générée dans Firebase
- [ ] ✅ Ancienne clé retirée du code
- [ ] ✅ Restrictions ajoutées sur la nouvelle clé
- [ ] ✅ Historique Git nettoyé
- [ ] ✅ Force push effectué sur GitHub
- [ ] ✅ Application testée et fonctionnelle
- [ ] ✅ git-secrets installé et configuré
- [ ] ✅ Pre-commit hook en place
- [ ] ✅ `.secrets.local` dans `.gitignore`

---

## 🆘 En Cas de Problème

### "L'application ne fonctionne plus après le déploiement"

```bash
# Vérifier la clé dans .env.production
cat frontend/.env.production

# Re-build avec la bonne clé
cd frontend
rm -rf build
npm run build:prod

# Re-deploy
cd ..
./deploy.sh frontend
```

### "git-filter-repo échoue"

```bash
# Alternative : BFG Repo Cleaner
brew install bfg
echo "YOUR_FIREBASE_API_KEY_HERE" > secrets.txt
bfg --replace-text secrets.txt .git
```

### "J'ai oublié de backup avant le nettoyage"

```bash
# Récupérer depuis GitHub (avant le force push)
git clone https://github.com/YanisMediene/projet_big_data.git projet_big_data_old
```

---

## 📞 Support

- **Firebase Support** : https://firebase.google.com/support
- **Google Cloud Security** : https://cloud.google.com/security
- **GitGuardian** : https://www.gitguardian.com/

---

## 🎯 Résumé Ultra-Rapide

```bash
# 1. Régénérer la clé
open https://console.firebase.google.com/project/ai-pictionary-4f8f2/settings/general

# 2. Mettre à jour .env.production avec la NOUVELLE clé
nano frontend/.env.production

# 3. Commit les changements
git add . && git commit -m "security: remove compromised keys"

# 4. Nettoyer l'historique
./clean-git-history.sh

# 5. Force push
git push origin main --force

# 6. Restreindre la clé dans Firebase Console

# 7. Tester
./deploy.sh frontend
```

**Temps total estimé : 30-45 minutes** ⏱️

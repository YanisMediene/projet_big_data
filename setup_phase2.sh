#!/bin/bash

# 🚀 Script de Finalisation Automatique - AI Pictionary Phase 2
# Ce script configure automatiquement les éléments nécessaires

set -e  # Arrêter en cas d'erreur

echo "======================================"
echo "🚀 AI Pictionary - Setup Phase 2"
echo "======================================"
echo ""

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les étapes
step() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "FINALIZATION_GUIDE.md" ]; then
    error "Veuillez exécuter ce script depuis la racine du projet"
    exit 1
fi

echo "📦 Étape 1: Configuration Backend"
echo "-----------------------------------"

# Créer backend/.env si inexistant
if [ ! -f "backend/.env" ]; then
    step "Copie de .env.example vers .env"
    cp backend/.env.example backend/.env
    
    # Générer ADMIN_API_KEY
    step "Génération de l'ADMIN_API_KEY sécurisée"
    ADMIN_KEY=$(openssl rand -hex 32)
    
    # Remplacer dans .env (compatible macOS et Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/ADMIN_API_KEY=your_secure_random_key_here/ADMIN_API_KEY=${ADMIN_KEY}/" backend/.env
    else
        # Linux
        sed -i "s/ADMIN_API_KEY=your_secure_random_key_here/ADMIN_API_KEY=${ADMIN_KEY}/" backend/.env
    fi
    
    step "ADMIN_API_KEY configurée: ${ADMIN_KEY:0:16}..."
else
    warning "backend/.env existe déjà, skip"
fi

# Vérifier serviceAccountKey.json
if [ ! -f "backend/serviceAccountKey.json" ]; then
    error "backend/serviceAccountKey.json manquant!"
    echo ""
    echo "🔐 Action requise:"
    echo "1. Aller sur Firebase Console: https://console.firebase.google.com"
    echo "2. Project Settings → Service Accounts"
    echo "3. Generate new private key"
    echo "4. Télécharger et placer dans backend/serviceAccountKey.json"
    echo ""
    read -p "Appuyer sur Entrée quand c'est fait..."
fi

echo ""
echo "📦 Étape 2: Installation React Router"
echo "--------------------------------------"

cd frontend

# Vérifier si react-router-dom est installé
if ! npm list react-router-dom &>/dev/null; then
    step "Installation de react-router-dom"
    npm install react-router-dom
else
    warning "react-router-dom déjà installé"
fi

cd ..

echo ""
echo "📦 Étape 3: Mise à jour App.js avec Router"
echo "-------------------------------------------"

# Backup de l'ancien App.js
if [ -f "frontend/src/App.js" ]; then
    step "Backup de App.js → App.js.backup"
    cp frontend/src/App.js frontend/src/App.js.backup
fi

# Remplacer par la nouvelle version avec Router
if [ -f "frontend/src/App.ROUTER.js" ]; then
    step "Remplacement de App.js par la version avec Router"
    cp frontend/src/App.ROUTER.js frontend/src/App.js
    step "App.js mis à jour avec routes: /, /multiplayer, /settings"
else
    error "App.ROUTER.js introuvable!"
fi

echo ""
echo "📦 Étape 4: Vérification des composants"
echo "----------------------------------------"

# Liste des composants requis
REQUIRED_FILES=(
    "frontend/src/components/Settings/Settings.jsx"
    "frontend/src/components/Settings/Settings.css"
    "frontend/src/hooks/useSettings.js"
    "frontend/src/components/Multiplayer/GuessingGame.jsx"
    "frontend/src/components/Multiplayer/Chat.jsx"
    "frontend/src/components/Multiplayer/Chat.css"
    "frontend/src/components/Multiplayer/GameLobby.jsx"
    "frontend/src/components/Multiplayer/RaceMode.jsx"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        step "$(basename $file) ✓"
    else
        error "$(basename $file) manquant!"
    fi
done

echo ""
echo "======================================"
echo "✅ Setup terminé!"
echo "======================================"
echo ""
echo "📝 Prochaines étapes:"
echo ""
echo "1️⃣  Démarrer le backend:"
echo "   cd backend"
echo "   python -m uvicorn main:app --reload"
echo ""
echo "2️⃣  Démarrer le frontend (nouveau terminal):"
echo "   cd frontend"
echo "   npm start"
echo ""
echo "3️⃣  Tester les nouvelles routes:"
echo "   • http://localhost:3000/           (Dessin)"
echo "   • http://localhost:3000/multiplayer (Lobby)"
echo "   • http://localhost:3000/settings    (Paramètres)"
echo ""
echo "4️⃣  Tester Guessing Game:"
echo "   • Créer une partie depuis le lobby"
echo "   • Rejoindre avec un 2e utilisateur (fenêtre incognito)"
echo "   • Jouer une partie complète"
echo ""
echo "📚 Documentation complète: FINALIZATION_GUIDE.md"
echo ""
echo "🎉 Bon développement!"

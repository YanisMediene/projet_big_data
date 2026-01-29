#!/bin/bash

# Script de nettoyage de l'historique Git pour retirer les secrets
# ⚠️ ATTENTION : Ceci réécrit l'historique Git !

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  ⚠️  NETTOYAGE DE L'HISTORIQUE GIT - OPÉRATION DANGEREUSE  ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Cette opération va :${NC}"
echo "  1. Réécrire TOUT l'historique Git"
echo "  2. Supprimer la clé API compromise de tous les commits"
echo "  3. Nécessiter un force push vers GitHub"
echo ""
echo -e "${YELLOW}Avant de continuer, assurez-vous que :${NC}"
echo "  ✅ Vous avez régénéré la clé dans Firebase Console"
echo "  ✅ Personne d'autre ne travaille sur ce repo en ce moment"
echo "  ✅ Vous avez sauvegardé votre travail localement"
echo ""
read -p "Voulez-vous continuer ? (tapez 'OUI' en majuscules) : " confirm

if [ "$confirm" != "OUI" ]; then
    echo "Opération annulée."
    exit 1
fi

echo ""
echo -e "${GREEN}🔧 Vérification de git-filter-repo...${NC}"

# Vérifier si git-filter-repo est installé
if ! command -v git-filter-repo &> /dev/null; then
    echo -e "${YELLOW}git-filter-repo n'est pas installé. Installation...${NC}"
    
    # Méthode 1 : via pip
    if command -v pip3 &> /dev/null; then
        pip3 install git-filter-repo
    elif command -v pip &> /dev/null; then
        pip install git-filter-repo
    # Méthode 2 : via brew (macOS)
    elif command -v brew &> /dev/null; then
        brew install git-filter-repo
    else
        echo -e "${RED}❌ Impossible d'installer git-filter-repo automatiquement${NC}"
        echo "Installez-le manuellement avec:"
        echo "  pip3 install git-filter-repo"
        echo "  OU"
        echo "  brew install git-filter-repo"
        exit 1
    fi
fi

echo -e "${GREEN}✅ git-filter-repo est disponible${NC}"
echo ""

# Créer une backup
echo -e "${GREEN}📦 Création d'une backup...${NC}"
BACKUP_DIR="../projet_big_data_backup_$(date +%Y%m%d_%H%M%S)"
cp -r . "$BACKUP_DIR"
echo -e "${GREEN}✅ Backup créée dans: $BACKUP_DIR${NC}"
echo ""

# La clé API à supprimer
OLD_KEY="YOUR_FIREBASE_API_KEY_HERE"
PLACEHOLDER="YOUR_FIREBASE_API_KEY_HERE"

echo -e "${GREEN}🧹 Nettoyage de l'historique Git...${NC}"
echo "Remplacement de: $OLD_KEY"
echo "Par: $PLACEHOLDER"
echo ""

# Utiliser git-filter-repo pour remplacer la clé dans tout l'historique
git filter-repo --replace-text <(echo "$OLD_KEY==>$PLACEHOLDER") --force

echo ""
echo -e "${GREEN}✅ Historique nettoyé avec succès !${NC}"
echo ""
echo -e "${YELLOW}📋 Prochaines étapes :${NC}"
echo ""
echo "1. Vérifiez que tout fonctionne :"
echo "   git log --all --grep='$OLD_KEY'"
echo "   (Devrait ne rien retourner)"
echo ""
echo "2. Mettez à jour frontend/.env.production avec la NOUVELLE clé"
echo ""
echo "3. Commitez les changements :"
echo "   git add ."
echo "   git commit -m 'security: remove compromised API key from history'"
echo ""
echo "4. Force push vers GitHub (⚠️ DANGEREUX) :"
echo "   git push origin main --force"
echo ""
echo "5. Informez votre équipe du force push (si applicable)"
echo ""
echo -e "${RED}⚠️  IMPORTANT : Tous les collaborateurs devront re-clone le repo${NC}"
echo -e "${RED}   ou faire un git pull avec rebase après le force push${NC}"
echo ""

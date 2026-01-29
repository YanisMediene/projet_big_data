#!/bin/bash

# Script de déploiement AI Pictionary
# Usage: ./deploy.sh [frontend|backend|all]

set -e  # Arrêter en cas d'erreur

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier les outils nécessaires
check_requirements() {
    if ! command -v firebase &> /dev/null; then
        print_error "Firebase CLI n'est pas installé"
        exit 1
    fi
    
    if ! command -v gcloud &> /dev/null; then
        print_error "Google Cloud SDK n'est pas installé"
        exit 1
    fi
    
    print_success "Tous les outils nécessaires sont installés"
}

# Déployer le frontend
deploy_frontend() {
    print_header "Déploiement du Frontend"
    
    cd frontend
    
    # Sauvegarder .env.local si existe
    if [ -f .env.local ]; then
        print_warning "Sauvegarde de .env.local..."
        mv .env.local .env.local.bak
    fi
    
    # Build
    echo "Building frontend..."
    npm run build
    
    # Restaurer .env.local
    if [ -f .env.local.bak ]; then
        mv .env.local.bak .env.local
        print_success ".env.local restauré"
    fi
    
    cd ..
    
    # Deploy
    echo "Deploying to Firebase Hosting..."
    firebase deploy --only hosting
    
    print_success "Frontend déployé sur https://ai-pictionary-4f8f2.web.app"
}

# Déployer le backend
deploy_backend() {
    print_header "Déploiement du Backend"
    
    cd backend
    
    echo "Deploying to Cloud Run..."
    gcloud run deploy ai-pictionary-backend \
        --source . \
        --region europe-west1 \
        --allow-unauthenticated \
        --memory 2Gi \
        --cpu 2 \
        --min-instances 0 \
        --max-instances 10
    
    cd ..
    
    print_success "Backend déployé sur Cloud Run"
}

# Déployer Firestore rules
deploy_firestore() {
    print_header "Déploiement des règles Firestore"
    firebase deploy --only firestore:rules
    print_success "Règles Firestore déployées"
}

# Menu principal
case "${1:-all}" in
    frontend)
        check_requirements
        deploy_frontend
        ;;
    backend)
        check_requirements
        deploy_backend
        ;;
    firestore)
        check_requirements
        deploy_firestore
        ;;
    all)
        check_requirements
        deploy_frontend
        deploy_backend
        deploy_firestore
        print_success "Déploiement complet terminé !"
        ;;
    *)
        echo "Usage: $0 [frontend|backend|firestore|all]"
        echo ""
        echo "Options:"
        echo "  frontend   - Déploie uniquement le frontend (Firebase Hosting)"
        echo "  backend    - Déploie uniquement le backend (Cloud Run)"
        echo "  firestore  - Déploie uniquement les règles Firestore"
        echo "  all        - Déploie tout (par défaut)"
        exit 1
        ;;
esac

#!/bin/bash

# AI Pictionary - Automated Setup Script
# This script automates the entire setup process after dataset download

set -e  # Exit on error

echo "============================================================"
echo "AI Pictionary - Automated Setup"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Project directory: $SCRIPT_DIR"
echo ""

# Step 1: Check if dataset is downloaded
echo "============================================================"
echo "STEP 1: Checking Dataset"
echo "============================================================"

if [ -d "ml-training/data/raw" ]; then
    NPY_COUNT=$(ls -1 ml-training/data/raw/*.npy 2>/dev/null | wc -l)
    if [ $NPY_COUNT -eq 20 ]; then
        print_success "All 20 categories downloaded"
    else
        print_warning "Only $NPY_COUNT/20 categories downloaded"
        print_info "Run: cd ml-training && python scripts/download_dataset.py"
        exit 1
    fi
else
    print_error "Dataset not found"
    print_info "Run: cd ml-training && python scripts/download_dataset.py"
    exit 1
fi

# Step 2: Preprocess dataset
echo ""
echo "============================================================"
echo "STEP 2: Preprocessing Dataset"
echo "============================================================"

if [ -f "ml-training/data/processed/quickdraw_20cat.h5" ]; then
    print_success "Preprocessed dataset already exists"
else
    print_info "Starting preprocessing (this takes ~10 minutes)..."
    cd ml-training
    python scripts/preprocess_dataset.py
    cd ..
    print_success "Dataset preprocessed successfully"
fi

# Step 3: Check if model exists
echo ""
echo "============================================================"
echo "STEP 3: Checking Model"
echo "============================================================"

if [ -f "backend/models/quickdraw_v1.0.0.h5" ]; then
    print_success "Model already exists"
    MODEL_SIZE=$(du -h backend/models/quickdraw_v1.0.0.h5 | cut -f1)
    print_info "Model size: $MODEL_SIZE"
else
    print_warning "Model not found"
    print_info "To train the model:"
    echo "   cd ml-training"
    echo "   jupyter notebook notebooks/train_model.ipynb"
    echo "   Then run all cells (Cell → Run All)"
    echo ""
    print_info "Training takes ~30 minutes"
    echo ""
    read -p "Do you want to open Jupyter notebook now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd ml-training
        jupyter notebook notebooks/train_model.ipynb
        cd ..
    else
        print_info "Skipping model training for now"
    fi
fi

# Step 4: Install backend dependencies
echo ""
echo "============================================================"
echo "STEP 4: Installing Backend Dependencies"
echo "============================================================"

cd backend
if pip list | grep -q "fastapi"; then
    print_success "Backend dependencies already installed"
else
    print_info "Installing backend dependencies..."
    pip install -r requirements.txt
    print_success "Backend dependencies installed"
fi
cd ..

# Step 5: Install frontend dependencies
echo ""
echo "============================================================"
echo "STEP 5: Installing Frontend Dependencies"
echo "============================================================"

cd frontend
if [ -d "node_modules" ]; then
    print_success "Frontend dependencies already installed"
else
    print_info "Installing frontend dependencies (this takes ~3 minutes)..."
    npm install
    print_success "Frontend dependencies installed"
fi
cd ..

# Step 6: Check environment files
echo ""
echo "============================================================"
echo "STEP 6: Checking Environment Files"
echo "============================================================"

if [ -f "backend/.env" ]; then
    print_success "Backend .env file exists"
else
    print_warning "Backend .env file not found"
    print_info "Creating from template..."
    cp backend/.env.example backend/.env
    print_success "Created backend/.env"
fi

if [ -f "frontend/.env.local" ]; then
    print_success "Frontend .env.local file exists"
else
    print_warning "Frontend .env.local file not found"
    print_info "Template already created, but you need to add Firebase credentials"
    print_info "See: docs/firebase_setup.md"
fi

# Step 7: Summary
echo ""
echo "============================================================"
echo "SETUP COMPLETE"
echo "============================================================"
echo ""

print_success "Project setup completed successfully!"
echo ""

echo "Next steps:"
echo ""

if [ ! -f "backend/models/quickdraw_v1.0.0.h5" ]; then
    echo "1. Train the model (required):"
    echo "   cd ml-training"
    echo "   jupyter notebook notebooks/train_model.ipynb"
    echo "   Run all cells (takes ~30 minutes)"
    echo ""
fi

echo "2. Start the backend:"
echo "   cd backend"
echo "   uvicorn main:app --reload"
echo ""

echo "3. Start the frontend (in another terminal):"
echo "   cd frontend"
echo "   npm start"
echo ""

echo "4. Open http://localhost:3000 and start drawing!"
echo ""

echo "Optional: Configure Firebase for multiplayer features"
echo "   See: docs/firebase_setup.md"
echo ""

echo "Test the integration:"
echo "   python test_integration.py"
echo ""

print_info "Full documentation: QUICKSTART.md"

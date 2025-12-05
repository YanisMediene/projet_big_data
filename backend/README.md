# Backend Testing and Setup Guide

## Prerequisites

Before running the backend, you need:

1. **Python 3.10+** installed
2. **Virtual environment** (recommended)
3. **Trained model** (from ml-training/notebooks/train_model.ipynb)
4. **Firebase credentials** (optional for testing without auth)

## Quick Start (Without Firebase)

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Edit `.env` file:
```bash
# Disable Firebase for initial testing
# FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Model (will use mock until trained)
MODEL_PATH=./models/quickdraw_v1.0.0.h5
MODEL_VERSION=v1.0.0

# Categories
CATEGORIES=apple,sun,tree,house,car,cat,fish,star,umbrella,flower,moon,airplane,bicycle,clock,eye,cup,shoe,cloud,lightning,smiley_face
```

### 3. Run Server (Without Model for Testing)

```bash
uvicorn main:app --reload --port 8000
```

The server will start at: http://localhost:8000

**Note:** `/predict` endpoint will fail until model is added. Use `/health` to verify server is running.

## API Endpoints

### GET /
Returns API information
```bash
curl http://localhost:8000/
```

### GET /health
Health check with model status
```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "model_version": "v1.0.0",
  "model_loaded": true,
  "categories_count": 20
}
```

### POST /predict
Predict drawing from base64 Canvas image

**Request:**
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "data:image/png;base64,iVBORw0KGgo..."
  }'
```

**Response:**
```json
{
  "prediction": "cat",
  "confidence": 0.87,
  "probabilities": {
    "cat": 0.87,
    "dog": 0.08,
    "rabbit": 0.03,
    ...
  },
  "model_version": "v1.0.0"
}
```

## Interactive API Documentation

Once the server is running:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## Testing Without Frontend

### Option 1: Use Python Script

Create `test_api.py`:
```python
import requests
import base64

# Read a test image
with open("test_drawing.png", "rb") as f:
    image_data = base64.b64encode(f.read()).decode()

# Make prediction request
response = requests.post(
    "http://localhost:8000/predict",
    json={"image_data": f"data:image/png;base64,{image_data}"}
)

print(response.json())
```

### Option 2: Use cURL with Base64 Image

```bash
# Convert image to base64
IMAGE_B64=$(base64 -i test_drawing.png)

# Make request
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d "{\"image_data\": \"data:image/png;base64,$IMAGE_B64\"}"
```

## Adding the Trained Model

After training the model in `ml-training/notebooks/train_model.ipynb`:

1. The model is automatically saved to `backend/models/quickdraw_v1.0.0.h5`
2. Restart the backend server
3. Check `/health` endpoint to verify model is loaded

## Troubleshooting

### ImportError: No module named 'tensorflow'

```bash
pip install tensorflow==2.15.0
```

### Model not found error

- Ensure `MODEL_PATH` in `.env` points to the correct model file
- Train the model first using the Jupyter notebook
- Or create a mock model for testing (see below)

### Firebase authentication errors

- Comment out Firebase initialization in `main.py` for testing
- Or add `serviceAccountKey.json` to backend directory

## Next Steps

1. ✅ Backend API is running
2. ⏳ Train model (run `ml-training/notebooks/train_model.ipynb`)
3. ⏳ Create React frontend
4. ⏳ Integrate Firebase Auth
5. ⏳ Test end-to-end flow

## Development Tips

- **Auto-reload:** Use `uvicorn main:app --reload` for development
- **Debugging:** Set `DEBUG=True` in `.env` for detailed error messages
- **Logs:** Check terminal output for model loading status
- **CORS:** Add frontend URL to `CORS_ORIGINS` in `.env`

## Production Deployment

For production (Cloud Run, AWS Lambda, etc.):

1. Set `DEBUG=False` in `.env`
2. Add Firebase service account key
3. Use production CORS origins
4. Consider using `gunicorn` with multiple workers:
   ```bash
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```

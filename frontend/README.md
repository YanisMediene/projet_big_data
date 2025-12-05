# AI Pictionary - Frontend

React-based frontend for AI Pictionary with real-time drawing recognition.

## Features

- **HTML5 Canvas Drawing** (280x280px)
  - Mouse and touch event support
  - 8px brush size with smooth strokes
  - Clear canvas functionality
  
- **Real-time Predictions**
  - 500ms debounced API calls
  - Top-3 predictions with confidence scores
  - Color-coded confidence levels:
    - 🟢 Green (>85%): High confidence
    - 🟡 Yellow (70-85%): Medium confidence
    - 🔴 Red (<70%): Low confidence

- **Active Learning Integration**
  - Correction modal for low-confidence predictions
  - User-submitted corrections for model improvement
  - Firebase integration for correction storage

- **Responsive UI**
  - Tailwind CSS styling
  - Mobile-friendly design
  - Real-time backend status indicator

## Tech Stack

- **React** 18.x
- **Tailwind CSS** 3.x
- **Axios** for API calls
- **Firebase SDK** 10.x (Auth, Firestore, Storage)

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Create `.env.local` (already created, update with your Firebase credentials):

```bash
# Firebase Configuration (from Firebase Console)
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Backend API Configuration
REACT_APP_API_BASE_URL=http://localhost:8000
```

**Note:** See `docs/firebase_setup.md` for Firebase project creation steps.

### 3. Start Development Server

```bash
npm start
```

App will open at: http://localhost:3000

## Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── DrawingCanvas.jsx       # HTML5 Canvas with drawing logic
│   │   ├── PredictionDisplay.jsx   # Top-3 predictions with confidence bars
│   │   └── CorrectionModal.jsx     # Active Learning correction UI
│   ├── services/
│   │   └── api.js                  # Axios client + debounced prediction
│   ├── firebase.js                 # Firebase initialization
│   ├── App.js                      # Main app component
│   ├── index.js                    # React entry point
│   └── index.css                   # Tailwind CSS imports
├── .env.local                      # Environment variables (NOT in Git)
├── tailwind.config.js              # Tailwind configuration
├── postcss.config.js               # PostCSS plugins
└── package.json
```

## Components

### DrawingCanvas.jsx

**Features:**
- 280x280px canvas (10x model's 28x28 input)
- Mouse and touch event listeners
- Stroke rendering with `lineCap: 'round'`
- Export canvas as base64 PNG
- Clear canvas button

**Usage:**
```jsx
<DrawingCanvas
  onDrawingChange={(base64Image) => console.log(base64Image)}
  isDrawing={isDrawing}
  setIsDrawing={setIsDrawing}
/>
```

### PredictionDisplay.jsx

**Features:**
- Animated confidence bars
- Color-coded thresholds (green/yellow/red)
- Low confidence warning message
- Loading spinner during prediction

**Usage:**
```jsx
<PredictionDisplay
  predictions={[
    { category: 'apple', confidence: 92.5 },
    { category: 'sun', confidence: 5.2 },
    { category: 'tree', confidence: 2.3 }
  ]}
  isLoading={false}
/>
```

### CorrectionModal.jsx

**Features:**
- Grid of 20 category buttons
- Shows original prediction with confidence
- Submit correction to Firestore (TODO)
- Upload image to Firebase Storage (TODO)

**Usage:**
```jsx
<CorrectionModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  predictions={predictions}
  canvasImage={base64Image}
  categories={CATEGORIES}
/>
```

## API Integration

### Endpoints

**Health Check:**
```javascript
import { checkHealth } from './services/api';

const health = await checkHealth();
// Returns: { status: 'healthy', model_loaded: true, version: 'v1.0.0' }
```

**Prediction:**
```javascript
import { predictDrawing } from './services/api';

const result = await predictDrawing(base64Image);
// Returns: {
//   predictions: [
//     { category: 'apple', confidence: 92.5 },
//     { category: 'sun', confidence: 5.2 },
//     { category: 'tree', confidence: 2.3 }
//   ]
// }
```

**Debouncing:**
- 500ms delay after last stroke
- Prevents API spam during drawing
- Configurable in `api.js`

## Firebase Integration

### Current Implementation

- Firebase SDK installed
- `firebase.js` exports `auth`, `db`, `storage`
- Environment variables configured

### TODO (Phase 2)

1. **Authentication:**
   - Google Sign-In button
   - Email/Password registration
   - User profile display

2. **Firestore:**
   - Save sessions to `sessions/{sessionId}`
   - Submit corrections to `corrections/{correctionId}`
   - Real-time game state sync

3. **Storage:**
   - Upload drawings to `/drawings/raw/{sessionId}/{timestamp}.png`
   - Download model versions from `/models/production/current/`

## Testing

### Manual Testing

1. **Start Backend:**
   ```bash
   cd backend
   uvicorn main:app --reload
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm start
   ```

3. **Test Drawing:**
   - Draw a simple apple
   - Check top-3 predictions appear
   - Verify confidence bars animate

4. **Test Correction Modal:**
   - Draw ambiguous shape
   - Modal should appear if confidence < 85%
   - Select correct category
   - Check console for correction log

### Backend Status Indicator

- 🟢 **Online:** Backend healthy, model loaded
- 🔴 **Offline:** Cannot connect to http://localhost:8000
- 🟡 **Checking:** Initial health check in progress

## Performance

### Optimization Strategies

1. **Debounced Predictions:**
   - 500ms delay reduces API calls by ~80%
   - User draws for ~3 seconds → Only 1-2 API calls

2. **Canvas to Base64:**
   - `canvas.toDataURL('image/png')` ~1ms
   - Efficient for 280x280px canvas

3. **React Rendering:**
   - Confidence bars use CSS transitions (GPU-accelerated)
   - Modal renders only when `isOpen={true}`

## Known Issues

1. **npm Vulnerabilities:**
   - 9 vulnerabilities (3 moderate, 6 high)
   - All in dev dependencies (webpack, babel)
   - Run `npm audit fix` if needed (may break build)

2. **Model Not Loaded:**
   - If backend shows "Model not loaded" error
   - Train model first: See `ml-training/README.md`

3. **Firebase Not Configured:**
   - App works without Firebase (prediction only)
   - Follow `docs/firebase_setup.md` for full features

## Build for Production

```bash
npm run build
```

Creates `build/` directory with optimized static files.

**Deploy to Firebase Hosting:**
```bash
firebase deploy --only hosting
```

## Next Steps

1. ✅ Canvas drawing component
2. ✅ Real-time predictions
3. ✅ Correction modal UI
4. ⏳ Firebase Authentication
5. ⏳ Firestore CRUD operations
6. ⏳ Storage image uploads
7. ⏳ Multiplayer game modes

---

**Estimated Development Time:** 2-3 hours for full Firebase integration

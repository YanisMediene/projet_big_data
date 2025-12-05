# Firebase Configuration Guide

## Overview

AI Pictionary uses Firebase for:
1. **Authentication** (Google Sign-In + Email/Password)
2. **Firestore** (NoSQL database for user data, sessions, corrections, games)
3. **Storage** (Cloud storage for drawings and model versions)

---

## Step 1: Create Firebase Project

### 1.1 Go to Firebase Console
Visit: https://console.firebase.google.com/

### 1.2 Create New Project
1. Click **"Add project"**
2. Project name: `ai-pictionary` (or your choice)
3. Enable Google Analytics: **Optional** (recommended for tracking)
4. Click **"Create project"**

---

## Step 2: Enable Authentication

### 2.1 Navigate to Authentication
1. In Firebase Console, click **"Authentication"** in left sidebar
2. Click **"Get started"**

### 2.2 Enable Sign-In Methods

**Google Sign-In:**
1. Click **"Sign-in method"** tab
2. Click **"Google"**
3. Toggle **"Enable"**
4. Set support email (your email)
5. Click **"Save"**

**Email/Password:**
1. Click **"Email/Password"**
2. Enable both:
   - ✅ Email/Password
   - ✅ Email link (passwordless sign-in) — Optional
3. Click **"Save"**

---

## Step 3: Create Firestore Database

### 3.1 Navigate to Firestore
1. Click **"Firestore Database"** in left sidebar
2. Click **"Create database"**

### 3.2 Choose Database Mode
- **Production mode** (recommended)
  - Secure by default
  - We'll add security rules later

### 3.3 Select Location
Choose closest region to your users:
- **us-central1** (Iowa, USA)
- **europe-west1** (Belgium, Europe)
- **asia-northeast1** (Tokyo, Asia)

**Note:** Location cannot be changed later!

### 3.4 Create Initial Collections

Click **"Start collection"** and create these structures:

**Collection: `users`**
```
users/{userId}
  - displayName: string
  - email: string
  - photoURL: string
  - createdAt: timestamp
  - statistics: map
    - totalDrawings: number (0)
    - correctGuesses: number (0)
    - gamesPlayed: number (0)
    - winRate: number (0.0)
```

**Collection: `sessions`**
```
sessions/{sessionId}
  - userId: string
  - mode: string ("solo" | "race" | "guessing")
  - startTime: timestamp
  - endTime: timestamp
  - category: string
  - score: number
  - status: string ("active" | "completed")

  → Subcollection: drawings/{drawingId}
    - imageUrl: string
    - timestamp: timestamp
    - prediction: string
    - confidence: number
    - correctLabel: string
    - wasCorrect: boolean
```

**Collection: `corrections`**
```
corrections/{correctionId}
  - drawingId: string
  - sessionId: string
  - originalPrediction: string
  - correctedLabel: string
  - userId: string
  - timestamp: timestamp
  - modelVersion: string
  - imageStoragePath: string
```

**Collection: `models`**
```
models/{version}
  - version: string (e.g., "v1.0.0")
  - createdAt: timestamp
  - storagePath: string
  - active: boolean
  - metrics: map
    - accuracy: number
    - loss: number
    - trainingSamples: number
    - corrections: number
```

**Collection: `games`** (for multiplayer)
```
games/{gameId}
  - mode: string ("race" | "guessing")
  - category: string
  - players: array
    - {userId: string, displayName: string, status: string}
  - currentDrawerId: string
  - startTime: timestamp
  - endTime: timestamp
  - winner: string
  - status: string

  → Subcollection: turns/{turnId}
    - playerId: string
    - drawingData: string (base64)
    - prediction: string
    - timestamp: timestamp
    - score: number
```

---

## Step 4: Firestore Security Rules

### 4.1 Navigate to Rules Tab
Click **"Rules"** tab in Firestore

### 4.2 Add Security Rules

Replace default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isOwner(userId);
    }
    
    // Sessions collection
    match /sessions/{sessionId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if isOwner(resource.data.userId);
      
      // Drawings subcollection
      match /drawings/{drawingId} {
        allow read: if isSignedIn();
        allow write: if isSignedIn();
      }
    }
    
    // Corrections collection
    match /corrections/{correctionId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if isOwner(resource.data.userId);
    }
    
    // Models collection (read-only for clients)
    match /models/{version} {
      allow read: if true;  // Public read access
      allow write: if false;  // Only backend can write
    }
    
    // Games collection (multiplayer)
    match /games/{gameId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update: if isSignedIn() && 
                       request.auth.uid in resource.data.players[].userId;
      
      // Turns subcollection
      match /turns/{turnId} {
        allow read: if isSignedIn();
        allow write: if isSignedIn();
      }
    }
  }
}
```

### 4.3 Publish Rules
Click **"Publish"**

---

## Step 5: Create Firebase Storage

### 5.1 Navigate to Storage
1. Click **"Storage"** in left sidebar
2. Click **"Get started"**

### 5.2 Choose Security Rules
- Start in **production mode**
- Default rules (we'll customize later)

### 5.3 Select Location
Use **same location** as Firestore (for performance)

### 5.4 Create Folder Structure

Manually create folders:
```
/drawings
  /raw
  /processed
/models
  /production
    /current
    /archived
  /training
/datasets
  /quick_draw_original
  /corrections
```

---

## Step 6: Storage Security Rules

### 6.1 Navigate to Rules Tab
Click **"Rules"** tab in Storage

### 6.2 Add Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Drawings: authenticated users can upload
    match /drawings/{sessionId}/{drawingId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Models: public read, backend-only write
    match /models/{allPaths=**} {
      allow read: if true;  // Public access (model download)
      allow write: if false;  // Only backend with admin SDK
    }
    
    // Datasets: backend-only access
    match /datasets/{allPaths=**} {
      allow read, write: if false;  // Admin SDK only
    }
  }
}
```

### 6.3 Publish Rules

---

## Step 7: Generate Service Account Key (Backend)

### 7.1 Navigate to Project Settings
1. Click **gear icon** ⚙️ next to "Project Overview"
2. Click **"Project settings"**

### 7.2 Go to Service Accounts Tab
1. Click **"Service accounts"** tab
2. Click **"Generate new private key"**

### 7.3 Download JSON File
1. Click **"Generate key"**
2. Save file as: `serviceAccountKey.json`

### 7.4 Add to Backend
```bash
# Move to backend directory
mv ~/Downloads/serviceAccountKey.json backend/

# ⚠️ NEVER commit this file to Git!
# Already in .gitignore: *serviceAccountKey*.json
```

### 7.5 Update Backend .env
```bash
# backend/.env
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
```

---

## Step 8: Get Firebase Config (Frontend)

### 8.1 Add Web App
1. In Project Settings, click **"Add app"**
2. Select **Web** (</> icon)
3. App nickname: `ai-pictionary-web`
4. ✅ **Enable Firebase Hosting** (optional)
5. Click **"Register app"**

### 8.2 Copy Firebase Config

You'll see config object like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "ai-pictionary.firebaseapp.com",
  projectId: "ai-pictionary",
  storageBucket: "ai-pictionary.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```


### 8.3 Add to Frontend

Create `frontend/.env.local`:
```bash
REACT_APP_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_FIREBASE_AUTH_DOMAIN=ai-pictionary.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ai-pictionary
REACT_APP_FIREBASE_STORAGE_BUCKET=ai-pictionary.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

---

## Step 9: Install Firebase SDK

### Backend (Python)
```bash
cd backend
pip install firebase-admin==6.4.0
```

### Frontend (JavaScript)
```bash
cd frontend
npm install firebase@10.8.0
```

---

## Step 10: Initialize Firebase in Code

### Backend Initialization

`backend/main.py` (already configured):
```python
import firebase_admin
from firebase_admin import credentials, auth

# Initialize Firebase Admin SDK
cred = credentials.Certificate("./serviceAccountKey.json")
firebase_admin.initialize_app(cred)
```

### Frontend Initialization

Create `frontend/src/firebase.js`:
```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

---

## Step 11: Create Firestore Indexes

For efficient queries, create composite indexes:

### 11.1 Navigate to Indexes
Click **"Indexes"** tab in Firestore

### 11.2 Create Composite Indexes

**Index 1: Corrections by model version and timestamp**
- Collection: `corrections`
- Fields:
  - `modelVersion` (Ascending)
  - `timestamp` (Descending)

**Index 2: Sessions by user and timestamp**
- Collection: `sessions`
- Fields:
  - `userId` (Ascending)
  - `startTime` (Descending)

**Index 3: Games by status and timestamp**
- Collection: `games`
- Fields:
  - `status` (Ascending)
  - `startTime` (Descending)

### 11.3 Auto-Create from Errors

Firebase will suggest indexes when queries fail. Accept suggestions in console.

---

## Step 12: Testing Firebase Connection

### Test Backend

```python
# test_firebase.py
from firebase_admin import credentials, auth
import firebase_admin

cred = credentials.Certificate("backend/serviceAccountKey.json")
firebase_admin.initialize_app(cred)

# Create a test user
user = auth.create_user(
    email='test@example.com',
    password='testpassword123'
)
print(f"User created: {user.uid}")
```

### Test Frontend

```javascript
// In browser console after React app starts
import { auth } from './firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

signInWithEmailAndPassword(auth, 'test@example.com', 'testpassword123')
  .then(userCredential => {
    console.log('Signed in:', userCredential.user.uid);
  });
```

---

## Security Checklist

- ✅ Service account key **NOT** in Git repository
- ✅ Firestore security rules restrict write access to owners
- ✅ Storage rules allow public read for models, authenticated write for drawings
- ✅ Frontend API keys in `.env.local` (not committed)
- ✅ Production mode enabled for Firestore/Storage
- ✅ Composite indexes created for efficient queries

---

## Troubleshooting

### Error: "Permission denied" when writing to Firestore

**Solution:** Check Firestore security rules. Ensure user is authenticated:
```javascript
import { getAuth } from 'firebase/auth';
const user = getAuth().currentUser;
console.log('Current user:', user);  // Should not be null
```

### Error: "Storage bucket not found"

**Solution:** Verify `storageBucket` in config matches Firebase console.

### Error: "Index not found" in queries

**Solution:** Create composite index in Firestore console or click error link.

---

## Next Steps

1. ✅ Firebase project created
2. ✅ Authentication enabled (Google + Email)
3. ✅ Firestore database initialized with security rules
4. ✅ Storage bucket created with folder structure
5. ⏳ Integrate Firebase Auth in React frontend
6. ⏳ Implement Firestore CRUD operations
7. ⏳ Test multiplayer real-time sync

**Estimated Time:** 30-45 minutes

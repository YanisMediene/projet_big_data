import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export app instance (needed for analytics)
export { app };

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);

// Connect to emulators if in development mode
// Set REACT_APP_USE_EMULATOR=true in .env to use local emulators
if (process.env.REACT_APP_USE_EMULATOR === 'true') {
  console.log('🔧 Using Firebase Emulators');
  
  // Connect Firestore to emulator
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('   → Firestore Emulator: localhost:8080');
  } catch (error) {
    console.warn('Firestore emulator already connected or connection failed:', error.message);
  }
  
  // Connect Auth to emulator (optionnel, mais recommandé)
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.log('   → Auth Emulator: localhost:9099');
  } catch (error) {
    console.warn('Auth emulator already connected or connection failed:', error.message);
  }
  
  // Connect Realtime Database to emulator
  if (process.env.REACT_APP_USE_RTDB_EMULATOR === 'true') {
    try {
      connectDatabaseEmulator(rtdb, 'localhost', 9000);
      console.log('   → RTDB Emulator: localhost:9000');
    } catch (error) {
      console.warn('RTDB emulator already connected or connection failed:', error.message);
    }
  }
}

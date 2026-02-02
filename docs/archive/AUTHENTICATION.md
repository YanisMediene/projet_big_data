# 🔐 Authentication System (Archivé)

> ⚠️ **DOCUMENT ARCHIVÉ** - Cette fonctionnalité n'est pas implémentée dans la version actuelle.
> Les joueurs sont identifiés par un pseudo + emoji, sans authentification persistante.
> Ce document est conservé pour référence future si l'authentification devait être ajoutée.

---

## Vue d'ensemble (Non implémenté)

Le système d'authentification prévu utilisait Firebase Authentication pour permettre :
- Connexion Google (OAuth 2.0)
- Connexion Email/Password
- Profils utilisateurs persistants dans Firestore

---

## Configuration Firebase Auth (Référence)

### Activer Authentication

1. Firebase Console → **"Authentication"** → **"Get started"**
2. Onglet **"Sign-in method"**

### Google Sign-In

1. Cliquer sur **"Google"**
2. Toggle **"Enable"**
3. Email support : votre email
4. **"Save"**

### Email/Password

1. Cliquer sur **"Email/Password"**
2. Activer :
   - ✅ Email/Password
   - ✅ Email link (optionnel, passwordless)
3. **"Save"**

---

## Collection Firestore `users` (Non créée)

Structure prévue pour les profils utilisateurs :

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

---

## Code Frontend (Non utilisé)

### Hook useAuth prévu

```javascript
// hooks/useAuth.js (NON IMPLÉMENTÉ)
import { useState, useEffect, createContext, useContext } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Récupérer ou créer profil Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            displayName: firebaseUser.displayName || 'Anonyme',
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            createdAt: new Date(),
            statistics: {
              totalDrawings: 0,
              correctGuesses: 0,
              gamesPlayed: 0,
              winRate: 0
            }
          });
        }
        setUser({ ...firebaseUser, ...userDoc.data() });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signInWithGoogle, 
      signInWithEmail,
      signUpWithEmail,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

### Composant Login prévu

```javascript
// components/Auth/Login.jsx (NON IMPLÉMENTÉ)
import { useAuth } from '../../hooks/useAuth';

export default function Login() {
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmail(email, password);
    } catch (error) {
      console.error('Email sign-in failed:', error);
    }
  };

  return (
    <div className="login-container">
      <button onClick={handleGoogleSignIn}>
        Se connecter avec Google
      </button>
      
      <form onSubmit={handleEmailSignIn}>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
        />
        <button type="submit">Se connecter</button>
      </form>
    </div>
  );
}
```

---

## Règles Firestore pour Auth (Référence)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Règles pour collection users (si authentification activée)
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Pourquoi Non Implémenté

L'authentification a été retirée pour simplifier l'expérience utilisateur :

1. **Friction réduite** - Les joueurs peuvent jouer immédiatement sans créer de compte
2. **Multiplayer simplifié** - Identification par emoji + pseudo suffit pour les parties
3. **Scope projet** - Focus sur le ML et le gameplay plutôt que la gestion utilisateurs
4. **Privacy** - Pas de données personnelles stockées

---

## Implémentation Actuelle

Les joueurs sont identifiés par :
- Un **pseudo** saisi au début de partie
- Un **emoji** aléatoire ou choisi
- Un **ID temporaire** généré par `generatePlayerId()` dans `multiplayerService.js`

```javascript
// Identification actuelle (multiplayerService.js)
export const generatePlayerId = () => {
  return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Création de partie avec identité simple
export const createGame = async (gameMode, playerName, playerEmoji) => {
  const roomCode = generateRoomCode();
  const playerId = generatePlayerId();
  // ...
  players: {
    [playerId]: {
      id: playerId,
      name: playerName,      // Pseudo choisi
      avatar: playerEmoji,   // Emoji choisi
      score: 0,
      isHost: true,
      isOnline: true
    }
  }
};
```

---

## Réactivation Future

Pour réactiver l'authentification :

1. Activer Firebase Auth dans la console
2. Créer collection `users` dans Firestore
3. Implémenter `useAuth` hook
4. Ajouter composant `Login`
5. Modifier `NewFrontTest.jsx` pour gérer l'état auth
6. Migrer `multiplayerService.js` pour utiliser `auth.currentUser.uid`

---

*Document archivé le 2 février 2026*

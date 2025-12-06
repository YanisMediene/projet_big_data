import React, { createContext, useState, useEffect, useContext } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create or update user profile in Firestore
  const createUserProfile = async (user) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Create new user profile
      await setDoc(userRef, {
        displayName: user.displayName || 'Anonymous',
        email: user.email,
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        statistics: {
          totalDrawings: 0,
          correctGuesses: 0,
          gamesPlayed: 0,
          winRate: 0,
          totalCorrections: 0
        },
        settings: {
          streamingPredictions: false,
          autoShowCorrectionModal: true,
          confidenceThreshold: 85,
          darkMode: false,
          soundEffects: true,
          language: 'fr'
        }
      });
    }

    // Fetch and return user profile
    const updatedSnap = await getDoc(userRef);
    return updatedSnap.data();
  };

  // Google Sign-In
  const signInWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const profile = await createUserProfile(result.user);
      setUserProfile(profile);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Email/Password Sign-In
  const signInWithEmail = async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      setUserProfile(userSnap.data());
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Email/Password Sign-Up
  const signUpWithEmail = async (email, password, displayName) => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name
      await updateProfile(result.user, { displayName });
      
      // Create Firestore profile
      const profile = await createUserProfile({
        ...result.user,
        displayName
      });
      setUserProfile(profile);
      
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Sign Out
  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
      setUserProfile(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Update user statistics
  const updateUserStats = async (updates) => {
    if (!currentUser) return;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        statistics: updates
      }, { merge: true });
      
      // Update local state
      setUserProfile(prev => ({
        ...prev,
        statistics: { ...prev.statistics, ...updates }
      }));
    } catch (err) {
      console.error('Error updating user stats:', err);
    }
  };

  // Update user settings
  const updateUserSettings = async (settings) => {
    if (!currentUser) return;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        settings: settings
      }, { merge: true });
      
      // Update local state
      setUserProfile(prev => ({
        ...prev,
        settings: { ...prev.settings, ...settings }
      }));
    } catch (err) {
      console.error('Error updating user settings:', err);
    }
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          } else {
            const profile = await createUserProfile(user);
            setUserProfile(profile);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setError(err.message);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
    updateUserStats,
    updateUserSettings
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

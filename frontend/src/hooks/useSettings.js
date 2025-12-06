/**
 * Settings Hook
 * Custom hook to access user settings from Firestore
 */

import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_SETTINGS = {
  streamingPredictions: true,
  autoShowModal: true,
  confidenceThreshold: 0.7,
  soundEffects: true,
  theme: 'light',
  predictionDebounce: 500,
};

export const useSettings = () => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    // Listen to settings changes in real-time
    const settingsRef = doc(db, 'users', currentUser.uid, 'settings', 'preferences');
    
    const unsubscribe = onSnapshot(
      settingsRef,
      (doc) => {
        if (doc.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...doc.data() });
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to settings:', error);
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  return { settings, loading };
};

export default useSettings;

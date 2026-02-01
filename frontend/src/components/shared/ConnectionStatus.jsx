import React, { useState, useEffect } from 'react';
import { rtdb } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import './ConnectionStatus.css';

/**
 * ConnectionStatus component displays the current connection state
 * to Firebase Realtime Database. Shows a banner when disconnected
 * or reconnecting.
 */
const ConnectionStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  useEffect(() => {
    // Listen to the special .info/connected path in RTDB
    const connectedRef = ref(rtdb, '.info/connected');
    
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val() === true;
      
      if (!connected && isConnected) {
        // Just went offline
        setWasDisconnected(true);
        setShowBanner(true);
      } else if (connected && wasDisconnected) {
        // Reconnected after being offline
        setShowBanner(true);
        // Hide the "connected" banner after 3 seconds
        setTimeout(() => {
          setShowBanner(false);
          setWasDisconnected(false);
        }, 3000);
      }
      
      setIsConnected(connected);
    });

    return () => unsubscribe();
  }, [isConnected, wasDisconnected]);

  if (!showBanner) return null;

  return (
    <div className={`connection-status-banner ${isConnected ? 'connected' : 'disconnected'}`}>
      {isConnected ? (
        <>
          <span className="status-icon">✅</span>
          <span className="status-text">Connexion rétablie</span>
        </>
      ) : (
        <>
          <span className="status-icon spinning">🔄</span>
          <span className="status-text">Connexion perdue. Tentative de reconnexion...</span>
        </>
      )}
    </div>
  );
};

export default ConnectionStatus;

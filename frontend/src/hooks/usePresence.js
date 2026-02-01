/**
 * usePresence Hook
 * Manages player presence using Firebase Realtime Database
 * Handles:
 * - Setting player online/offline
 * - Heartbeat mechanism
 * - onDisconnect cleanup
 * - Listening to other players' presence
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { rtdb } from '../firebase';
import { 
  ref, 
  set, 
  onValue, 
  onDisconnect, 
  serverTimestamp,
  off,
  update
} from 'firebase/database';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Configuration
const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const PRESENCE_TIMEOUT = 30000;   // 30 seconds to consider offline

/**
 * Custom hook for managing player presence in multiplayer games
 * 
 * @param {string} gameId - The game document ID
 * @param {string} playerId - The current player's Firebase UID
 * @param {string} playerName - The current player's display name
 * @param {boolean} enabled - Whether presence tracking is enabled
 * @returns {Object} Presence state and controls
 */
export function usePresence(gameId, playerId, playerName, enabled = true) {
  const [onlinePlayers, setOnlinePlayers] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const heartbeatRef = useRef(null);
  const presenceRef = useRef(null);
  const unsubscribeRef = useRef(null);

  /**
   * Set up presence in RTDB
   */
  const setupPresence = useCallback(async () => {
    if (!gameId || !playerId || !playerName || !enabled) return;

    try {
      const playerPresenceRef = ref(rtdb, `presence/${gameId}/${playerId}`);
      presenceRef.current = playerPresenceRef;

      // Set initial presence data
      await set(playerPresenceRef, {
        online: true,
        lastSeen: serverTimestamp(),
        playerName: playerName,
        joinedAt: serverTimestamp()
      });

      // Set up onDisconnect to automatically mark offline
      const disconnectRef = onDisconnect(playerPresenceRef);
      await disconnectRef.update({
        online: false,
        lastSeen: serverTimestamp()
      });

      setIsConnected(true);
      console.log(`✅ Presence set up for ${playerName} in game ${gameId}`);

      // Also notify backend
      try {
        await fetch(`${API_URL}/games/presence/online`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game_id: gameId,
            player_id: playerId,
            player_name: playerName
          })
        });
      } catch (err) {
        console.warn('Backend presence notification failed:', err);
      }

    } catch (error) {
      console.error('Error setting up presence:', error);
      setIsConnected(false);
    }
  }, [gameId, playerId, playerName, enabled]);

  /**
   * Send heartbeat to keep presence alive
   */
  const sendHeartbeat = useCallback(async () => {
    if (!presenceRef.current || !enabled) return;

    try {
      await update(presenceRef.current, {
        lastSeen: serverTimestamp(),
        online: true
      });
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }, [enabled]);

  /**
   * Manually set player as offline (for graceful leave)
   */
  const goOffline = useCallback(async () => {
    if (!presenceRef.current) return;

    try {
      await update(presenceRef.current, {
        online: false,
        lastSeen: serverTimestamp()
      });

      // Cancel onDisconnect since we're leaving gracefully
      await onDisconnect(presenceRef.current).cancel();

      // Notify backend
      try {
        await fetch(`${API_URL}/games/presence/offline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game_id: gameId,
            player_id: playerId
          })
        });
      } catch (err) {
        console.warn('Backend offline notification failed:', err);
      }

      setIsConnected(false);
      console.log(`👋 ${playerName} went offline gracefully`);
    } catch (error) {
      console.error('Error going offline:', error);
    }
  }, [gameId, playerId, playerName]);

  /**
   * Listen to all players' presence in the game
   */
  const subscribeToPresence = useCallback(() => {
    if (!gameId || !enabled) return;

    const gamePresenceRef = ref(rtdb, `presence/${gameId}`);
    
    const unsubscribe = onValue(gamePresenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      const now = Date.now();
      
      // Filter to only include recently active players
      const filteredPresence = {};
      Object.entries(data).forEach(([id, playerData]) => {
        const lastSeen = playerData.lastSeen || 0;
        const isRecent = (now - lastSeen) < PRESENCE_TIMEOUT;
        
        filteredPresence[id] = {
          ...playerData,
          isOnline: playerData.online && isRecent
        };
      });
      
      setOnlinePlayers(filteredPresence);
    });

    unsubscribeRef.current = () => off(gamePresenceRef);
    return unsubscribe;
  }, [gameId, enabled]);

  /**
   * Get count of online players
   */
  const getOnlineCount = useCallback(() => {
    return Object.values(onlinePlayers).filter(p => p.isOnline).length;
  }, [onlinePlayers]);

  /**
   * Check if a specific player is online
   */
  const isPlayerOnline = useCallback((checkPlayerId) => {
    const player = onlinePlayers[checkPlayerId];
    return player?.isOnline || false;
  }, [onlinePlayers]);

  // Set up presence when component mounts
  useEffect(() => {
    if (!enabled) return;

    setupPresence();
    subscribeToPresence();

    // Start heartbeat interval
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      // Don't call goOffline here - let onDisconnect handle it
      // unless we want graceful cleanup
    };
  }, [enabled, setupPresence, subscribeToPresence, sendHeartbeat]);

  // Handle page visibility change
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setupPresence();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, setupPresence]);

  // Handle beforeunload for graceful cleanup
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      // Synchronous cleanup attempt
      if (presenceRef.current) {
        // Use sendBeacon for reliable delivery
        const data = JSON.stringify({
          game_id: gameId,
          player_id: playerId
        });
        navigator.sendBeacon(`${API_URL}/games/presence/offline`, data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, gameId, playerId]);

  return {
    onlinePlayers,
    isConnected,
    getOnlineCount,
    isPlayerOnline,
    goOffline,
    refreshPresence: setupPresence
  };
}

/**
 * Hook for leaving a game gracefully
 * 
 * @param {string} gameType - 'race' or 'guessing'
 * @returns {Function} leaveGame function
 */
export function useLeaveGame(gameType = 'race') {
  const leaveGame = useCallback(async (gameId, playerId, onSuccess, onError) => {
    try {
      const endpoint = gameType === 'race' ? 'race' : 'guessing';
      const response = await fetch(`${API_URL}/games/${endpoint}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          player_id: playerId
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.detail || 'Failed to leave game');
      }

      console.log(`✅ Left ${gameType} game:`, result);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      console.error('Error leaving game:', error);
      if (onError) {
        onError(error);
      }
      throw error;
    }
  }, [gameType]);

  return leaveGame;
}

export default usePresence;

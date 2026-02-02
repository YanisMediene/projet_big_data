/**
 * Multiplayer Game Service for NewFrontTest.jsx
 * Uses Firebase RTDB for real-time game state synchronization
 * No authentication required - players identified by emoji + name
 */

import { rtdb } from '../firebase';
import { 
  ref, 
  set, 
  push, 
  onValue, 
  off, 
  update, 
  remove,
  get,
  serverTimestamp,
  onDisconnect
} from 'firebase/database';

// Generate a random 4-character room code
export const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Generate a unique player ID
export const generatePlayerId = () => {
  return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Create a new multiplayer game room
 */
export const createGame = async (gameMode, playerName, playerEmoji) => {
  const roomCode = generateRoomCode();
  const playerId = generatePlayerId();
  const gameRef = ref(rtdb, `games/${roomCode}`);
  
  const gameData = {
    roomCode,
    gameMode, // 'RACE' or 'TEAM'
    status: 'waiting', // waiting, playing, finished
    hostId: playerId,
    currentRound: 0,
    maxRounds: 6,
    currentWord: '',
    currentDrawerId: null, // For TEAM mode
    roundStartTime: null,
    roundWinner: null,
    createdAt: Date.now(),
    players: {
      [playerId]: {
        id: playerId,
        name: playerName,
        avatar: playerEmoji,
        score: 0,
        isHost: true,
        isOnline: true,
        lastSeen: Date.now(),
        roundsWon: 0,
        hasFinishedRound: false,
        finishTime: null,
        confidence: 0
      }
    }
  };

  await set(gameRef, gameData);
  
  // Setup presence/disconnect handling
  const playerRef = ref(rtdb, `games/${roomCode}/players/${playerId}`);
  const presenceRef = ref(rtdb, `games/${roomCode}/players/${playerId}/isOnline`);
  
  onDisconnect(presenceRef).set(false);
  onDisconnect(ref(rtdb, `games/${roomCode}/players/${playerId}/lastSeen`)).set(Date.now());

  return { roomCode, playerId, gameData };
};

/**
 * Join an existing game room
 */
export const joinGame = async (roomCode, playerName, playerEmoji) => {
  const gameRef = ref(rtdb, `games/${roomCode}`);
  const snapshot = await get(gameRef);
  
  if (!snapshot.exists()) {
    throw new Error('Partie introuvable');
  }

  const gameData = snapshot.val();
  
  if (gameData.status !== 'waiting') {
    throw new Error('La partie a déjà commencé');
  }

  const playerCount = Object.keys(gameData.players || {}).length;
  if (playerCount >= 8) {
    throw new Error('La partie est pleine');
  }

  const playerId = generatePlayerId();
  const playerRef = ref(rtdb, `games/${roomCode}/players/${playerId}`);
  
  await set(playerRef, {
    id: playerId,
    name: playerName,
    avatar: playerEmoji,
    score: 0,
    isHost: false,
    isOnline: true,
    lastSeen: Date.now(),
    roundsWon: 0,
    hasFinishedRound: false,
    finishTime: null,
    confidence: 0
  });

  // Setup presence/disconnect handling
  const presenceRef = ref(rtdb, `games/${roomCode}/players/${playerId}/isOnline`);
  onDisconnect(presenceRef).set(false);
  onDisconnect(ref(rtdb, `games/${roomCode}/players/${playerId}/lastSeen`)).set(Date.now());

  return { roomCode, playerId };
};

/**
 * Get list of available games to join
 */
export const getAvailableGames = async (gameMode) => {
  const gamesRef = ref(rtdb, 'games');
  const snapshot = await get(gamesRef);
  
  if (!snapshot.exists()) {
    return [];
  }

  const games = [];
  snapshot.forEach((child) => {
    const game = child.val();
    if (game.status === 'waiting' && game.gameMode === gameMode) {
      const playerCount = Object.keys(game.players || {}).length;
      if (playerCount < 8) {
        // Find host name
        const hostPlayer = Object.values(game.players || {}).find(p => p.isHost);
        games.push({
          roomCode: game.roomCode,
          hostName: hostPlayer?.name || 'Inconnu',
          playerCount,
          maxPlayers: 8,
          gameMode: game.gameMode
        });
      }
    }
  });

  return games;
};

/**
 * Subscribe to game updates
 */
export const subscribeToGame = (roomCode, callback) => {
  const gameRef = ref(rtdb, `games/${roomCode}`);
  
  const unsubscribe = onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  });

  return () => off(gameRef);
};

/**
 * Subscribe to available games list
 */
export const subscribeToAvailableGames = (gameMode, callback) => {
  const gamesRef = ref(rtdb, 'games');
  
  const unsubscribe = onValue(gamesRef, (snapshot) => {
    const games = [];
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const game = child.val();
        if (game.status === 'waiting' && game.gameMode === gameMode) {
          const playerCount = Object.keys(game.players || {}).length;
          if (playerCount < 8) {
            const hostPlayer = Object.values(game.players || {}).find(p => p.isHost);
            games.push({
              roomCode: game.roomCode,
              hostName: hostPlayer?.name || 'Inconnu',
              playerCount,
              maxPlayers: 8,
              gameMode: game.gameMode
            });
          }
        }
      });
    }
    callback(games);
  });

  return () => off(gamesRef);
};

/**
 * Start the game (host only)
 */
export const startGame = async (roomCode, categories) => {
  const gameRef = ref(rtdb, `games/${roomCode}`);
  const snapshot = await get(gameRef);
  
  if (!snapshot.exists()) {
    throw new Error('Partie introuvable');
  }

  const gameData = snapshot.val();
  const players = gameData.players || {};
  const playerIds = Object.keys(players);
  
  // Select random word
  const word = categories[Math.floor(Math.random() * categories.length)];
  
  // For TEAM mode, select first drawer
  let currentDrawerId = null;
  if (gameData.gameMode === 'TEAM') {
    currentDrawerId = playerIds[Math.floor(Math.random() * playerIds.length)];
  }

  // Reset all players for the new round (including ready state)
  const playerUpdates = {};
  playerIds.forEach(pid => {
    playerUpdates[`players/${pid}/hasFinishedRound`] = false;
    playerUpdates[`players/${pid}/finishTime`] = null;
    playerUpdates[`players/${pid}/confidence`] = 0;
    playerUpdates[`players/${pid}/isReady`] = false;
  });

  // Build update object
  const updateData = {
    status: 'playing',
    currentRound: 1,
    currentWord: word,
    roundStartTime: null, // Will be set when all players ready or timeout
    roundStatus: 'waiting', // waiting, playing, finished
    roundWinner: null,
    roundWinnerType: null,
    allPlayersReady: false,
    currentDrawing: null, // No drawing yet
    ...playerUpdates
  };
  
  // Only set currentDrawerId for TEAM mode
  if (gameData.gameMode === 'TEAM') {
    updateData.currentDrawerId = currentDrawerId;
  }

  await update(gameRef, updateData);
};

/**
 * Submit round result (player finished drawing)
 */
export const submitRoundResult = async (roomCode, playerId, success, confidence, timeLeft) => {
  const gameRef = ref(rtdb, `games/${roomCode}`);
  const playerRef = ref(rtdb, `games/${roomCode}/players/${playerId}`);
  
  await update(playerRef, {
    hasFinishedRound: true,
    finishTime: Date.now(),
    confidence: confidence
  });

  // In RACE mode, check if this player won the round
  const snapshot = await get(gameRef);
  if (!snapshot.exists()) return;
  
  const gameData = snapshot.val();
  
  if (gameData.gameMode === 'RACE' && success && !gameData.roundWinner) {
    // First player to succeed wins the round
    await update(gameRef, {
      roundWinner: playerId
    });
    
    // Update player score
    const currentScore = gameData.players[playerId]?.score || 0;
    const currentWins = gameData.players[playerId]?.roundsWon || 0;
    
    // Score based on time left and confidence
    const timeBonus = Math.floor(timeLeft * 5);
    const confidenceBonus = Math.floor(confidence * 50);
    const roundScore = 100 + timeBonus + confidenceBonus;
    
    await update(playerRef, {
      score: currentScore + roundScore,
      roundsWon: currentWins + 1
    });
  }
};

/**
 * Progress to next round (host only)
 */
export const nextRound = async (roomCode, categories) => {
  const gameRef = ref(rtdb, `games/${roomCode}`);
  const snapshot = await get(gameRef);
  
  if (!snapshot.exists()) return;
  
  const gameData = snapshot.val();
  const nextRoundNum = (gameData.currentRound || 0) + 1;
  
  // Prevent duplicate calls - check if we're already in the next round
  // This can happen when multiple players call nextRound simultaneously in RACE mode
  if (gameData.roundStatus === 'waiting' && gameData.currentRound === nextRoundNum) {
    console.log('⚠️ Round already advanced, skipping duplicate nextRound call');
    return;
  }
  
  if (nextRoundNum > gameData.maxRounds) {
    // Game over
    await update(gameRef, {
      status: 'finished'
    });
    return;
  }

  // Select new word (different from current)
  let word = gameData.currentWord;
  while (word === gameData.currentWord) {
    word = categories[Math.floor(Math.random() * categories.length)];
  }

  // For TEAM mode, rotate drawer
  let currentDrawerId = gameData.currentDrawerId || null;
  if (gameData.gameMode === 'TEAM') {
    const playerIds = Object.keys(gameData.players || {});
    const currentIndex = currentDrawerId ? playerIds.indexOf(currentDrawerId) : -1;
    currentDrawerId = playerIds[(currentIndex + 1) % playerIds.length];
  }

  // Reset all players for the new round (including ready state)
  const playerUpdates = {};
  Object.keys(gameData.players || {}).forEach(pid => {
    playerUpdates[`players/${pid}/hasFinishedRound`] = false;
    playerUpdates[`players/${pid}/finishTime`] = null;
    playerUpdates[`players/${pid}/confidence`] = 0;
    playerUpdates[`players/${pid}/isReady`] = false;
  });

  // Build update object (only include currentDrawerId for TEAM mode)
  const updateData = {
    currentRound: nextRoundNum,
    currentWord: word,
    roundStartTime: null, // Will be set when all players ready or timeout
    roundStatus: 'waiting', // waiting, playing, finished
    roundWinner: null,
    roundWinnerType: null, // Reset winner type too
    allPlayersReady: false,
    currentDrawing: null, // Clear previous drawing
    ...playerUpdates
  };
  
  // Only set currentDrawerId if it's defined (TEAM mode)
  if (gameData.gameMode === 'TEAM') {
    updateData.currentDrawerId = currentDrawerId;
  }

  await update(gameRef, updateData);
};

/**
 * Leave a game
 */
export const leaveGame = async (roomCode, playerId) => {
  const gameRef = ref(rtdb, `games/${roomCode}`);
  const playerRef = ref(rtdb, `games/${roomCode}/players/${playerId}`);
  
  const snapshot = await get(gameRef);
  if (!snapshot.exists()) return;
  
  const gameData = snapshot.val();
  const players = gameData.players || {};
  const playerCount = Object.keys(players).length;
  
  // If last player, delete the game
  if (playerCount <= 1) {
    await remove(gameRef);
    return;
  }

  // If host is leaving, transfer host to another player
  if (gameData.hostId === playerId) {
    const otherPlayers = Object.keys(players).filter(pid => pid !== playerId);
    if (otherPlayers.length > 0) {
      const newHostId = otherPlayers[0];
      await update(gameRef, {
        hostId: newHostId
      });
      await update(ref(rtdb, `games/${roomCode}/players/${newHostId}`), {
        isHost: true
      });
    }
  }

  // Remove the player
  await remove(playerRef);
};

/**
 * Update player heartbeat (keep alive)
 */
export const updateHeartbeat = async (roomCode, playerId) => {
  const playerRef = ref(rtdb, `games/${roomCode}/players/${playerId}`);
  await update(playerRef, {
    isOnline: true,
    lastSeen: Date.now()
  });
};

/**
 * Mark player as ready for the round
 */
export const markPlayerReady = async (roomCode, playerId) => {
  console.log('🙋 markPlayerReady called - room:', roomCode, 'player:', playerId);
  
  if (!roomCode || !playerId) {
    console.error('❌ Missing roomCode or playerId');
    return;
  }
  
  const gameRef = ref(rtdb, `games/${roomCode}`);
  const playerRef = ref(rtdb, `games/${roomCode}/players/${playerId}`);
  
  await update(playerRef, {
    isReady: true
  });
  console.log('✅ Player marked as ready');
  
  // Check if all players are ready
  const snapshot = await get(gameRef);
  if (!snapshot.exists()) return;
  
  const gameData = snapshot.val();
  const players = Object.values(gameData.players || {});
  const allReady = players.every(p => p.isReady === true);
  
  console.log('📊 Players ready status:', players.map(p => ({ name: p.name, isReady: p.isReady })));
  console.log('🔍 All ready:', allReady, 'roundStatus:', gameData.roundStatus);
  
  if (allReady && gameData.roundStatus === 'waiting') {
    // All players ready - start the round immediately
    console.log('🎉 All players ready! Starting round immediately');
    await update(gameRef, {
      roundStatus: 'playing',
      roundStartTime: Date.now(),
      allPlayersReady: true
    });
  }
};

/**
 * Force start round after timeout (called by any player after 5 seconds)
 */
export const forceStartRound = async (roomCode) => {
  console.log('🚀 forceStartRound called for room:', roomCode);
  
  if (!roomCode) {
    console.error('❌ No roomCode provided');
    return;
  }
  
  const gameRef = ref(rtdb, `games/${roomCode}`);
  const snapshot = await get(gameRef);
  
  if (!snapshot.exists()) {
    console.error('❌ Game not found:', roomCode);
    return;
  }
  
  const gameData = snapshot.val();
  console.log('📊 Current roundStatus:', gameData.roundStatus);
  
  // Only start if still waiting
  if (gameData.roundStatus === 'waiting') {
    console.log('✅ Starting round...');
    await update(gameRef, {
      roundStatus: 'playing',
      roundStartTime: Date.now()
    });
  } else {
    console.log('ℹ️ Round already started or not waiting');
  }
};

/**
 * Send a chat message / guess (TEAM mode)
 */
export const sendChatMessage = async (roomCode, playerId, playerName, message, isCorrect = false) => {
  const chatRef = ref(rtdb, `games/${roomCode}/chat`);
  const gameRef = ref(rtdb, `games/${roomCode}`);
  
  const messageData = {
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    playerId,
    playerName,
    message,
    isCorrect,
    timestamp: Date.now()
  };
  
  // Get current chat array
  const snapshot = await get(chatRef);
  const currentChat = snapshot.exists() ? snapshot.val() : [];
  
  // Add new message (keep last 50 messages)
  const newChat = [...currentChat, messageData].slice(-50);
  
  await set(chatRef, newChat);
  
  // If correct guess by a HUMAN player, end the round and give points
  // AI wins are handled separately by aiGuessedCorrectly()
  if (isCorrect && playerId !== 'AI') {
    const gameSnapshot = await get(gameRef);
    if (!gameSnapshot.exists()) return;
    
    const gameData = gameSnapshot.val();
    const playerData = gameData.players?.[playerId];
    
    // Update score for the guesser (human)
    if (playerData) {
      const currentScore = playerData.score || 0;
      await update(ref(rtdb, `games/${roomCode}/players/${playerId}`), {
        score: currentScore + 100
      });
    }
    
    // Also give points to the drawer
    const drawerId = gameData.currentDrawerId;
    if (drawerId && gameData.players?.[drawerId]) {
      const drawerScore = gameData.players[drawerId].score || 0;
      await update(ref(rtdb, `games/${roomCode}/players/${drawerId}`), {
        score: drawerScore + 50
      });
    }
    
    await update(gameRef, {
      roundWinner: playerId,
      roundWinnerType: 'human',
      roundStatus: 'finished'
    });
  }
  
  return messageData;
};

/**
 * AI made a correct guess (TEAM mode)
 */
export const aiGuessedCorrectly = async (roomCode) => {
  const gameRef = ref(rtdb, `games/${roomCode}`);
  
  const gameSnapshot = await get(gameRef);
  if (!gameSnapshot.exists()) return;
  
  const gameData = gameSnapshot.val();
  
  // Don't end if round already finished
  if (gameData.roundStatus === 'finished' || gameData.roundWinner) return;
  
  // AI wins - no points for team, but AI gets points
  const currentAiScore = gameData.aiScore || 0;
  await update(gameRef, {
    roundWinner: 'AI',
    roundWinnerType: 'ai',
    roundStatus: 'finished',
    aiScore: currentAiScore + 100
  });
};

/**
 * Update the shared drawing canvas data (TEAM mode)
 */
export const updateDrawingData = async (roomCode, drawingDataUrl) => {
  const gameRef = ref(rtdb, `games/${roomCode}`);
  await update(gameRef, {
    currentDrawing: drawingDataUrl,
    lastDrawingUpdate: Date.now()
  });
};

/**
 * Subscribe to drawing updates (TEAM mode - for viewers)
 */
export const subscribeToDrawing = (roomCode, callback) => {
  const drawingRef = ref(rtdb, `games/${roomCode}/currentDrawing`);
  
  console.log('🖼️ Setting up drawing subscription for room:', roomCode);
  
  onValue(drawingRef, (snapshot) => {
    const drawingData = snapshot.val();
    console.log('📡 Drawing subscription update, has data:', !!drawingData, 'length:', drawingData?.length || 0);
    callback(drawingData);
  });

  return () => {
    console.log('🔌 Cleaning up drawing subscription');
    off(drawingRef);
  };
};

/**
 * Subscribe to chat messages
 */
export const subscribeToChat = (roomCode, callback) => {
  const chatRef = ref(rtdb, `games/${roomCode}/chat`);
  
  onValue(chatRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback([]);
    }
  });

  return () => off(chatRef);
};

/**
 * Clear chat for new round
 */
export const clearChat = async (roomCode) => {
  const chatRef = ref(rtdb, `games/${roomCode}/chat`);
  await set(chatRef, []);
};

/**
 * End the game
 */
export const endGame = async (roomCode) => {
  const gameRef = ref(rtdb, `games/${roomCode}`);
  await update(gameRef, {
    status: 'finished'
  });
};

/**
 * Delete the game (cleanup)
 */
export const deleteGame = async (roomCode) => {
  const gameRef = ref(rtdb, `games/${roomCode}`);
  await remove(gameRef);
};

export default {
  generateRoomCode,
  generatePlayerId,
  createGame,
  joinGame,
  getAvailableGames,
  subscribeToGame,
  subscribeToAvailableGames,
  subscribeToDrawing,
  startGame,
  submitRoundResult,
  nextRound,
  leaveGame,
  updateHeartbeat,
  markPlayerReady,
  forceStartRound,
  sendChatMessage,
  aiGuessedCorrectly,
  updateDrawingData,
  subscribeToChat,
  clearChat,
  endGame,
  deleteGame
};

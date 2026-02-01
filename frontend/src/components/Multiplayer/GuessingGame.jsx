import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, rtdb } from '../../firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import DrawingCanvas from '../DrawingCanvas';
import { trackGameStarted } from '../../services/analytics';
import { usePresence, useLeaveGame } from '../../hooks/usePresence';
import './Multiplayer.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function GuessingGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [game, setGame] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(90);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [aiPredictions, setAiPredictions] = useState([]);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [canvasImage, setCanvasImage] = useState(null);
  const [roundNotification, setRoundNotification] = useState(null);
  const [viewerCanvasImage, setViewerCanvasImage] = useState(null);
  const [presence, setPresence] = useState({});
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  
  const chatEndRef = useRef(null);
  const previousRoundRef = useRef(null);
  const canvasRef = useRef(null);
  const viewerCanvasRef = useRef(null);

  // Determine player name for presence
  const playerName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Joueur';

  // Initialize presence system
  usePresence(gameId, currentUser?.uid, playerName, !!currentUser && !!gameId);
  const { leaveGame, isLeaving: leaveInProgress } = useLeaveGame('guessing');

  // Listen to presence updates
  useEffect(() => {
    if (!gameId) return;

    const presenceRef = ref(rtdb, `presence/${gameId}`);
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      if (snapshot.exists()) {
        setPresence(snapshot.val());
      } else {
        setPresence({});
      }
    });

    return () => unsubscribe();
  }, [gameId]);

  // Listen to game updates
  useEffect(() => {
    if (!gameId) return;

    const gameRef = doc(db, 'games', gameId);
    const unsubscribe = onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        const gameData = { id: doc.id, ...doc.data() };
        setGame(gameData);
        
        // Detect round change
        if (previousRoundRef.current !== null && 
            gameData.current_round !== previousRoundRef.current && 
            gameData.status === 'playing') {
          // Clear canvas for drawer
          if (canvasRef.current) {
            canvasRef.current.clearCanvas();
          }
          
          // Show round notification
          const lastWinner = gameData.round_winners?.[gameData.round_winners.length - 1];
          let message = `Round ${gameData.current_round} !`;
          if (lastWinner) {
            message = lastWinner.winner === 'humans' 
              ? `Round ${previousRoundRef.current} gagné par ${lastWinner.guesser} !`
              : `Round ${previousRoundRef.current} gagné par l'IA !`;
          }
          
          setRoundNotification(message);
          setTimeout(() => setRoundNotification(null), 3000);
        }
        
        previousRoundRef.current = gameData.current_round;
        
        if (gameData.status === 'playing' && gameData.round_start_time) {
          const elapsed = (Date.now() - gameData.round_start_time.toMillis()) / 1000;
          const remaining = Math.max(0, gameData.settings.round_duration - elapsed);
          setTimeRemaining(Math.floor(remaining));
        }
        
        // Update AI predictions from game state (merge with local predictions)
        if (gameData.team_ai?.predictions) {
          setAiPredictions(prev => {
            // Get existing prediction timestamps
            const existingTimestamps = new Set(prev.map(p => p.timestamp));
            
            // Add new predictions from Firestore that we don't have locally
            const newPredictions = gameData.team_ai.predictions
              .filter(p => !existingTimestamps.has(p.timestamp))
              .map(p => ({
                timestamp: p.timestamp?.toMillis ? p.timestamp.toMillis() : p.timestamp,
                prediction: p.prediction,
                confidence: p.confidence
              }));
            
            // Combine and keep last 10
            return [...prev, ...newPredictions].slice(-10);
          });
        }
        
        // Update canvas state for viewers (non-drawers)
        if (gameData.canvas_state) {
          setViewerCanvasImage(gameData.canvas_state);
        }
      }
    });

    return () => unsubscribe();
  }, [gameId]);

  // Listen to chat messages (using 'turns' subcollection as backend writes to 'chat' now)
  useEffect(() => {
    if (!gameId) return;

    const chatRef = collection(db, 'games', gameId, 'chat');
    const chatQuery = query(chatRef, orderBy('timestamp', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() });
      });
      setChatMessages(messages.reverse());
    });

    return () => unsubscribe();
  }, [gameId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Update viewer canvas when canvas_state changes
  useEffect(() => {
    if (!viewerCanvasRef.current || !viewerCanvasImage) return;
    
    const canvas = viewerCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    
    img.src = `data:image/png;base64,${viewerCanvasImage}`;
  }, [viewerCanvasImage]);

  // Countdown timer
  useEffect(() => {
    if (game?.status !== 'playing') return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Call timeout endpoint
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [game?.status, game?.current_round]);

  // Update canvas state in Firestore when drawer draws
  useEffect(() => {
    if (!game || game.status !== 'playing') return;
    if (!currentUser || game.current_drawer?.player_id !== currentUser.uid) return;
    if (!canvasImage) return;

    const updateCanvasState = async () => {
      try {
        await fetch(`${API_URL}/games/guessing/update-canvas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            game_id: gameId,
            canvas_state: canvasImage 
          }),
        });
      } catch (error) {
        console.error('Error updating canvas state:', error);
      }
    };

    // Throttle updates to avoid excessive writes (max 1 per second)
    const timeout = setTimeout(updateCanvasState, 1000);
    return () => clearTimeout(timeout);
  }, [game, currentUser, canvasImage, gameId]);

  const handleStartGame = async () => {
    try {
      const response = await fetch(`${API_URL}/games/guessing/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId }),
      });

      if (response.ok) {
        trackGameStarted('guessing', game.players.length);
      }
    } catch (error) {
      console.error('Error starting game:', error);
      alert(error.message);
    }
  };

  const handleTimeout = async () => {
    try {
      await fetch(`${API_URL}/games/guessing/timeout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId }),
      });
    } catch (error) {
      console.error('Error handling timeout:', error);
    }
  };

  const handleAiPrediction = async (predictionData) => {
    // Update local prediction display
    setCurrentPrediction(predictionData);

    // Add to AI predictions list
    const newPrediction = {
      timestamp: Date.now(),
      prediction: predictionData.prediction,
      confidence: predictionData.confidence,
    };
    setAiPredictions(prev => [...prev, newPrediction].slice(-10)); // Keep last 10

    // Submit AI prediction to backend if drawer and canvas image exists
    if (predictionData.prediction && canvasImage && currentUser && 
        game?.current_drawer?.player_id === currentUser.uid) {
      try {
        await fetch(`${API_URL}/games/guessing/ai-prediction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game_id: gameId,
            round_number: game.current_round,
            prediction: predictionData.prediction,
            confidence: predictionData.confidence,
          }),
        });
      } catch (error) {
        console.error('Error submitting AI prediction:', error);
      }
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;

    try {
      await fetch(`${API_URL}/games/guessing/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          player_id: currentUser.uid,
          player_name: currentUser.displayName || 'Anonyme',
          message: chatInput,
        }),
      });

      setChatInput('');
    } catch (error) {
      console.error('Error sending chat:', error);
    }
  };

  const handleSubmitGuess = async (e) => {
    e.preventDefault();
    if (!guessInput.trim() || !currentUser) return;

    try {
      const response = await fetch(`${API_URL}/games/guessing/submit-guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          player_id: currentUser.uid,
          player_name: currentUser.displayName || 'Anonyme',
          guess: guessInput,
          round_number: game.current_round,
        }),
      });

      const result = await response.json();
      
      if (result.status === 'correct_guess') {
        setGuessInput('');
      } else if (result.status === 'incorrect_guess') {
        // Show feedback but don't clear input
        setChatInput(`Essai incorrect: ${guessInput}`);
        setGuessInput('');
      }
    } catch (error) {
      console.error('Error submitting guess:', error);
    }
  };

  if (!game) {
    return <div className="loading">Chargement de la partie...</div>;
  }

  const isCreator = game.creator_id === currentUser?.uid;
  const isDrawer = game.current_drawer?.player_id === currentUser?.uid;
  const highestAiConfidence = aiPredictions.length > 0 
    ? Math.max(...aiPredictions.map(p => p.confidence)) 
    : 0;
  const aiWinning = highestAiConfidence >= (game.settings.ai_confidence_threshold || 0.85);

  // Check if a player is online
  const isPlayerOnline = (playerId) => {
    const playerPresence = presence[playerId];
    if (!playerPresence) return false;
    const lastSeen = playerPresence.lastSeen || 0;
    const threshold = 30000; // 30 seconds
    return playerPresence.online && (Date.now() - lastSeen < threshold);
  };

  // Handle leaving the game
  const handleLeaveGame = async () => {
    setIsLeaving(true);
    try {
      const result = await leaveGame(gameId, currentUser?.uid);
      if (result.success) {
        navigate('/multiplayer');
      } else {
        alert(result.error || 'Erreur lors de la sortie de la partie');
      }
    } catch (error) {
      console.error('Error leaving game:', error);
      alert('Erreur lors de la sortie de la partie');
    } finally {
      setIsLeaving(false);
      setShowLeaveModal(false);
    }
  };

  return (
    <div className="guessing-game">
      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div className="modal-overlay">
          <div className="modal-content leave-modal">
            <h3>⚠️ Quitter la partie ?</h3>
            <p>Êtes-vous sûr de vouloir quitter cette partie ?</p>
            {isCreator && game.players.length > 1 && (
              <p className="warning-text">
                En tant qu'hôte, un autre joueur deviendra le nouvel hôte.
              </p>
            )}
            {isDrawer && game.status === 'playing' && (
              <p className="warning-text">
                Vous êtes le dessinateur actuel. Un autre joueur sera sélectionné.
              </p>
            )}
            <div className="modal-actions">
              <button 
                className="cancel-btn" 
                onClick={() => setShowLeaveModal(false)}
                disabled={isLeaving || leaveInProgress}
              >
                Annuler
              </button>
              <button 
                className="confirm-leave-btn" 
                onClick={handleLeaveGame}
                disabled={isLeaving || leaveInProgress}
              >
                {isLeaving || leaveInProgress ? 'Sortie...' : 'Quitter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Round notification */}
      {roundNotification && (
        <div className="round-notification">
          {roundNotification}
        </div>
      )}
      
      {/* Header */}
      <div className="game-header">
        <div className="game-info">
          <h2>🤖 Humains vs IA</h2>
          <div className="round-info">
            Round {game.current_round || 0} / {game.max_rounds}
          </div>
        </div>

        {game.status === 'playing' && (
          <div className="timer-container">
            <div className={`timer ${timeRemaining <= 15 ? 'timer-warning' : ''}`}>
              ⏱️ {timeRemaining}s
            </div>
            {isDrawer && (
              <div className="drawer-badge">
                ✏️ Vous dessinez: <strong>{game.current_category}</strong>
              </div>
            )}
            {!isDrawer && game.current_drawer && (
              <div className="watcher-info">
                ✏️ {game.current_drawer.player_name} dessine...
              </div>
            )}
          </div>
        )}

        <div className="team-scores">
          <div className="team-score humans">
            <span className="team-label">👥 Humains</span>
            <span className="score-value">{game.team_humans.rounds_won}</span>
          </div>
          <div className="team-score ai">
            <span className="team-label">🤖 IA</span>
            <span className="score-value">{game.team_ai.rounds_won}</span>
          </div>
          {game.status !== 'finished' && (
            <button 
              className="leave-game-btn"
              onClick={() => setShowLeaveModal(true)}
              title="Quitter la partie"
            >
              🚪 Quitter
            </button>
          )}
        </div>
      </div>

      {/* Game Layout */}
      <div className="guessing-layout">
        {/* Left: Players & Chat */}
        <div className="left-panel">
          <div className="players-section">
            <h3>Équipe Humains ({game.players.length})</h3>
            {game.players.map((player) => (
              <div
                key={player.player_id}
                className={`player-card ${player.player_id === game.current_drawer?.player_id ? 'is-drawer' : ''} ${!isPlayerOnline(player.player_id) ? 'player-offline' : ''}`}
              >
                <div className="player-name">
                  <span className={`presence-dot ${isPlayerOnline(player.player_id) ? 'online' : 'offline'}`}></span>
                  {player.player_name}
                  {player.player_id === game.current_drawer?.player_id && (
                    <span className="drawer-icon">✏️</span>
                  )}
                  {player.player_id === game.creator_id && (
                    <span className="host-badge">👑</span>
                  )}
                </div>
                <div className="player-stats">
                  <span>🎯 {player.individual_guesses}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="chat-section">
            <h3>💬 Chat d'équipe</h3>
            <div className="chat-messages">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="chat-message">
                  <span className="message-author">{msg.player_name}:</span>
                  <span className="message-text">{msg.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendChat} className="chat-input-form">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message à l'équipe..."
                maxLength={200}
              />
              <button type="submit">Envoyer</button>
            </form>
          </div>
        </div>

        {/* Center: Drawing Canvas */}
        <div className="center-panel">
          {game.status === 'waiting' && (
            <div className="waiting-screen">
              <h2>Salle d'attente</h2>
              <p>En attente du démarrage...</p>
              {isCreator && (
                <button
                  className="start-game-btn"
                  onClick={handleStartGame}
                  disabled={game.players.length < 2}
                >
                  {game.players.length < 2 ? 'Minimum 2 joueurs' : 'Démarrer la partie'}
                </button>
              )}
            </div>
          )}

          {game.status === 'playing' && (
            <>
              {isDrawer ? (
                <div className="drawer-area">
                  <div className="drawer-instructions">
                    <h3>Dessinez: {game.current_category}</h3>
                    <p>Vos coéquipiers doivent deviner avant que l'IA atteigne 85%</p>
                  </div>
                  <DrawingCanvas
                    ref={canvasRef}
                    onCanvasChange={setCanvasImage}
                    enablePrediction={true}
                    onPrediction={handleAiPrediction}
                    debounceTime={500}
                  />
                </div>
              ) : (
                <div className="guesser-area">
                  <div className="guesser-instructions">
                    <h3>Devinez ce que dessine {game.current_drawer?.player_name} !</h3>
                    <p className="guess-hint">
                      Tapez votre réponse rapidement avant que l'IA ne devine !
                    </p>
                  </div>
                  <div className="viewer-canvas">
                    <canvas
                      ref={viewerCanvasRef}
                      width={400}
                      height={400}
                      style={{ border: '2px solid #ccc', borderRadius: '8px', backgroundColor: '#fff' }}
                    />
                  </div>
                  <form onSubmit={handleSubmitGuess} className="guess-form">
                    <input
                      type="text"
                      value={guessInput}
                      onChange={(e) => setGuessInput(e.target.value)}
                      placeholder="Tapez votre réponse..."
                      autoComplete="off"
                    />
                    <button type="submit">Deviner</button>
                  </form>
                </div>
              )}
            </>
          )}

          {game.status === 'finished' && (
            <div className="game-over-screen">
              <h1>🏆 Partie Terminée !</h1>
              <div className="winner-announcement">
                <h2>
                  {game.winner === 'humans' ? '👥 Les Humains gagnent !' : '🤖 L\'IA gagne !'}
                </h2>
                <div className="final-score">
                  <div>Humains: {game.team_humans.rounds_won} rounds</div>
                  <div>IA: {game.team_ai.rounds_won} rounds</div>
                </div>
              </div>
              <button onClick={() => (window.location.href = '/multiplayer')}>
                Retour au salon
              </button>
            </div>
          )}
        </div>

        {/* Right: AI Predictions */}
        <div className="right-panel">
          <h3>🤖 Prédictions de l'IA</h3>
          <div className={`ai-status ${aiWinning ? 'ai-winning' : ''}`}>
            {aiWinning ? (
              <div className="ai-alert">⚠️ IA proche de la victoire !</div>
            ) : (
              <div className="ai-safe">✅ Temps de deviner</div>
            )}
          </div>

          <div className="ai-predictions-list">
            {aiPredictions.length === 0 ? (
              <p className="no-predictions">En attente de prédictions...</p>
            ) : (
              aiPredictions.slice(-5).reverse().map((pred, idx) => (
                <div key={idx} className="ai-prediction-item">
                  <div className="prediction-header">
                    <span className="prediction-label">{pred.prediction}</span>
                    <span className="prediction-confidence">
                      {(pred.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="prediction-bar">
                    <div
                      className="prediction-fill"
                      style={{
                        width: `${pred.confidence * 100}%`,
                        backgroundColor:
                          pred.confidence >= 0.85
                            ? '#e74c3c'
                            : pred.confidence >= 0.5
                            ? '#f39c12'
                            : '#3498db',
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuessingGame;

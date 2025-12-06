import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import DrawingCanvas from '../DrawingCanvas';
import { trackGameStarted, trackGameCompleted } from '../../services/analytics';
import './Multiplayer.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function GuessingGame() {
  const { gameId } = useParams();
  const { currentUser } = useAuth();
  
  const [game, setGame] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(90);
  const [chatMessages, setChat Messages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [aiPredictions, setAiPredictions] = useState([]);
  const [canvasImage, setCanvasImage] = useState(null);
  
  const chatEndRef = useRef(null);
  const predictionIntervalRef = useRef(null);

  // Listen to game updates
  useEffect(() => {
    if (!gameId) return;

    const gameRef = doc(db, 'games', gameId);
    const unsubscribe = onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        const gameData = { id: doc.id, ...doc.data() };
        setGame(gameData);
        
        if (gameData.status === 'playing' && gameData.round_start_time) {
          const elapsed = (Date.now() - gameData.round_start_time.toMillis()) / 1000;
          const remaining = Math.max(0, gameData.settings.round_duration - elapsed);
          setTimeRemaining(Math.floor(remaining));
        }
        
        // Update AI predictions from game state
        if (gameData.team_ai?.predictions) {
          setAiPredictions(gameData.team_ai.predictions);
        }
      }
    });

    return () => unsubscribe();
  }, [gameId]);

  // Listen to chat messages
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

  // Countdown timer
  useEffect(() => {
    if (game?.status !== 'playing') return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [game?.status, game?.current_round]);

  // AI Prediction streaming (every 500ms for drawer)
  useEffect(() => {
    if (!game || game.status !== 'playing') return;
    if (!currentUser || game.current_drawer?.player_id !== currentUser.uid) return;
    if (!canvasImage) return;

    const streamPredictions = async () => {
      try {
        const response = await fetch(`${API_URL}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_data: canvasImage }),
        });

        if (response.ok) {
          const prediction = await response.json();
          
          // Add to AI predictions list (shown to all players)
          const newPrediction = {
            timestamp: Date.now(),
            prediction: prediction.prediction,
            confidence: prediction.confidence,
          };
          
          setAiPredictions(prev => [...prev, newPrediction].slice(-10)); // Keep last 10
        }
      } catch (error) {
        console.error('Error getting AI prediction:', error);
      }
    };

    const interval = setInterval(streamPredictions, game.settings.prediction_interval || 500);
    predictionIntervalRef.current = interval;

    return () => clearInterval(interval);
  }, [game, currentUser, canvasImage]);

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
        alert(`🎉 Bonne réponse ! Les humains gagnent ce round !`);
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

  return (
    <div className="guessing-game">
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
                className={`player-card ${player.player_id === game.current_drawer?.player_id ? 'is-drawer' : ''}`}
              >
                <div className="player-name">
                  {player.player_name}
                  {player.player_id === game.current_drawer?.player_id && (
                    <span className="drawer-icon">✏️</span>
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
                    onCanvasChange={setCanvasImage}
                    enablePrediction={false}
                  />
                </div>
              ) : (
                <div className="guesser-area">
                  <h3>Devinez ce que dessine {game.current_drawer?.player_name} !</h3>
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
                  <p className="guess-hint">
                    Soyez rapide ! L'IA fait des prédictions toutes les 500ms
                  </p>
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

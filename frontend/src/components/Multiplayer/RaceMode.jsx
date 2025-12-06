import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import DrawingCanvas from '../DrawingCanvas';
import './Multiplayer.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function RaceMode() {
  const { gameId } = useParams();
  const { currentUser } = useAuth();
  
  const [game, setGame] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [prediction, setPrediction] = useState(null);
  const [canvasImage, setCanvasImage] = useState(null);
  const [gameStatus, setGameStatus] = useState('waiting'); // waiting, playing, finished
  
  const canvasRef = useRef(null);

  // Listen to game updates in real-time
  useEffect(() => {
    if (!gameId) return;

    const gameRef = doc(db, 'games', gameId);
    const unsubscribe = onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        const gameData = { id: doc.id, ...doc.data() };
        setGame(gameData);
        setGameStatus(gameData.status);
        
        // Reset timer when round changes
        if (gameData.round_start_time) {
          const elapsed = (Date.now() - gameData.round_start_time.toMillis()) / 1000;
          const remaining = Math.max(0, gameData.settings.round_duration - elapsed);
          setTimeRemaining(Math.floor(remaining));
        }
      }
    });

    return () => unsubscribe();
  }, [gameId]);

  // Countdown timer
  useEffect(() => {
    if (gameStatus !== 'playing') return;

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
  }, [gameStatus, game?.current_round]);

  const handleStartGame = async () => {
    try {
      const response = await fetch(`${API_URL}/games/race/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }
    } catch (error) {
      console.error('Error starting game:', error);
      alert(error.message);
    }
  };

  const handlePrediction = async (predictionData) => {
    setPrediction(predictionData);

    // Submit drawing to backend
    if (predictionData.prediction && canvasImage) {
      try {
        const response = await fetch(`${API_URL}/games/race/submit-drawing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game_id: gameId,
            player_id: currentUser.uid,
            round_number: game.current_round,
            drawing_data: canvasImage,
            prediction: predictionData.prediction,
            confidence: predictionData.confidence,
          }),
        });

        const result = await response.json();
        
        if (result.status === 'round_won' || result.status === 'game_finished') {
          // Show winner animation
          alert(`🎉 ${result.round_winner.player_name} a gagné ce round !`);
          
          if (result.status === 'game_finished') {
            alert(`🏆 Champion: ${result.champion.player_name} avec ${result.champion.rounds_won} victoires !`);
          }
          
          // Clear canvas for next round
          if (canvasRef.current) {
            canvasRef.current.clearCanvas();
          }
        }
      } catch (error) {
        console.error('Error submitting drawing:', error);
      }
    }
  };

  if (!game) {
    return <div className="loading">Chargement de la partie...</div>;
  }

  const isCreator = game.creator_id === currentUser?.uid;
  const currentPlayer = game.players.find(p => p.player_id === currentUser?.uid);

  return (
    <div className="race-mode">
      {/* Header with game info */}
      <div className="race-header">
        <div className="game-info">
          <h2>🏁 Mode Course</h2>
          <div className="round-info">
            Round {game.current_round || 0} / {game.max_rounds}
          </div>
        </div>

        {gameStatus === 'playing' && (
          <div className="timer-container">
            <div className={`timer ${timeRemaining <= 10 ? 'timer-warning' : ''}`}>
              ⏱️ {timeRemaining}s
            </div>
            <div className="category-prompt">
              <span className="prompt-label">Dessinez:</span>
              <span className="category">{game.current_category}</span>
            </div>
          </div>
        )}

        <div className="race-stats">
          {currentPlayer && (
            <>
              <div className="stat">
                <span className="stat-label">Rounds gagnés:</span>
                <span className="stat-value">{currentPlayer.rounds_won}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Score:</span>
                <span className="stat-value">{currentPlayer.score}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Players sidebar */}
      <div className="race-layout">
        <div className="players-sidebar">
          <h3>Joueurs ({game.players.length}/{game.max_players})</h3>
          <div className="players-list">
            {game.players.map((player, index) => (
              <div
                key={player.player_id}
                className={`player-card ${player.player_id === currentUser?.uid ? 'current-player' : ''}`}
              >
                <div className="player-rank">#{index + 1}</div>
                <div className="player-info">
                  <div className="player-name">
                    {player.player_name}
                    {player.player_id === game.creator_id && (
                      <span className="host-badge">👑</span>
                    )}
                  </div>
                  <div className="player-stats">
                    <span>🏆 {player.rounds_won}</span>
                    <span>⭐ {player.score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {gameStatus === 'waiting' && isCreator && (
            <button
              className="start-game-btn"
              onClick={handleStartGame}
              disabled={game.players.length < 2}
            >
              {game.players.length < 2 ? 'En attente de joueurs...' : 'Démarrer la partie'}
            </button>
          )}

          {gameStatus === 'waiting' && !isCreator && (
            <div className="waiting-message">
              En attente du démarrage...
            </div>
          )}
        </div>

        {/* Drawing area */}
        <div className="drawing-area">
          {gameStatus === 'waiting' && (
            <div className="waiting-screen">
              <h2>Salle d'attente</h2>
              <p>La partie démarrera dès que l'hôte sera prêt</p>
              <div className="waiting-animation">⏳</div>
            </div>
          )}

          {gameStatus === 'playing' && (
            <>
              <DrawingCanvas
                ref={canvasRef}
                onPrediction={handlePrediction}
                onCanvasChange={setCanvasImage}
                enablePrediction={true}
                debounceTime={500}
              />

              {prediction && (
                <div className="prediction-feedback">
                  <div className="prediction-result">
                    <span className="prediction-label">Prédiction:</span>
                    <span className="prediction-value">{prediction.prediction}</span>
                  </div>
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{
                        width: `${prediction.confidence * 100}%`,
                        backgroundColor:
                          prediction.confidence >= 0.85
                            ? '#4CAF50'
                            : prediction.confidence >= 0.5
                            ? '#FFC107'
                            : '#f44336',
                      }}
                    />
                  </div>
                  <div className="confidence-text">
                    {(prediction.confidence * 100).toFixed(0)}% / 85% requis
                  </div>
                </div>
              )}
            </>
          )}

          {gameStatus === 'finished' && game.champion && (
            <div className="game-over-screen">
              <h1>🏆 Partie Terminée !</h1>
              <div className="champion-announcement">
                <h2>Champion: {game.champion.player_name}</h2>
                <p>{game.champion.rounds_won} rounds gagnés</p>
              </div>
              <div className="final-rankings">
                <h3>Classement Final</h3>
                {[...game.players]
                  .sort((a, b) => b.rounds_won - a.rounds_won)
                  .map((player, index) => (
                    <div key={player.player_id} className="ranking-row">
                      <span className="rank-position">#{index + 1}</span>
                      <span className="rank-name">{player.player_name}</span>
                      <span className="rank-wins">🏆 {player.rounds_won}</span>
                      <span className="rank-score">⭐ {player.score}</span>
                    </div>
                  ))}
              </div>
              <button onClick={() => (window.location.href = '/multiplayer')}>
                Retour au salon
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RaceMode;

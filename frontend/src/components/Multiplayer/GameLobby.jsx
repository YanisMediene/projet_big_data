import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, rtdb } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import './Multiplayer.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function GameLobby() {
  const { currentUser } = useAuth();
  const [lobbies, setLobbies] = useState([]);
  const [lobbyPresence, setLobbyPresence] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [gameType, setGameType] = useState('race');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Listen to available lobbies in Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'games'),
      where('status', '==', 'waiting')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lobbyList = [];
      snapshot.forEach((doc) => {
        lobbyList.push({ id: doc.id, ...doc.data() });
      });
      setLobbies(lobbyList);
    }, (err) => {
      console.error('Error fetching lobbies:', err);
      setError('Erreur de connexion aux salons');
    });

    return () => unsubscribe();
  }, []);

  // Listen to presence for all lobbies
  useEffect(() => {
    if (lobbies.length === 0) return;

    const unsubscribes = [];

    lobbies.forEach((lobby) => {
      const presenceRef = ref(rtdb, `presence/${lobby.id}`);
      const unsubscribe = onValue(presenceRef, (snapshot) => {
        const data = snapshot.val() || {};
        const onlineCount = Object.values(data).filter(p => p.online).length;
        
        setLobbyPresence(prev => ({
          ...prev,
          [lobby.id]: {
            data,
            onlineCount
          }
        }));
      });
      unsubscribes.push(() => unsubscribe());
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [lobbies]);

  const getOnlineIndicator = (lobby) => {
    const presence = lobbyPresence[lobby.id];
    if (!presence) return null;
    
    const onlineCount = presence.onlineCount;
    const totalPlayers = lobby.players?.length || 0;
    
    if (onlineCount === totalPlayers && onlineCount > 0) {
      return <span className="online-indicator all-online">🟢 {onlineCount} en ligne</span>;
    } else if (onlineCount > 0) {
      return <span className="online-indicator some-online">🟡 {onlineCount}/{totalPlayers} en ligne</span>;
    } else {
      return <span className="online-indicator none-online">🔴 Aucun en ligne</span>;
    }
  };

  const handleCreateGame = async () => {
    if (!currentUser) {
      setError('Vous devez être connecté pour créer une partie');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const endpoint = gameType === 'race' ? 'race' : 'guessing';
      const response = await fetch(`${API_URL}/games/${endpoint}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_type: gameType,
          max_players: maxPlayers,
          creator_id: currentUser.uid,
          creator_name: currentUser.displayName || 'Anonyme',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur lors de la création de la partie');
      }

      const data = await response.json();
      // Redirect to game room
      const roomPath = gameType === 'race' ? 'race' : 'guessing';
      window.location.href = `/multiplayer/${roomPath}/${data.game_id}`;
    } catch (error) {
      console.error('Error creating game:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (gameId, gameType) => {
    if (!currentUser) {
      setError('Vous devez être connecté pour rejoindre une partie');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = gameType === 'race' ? 'race' : 'guessing';
      const response = await fetch(`${API_URL}/games/${endpoint}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_id: gameId,
          player_id: currentUser.uid,
          player_name: currentUser.displayName || 'Anonyme',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors de la connexion');
      }

      // Redirect to game room
      const roomPath = gameType === 'race' ? 'race' : 'guessing';
      window.location.href = `/multiplayer/${roomPath}/${gameId}`;
    } catch (error) {
      console.error('Error joining game:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderLobbyCard = (lobby) => {
    const presence = lobbyPresence[lobby.id];
    
    return (
      <div key={lobby.id} className="lobby-card">
        <div className="lobby-info">
          <h3>Partie de {lobby.players[0]?.player_name}</h3>
          <div className="lobby-details">
            <span className="player-count">
              👥 {lobby.players.length}/{lobby.max_players} joueurs
            </span>
            <span className="round-count">
              🎯 {lobby.max_rounds} rounds
            </span>
            {getOnlineIndicator(lobby)}
          </div>
          <div className="players-preview">
            {lobby.players.map((p, i) => {
              const isOnline = presence?.data?.[p.player_id]?.online;
              return (
                <span 
                  key={i} 
                  className={`player-badge ${isOnline ? 'online' : 'offline'}`}
                  title={isOnline ? 'En ligne' : 'Hors ligne'}
                >
                  {isOnline && <span className="status-dot">●</span>}
                  {p.player_name}
                </span>
              );
            })}
          </div>
        </div>
        <button
          className="join-btn"
          onClick={() => handleJoinGame(lobby.id, lobby.game_type)}
          disabled={lobby.players.length >= lobby.max_players || loading}
        >
          {lobby.players.length >= lobby.max_players
            ? '🔒 Pleine'
            : loading 
            ? '⏳ Connexion...'
            : '🚀 Rejoindre'}
        </button>
      </div>
    );
  };

  return (
    <div className="game-lobby">
      <div className="lobby-header">
        <h1>🎮 Salon Multijoueur</h1>
        <button
          className="create-game-btn"
          onClick={() => setShowCreateModal(true)}
          disabled={!currentUser || loading}
        >
          ➕ Créer une partie
        </button>
      </div>

      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {!currentUser && (
        <div className="login-prompt">
          <p>🔐 Connectez-vous pour créer ou rejoindre une partie</p>
        </div>
      )}

      <div className="lobby-grid">
        <div className="lobby-section">
          <h2>🏁 Mode Course (Race)</h2>
          <p className="mode-description">
            Soyez le plus rapide à faire deviner vos dessins ! 
            Premier à 85% de confiance gagne le round.
          </p>
          
          {lobbies.filter(l => l.game_type === 'race').length === 0 ? (
            <div className="no-lobbies">
              <p>Aucune partie disponible</p>
              <p className="subtitle">Créez-en une !</p>
            </div>
          ) : (
            <div className="lobbies-list">
              {lobbies.filter(l => l.game_type === 'race').map(renderLobbyCard)}
            </div>
          )}
        </div>

        <div className="lobby-section">
          <h2>🤖 Humains vs IA</h2>
          <p className="mode-description">
            Travaillez en équipe pour faire deviner vos dessins à l'IA !
            Chat et collaboration en temps réel.
          </p>
          
          {lobbies.filter(l => l.game_type === 'guessing').length === 0 ? (
            <div className="no-lobbies">
              <p>Aucune partie disponible</p>
              <p className="subtitle">Créez-en une !</p>
            </div>
          ) : (
            <div className="lobbies-list">
              {lobbies.filter(l => l.game_type === 'guessing').map(renderLobbyCard)}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Créer une partie</h2>
            <div className="form-group">
              <label>Type de jeu:</label>
              <select value={gameType} onChange={(e) => setGameType(e.target.value)}>
                <option value="race">🏁 Mode Course</option>
                <option value="guessing">🤖 Humains vs IA</option>
              </select>
            </div>
            <div className="form-group">
              <label>Nombre maximum de joueurs:</label>
              <input
                type="number"
                min="2"
                max="4"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowCreateModal(false)}>Annuler</button>
              <button
                className="primary"
                onClick={handleCreateGame}
                disabled={loading}
              >
                {loading ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameLobby;

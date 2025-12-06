import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import './Chat.css';

/**
 * Chat Component for Guessing Game
 * 
 * Features:
 * - Real-time team chat with Firestore
 * - Auto-scroll to latest message
 * - Message history (last 50 messages)
 * - Player name display
 * - Timestamp display
 */
function Chat({ gameId, currentUser, disabled = false }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Listen to chat messages
  useEffect(() => {
    if (!gameId) return;

    const chatRef = collection(db, 'games', gameId, 'chat');
    const chatQuery = query(chatRef, orderBy('timestamp', 'desc'), limit(50));

    const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
      const newMessages = [];
      snapshot.forEach((doc) => {
        newMessages.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      setMessages(newMessages.reverse());
    });

    return () => unsubscribe();
  }, [gameId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim() || !currentUser || disabled || isSending) return;

    const messageText = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      const chatRef = collection(db, 'games', gameId, 'chat');
      await addDoc(chatRef, {
        player_id: currentUser.uid,
        player_name: currentUser.displayName || 'Anonyme',
        message: messageText,
        timestamp: serverTimestamp(),
        type: 'chat', // 'chat', 'system', 'guess'
      });
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Erreur lors de l\'envoi du message');
      setInputValue(messageText); // Restore message on error
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (error) {
      return '';
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>💬 Chat d'équipe</h3>
        <span className="chat-count">{messages.length}</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>Aucun message. Soyez le premier à parler ! 👋</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = currentUser && msg.player_id === currentUser.uid;
            const isSystemMessage = msg.type === 'system';
            const isGuessMessage = msg.type === 'guess';

            return (
              <div
                key={msg.id}
                className={`chat-message ${isOwnMessage ? 'own-message' : ''} ${isSystemMessage ? 'system-message' : ''} ${isGuessMessage ? 'guess-message' : ''}`}
              >
                {isSystemMessage ? (
                  <div className="system-text">
                    {msg.message}
                  </div>
                ) : (
                  <>
                    <div className="message-header">
                      <span className="message-author">
                        {isOwnMessage ? 'Vous' : msg.player_name}
                      </span>
                      <span className="message-time">
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    </div>
                    <div className="message-text">
                      {msg.message}
                      {isGuessMessage && (
                        <span className="guess-badge">Tentative</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={disabled ? 'Chat désactivé' : 'Tapez votre message...'}
          maxLength={200}
          disabled={disabled || isSending}
          className="chat-input"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || disabled || isSending}
          className="chat-send-btn"
        >
          {isSending ? '...' : '📤'}
        </button>
      </form>
    </div>
  );
}

export default Chat;

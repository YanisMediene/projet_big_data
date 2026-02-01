import React, { useState, useEffect, useRef } from 'react';
import { Trash2, X, RefreshCw, Share2, SkipForward, AlertTriangle, User, Users, Zap, Plus, LogIn, Play, Copy, MessageSquare, Send } from 'lucide-react';
import { predictDrawing, getCategories } from './services/api';
import { CATEGORY_MAP, FRENCH_TO_ENGLISH } from './data/categoryTranslations';

// --- CONSTANTES GLOBALES ---
const TOTAL_ROUNDS_CLASSIC = 6;
const TOTAL_ROUNDS_RACE = 6;
const ROUND_TIME = 20;

const WRONG_GUESSES = [
  "un truc", "aucune idée", "c'est quoi ça ?", "un ovni", 
  "bizarre...", "un chien ?", "une table ?", "abstrait"
];

const MOCK_LOBBIES = [
  { id: 1, name: "Salon de Thomas", players: 3, max: 8 },
  { id: 2, name: "Dessinateurs Fous", players: 5, max: 8 },
  { id: 3, name: "Pro Only", players: 1, max: 8 },
];

const INITIAL_MOCK_PLAYERS = [
  { id: 1, name: "Toi", score: 0 },
  { id: 2, name: "Bot1", score: 0 },
  { id: 3, name: "Bot2", score: 0 },
  { id: 4, name: "Bot3", score: 0 },
];

// --- MAIN COMPONENT ---
export default function QuickDrawApp() {
  const [gameState, setGameState] = useState('WELCOME'); // WELCOME, MODE_SELECT, LOBBY_FLOW, PLAYING, GAME_OVER
  const [gameMode, setGameMode] = useState('CLASSIC'); // CLASSIC, RACE, TEAM
  const [round, setRound] = useState(1);
  const [currentWord, setCurrentWord] = useState('');
  const [previousWord, setPreviousWord] = useState(''); // Pour éviter les répétitions
  const [drawings, setDrawings] = useState([]); 
  const [players, setPlayers] = useState([
    { id: 'me', name: "Moi", isHost: true, avatar: "😎", score: 0 },
    { id: 2, name: "Thomas", isHost: false, avatar: "😺", score: 0 },
    { id: 3, name: "Sarah", isHost: false, avatar: "🎨", score: 0 },
    { id: 4, name: "Robot_X", isHost: false, avatar: "🤖", score: 0 },
  ]);
  
  // Liste des mots disponibles - chargée depuis l'API
  const [wordsToDrawFr, setWordsToDrawFr] = useState([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  
  // Controls the "Curtain" transition overlay during the game
  const [showOverlay, setShowOverlay] = useState(false);

  // Charger les catégories depuis l'API au démarrage
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        if (data.categories && data.categories.length > 0) {
          // Convertir les catégories anglaises en français
          const wordsFr = data.categories.map(cat => CATEGORY_MAP[cat] || cat);
          setWordsToDrawFr(wordsFr);
          setCategoriesLoaded(true);
          console.log(`✅ Loaded ${data.count} categories from backend`);
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
        // Fallback: utiliser toutes les catégories du fichier
        setWordsToDrawFr(Object.values(CATEGORY_MAP));
        setCategoriesLoaded(true);
      }
    };
    
    loadCategories();
  }, []);

  // Start sequence: Welcome -> Mode Select
  const goToModeSelect = () => {
    setGameState('MODE_SELECT');
  };

  // Mode Select -> Playing (Classic)
  const startClassicGame = () => {
    setGameMode('CLASSIC');
    setRound(1);
    setDrawings([]);
    setPreviousWord(''); // Reset le mot précédent
    setPlayers(INITIAL_MOCK_PLAYERS);
    setGameState('PLAYING');
    prepareRound(1);
  };

  // Mode Select -> Lobby Flow (Race/Team)
  const startMultiplayerGame = (mode) => {
    setGameMode(mode);
    setRound(1);
    setDrawings([]);
    setPreviousWord('');
    setPlayers(INITIAL_MOCK_PLAYERS);
    setGameState('LOBBY_FLOW');
  };

  // Lobby Flow -> Playing
  const startGameFromLobby = () => {
    setGameState('PLAYING');
    prepareRound(1);
  };

  const prepareRound = (roundNum) => {
    // Ne pas démarrer si les catégories ne sont pas chargées
    if (!categoriesLoaded || wordsToDrawFr.length === 0) {
      console.warn('Categories not loaded yet');
      return;
    }
    
    // Choisir un mot différent du précédent
    let word;
    do {
      word = wordsToDrawFr[Math.floor(Math.random() * wordsToDrawFr.length)];
    } while (word === previousWord && wordsToDrawFr.length > 1);
    
    setCurrentWord(word);
    setPreviousWord(word);
    // Show the curtain overlay for instructions
    setShowOverlay(true);
  };

  const handleRoundComplete = (imageData, success, winner = null, timeLeft = 0, confidence = 0) => {
    // Update scores based on game mode
    if (gameMode === 'RACE' && success) {
      // Calculate points based on time and confidence
      // Base: 100 points
      // Time bonus: 0-50 points (proportional to time left)
      // Confidence bonus: 0-50 points (proportional to confidence)
      const timeBonus = Math.round((timeLeft / ROUND_TIME) * 50);
      const confidenceBonus = Math.round(confidence * 50);
      const totalPoints = 100 + timeBonus + confidenceBonus;
      
      setPlayers(prevPlayers => 
        prevPlayers.map(p => 
          p.id === 'me' ? { ...p, score: p.score + totalPoints } : p
        )
      );
    } else if (gameMode === 'TEAM') {
      // In Team mode, update scores based on winner
      if (winner === 'TEAM') {
        setPlayers(prevPlayers => 
          prevPlayers.map(p => 
            p.id !== 'me' ? { ...p, score: p.score + 5 } : p
          )
        );
      }
      // Note: AI score is tracked separately in state if needed
    }

    // Save drawing
    const newDrawings = [...drawings, { word: currentWord, imageData, success, winner }];
    setDrawings(newDrawings);

    const totalRounds = gameMode === 'RACE' ? TOTAL_ROUNDS_RACE : TOTAL_ROUNDS_CLASSIC;

    if (round < totalRounds) {
      // Fermer l'overlay d'abord (si jamais il était ouvert)
      setShowOverlay(false);
      
      // Attendre que l'overlay soit fermé avant de préparer le prochain round
      setTimeout(() => {
        setRound(round + 1);
        prepareRound(round + 1);
      }, 600); // 600ms pour laisser le temps à l'animation de fermeture (500ms) de se terminer
    } else {
      setGameState('GAME_OVER');
    }
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-[#ECECEC] font-['Architects_Daughter'] text-[#333] overflow-hidden select-none relative">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
          body { font-family: 'Architects Daughter', cursive; }
          .btn-shadow { box-shadow: 4px 4px 0px 0px rgba(0,0,0,1); }
          .btn-shadow:active { box-shadow: 2px 2px 0px 0px rgba(0,0,0,1); transform: translate(2px, 2px); }
          /* Curtain Animation Classes */
          .curtain-enter { transform: translateY(-100%); }
          .curtain-active { transform: translateY(0); transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
          .curtain-exit { transform: translateY(0); }
          .curtain-exit-active { transform: translateY(-100%); transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        `}
      </style>

      {gameState === 'WELCOME' && <WelcomeScreen onStart={goToModeSelect} />}
      
      {gameState === 'MODE_SELECT' && (
        <GameModeSelection 
          onSelectClassic={startClassicGame}
          onSelectRace={() => startMultiplayerGame('RACE')}
          onSelectTeam={() => startMultiplayerGame('TEAM')}
        />
      )}

      {gameState === 'LOBBY_FLOW' && (
        <MultiplayerFlow
          mode={gameMode}
          onBack={() => setGameState('MODE_SELECT')}
          onStartGame={startGameFromLobby}
          players={players}
        />
      )}

      {/* LOGIC: We keep DrawingScreen mounted during the game. 
        The TransitionOverlay sits ON TOP and slides up/down.
      */}
      {gameState === 'PLAYING' && (
        <>
          <DrawingScreen 
            word={currentWord} 
            round={round}
            gameMode={gameMode}
            players={players}
            totalRounds={gameMode === 'RACE' ? TOTAL_ROUNDS_RACE : TOTAL_ROUNDS_CLASSIC}
            // Pause timer if overlay is visible
            isPaused={showOverlay} 
            onComplete={handleRoundComplete}
            onQuit={() => setGameState('WELCOME')}
          />
          
          <TransitionOverlay 
            isVisible={showOverlay}
            word={currentWord}
            round={round}
            totalRounds={gameMode === 'RACE' ? TOTAL_ROUNDS_RACE : TOTAL_ROUNDS_CLASSIC}
            onDismiss={() => setShowOverlay(false)}
          />
        </>
      )}

      {gameState === 'GAME_OVER' && (
        <GameOverScreen 
          drawings={drawings}
          gameMode={gameMode}
          players={players}
          onRestart={goToModeSelect}
        />
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function WelcomeScreen({ onStart }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center z-10 relative">
      <div className="mb-8 relative">
        <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-blue-600">
          Swift, Sketch
        </h1>
        <div className="absolute -top-6 -right-8 transform rotate-12 text-black opacity-10 text-9xl pointer-events-none">
          ✎
        </div>
      </div>
      
      <p className="text-2xl md:text-3xl max-w-2xl mb-12 leading-relaxed">
        Un réseau de neurones peut-il apprendre à reconnaître vos gribouillages ?
      </p>
      
      <button 
        onClick={onStart}
        className="btn-shadow bg-blue-600 text-white border-4 border-black text-3xl px-12 py-4 rounded-sm hover:bg-blue-500 transition-colors duration-200 font-bold tracking-wider"
      >
        C'est parti !
      </button>

      <div className="mt-20 text-gray-500 text-sm flex gap-4">
        <span>À propos</span>
        <span>•</span>
        <span>Confidentialité</span>
      </div>
    </div>
  );
}

// New Component: Game Mode Selection Curtain
function GameModeSelection({ onSelectClassic, onSelectRace, onSelectTeam }) {
  const [renderState, setRenderState] = useState('hidden');

  useEffect(() => {
    // Start entry animation on mount
    setRenderState('entering');
    setTimeout(() => setRenderState('visible'), 50);
  }, []);

  const getTransformClass = () => {
    if (renderState === 'entering') return 'translate-y-[-100%]';
    if (renderState === 'visible') return 'translate-y-0';
    return 'translate-y-[-100%]';
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#ECECEC] transition-transform duration-500 ease-in-out ${getTransformClass()}`}
      style={{ willChange: 'transform' }}
    >
      <div className="bg-white p-8 md:p-12 rounded-sm border-4 border-black text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-4xl w-full mx-4">
        <h2 className="text-4xl md:text-5xl font-bold mb-8 text-blue-600">Choisissez un mode</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Classic Mode */}
          <button 
            onClick={onSelectClassic}
            className="group flex flex-col items-center p-6 border-4 border-black rounded-sm hover:bg-blue-50 transition-colors btn-shadow bg-white"
          >
            <div className="bg-blue-600 p-4 rounded-full border-2 border-black mb-4 group-hover:scale-110 transition-transform">
               <User size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Classique</h3>
            <p className="text-gray-500 text-sm">Mode Solo. Dessinez 6 objets et défiez l'IA.</p>
          </button>

          {/* Race Mode */}
          <button 
            onClick={onSelectRace}
            className="group flex flex-col items-center p-6 border-4 border-black rounded-sm hover:bg-blue-50 transition-colors btn-shadow bg-white"
          >
             <div className="bg-blue-600 p-4 rounded-full border-2 border-black mb-4 group-hover:scale-110 transition-transform">
               <Zap size={32} className="text-white"/>
            </div>
            <h3 className="text-2xl font-bold mb-2">Course</h3>
            <p className="text-gray-500 text-sm">Multijoueur. Soyez le plus rapide à faire deviner (6 manches).</p>
          </button>

          {/* Team Mode */}
          <button 
            onClick={onSelectTeam}
            className="group flex flex-col items-center p-6 border-4 border-black rounded-sm hover:bg-blue-50 transition-colors btn-shadow bg-white"
          >
             <div className="bg-blue-600 p-4 rounded-full border-2 border-black mb-4 group-hover:scale-110 transition-transform">
               <Users size={32} className="text-white"/>
            </div>
            <h3 className="text-2xl font-bold mb-2">Team vs IA</h3>
            <p className="text-gray-500 text-sm">Coop. Dessinez ensemble pour battre l'IA.</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// The sliding panel (Curtain)
function TransitionOverlay({ isVisible, word, round, totalRounds, onDismiss }) {
  // We use internal state to handle the CSS transition classes
  const [renderState, setRenderState] = useState('hidden'); // hidden, entering, visible, exiting

  useEffect(() => {
    if (isVisible) {
      setRenderState('entering');
      // Force reflow/next tick to start animation
      setTimeout(() => setRenderState('visible'), 50);
    } else {
      setRenderState('exiting');
      // Wait for animation to finish before hiding completely (if needed)
      const timer = setTimeout(() => setRenderState('hidden'), 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Determine CSS class based on state
  const getTransformClass = () => {
    if (renderState === 'entering') return 'translate-y-[-100%]';
    if (renderState === 'visible') return 'translate-y-0';
    if (renderState === 'exiting') return 'translate-y-[-100%]';
    return 'translate-y-[-100%]'; // hidden default
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#ECECEC] transition-transform duration-500 ease-in-out ${getTransformClass()}`}
      style={{ willChange: 'transform' }}
    >
       <div className="bg-white p-10 md:p-14 rounded-sm border-4 border-black text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-2xl w-full mx-4">
        <p className="text-2xl text-gray-500 mb-4">
          Niveau {round}/{totalRounds} • Dessinez :
        </p>
        <h2 className="text-5xl md:text-6xl font-bold mb-10 capitalize">{word}</h2>
        <p className="text-xl text-gray-500 mb-10">en moins de {ROUND_TIME} secondes</p>
        
        <button 
          onClick={onDismiss}
          className="btn-shadow bg-blue-600 text-white border-4 border-black text-2xl px-10 py-3 rounded-sm hover:bg-blue-500 transition-colors w-full md:w-auto font-bold"
        >
          C'est parti !
        </button>
      </div>
    </div>
  );
}

// Multiplayer Flow Component (Lobby & Waiting Room)
function MultiplayerFlow({ mode, onBack, onStartGame, players }) {
  const [step, setStep] = useState('LOBBY'); // LOBBY, WAITING_ROOM
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('Moi');
  const [playerEmoji, setPlayerEmoji] = useState('😎');

  // Liste d'emojis disponibles
  const availableEmojis = ['😎', '😺', '🤖', '🦊', '🐼', '🐸', '🦁', '🐯', '🐨', '🐻'];

  // Mode specific styles - NOW ALL BLUE
  const themeColor = 'bg-blue-600';
  const themeText = 'text-blue-600';
  const themeHover = 'hover:bg-blue-500';
  
  const modeName = mode === 'RACE' ? 'Mode Course' : 'Team vs IA';
  const modeIcon = mode === 'RACE' ? <Zap size={40} className="text-white" /> : <Users size={40} className="text-white" />;

  const handleCreateGame = () => {
    setIsHost(true);
    setRoomCode(mode === 'RACE' ? 'X4J9' : 'T7M2');
    setStep('WAITING_ROOM');
  };

  const handleJoinGame = () => {
    setIsHost(false);
    setRoomCode(mode === 'RACE' ? 'X4J9' : 'T7M2');
    setStep('WAITING_ROOM');
  };

  if (step === 'LOBBY') {
    return (
      <div className="min-h-screen flex flex-col items-center pt-20 px-4 bg-[#ECECEC]">
        <div className="w-full max-w-4xl">
          <div className="flex items-center mb-8 relative">
            <button onClick={onBack} className="absolute left-0 p-2 hover:bg-white/50 rounded-full transition-colors"><X size={32} /></button>
            <h2 className={`text-4xl font-bold text-center w-full ${themeText} flex items-center justify-center gap-3`}>
              {modeIcon} {modeName}
            </h2>
          </div>

          {/* Player Profile Setup */}
          <div className="mb-8 bg-white p-6 rounded-sm border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <User size={24} /> Votre profil
            </h3>
            <div className="flex flex-col md:flex-row gap-4 items-center">
              {/* Emoji Selector */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-6xl">{playerEmoji}</div>
                <div className="flex flex-wrap gap-2 justify-center max-w-xs">
                  {availableEmojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setPlayerEmoji(emoji)}
                      className={`text-3xl p-2 rounded-lg border-2 transition-all hover:scale-110 ${
                        playerEmoji === emoji 
                          ? 'border-blue-600 bg-blue-50 scale-110' 
                          : 'border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Name Input */}
              <div className="flex-1 w-full">
                <label className="block text-sm font-bold text-gray-600 mb-2">Nom du joueur</label>
                <input 
                  type="text" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Votre pseudo" 
                  className="w-full p-4 border-2 border-gray-300 rounded-sm font-bold text-xl outline-none focus:border-blue-600 transition-colors" 
                  maxLength={15}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* CREATE */}
            <div className="flex-1 bg-white p-8 rounded-sm border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2"><Plus size={28} /> Créer une partie</h3>
              <div className="space-y-4">
                <p className="text-gray-600">Créez votre propre salon et invitez vos amis !</p>
                <button onClick={handleCreateGame} className={`w-full py-4 ${themeColor} text-white border-4 border-black font-bold text-2xl rounded-sm btn-shadow ${themeHover} transition-all`}>Créer le salon</button>
              </div>
            </div>
            {/* JOIN */}
            <div className="flex-1 bg-white p-8 rounded-sm border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2"><LogIn size={28} /> Rejoindre</h3>
              <div className="mb-6 space-y-3">
                 {MOCK_LOBBIES.map(lobby => (
                   <div key={lobby.id} className={`flex justify-between items-center p-3 border-2 border-gray-100 hover:border-black bg-gray-50 rounded-sm`}>
                     <div><div className="font-bold">{lobby.name}</div><div className="text-xs text-gray-500">{lobby.players}/8 Joueurs</div></div>
                     <button onClick={handleJoinGame} className="px-4 py-2 bg-white border-2 border-black text-sm font-bold rounded-sm btn-shadow-sm">Rejoindre</button>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // WAITING ROOM
  return (
    <div className="min-h-screen flex flex-col items-center pt-20 px-4 bg-[#ECECEC]">
      <div className="w-full max-w-4xl bg-white rounded-sm border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <div className={`${themeColor} text-white p-6 border-b-4 border-black flex justify-between items-center`}>
           <button onClick={() => setStep('LOBBY')} className="p-2 hover:bg-white/20 rounded-full"><X size={24} /></button>
           <div className="text-center">
             <p className="text-sm font-bold uppercase opacity-80">Code de la partie</p>
             <h2 className="text-4xl font-bold flex items-center gap-2 justify-center">{roomCode} <Copy size={20} className="opacity-70" /></h2>
           </div>
           <div className="w-10"></div> 
        </div>

        <div className="p-8">
           <h3 className="text-2xl font-bold flex items-center gap-2 mb-6"><Users size={28} /> Joueurs ({players.length}/8)</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
             {players.map(player => (
               <div key={player.id} className="flex flex-col items-center p-4 bg-gray-50 border-2 border-gray-200 rounded-sm">
                 <div className="text-5xl mb-2">{player.avatar}</div>
                 <div className="font-bold text-lg">{player.name}</div>
               </div>
             ))}
             {[...Array(8 - players.length)].map((_, i) => (
                <div key={i} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-sm opacity-50"><div className="text-3xl text-gray-300">?</div></div>
             ))}
           </div>
           <div className="flex justify-center">
              {isHost ? (
                <button onClick={onStartGame} className={`px-16 py-4 border-4 border-black text-2xl font-bold rounded-sm ${themeColor} text-white btn-shadow ${themeHover} flex items-center gap-3`}>
                  <Play size={28} fill="currentColor" /> Lancer
                </button>
              ) : (
                 <div className="text-center p-4 bg-yellow-50 border-2 border-[#FFD154] rounded-sm"><p className="text-xl font-bold text-gray-700 animate-pulse">En attente...</p></div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

function DrawingScreen({ word, round, gameMode = 'CLASSIC', players = [], totalRounds, isPaused, onComplete, onQuit }) {
  const canvasRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [aiText, setAiText] = useState("Je ne vois rien pour l'instant...");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStartedDrawing, setHasStartedDrawing] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const predictionTimerRef = useRef(null);
  const currentRoundRef = useRef(round); // Référence pour tracker le round actuel
  const isPredictingRef = useRef(false); // Flag pour tracker si une prédiction est en cours
  
  // Reset when word changes (new round)
  useEffect(() => {
    currentRoundRef.current = round; // Mettre à jour la référence du round
    isPredictingRef.current = false; // Réinitialiser le flag de prédiction
    setTimeLeft(ROUND_TIME);
    setAiText("Je ne vois rien pour l'instant...");
    setHasStartedDrawing(false);
    setPredictions([]);
    setChatMessages([]); // Reset chat messages
    clearCanvas();
    
    // Annuler toute prédiction en attente
    if (predictionTimerRef.current) {
      clearTimeout(predictionTimerRef.current);
      predictionTimerRef.current = null;
    }
  }, [word]);

  // Timer Logic
  useEffect(() => {
    if (isPaused || timeLeft <= 0 || showQuitConfirm) {
        if (timeLeft <= 0 && !isPaused && !showQuitConfirm) {
            finishRound(false);
        }
        return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isPaused, showQuitConfirm]);

  // AI & Team Guessing Logic - Based on real predictions
  useEffect(() => {
    if (!hasStartedDrawing || isPaused || showQuitConfirm || predictions.length === 0) return;

    // Use real predictions from the model
    const topPrediction = predictions[0]; // Meilleure prédiction
    const targetEnglish = FRENCH_TO_ENGLISH[word];

    if (gameMode === 'TEAM') {
      // In Team Mode, AI sends best prediction to chat
      const confidence = Math.round(topPrediction.confidence * 100);
      const aiGuess = topPrediction.categoryFr;
      
      // AI sends its guess to chat (only once per prediction - check all AI messages)
      const hasAlreadySentThisGuess = chatMessages.some(
        msg => msg.sender === 'AI' && msg.text === aiGuess && !msg.isCorrect
      );
      
      if (!hasAlreadySentThisGuess) {
        addChatMessage('AI', aiGuess);
        
        // Check if AI wins (correct prediction with enough confidence)
        if (topPrediction.category === targetEnglish && topPrediction.confidence >= 0.25) {
          addChatMessage('AI', word, true);
          finishRound(false, 'AI'); // Team loses, AI wins
        }
      }

      // 2. Teammates Logic (Only Team Mode) - Still use wrong guesses
      if (Math.random() > 0.7) {
        const teammate = players.filter(p => p.id !== 'me')[Math.floor(Math.random() * (players.length - 1))];
        if (teammate) {
           const wrongGuess = WRONG_GUESSES[Math.floor(Math.random() * WRONG_GUESSES.length)];
           addChatMessage(teammate.name, wrongGuess);
           
           // Small chance Teammate wins (they guess correctly)
           if (Math.random() > 0.95) {
             addChatMessage(teammate.name, word, true);
             finishRound(true, 'TEAM'); // Team wins
           }
        }
      }
    }
  }, [predictions, hasStartedDrawing, isPaused, showQuitConfirm, gameMode, word, players, chatMessages]);

  const addChatMessage = (sender, text, isCorrect = false) => {
    setChatMessages(prev => [...prev, { id: Date.now() + Math.random(), sender, text, isCorrect }]);
  };

  // Fonction pour calculer la bounding box du dessin
  const getBoundingBox = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    let hasDrawing = false;

    // Parcourir tous les pixels
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        // Détecter les pixels non-blancs (dessin)
        if (r < 250 || g < 250 || b < 250) {
          hasDrawing = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasDrawing) return null;

    // Ajouter un padding de 5%
    const width = maxX - minX;
    const height = maxY - minY;
    const padding = Math.max(width, height) * 0.05;

    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: Math.min(canvas.width - minX, width + padding * 2),
      height: Math.min(canvas.height - minY, height + padding * 2)
    };
  };

  // Fonction pour appliquer une dilatation morphologique (épaississement des traits)
  const dilateImage = (ctx, width, height, iterations = 1) => {
    for (let iter = 0; iter < iterations; iter++) {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const output = new Uint8ClampedArray(data);

      // Kernel de dilatation 3x3
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          
          // Si le pixel actuel est noir, on passe
          if (data[idx] < 128) {
            output[idx] = data[idx];
            output[idx + 1] = data[idx + 1];
            output[idx + 2] = data[idx + 2];
            continue;
          }

          // Vérifier les 8 voisins
          let minValue = 255;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4;
              minValue = Math.min(minValue, data[nIdx]);
            }
          }

          // Appliquer la valeur minimale (dilate les zones noires)
          output[idx] = minValue;
          output[idx + 1] = minValue;
          output[idx + 2] = minValue;
        }
      }

      // Remettre les données
      for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
      }
      ctx.putImageData(imageData, 0, 0);
    }
  };

  // Fonction pour créer l'image 128x128 carrée à envoyer au modèle
  const createModelImage = () => {
    const canvas = canvasRef.current;
    const bbox = getBoundingBox();

    if (!bbox) return null;

    // Calculer le facteur de réduction
    const maxDimension = Math.max(bbox.width, bbox.height);
    const targetSize = 128;
    const scaleFactor = maxDimension / targetSize;

    // Étape 1: Créer un canvas intermédiaire à résolution plus élevée
    const intermediateSize = Math.max(targetSize * 2, 256);
    const intermediateCanvas = document.createElement('canvas');
    intermediateCanvas.width = intermediateSize;
    intermediateCanvas.height = intermediateSize;
    const intermediateCtx = intermediateCanvas.getContext('2d');

    // Fond blanc
    intermediateCtx.fillStyle = '#FFFFFF';
    intermediateCtx.fillRect(0, 0, intermediateSize, intermediateSize);

    // Le dessin remplit tout l'espace disponible (95% pour petite marge)
    const scale = Math.min(intermediateSize / bbox.width, intermediateSize / bbox.height) * 0.95;
    const scaledWidth = bbox.width * scale;
    const scaledHeight = bbox.height * scale;

    // Centrer le dessin
    const offsetX = (intermediateSize - scaledWidth) / 2;
    const offsetY = (intermediateSize - scaledHeight) / 2;

    // Qualité de redimensionnement maximale
    intermediateCtx.imageSmoothingEnabled = true;
    intermediateCtx.imageSmoothingQuality = 'high';

    // Dessiner la zone croppée et redimensionnée sur le canvas intermédiaire
    intermediateCtx.drawImage(
      canvas,
      bbox.x, bbox.y, bbox.width, bbox.height,
      offsetX, offsetY, scaledWidth, scaledHeight
    );

    // Étape 2: Appliquer une dilatation si le facteur de réduction est élevé
    if (scaleFactor > 2) {
      const dilationIterations = Math.min(Math.floor(scaleFactor / 2), 3);
      dilateImage(intermediateCtx, intermediateSize, intermediateSize, dilationIterations);
    }

    // Étape 3: Créer le canvas final 128x128
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetSize;
    tempCanvas.height = targetSize;
    const tempCtx = tempCanvas.getContext('2d');

    // Fond blanc
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, targetSize, targetSize);

    // Redimensionner du canvas intermédiaire vers le canvas final
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(intermediateCanvas, 0, 0, targetSize, targetSize);

    return tempCanvas.toDataURL('image/png');
  };

  // Real-time AI predictions avec smart crop
  const makePrediction = async () => {
    if (!canvasRef.current || isPaused || showQuitConfirm) return;
    
    // Si une prédiction est déjà en cours, ignorer cette nouvelle requête
    if (isPredictingRef.current) {
      console.log('⏳ Prédiction déjà en cours, requête ignorée');
      return;
    }
    
    // Capturer le round actuel avant de commencer la prédiction async
    const roundAtStart = currentRoundRef.current;
    
    try {
      isPredictingRef.current = true; // Marquer qu'une prédiction est en cours
      const base64Image = createModelImage();
      
      if (!base64Image) {
        isPredictingRef.current = false;
        return;
      }
      
      console.log('📤 Envoi prédiction (bounding box + 128x128)...');
      
      const result = await predictDrawing(base64Image);
      
      // Vérifier si on est toujours dans le même round
      if (roundAtStart !== currentRoundRef.current) {
        console.log('⚠️ Prédiction obsolète ignorée (round changé)');
        isPredictingRef.current = false;
        return;
      }
      
      console.log('✅ Prédictions:', result.probabilities);
      
      // Transformer les prédictions
      const predArray = Object.entries(result.probabilities)
        .map(([category, confidence]) => ({
          category,
          categoryFr: CATEGORY_MAP[category] || category,
          confidence
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);
      
      setPredictions(predArray);
      
      if (predArray.length > 0) {
        const topPrediction = predArray[0];
        const confidence = Math.round(topPrediction.confidence * 100);
        setAiText(`Je vois... ${topPrediction.categoryFr} (${confidence}%)`);
        
        const targetEnglish = FRENCH_TO_ENGLISH[word];
        
        // Vérifier si le mot cible est dans le top 3
        const isInTop3 = predArray.some(pred => pred.category === targetEnglish);
        const targetPrediction = predArray.find(pred => pred.category === targetEnglish);
        
        if (isInTop3) {
          const targetConfidence = Math.round(targetPrediction.confidence * 100);
          const position = predArray.findIndex(pred => pred.category === targetEnglish) + 1;
          console.log(`🎯 ${targetEnglish} trouvé en position ${position} avec ${targetConfidence}%`);
        }
        
        // Gagner si le mot cible est dans le top 3 avec confiance >= 25%
        if (isInTop3 && targetPrediction.confidence >= 0.25) {
          console.log('✅ BONNE RÉPONSE! (Top 3)');
          isPredictingRef.current = false; // Libérer le flag avant de finir le round
          setTimeout(() => finishRound(true), 500);
          return; // Sortir immédiatement
        }
      }
    } catch (error) {
      console.error('❌ Erreur:', error);
      setAiText("Erreur de prédiction...");
    } finally {
      isPredictingRef.current = false; // Toujours libérer le flag
    }
  };

  // Les prédictions se font uniquement lors du dessin via le debounce
  // (pas d'interval automatique pour éviter le rate limiting)

  const finishRound = (success, winner = null) => {
    // Get top prediction confidence for scoring
    const topConfidence = predictions.length > 0 ? predictions[0].confidence : 0;
    
    // Utiliser l'image avec bounding box au lieu du canvas complet
    let imageData = createModelImage();
    
    // Si pas de dessin (canvas vide), créer une image placeholder
    if (!imageData) {
      const emptyCanvas = document.createElement('canvas');
      emptyCanvas.width = 128;
      emptyCanvas.height = 128;
      const ctx = emptyCanvas.getContext('2d');
      
      // Fond gris clair
      ctx.fillStyle = '#F3F4F6';
      ctx.fillRect(0, 0, 128, 128);
      
      // Texte "Pas de dessin"
      ctx.fillStyle = '#9CA3AF';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Pas de', 64, 54);
      ctx.fillText('dessin', 64, 74);
      
      imageData = emptyCanvas.toDataURL('image/png');
    }
    
    onComplete(imageData, success, winner, timeLeft, topConfidence);
  };

  // Drawing Handlers - avec scaling pour canvas plein écran
  const getCoordinates = (event) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Support mouse et touch
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    
    // Le canvas CSS peut être grand écran, mais résolution interne = 280x280
    // On scale les coordonnées pour correspondre à la résolution interne
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  const startDraw = (e) => {
    if (isPaused || showQuitConfirm) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    // Commencer un nouveau chemin
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasStartedDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || isPaused || showQuitConfirm) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const currentPos = getCoordinates(e);
    
    // Dessiner une ligne continue
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(currentPos.x, currentPos.y);
    
    // Debounced prediction - pendant le dessin (500ms)
    if (predictionTimerRef.current) {
      clearTimeout(predictionTimerRef.current);
    }
    predictionTimerRef.current = setTimeout(() => {
      makePrediction();
    }, 500);
  };

  const stopDraw = () => {
    setIsDrawing(false);
    // Faire une prédiction immédiate quand on arrête de dessiner
    if (hasStartedDrawing && !isPaused && !showQuitConfirm) {
      setTimeout(() => makePrediction(), 100);
    }
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // Fond blanc
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStartedDrawing(false);
    setPredictions([]);
    setAiText("Je ne vois rien pour l'instant...");
  };

  // Configuration du canvas plein écran
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Taille plein écran
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Resize handler
    const handleResize = () => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.putImageData(imageData, 0, 0);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* LEADERBOARD (RACE MODE ONLY) */}
      {gameMode === 'RACE' && (
        <div className="w-80 bg-gray-50 border-r-2 border-gray-200 flex flex-col z-20 shadow-lg shrink-0">
          <div className="p-3 bg-blue-600 border-b-2 border-blue-700 font-bold text-white flex items-center gap-2">
            <Zap size={18} /> Classement en direct
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {players.map((player, idx) => (
                <div 
                  key={player.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    player.id === 'me' 
                      ? 'bg-blue-50 border-blue-300 shadow-sm' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="text-2xl font-bold text-gray-400 w-8">#{idx + 1}</div>
                  <div className="text-3xl">{player.avatar}</div>
                  <div className="flex-1">
                    <div className="font-bold text-lg">{player.name}</div>
                    <div className="text-sm text-gray-500">{player.score} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* QUIT CONFIRMATION MODAL */}
        {showQuitConfirm && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white border-4 border-black p-8 rounded-sm shadow-lg max-w-sm w-full text-center">
                  <AlertTriangle className="mx-auto mb-4 text-blue-600" size={48} />
                  <h3 className="text-2xl font-bold mb-2">Quitter la partie ?</h3>
                  <p className="text-gray-600 mb-8">Votre progression sera perdue.</p>
                  <div className="flex gap-4">
                      <button 
                          onClick={() => setShowQuitConfirm(false)}
                          className="flex-1 py-3 font-bold border-2 border-gray-300 hover:bg-gray-100 rounded-sm"
                      >
                          Annuler
                      </button>
                      <button 
                          onClick={onQuit}
                          className="flex-1 py-3 font-bold bg-blue-600 text-white border-2 border-black rounded-sm btn-shadow hover:bg-blue-500"
                      >
                          Quitter
                      </button>
                  </div>
              </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 bg-[#ECECEC] z-10 shrink-0 border-b border-gray-200">
          <div className="text-lg md:text-xl">
            {gameMode === 'TEAM' ? (
              <>
                <span className="text-blue-600 font-bold">Team {players.filter(p => p.id === 'me').length > 0 ? players.filter(p => p.id !== 'me').reduce((sum, p) => sum + p.score, 0) : 0}</span>
                <span className="mx-2">vs</span>
                <span className="text-red-600 font-bold">AI 0</span>
              </>
            ) : (
              <>
                <span className="text-gray-400">Dessinez : </span>
                <span className="font-bold capitalize">{word}</span>
              </>
            )}
          </div>
          <div className="text-3xl md:text-4xl font-bold text-gray-700">
            00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
          </div>
        </div>

        {/* Main Drawing Area */}
        <div className="flex-1 relative bg-white cursor-crosshair overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          
          {/* AI Voice Overlay with Predictions - Only for Classic/Race modes */}
          {gameMode !== 'TEAM' && (
            <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none px-4">
              <p className="text-xl md:text-2xl bg-white/90 inline-block px-4 py-2 rounded-lg text-gray-800 font-bold transition-all duration-300 shadow-lg border-2 border-gray-200">
                {aiText}
              </p>
              
              {/* Top 3 Predictions */}
              {predictions.length > 0 && (
                <div className="flex gap-2 flex-wrap justify-center">
                  {predictions.map((pred, idx) => {
                    const confidence = Math.round(pred.confidence * 100);
                    const isCorrect = pred.category === FRENCH_TO_ENGLISH[word];
                    return (
                      <div 
                        key={idx}
                        className={`px-3 py-1 rounded-full text-sm font-bold transition-all duration-300 ${
                          isCorrect 
                            ? 'bg-green-500 text-white border-2 border-green-700 scale-110' 
                            : confidence >= 70 
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                              : 'bg-gray-100 text-gray-600 border border-gray-300'
                        }`}
                      >
                        {pred.categoryFr} {confidence}%
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="bg-[#ECECEC] px-4 py-2 flex justify-between items-center border-t border-gray-200 shrink-0">
          <button 
              onClick={clearCanvas} 
              className="p-2 hover:bg-gray-200 rounded-full transition-colors flex flex-col items-center gap-1 group" 
              title="Effacer"
          >
            <Trash2 size={24} className="text-gray-600 group-hover:text-black" />
            <span className="text-xs font-bold text-gray-500 group-hover:text-black">Effacer</span>
          </button>
          
          <div className="flex gap-4">
               {/* Skip Button - Masqué en mode Race et Team */}
              {gameMode !== 'RACE' && gameMode !== 'TEAM' && (
                <button 
                    onClick={() => finishRound(false)} 
                    className="flex items-center gap-2 p-2 hover:bg-gray-200 rounded-full transition-colors group"
                    title="Passer"
                >
                    <SkipForward size={28} className="text-gray-600 group-hover:text-black" />
                </button>
              )}
          </div>

          <button 
              onClick={() => setShowQuitConfirm(true)} 
              className="p-2 hover:bg-gray-200 rounded-full transition-colors group" 
              title="Quitter"
          >
            <X size={28} className="text-gray-600 group-hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* CHAT SIDEBAR (TEAM MODE ONLY) */}
      {gameMode === 'TEAM' && (
        <div className="w-80 bg-gray-50 border-l-2 border-gray-200 flex flex-col z-20 shadow-lg shrink-0">
           <div className="p-3 bg-white border-b-2 border-gray-100 font-bold text-gray-500 flex items-center gap-2">
             <MessageSquare size={18} /> Chat de l'équipe
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col-reverse scrollbar-hide">
              {/* Messages reversed to start from bottom */}
              {[...chatMessages].reverse().map(msg => (
                <div key={msg.id} className={`flex flex-col animate-in slide-in-from-bottom-2 ${msg.sender === 'AI' ? 'items-end' : 'items-start'}`}>
                  <div className="text-xs text-gray-400 mb-1 font-bold">{msg.sender === 'AI' ? '🤖 IA' : msg.sender}</div>
                  <div className={`px-3 py-2 rounded-lg max-w-[90%] text-sm font-medium shadow-sm border 
                      ${msg.isCorrect 
                         ? 'bg-green-500 text-white border-green-600 scale-110 origin-bottom' 
                         : (msg.sender === 'AI' ? 'bg-red-50 text-red-900 border-red-100' : 'bg-white text-gray-800 border-gray-200')}
                  `}>
                     {msg.isCorrect ? `★ ${msg.text.toUpperCase()} !` : msg.text}
                  </div>
                </div>
              ))}
              {chatMessages.length === 0 && <div className="text-center text-gray-300 italic mt-10">La partie commence...</div>}
           </div>
           <div className="p-3 bg-white border-t-2 border-gray-200">
             <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 opacity-50 cursor-not-allowed">
                <input type="text" disabled placeholder="Vous dessinez..." className="bg-transparent flex-1 outline-none text-sm" />
                <Send size={16} />
             </div>
           </div>
        </div>
      )}
    </div>
  );
}

function GameOverScreen({ drawings, gameMode = 'CLASSIC', players = [], onRestart }) {
  // Calculate winner message
  const getWinnerMessage = () => {
    if (gameMode === 'RACE') {
      const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
      const winner = sortedPlayers[0];
      if (winner.id === 'me') {
        return {
          text: "Félicitations ! Vous avez gagné !",
          color: "text-green-600"
        };
      } else {
        return {
          text: `${winner.name} a gagné la course !`,
          color: "text-blue-600"
        };
      }
    } else if (gameMode === 'TEAM') {
      const teamScore = players.filter(p => p.id !== 'me').reduce((sum, p) => sum + p.score, 0);
      const aiScore = drawings.filter(d => d.winner === 'AI').length * 5;
      
      if (teamScore > aiScore) {
        return {
          text: "L'équipe a gagné ! Bravo !",
          color: "text-green-600"
        };
      } else if (aiScore > teamScore) {
        return {
          text: "L'IA a gagné cette fois...",
          color: "text-red-600"
        };
      } else {
        return {
          text: "Égalité parfaite !",
          color: "text-yellow-600"
        };
      }
    }
    return null;
  };

  const winnerMessage = getWinnerMessage();
  const successCount = drawings.filter(d => d.success).length;

  return (
    <div className="min-h-screen bg-[#ECECEC] p-4 md:p-8 flex flex-col items-center">
      <h1 className="text-4xl md:text-5xl font-bold mb-2 mt-4 text-center">Partie terminée !</h1>
      
      {/* Winner Message */}
      {winnerMessage && (
        <p className={`text-3xl font-bold mb-4 ${winnerMessage.color}`}>
          {winnerMessage.text}
        </p>
      )}
      
      {/* Score Display */}
      {gameMode === 'CLASSIC' && (
        <p className="text-xl mb-12 text-gray-600">
          Score : {successCount}/{drawings.length}
        </p>
      )}

      {/* Race Mode Leaderboard */}
      {gameMode === 'RACE' && (
        <div className="w-full max-w-2xl mb-8 bg-white rounded-sm border-4 border-black shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Zap size={24} className="text-blue-600" /> Classement Final
          </h2>
          <div className="space-y-3">
            {[...players].sort((a, b) => b.score - a.score).map((player, idx) => (
              <div 
                key={player.id}
                className={`flex items-center gap-4 p-4 rounded-lg border-2 ${
                  player.id === 'me' 
                    ? 'bg-blue-50 border-blue-300 shadow-md' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="text-3xl font-bold text-gray-400 w-12">#{idx + 1}</div>
                <div className="text-4xl">{player.avatar}</div>
                <div className="flex-1">
                  <div className="font-bold text-xl">{player.name}</div>
                </div>
                <div className="text-2xl font-bold text-blue-600">{player.score} pts</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team vs AI Score */}
      {gameMode === 'TEAM' && (
        <div className="w-full max-w-2xl mb-8 bg-white rounded-sm border-4 border-black shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Users size={24} className="text-blue-600" /> Score Final
          </h2>
          <div className="flex justify-around items-center">
            <div className="text-center">
              <div className="text-5xl mb-2">👥</div>
              <div className="text-lg font-bold text-gray-600">Team</div>
              <div className="text-4xl font-bold text-blue-600">
                {players.filter(p => p.id !== 'me').reduce((sum, p) => sum + p.score, 0)}
              </div>
            </div>
            <div className="text-5xl font-bold text-gray-300">VS</div>
            <div className="text-center">
              <div className="text-5xl mb-2">🤖</div>
              <div className="text-lg font-bold text-gray-600">IA</div>
              <div className="text-4xl font-bold text-red-600">
                {drawings.filter(d => d.winner === 'AI').length * 5}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xl mb-8 text-gray-600">Voici vos chefs-d'œuvre</p>

      {/* Drawings Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl w-full mb-12">
        {drawings.map((draw, idx) => (
          <div key={idx} className="bg-white rounded-sm shadow-md overflow-hidden relative border-2 border-gray-300">
            <div className="aspect-square relative bg-gray-50 p-4">
               <img src={draw.imageData} alt={draw.word} className="w-full h-full object-contain" />
               {/* Success/Fail indicator en haut à droite */}
               <div className={`absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center ${
                 draw.success ? 'bg-green-500' : 'bg-red-500'
               }`}>
                 {draw.success ? (
                   <span className="text-white text-2xl font-bold">✓</span>
                 ) : (
                   <span className="text-white text-2xl font-bold">✗</span>
                 )}
               </div>
            </div>
            <div className={`p-3 text-center border-t-2 ${
              draw.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <p className="font-bold text-gray-800 capitalize text-base">{draw.word}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-16 w-full max-w-lg justify-center">
        <button 
           className="btn-shadow flex-1 bg-[#3b5998] text-white border-2 border-black py-3 px-6 text-xl rounded-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Share2 size={20} /> Partager
        </button>
        <button 
          className="btn-shadow flex-1 bg-[#00aced] text-white border-2 border-black py-3 px-6 text-xl rounded-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Share2 size={20} /> Tweeter
        </button>
      </div>

      <button 
        onClick={onRestart}
        className="btn-shadow bg-blue-600 text-white border-4 border-black text-2xl px-12 py-4 rounded-sm hover:bg-blue-500 transition-colors font-bold mb-20 flex items-center gap-3"
      >
        <RefreshCw size={24} /> Rejouer
      </button>
    </div>
  );
}
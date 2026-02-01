import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import DrawingCanvas from './components/DrawingCanvas';
import PredictionDisplay from './components/PredictionDisplay';
import CorrectionModal from './components/CorrectionModal';
import LoginModal from './components/Auth/LoginModal';
import SignUpForm from './components/Auth/SignUpForm';
import UserProfile from './components/Auth/UserProfile';
import GameLobby from './components/Multiplayer/GameLobby';
import RaceMode from './components/Multiplayer/RaceMode';
import GuessingGame from './components/Multiplayer/GuessingGame';
import Settings from './components/Settings/Settings';
import NewFrontTest from './NewFrontTest';
import TestCanva from './TestCanva';
import { ToastProvider } from './components/shared/Toast';
import ConnectionStatus from './components/shared/ConnectionStatus';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { predictDrawing, checkHealth, getCategories } from './services/api';
import { useSettings } from './hooks/useSettings';
import './App.css';

// Home Page Component (Drawing Interface)
function HomePage() {
  // const { currentUser } = useAuth(); // Unused for now
  const { settings } = useSettings();
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasImage, setCanvasImage] = useState(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [categories, setCategories] = useState([]);

  // Check backend health and load categories on mount
  useEffect(() => {
    const initBackend = async () => {
      try {
        const health = await checkHealth();
        setBackendStatus(health.status === 'healthy' ? 'online' : 'offline');
        
        // Load categories from backend
        const categoriesData = await getCategories();
        if (categoriesData.categories && categoriesData.categories.length > 0) {
          setCategories(categoriesData.categories);
          console.log(`✅ Loaded ${categoriesData.count} categories from backend`);
        }
      } catch (error) {
        setBackendStatus('offline');
      }
    };

    initBackend();
  }, []);

  const handleDrawingChange = async (base64Image) => {
    if (!base64Image) {
      // Canvas cleared
      setPredictions([]);
      setCanvasImage(null);
      setShowCorrectionModal(false);
      return;
    }

    setCanvasImage(base64Image);
    setIsLoading(true);

    try {
      // Note: predictionDebounce setting available but debouncing handled in api.js
      // const debounce = settings?.predictionDebounce || 500;
      
      // Debounced prediction call
      const result = await predictDrawing(base64Image);
      
      // Transform backend response to predictions array
      const predictionsArray = Object.entries(result.probabilities)
        .slice(0, 3) // Top 3 only
        .map(([category, confidence]) => ({
          category,
          confidence,
        }));

      setPredictions(predictionsArray);

      // Use settings.confidenceThreshold if available (default 0.85)
      const threshold = settings?.confidenceThreshold || 0.85;
      const autoShowModal = settings?.autoShowModal !== false; // default true

      // Show correction modal based on settings
      if (predictionsArray[0].confidence < threshold && autoShowModal) {
        setShowCorrectionModal(true);
      } else {
        setShowCorrectionModal(false);
      }
    } catch (error) {
      console.error('Prediction error:', error);
      
      if (error.response?.status === 500) {
        alert('Backend error: Make sure the model is trained and loaded');
      } else if (error.code === 'ERR_NETWORK') {
        alert('Cannot connect to backend. Is the server running on http://localhost:8000?');
      } else {
        alert('Prediction failed. Check console for details.');
      }
      
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      {backendStatus === 'offline' && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>Backend not responding.</strong> Make sure the FastAPI server is running:
                <code className="ml-2 px-2 py-1 bg-red-100 rounded text-xs">cd backend && uvicorn main:app --reload</code>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Drawing Area */}
        <div className="flex justify-center">
          <DrawingCanvas
            onDrawingChange={handleDrawingChange}
            isDrawing={isDrawing}
            setIsDrawing={setIsDrawing}
            streamingMode={settings?.streamingPredictions}
          />
        </div>

        {/* Predictions Area */}
        <div className="flex justify-center">
          <PredictionDisplay
            predictions={predictions}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-12 max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">How to Play</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Draw something on the canvas above</li>
            <li>The AI will predict what you drew (top 3 guesses)</li>
            <li>If the prediction is wrong or has low confidence, you can submit a correction</li>
            <li>Your corrections help improve the model through Active Learning!</li>
          </ol>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Available Categories ({categories.length})</h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2 max-h-64 overflow-y-auto">
              {categories.map((category) => (
                <span
                  key={category}
                  className="px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded text-center capitalize"
                >
                  {category.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Correction Modal */}
      <CorrectionModal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        predictions={predictions}
        canvasImage={canvasImage}
        categories={categories}
      />
    </div>
  );
}

// Main App Layout with Navigation
function AppLayout() {
  const { currentUser } = useAuth();
  const [backendStatus, setBackendStatus] = useState('checking');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const health = await checkHealth();
        setBackendStatus(health.status === 'healthy' ? 'online' : 'offline');
      } catch (error) {
        setBackendStatus('offline');
      }
    };
    checkBackendHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      {/* Header with Navigation */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex flex-col">
                <h1 className="text-3xl font-bold text-gray-900">AI Pictionary</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Draw something and let AI guess what it is!
                </p>
              </Link>
              
              {/* Navigation Links */}
              <nav className="hidden md:flex space-x-6">
                <Link
                  to="/"
                  className="text-gray-700 hover:text-indigo-600 font-medium transition-colors"
                >
                  🎨 Dessin
                </Link>
                <Link
                  to="/multiplayer"
                  className="text-gray-700 hover:text-indigo-600 font-medium transition-colors"
                >
                  🎮 Multijoueur
                </Link>
                {currentUser && (
                  <Link
                    to="/settings"
                    className="text-gray-700 hover:text-indigo-600 font-medium transition-colors"
                  >
                    ⚙️ Paramètres
                  </Link>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {/* Backend Status */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Backend:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  backendStatus === 'online' 
                    ? 'bg-green-100 text-green-800' 
                    : backendStatus === 'offline'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {backendStatus === 'online' ? '✓ Online' : backendStatus === 'offline' ? '✗ Offline' : '⟳ Checking...'}
                </span>
              </div>
              
              {/* Auth Buttons */}
              {!currentUser ? (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Se connecter
                  </button>
                  <button
                    onClick={() => setShowSignUpModal(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    S'inscrire
                  </button>
                </div>
              ) : (
                <UserProfile />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Routes */}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/multiplayer" element={<GameLobby />} />
          <Route path="/multiplayer/race/:gameId" element={<RaceMode />} />
          <Route path="/multiplayer/guessing/:gameId" element={<GuessingGame />} />
          <Route 
            path="/settings" 
            element={currentUser ? <Settings /> : <Navigate to="/" replace />} 
          />
        </Routes>
      </main>

      {/* Auth Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSwitchToSignup={() => {
          setShowLoginModal(false);
          setShowSignUpModal(true);
        }}
      />
      <SignUpForm
        isOpen={showSignUpModal}
        onClose={() => setShowSignUpModal(false)}
        onSwitchToLogin={() => {
          setShowSignUpModal(false);
          setShowLoginModal(true);
        }}
      />

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            AI Pictionary - FISE3 Big Data Project | Built with React, FastAPI, TensorFlow & Firebase
          </p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <ConnectionStatus />
          <Routes>
            {/* Route standalone plein écran pour NewFrontTest */}
            <Route path="/" element={<NewFrontTest />} />
            <Route path="/test_canva" element={<TestCanva />} />
            <Route path="/old" element={<AppLayout />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;

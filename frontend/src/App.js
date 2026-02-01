import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NewFrontTest from './NewFrontTest';
import TestCanva from './TestCanva';
import { ToastProvider } from './components/shared/Toast';
import ConnectionStatus from './components/shared/ConnectionStatus';
import './App.css';

function App() {
  return (
    <ToastProvider>
      <Router>
        <ConnectionStatus />
        <Routes>
          {/* Route principale pour la nouvelle UI */}
          <Route path="/" element={<NewFrontTest />} />
          
          {/* Route de test pour le canvas */}
          <Route path="/test_canva" element={<TestCanva />} />
          
          {/* Redirection par défaut */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;

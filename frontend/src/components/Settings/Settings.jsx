import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { trackSettingChanged } from '../../services/analytics';
import './Settings.css';

const DEFAULT_SETTINGS = {
  streamingPredictions: true,
  autoShowModal: true,
  confidenceThreshold: 0.7,
  soundEffects: true,
  theme: 'light',
  predictionDebounce: 500, // ms
};

function Settings() {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Load user settings from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      if (!currentUser) return;

      try {
        const settingsRef = doc(db, 'users', currentUser.uid, 'settings', 'preferences');
        const settingsDoc = await getDoc(settingsRef);

        if (settingsDoc.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...settingsDoc.data() });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [currentUser]);

  // Save settings to Firestore
  const handleSaveSettings = async () => {
    if (!currentUser) return;

    setSaving(true);
    setSaveMessage('');

    try {
      const settingsRef = doc(db, 'users', currentUser.uid, 'settings', 'preferences');
      await setDoc(settingsRef, settings, { merge: true });

      setSaveMessage('✅ Paramètres sauvegardés !');
      setTimeout(() => setSaveMessage(''), 3000);

      // Track settings change
      trackSettingChanged('all_settings', settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('❌ Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key) => {
    const newValue = !settings[key];
    setSettings({ ...settings, [key]: newValue });
    trackSettingChanged(key, newValue);
  };

  const handleSliderChange = (key, value) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleSelectChange = (key, value) => {
    setSettings({ ...settings, [key]: value });
    trackSettingChanged(key, value);
  };

  if (!currentUser) {
    return (
      <div className="settings-container">
        <div className="settings-card">
          <h2>⚙️ Paramètres</h2>
          <p className="auth-required">
            Vous devez être connecté pour accéder aux paramètres.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="settings-container">
        <div className="settings-card">
          <div className="loading-spinner">Chargement des paramètres...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-card">
        <h1>⚙️ Paramètres</h1>
        <p className="settings-subtitle">
          Personnalisez votre expérience AI Pictionary
        </p>

        {/* Prediction Settings */}
        <section className="settings-section">
          <h2>🎨 Prédictions</h2>

          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="streamingPredictions">
                <span className="setting-icon">⚡</span>
                Prédictions en temps réel
              </label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  id="streamingPredictions"
                  checked={settings.streamingPredictions}
                  onChange={() => handleToggle('streamingPredictions')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <p className="setting-description">
              {settings.streamingPredictions
                ? 'Les prédictions sont mises à jour automatiquement pendant que vous dessinez'
                : 'Cliquez sur un bouton pour obtenir une prédiction'}
            </p>
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="predictionDebounce">
                <span className="setting-icon">⏱️</span>
                Délai de prédiction: {settings.predictionDebounce}ms
              </label>
            </div>
            <input
              type="range"
              id="predictionDebounce"
              min="100"
              max="1000"
              step="100"
              value={settings.predictionDebounce}
              onChange={(e) => handleSliderChange('predictionDebounce', parseInt(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>Rapide (100ms)</span>
              <span>Équilibré (500ms)</span>
              <span>Lent (1000ms)</span>
            </div>
            <p className="setting-description">
              Temps d'attente après avoir arrêté de dessiner avant de lancer une prédiction.
              Plus rapide = plus de requêtes, plus lent = moins de prédictions.
            </p>
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="confidenceThreshold">
                <span className="setting-icon">🎯</span>
                Seuil de confiance: {Math.round(settings.confidenceThreshold * 100)}%
              </label>
            </div>
            <input
              type="range"
              id="confidenceThreshold"
              min="0.5"
              max="0.95"
              step="0.05"
              value={settings.confidenceThreshold}
              onChange={(e) => handleSliderChange('confidenceThreshold', parseFloat(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>Permissif (50%)</span>
              <span>Recommandé (70%)</span>
              <span>Strict (95%)</span>
            </div>
            <p className="setting-description">
              Niveau de confiance minimum pour considérer une prédiction comme valide.
              Affecte les indicateurs visuels et les validations.
            </p>
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="autoShowModal">
                <span className="setting-icon">💡</span>
                Afficher modal de correction automatiquement
              </label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  id="autoShowModal"
                  checked={settings.autoShowModal}
                  onChange={() => handleToggle('autoShowModal')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <p className="setting-description">
              Ouvre automatiquement la fenêtre de correction lorsque la confiance est basse.
            </p>
          </div>
        </section>

        {/* Interface Settings */}
        <section className="settings-section">
          <h2>🎨 Interface</h2>

          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="theme">
                <span className="setting-icon">🌓</span>
                Thème
              </label>
              <select
                id="theme"
                value={settings.theme}
                onChange={(e) => handleSelectChange('theme', e.target.value)}
                className="setting-select"
              >
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
                <option value="auto">Automatique (système)</option>
              </select>
            </div>
            <p className="setting-description">
              Choisissez le thème de couleur de l'application.
            </p>
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <label htmlFor="soundEffects">
                <span className="setting-icon">🔊</span>
                Effets sonores
              </label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  id="soundEffects"
                  checked={settings.soundEffects}
                  onChange={() => handleToggle('soundEffects')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <p className="setting-description">
              Active les sons pour les prédictions, victoires et événements du jeu.
            </p>
          </div>
        </section>

        {/* Save Button */}
        <div className="settings-actions">
          <button
            className="save-button"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? 'Sauvegarde...' : '💾 Sauvegarder les paramètres'}
          </button>
          {saveMessage && (
            <div className={`save-message ${saveMessage.includes('✅') ? 'success' : 'error'}`}>
              {saveMessage}
            </div>
          )}
        </div>

        {/* Reset to Defaults */}
        <div className="settings-footer">
          <button
            className="reset-button"
            onClick={() => {
              if (window.confirm('Réinitialiser tous les paramètres par défaut ?')) {
                setSettings(DEFAULT_SETTINGS);
                trackSettingChanged('reset_to_defaults', true);
              }
            }}
          >
            🔄 Réinitialiser par défaut
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;

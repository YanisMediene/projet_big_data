import React, { useState } from 'react';
import { Volume2, VolumeX, Mic, MicOff, X } from 'lucide-react';
import audioService from '../services/audioService';

export default function AudioSettings({ isOpen, onClose }) {
  const [ttsEnabled, setTtsEnabled] = useState(audioService.ttsEnabled);
  const [sfxEnabled, setSfxEnabled] = useState(audioService.sfxEnabled);
  const [volume, setVolume] = useState(audioService.volume);
  
  if (!isOpen) return null;
  
  const handleToggleTTS = () => {
    const newState = audioService.toggleTTS();
    setTtsEnabled(newState);
  };
  
  const handleToggleSFX = () => {
    const newState = audioService.toggleSFX();
    setSfxEnabled(newState);
  };
  
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audioService.setVolume(newVolume);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-sm border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold">🔊 Paramètres Audio</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* TTS Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded border-2 border-gray-200">
            <div className="flex items-center gap-3">
              {ttsEnabled ? <Mic size={24} className="text-blue-600" /> : <MicOff size={24} className="text-gray-400" />}
              <div>
                <p className="font-bold">Voix de l'IA</p>
                <p className="text-sm text-gray-500">Text-to-Speech</p>
              </div>
            </div>
            <button 
              onClick={handleToggleTTS}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors border-2 border-black ${
                ttsEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span 
                className={`inline-block h-6 w-6 transform rounded-full bg-white border-2 border-black transition-transform ${
                  ttsEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {/* SFX Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded border-2 border-gray-200">
            <div className="flex items-center gap-3">
              {sfxEnabled ? <Volume2 size={24} className="text-blue-600" /> : <VolumeX size={24} className="text-gray-400" />}
              <div>
                <p className="font-bold">Effets Sonores</p>
                <p className="text-sm text-gray-500">Sons du jeu</p>
              </div>
            </div>
            <button 
              onClick={handleToggleSFX}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors border-2 border-black ${
                sfxEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span 
                className={`inline-block h-6 w-6 transform rounded-full bg-white border-2 border-black transition-transform ${
                  sfxEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {/* Volume Slider */}
          <div className="p-4 bg-gray-50 rounded border-2 border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold">Volume</p>
              <p className="text-lg font-bold text-blue-600">{Math.round(volume * 100)}%</p>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 border-2 border-gray-300"
              style={{
                background: `linear-gradient(to right, #2563eb 0%, #2563eb ${volume * 100}%, #e5e7eb ${volume * 100}%, #e5e7eb 100%)`
              }}
            />
          </div>
          
          {/* Info */}
          <div className="text-sm text-gray-500 bg-blue-50 border-2 border-blue-200 rounded p-3">
            <p className="font-bold text-blue-900 mb-1">💡 Astuce</p>
            <p>La voix de l'IA vous permet de dessiner sans regarder les prédictions !</p>
          </div>
        </div>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-sm border-4 border-black hover:bg-blue-500 transition-colors font-bold text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px]"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

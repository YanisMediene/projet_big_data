// Audio Service - Gestion centralisée des SFX et TTS
class AudioService {
  constructor() {
    this.sounds = {};
    this.ttsEnabled = true;
    this.sfxEnabled = true;
    this.volume = 0.7;
    this.ttsVoice = null;
    this.ttsRate = 1.1; // Légèrement plus rapide
    this.ttsLang = 'fr-FR';
    
    // Debounce TTS pour éviter spam
    this.lastTTSText = '';
    this.lastTTSTime = 0;
    this.ttsDebounceMs = 1500;
    
    this.init();
  }
  
  async init() {
    // Charger les sons
    await this.loadSounds();
    
    // Initialiser TTS
    this.initTTS();
    
    // Charger préférences localStorage
    this.loadPreferences();
  }
  
  async loadSounds() {
    // Sons synthétiques générés à la volée pour éviter les fichiers externes
    // Utilise Web Audio API pour générer des sons simples
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Map des sons (seront générés à la demande)
    this.soundGenerators = {
      // Feedback positifs
      roundSuccess: () => this.generateSuccessSound(),
      gameWin: () => this.generateVictorySound(),
      playerReady: () => this.generateReadySound(),
      teamWin: () => this.generateTeamVictorySound(),
      
      // Feedback négatifs
      roundFail: () => this.generateFailSound(),
      aiWins: () => this.generateAIWinsSound(),
      
      // Actions
      startDrawing: () => this.generatePencilSound(),
      clearCanvas: () => this.generateEraseSound(),
      chatMessage: () => this.generateChatPopSound(),
      buttonClick: () => this.generateButtonClickSound(),
      
      // Countdown
      tick: () => this.generateTickSound(),
      tickUrgent: () => this.generateTickUrgentSound(),
      countdownBeep: () => this.generateBeepSound(),
      
      // Transitions
      roundStart: () => this.generateWhooshSound(),
      playerJoin: () => this.generateJoinSound(),
      drawerRotate: () => this.generateRotateSound(),
    };
    
    console.log('🔊 Audio Service initialized with', Object.keys(this.soundGenerators).length, 'sounds');
  }
  
  // Générateurs de sons synthétiques
  generateSuccessSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2); // G5
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }
  
  generateVictorySound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2); // G5
    oscillator.frequency.setValueAtTime(1046.50, this.audioContext.currentTime + 0.3); // C6
    
    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.5);
  }
  
  generateFailSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }
  
  generateTickSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }
  
  generateTickUrgentSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.08);
  }
  
  generateBeepSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'square';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.15);
  }
  
  generatePencilSound() {
    // Son subtil de crayon
    const noise = this.audioContext.createBufferSource();
    const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.1, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, this.audioContext.currentTime);
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    noise.start(this.audioContext.currentTime);
  }
  
  generateEraseSound() {
    // Son de "whoosh" pour effacement
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }
  
  generateChatPopSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }
  
  generateReadySound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
    oscillator.frequency.setValueAtTime(700, this.audioContext.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.15);
  }
  
  generateButtonClickSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Son de clic rapide et doux
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0.12, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.08);
  }
  
  generateTeamVictorySound() {
    // Séquence de notes pour victoire d'équipe
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime + i * 0.1);
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime + i * 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + i * 0.1 + 0.2);
      
      oscillator.start(this.audioContext.currentTime + i * 0.1);
      oscillator.stop(this.audioContext.currentTime + i * 0.1 + 0.2);
    });
  }
  
  generateAIWinsSound() {
    // Son "robotique" pour victoire IA
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'square';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
    oscillator.frequency.setValueAtTime(250, this.audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.25, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }
  
  generateWhooshSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }
  
  generateJoinSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }
  
  generateRotateSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'triangle';
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
    oscillator.frequency.setValueAtTime(700, this.audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.25);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.25);
  }
  
  initTTS() {
    if (!('speechSynthesis' in window)) {
      console.warn('🎙️ TTS not supported');
      this.ttsEnabled = false;
      return;
    }
    
    // Attendre que les voix soient chargées
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Préférer voix française
      this.ttsVoice = voices.find(v => v.lang.startsWith('fr')) || voices[0];
      if (this.ttsVoice) {
        console.log('🎙️ TTS Voice loaded:', this.ttsVoice.name);
      }
    };
    
    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoices();
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }
  
  // Jouer un SFX
  play(soundKey, volumeMultiplier = 1.0) {
    if (!this.sfxEnabled || !this.soundGenerators[soundKey]) return;
    
    try {
      // Créer le contexte audio si nécessaire (pour contourner autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      // Appliquer le volume
      const oldGain = this.audioContext.createGain();
      oldGain.gain.value = this.volume * volumeMultiplier;
      
      // Générer et jouer le son
      this.soundGenerators[soundKey]();
    } catch (error) {
      console.warn(`Failed to play sound: ${soundKey}`, error);
    }
  }
  
  // Text-to-Speech pour prédictions IA
  speakPrediction(text, confidence = 1.0) {
    if (!this.ttsEnabled || !text) return;
    
    // Debounce: éviter de répéter le même mot trop rapidement
    const now = Date.now();
    if (text === this.lastTTSText && (now - this.lastTTSTime) < this.ttsDebounceMs) {
      return;
    }
    
    this.lastTTSText = text;
    this.lastTTSTime = now;
    
    // Annuler TTS en cours
    window.speechSynthesis.cancel();
    
    // Créer utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.ttsVoice;
    utterance.lang = this.ttsLang;
    utterance.rate = this.ttsRate;
    utterance.pitch = 1.0;
    
    // Adapter volume selon confidence
    utterance.volume = Math.max(0.3, confidence) * this.volume;
    
    window.speechSynthesis.speak(utterance);
  }
  
  // TTS pour messages IA (Team mode)
  speakAIGuess(text) {
    if (!this.ttsEnabled || !text) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.ttsVoice;
    utterance.lang = this.ttsLang;
    utterance.rate = 1.2; // Plus rapide pour IA
    utterance.pitch = 0.8; // Légèrement plus grave pour IA
    utterance.volume = this.volume;
    
    window.speechSynthesis.speak(utterance);
  }
  
  // Countdown avec sons
  playCountdown(number) {
    if (number <= 5 && number > 0) {
      this.play('countdownBeep', 1.0 + (5 - number) * 0.2); // Plus fort au fur et à mesure
    }
  }
  
  // Click button (méthode publique simplifiée)
  playButtonClick() {
    this.play('buttonClick', 0.8);
  }
  
  // Arrêter tous les sons
  stopAll() {
    window.speechSynthesis.cancel();
    if (this.audioContext) {
      this.audioContext.suspend();
    }
  }
  
  // Sauvegarder préférences
  savePreferences() {
    localStorage.setItem('audioPreferences', JSON.stringify({
      ttsEnabled: this.ttsEnabled,
      sfxEnabled: this.sfxEnabled,
      volume: this.volume,
    }));
  }
  
  loadPreferences() {
    try {
      const prefs = JSON.parse(localStorage.getItem('audioPreferences'));
      if (prefs) {
        this.ttsEnabled = prefs.ttsEnabled ?? true;
        this.sfxEnabled = prefs.sfxEnabled ?? true;
        this.volume = prefs.volume ?? 0.7;
      }
    } catch (e) {
      console.warn('Failed to load audio preferences:', e);
    }
  }
  
  // Toggles
  toggleTTS() {
    this.ttsEnabled = !this.ttsEnabled;
    this.savePreferences();
    return this.ttsEnabled;
  }
  
  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    this.savePreferences();
    return this.sfxEnabled;
  }
  
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    this.savePreferences();
  }
}

// Singleton
const audioService = new AudioService();
export default audioService;

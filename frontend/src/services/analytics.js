/**
 * Analytics Service
 * Handles Firebase Analytics tracking and custom events
 */

import { getAnalytics, logEvent, setUserProperties } from 'firebase/analytics';
import { app } from '../firebase';

// Initialize Firebase Analytics
let analytics = null;

// Only initialize analytics in production
const isProduction = process.env.NODE_ENV === 'production' && 
                     window.location.hostname !== 'localhost';

try {
  // Analytics only works in browser environment with supported browsers
  if (typeof window !== 'undefined' && isProduction) {
    analytics = getAnalytics(app);
    console.log('✅ Firebase Analytics initialized');
  } else {
    console.log('🔧 Firebase Analytics disabled in development');
  }
} catch (error) {
  console.warn('⚠️  Firebase Analytics initialization failed:', error);
}

/**
 * Log a custom analytics event
 * @param {string} eventName - Name of the event
 * @param {object} params - Event parameters
 */
export const logAnalyticsEvent = (eventName, params = {}) => {
  if (!analytics) {
    console.warn('Analytics not initialized');
    return;
  }

  try {
    logEvent(analytics, eventName, {
      ...params,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging analytics event:', error);
  }
};

/**
 * Track drawing completion event
 * @param {string} prediction - Predicted category
 * @param {number} confidence - Prediction confidence (0-1)
 * @param {number} drawingTime - Time spent drawing (seconds)
 */
export const trackDrawingCompleted = (prediction, confidence, drawingTime) => {
  logAnalyticsEvent('drawing_completed', {
    prediction,
    confidence: Math.round(confidence * 100) / 100,
    drawing_time_seconds: Math.round(drawingTime),
    confidence_bucket: confidence >= 0.85 ? 'high' : confidence >= 0.5 ? 'medium' : 'low',
  });
};

/**
 * Track prediction made event
 * @param {string} category - Predicted category
 * @param {number} confidence - Confidence level
 * @param {string} modelVersion - Model version used
 */
export const trackPredictionMade = (category, confidence, modelVersion) => {
  logAnalyticsEvent('prediction_made', {
    category,
    confidence: Math.round(confidence * 100) / 100,
    model_version: modelVersion,
  });
};

/**
 * Track user correction submission
 * @param {string} originalPrediction - Original AI prediction
 * @param {string} correctedLabel - User's correction
 * @param {number} confidence - Original prediction confidence
 */
export const trackCorrectionSubmitted = (originalPrediction, correctedLabel, confidence) => {
  logAnalyticsEvent('correction_submitted', {
    original_prediction: originalPrediction,
    corrected_label: correctedLabel,
    original_confidence: Math.round(confidence * 100) / 100,
    correction_type: originalPrediction === correctedLabel ? 'confirmation' : 'change',
  });
};

/**
 * Track game started event
 * @param {string} gameType - Type of game (race, guessing)
 * @param {number} playerCount - Number of players
 */
export const trackGameStarted = (gameType, playerCount) => {
  logAnalyticsEvent('game_started', {
    game_type: gameType,
    player_count: playerCount,
  });
};

/**
 * Track game completed event
 * @param {string} gameType - Type of game
 * @param {number} duration - Game duration in seconds
 * @param {object} winner - Winner information
 */
export const trackGameCompleted = (gameType, duration, winner) => {
  logAnalyticsEvent('game_completed', {
    game_type: gameType,
    duration_seconds: Math.round(duration),
    winner_id: winner?.player_id,
    winner_score: winner?.score,
  });
};

/**
 * Track user sign-up event
 * @param {string} method - Sign-up method (google, email)
 */
export const trackSignUp = (method) => {
  logAnalyticsEvent('sign_up', {
    method,
  });
};

/**
 * Track user login event
 * @param {string} method - Login method (google, email)
 */
export const trackLogin = (method) => {
  logAnalyticsEvent('login', {
    method,
  });
};

/**
 * Track settings changed event
 * @param {string} setting - Setting name
 * @param {any} value - New value
 */
export const trackSettingChanged = (setting, value) => {
  logAnalyticsEvent('setting_changed', {
    setting,
    value: String(value),
  });
};

/**
 * Track error event
 * @param {string} errorType - Type of error
 * @param {string} errorMessage - Error message
 * @param {string} component - Component where error occurred
 */
export const trackError = (errorType, errorMessage, component) => {
  logAnalyticsEvent('error_occurred', {
    error_type: errorType,
    error_message: errorMessage.substring(0, 100), // Limit message length
    component,
  });
};

/**
 * Set user properties for analytics segmentation
 * @param {object} properties - User properties
 */
export const setAnalyticsUserProperties = (properties) => {
  if (!analytics) return;

  try {
    setUserProperties(analytics, properties);
  } catch (error) {
    console.error('Error setting user properties:', error);
  }
};

/**
 * Track page view
 * @param {string} pageName - Name of the page
 * @param {string} path - Page path
 */
export const trackPageView = (pageName, path) => {
  logAnalyticsEvent('page_view', {
    page_name: pageName,
    page_path: path,
  });
};

/**
 * Performance tracking helper
 */
export class PerformanceTracker {
  constructor(eventName) {
    this.eventName = eventName;
    this.startTime = performance.now();
  }

  complete(additionalParams = {}) {
    const duration = performance.now() - this.startTime;
    logAnalyticsEvent(`${this.eventName}_performance`, {
      duration_ms: Math.round(duration),
      ...additionalParams,
    });
  }
}

const analyticsService = {
  logEvent: logAnalyticsEvent,
  trackDrawingCompleted,
  trackPredictionMade,
  trackCorrectionSubmitted,
  trackGameStarted,
  trackGameCompleted,
  trackSignUp,
  trackLogin,
  trackSettingChanged,
  trackError,
  setUserProperties: setAnalyticsUserProperties,
  trackPageView,
  PerformanceTracker,
};

export default analyticsService;

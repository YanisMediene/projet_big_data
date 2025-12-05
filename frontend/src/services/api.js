import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Axios client with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add Firebase auth token to requests
export const setAuthToken = (token) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

/**
 * Debounced prediction call to avoid overwhelming the API
 * Uses 500ms debounce as per UX requirements
 */
let debounceTimer = null;
const DEBOUNCE_DELAY = 500; // milliseconds

export const predictDrawing = (base64Image) => {
  return new Promise((resolve, reject) => {
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer
    debounceTimer = setTimeout(async () => {
      try {
        const response = await apiClient.post('/predict', {
          image: base64Image,
        });
        resolve(response.data);
      } catch (error) {
        reject(error);
      }
    }, DEBOUNCE_DELAY);
  });
};

/**
 * Health check endpoint
 */
export const checkHealth = async () => {
  try {
    const response = await apiClient.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'error', message: error.message };
  }
};

export default apiClient;

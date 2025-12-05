import React from 'react';

/**
 * PredictionDisplay Component
 * 
 * Features:
 * - Shows top-3 predictions with confidence scores
 * - Color-coded confidence thresholds:
 *   - Green (>85%): High confidence
 *   - Yellow (70-85%): Medium confidence
 *   - Red (<70%): Low confidence (triggers correction modal)
 * - Animated confidence bars
 */
const PredictionDisplay = ({ predictions, isLoading }) => {
  if (isLoading) {
    return (
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Predictions</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary-600"></div>
          <span className="ml-3 text-gray-600">Analyzing drawing...</span>
        </div>
      </div>
    );
  }

  if (!predictions || predictions.length === 0) {
    return (
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Predictions</h2>
        <div className="text-center py-8 text-gray-500">
          Draw something to see predictions!
        </div>
      </div>
    );
  }

  const getConfidenceColor = (confidence) => {
    const percent = confidence * 100;
    if (percent >= 85) {
      return 'bg-green-500'; // High confidence
    } else if (percent >= 70) {
      return 'bg-yellow-500'; // Medium confidence
    } else {
      return 'bg-red-500'; // Low confidence
    }
  };

  const getConfidenceTextColor = (confidence) => {
    const percent = confidence * 100;
    if (percent >= 85) {
      return 'text-green-700';
    } else if (percent >= 70) {
      return 'text-yellow-700';
    } else {
      return 'text-red-700';
    }
  };

  const getConfidenceLabel = (confidence) => {
    const percent = confidence * 100;
    if (percent >= 85) {
      return '✓ High';
    } else if (percent >= 70) {
      return '⚠ Medium';
    } else {
      return '✗ Low';
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Predictions</h2>
      
      <div className="space-y-4">
        {predictions.map((prediction, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-gray-700">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </span>
                <span className="text-lg font-medium text-gray-800 capitalize">
                  {prediction.category.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-semibold ${getConfidenceTextColor(prediction.confidence)}`}>
                  {getConfidenceLabel(prediction.confidence)}
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {(prediction.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            
            {/* Confidence bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full ${getConfidenceColor(prediction.confidence)} transition-all duration-500 ease-out rounded-full`}
                style={{ width: `${prediction.confidence * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Low confidence warning */}
      {predictions[0] && predictions[0].confidence * 100 < 85 && (
        <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Low confidence detected.</strong> Is the prediction wrong? You can submit a correction to help improve the model.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionDisplay;

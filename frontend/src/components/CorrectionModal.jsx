import React, { useState } from 'react';

/**
 * CorrectionModal Component
 * 
 * Features:
 * - Shown when confidence < 85%
 * - Grid of 20 category buttons for correction
 * - Submits correction to Firestore
 * - Uploads drawing to Firebase Storage
 * - Part of Active Learning pipeline
 */
const CorrectionModal = ({ isOpen, onClose, predictions, canvasImage, categories }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmitCorrection = async () => {
    if (!selectedCategory) {
      alert('Please select the correct category');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Implement Firestore submission
      // 1. Upload image to Firebase Storage: /drawings/raw/{sessionId}/{timestamp}.png
      // 2. Add correction document to Firestore: corrections/{correctionId}
      // 3. Trigger retraining if corrections >= 500

      console.log('Correction submitted:', {
        originalPrediction: predictions[0]?.category,
        correctedLabel: selectedCategory,
        confidence: predictions[0]?.confidence,
        imageData: canvasImage,
      });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert(`✓ Thank you! Correction saved: ${selectedCategory.replace('_', ' ')}`);
      onClose();
    } catch (error) {
      console.error('Error submitting correction:', error);
      alert('Error submitting correction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Help Improve the Model</h2>
              <p className="mt-2 text-sm text-gray-600">
                The AI predicted: <strong className="text-gray-900 capitalize">
                  {predictions[0]?.category.replace('_', ' ')}
                </strong> ({(predictions[0]?.confidence * 100).toFixed(1)}% confidence)
              </p>
              <p className="mt-1 text-sm text-gray-600">
                What did you actually draw?
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Category Grid */}
        <div className="p-6">
          <div className="grid grid-cols-4 gap-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`p-3 rounded-lg border-2 transition-all font-medium text-sm capitalize ${
                  selectedCategory === category
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-gray-50'
                }`}
                disabled={isSubmitting}
              >
                {category.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            Your correction will help retrain the model
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitCorrection}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              disabled={!selectedCategory || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Correction</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorrectionModal;

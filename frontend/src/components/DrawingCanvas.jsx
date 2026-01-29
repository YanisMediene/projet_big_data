import React, { useRef, useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * DrawingCanvas Component
 * 
 * Features:
 * - 280x280px canvas (10x model's 28x28 input size)
 * - Mouse and touch event support
 * - Stroke rendering with adjustable brush size
 * - Clear canvas functionality
 * - Export canvas as base64 image
 * - AI predictions with debouncing
 */
const DrawingCanvas = ({ 
  onDrawingChange, 
  onPrediction, 
  onCanvasChange,
  enablePrediction = false,
  debounceTime = 500
}) => {
  const canvasRef = useRef(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });
  const debounceTimerRef = useRef(null);

  // Canvas configuration
  const CANVAS_SIZE = 280; // 280x280px
  const BRUSH_SIZE = 8;
  const BRUSH_COLOR = '#000000';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#FFFFFF'; // White background
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.strokeStyle = BRUSH_COLOR;
      ctx.lineWidth = BRUSH_SIZE;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  // Prediction function
  const getPrediction = async (base64Image) => {
    if (!enablePrediction || !onPrediction) return;

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: `data:image/png;base64,${base64Image}` }),
      });

      if (response.ok) {
        const data = await response.json();
        onPrediction({
          prediction: data.prediction,
          confidence: data.confidence,
          top_predictions: data.top_predictions || [],
        });
      }
    } catch (error) {
      console.error('Prediction error:', error);
    }
  };

  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Handle both mouse and touch events
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (event) => {
    event.preventDefault();
    const coords = getCanvasCoordinates(event);
    setIsMouseDown(true);
    setIsDrawing(true);
    setLastPosition(coords);
    
    // Draw a point at the starting position
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, BRUSH_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const draw = (event) => {
    if (!isMouseDown) return;
    
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const currentPosition = getCanvasCoordinates(event);

    // Draw line from last position to current position
    ctx.beginPath();
    ctx.moveTo(lastPosition.x, lastPosition.y);
    ctx.lineTo(currentPosition.x, currentPosition.y);
    ctx.stroke();

    setLastPosition(currentPosition);

    // Trigger callbacks with canvas data
    const base64Image = canvas.toDataURL('image/png').split(',')[1];
    if (onDrawingChange) onDrawingChange(base64Image);
    if (onCanvasChange) onCanvasChange(base64Image);

    // Trigger prediction with debounce
    if (enablePrediction) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        getPrediction(base64Image);
      }, debounceTime);
    }
  };

  const stopDrawing = () => {
    setIsMouseDown(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    setIsDrawing(false);
    if (onDrawingChange) onDrawingChange(null);
    if (onCanvasChange) onCanvasChange(null);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="border-4 border-gray-800 rounded-lg cursor-crosshair shadow-lg"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      
      <button
        onClick={clearCanvas}
        className="px-6 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors shadow-md"
      >
        Clear Canvas
      </button>
      
      <div className="text-sm text-gray-600 text-center">
        {isDrawing ? (
          <span className="text-green-600 font-medium">✓ Drawing detected</span>
        ) : (
          <span>Start drawing to get predictions</span>
        )}
      </div>
    </div>
  );
};

export default DrawingCanvas;

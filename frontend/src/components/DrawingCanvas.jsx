import React, { useRef, useState, useEffect } from 'react';

/**
 * DrawingCanvas Component
 * 
 * Features:
 * - 280x280px canvas (10x model's 28x28 input size)
 * - Mouse and touch event support
 * - Stroke rendering with adjustable brush size
 * - Clear canvas functionality
 * - Export canvas as base64 image
 */
const DrawingCanvas = ({ onDrawingChange, isDrawing, setIsDrawing }) => {
  const canvasRef = useRef(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });

  // Canvas configuration
  const CANVAS_SIZE = 280; // 280x280px
  const BRUSH_SIZE = 8;
  const BRUSH_COLOR = '#000000';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF'; // White background
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.strokeStyle = BRUSH_COLOR;
      ctx.lineWidth = BRUSH_SIZE;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

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
    setIsMouseDown(true);
    setIsDrawing(true);
    const coords = getCanvasCoordinates(event);
    setLastPosition(coords);
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

    // Trigger callback with canvas data (debounced in api.js)
    const base64Image = canvas.toDataURL('image/png').split(',')[1];
    onDrawingChange(base64Image);
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
    onDrawingChange(null); // Clear predictions
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

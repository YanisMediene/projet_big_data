import React, { useState, useRef, useEffect } from 'react';
import { Eye, Trash2, Send } from 'lucide-react';
import { predictDrawing } from './services/api';

export default function TestCanva() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage128, setPreviewImage128] = useState(null);
  const [previewImage28, setPreviewImage28] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Configuration du canvas plein écran
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Taille plein écran
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Resize handler
    const handleResize = () => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.putImageData(imageData, 0, 0);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fonction pour calculer la bounding box du dessin
  const getBoundingBox = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    let hasDrawing = false;

    // Parcourir tous les pixels
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        // Détecter les pixels non-blancs (dessin)
        if (r < 250 || g < 250 || b < 250) {
          hasDrawing = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasDrawing) return null;

    // Ajouter un padding de 5%
    const width = maxX - minX;
    const height = maxY - minY;
    const padding = Math.max(width, height) * 0.05;

    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: Math.min(canvas.width - minX, width + padding * 2),
      height: Math.min(canvas.height - minY, height + padding * 2)
    };
  };

  // Fonction pour créer l'image carrée à une taille donnée
  const createModelImage = (targetSize = 128) => {
    const canvas = canvasRef.current;
    const bbox = getBoundingBox();

    if (!bbox) return null;

    // Créer un canvas temporaire carré
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetSize;
    tempCanvas.height = targetSize;
    const tempCtx = tempCanvas.getContext('2d');

    // Fond blanc
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, targetSize, targetSize);

    // Le dessin remplit tout l'espace disponible (95% pour petite marge)
    const scale = Math.min(targetSize / bbox.width, targetSize / bbox.height) * 0.95;
    const scaledWidth = bbox.width * scale;
    const scaledHeight = bbox.height * scale;

    // Centrer le dessin
    const offsetX = (targetSize - scaledWidth) / 2;
    const offsetY = (targetSize - scaledHeight) / 2;

    // Qualité de redimensionnement
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';

    // Dessiner la zone croppée et redimensionnée
    tempCtx.drawImage(
      canvas,
      bbox.x, bbox.y, bbox.width, bbox.height,
      offsetX, offsetY, scaledWidth, scaledHeight
    );

    return tempCanvas.toDataURL('image/png');
  };

  // Dessin handlers
  const getCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCoordinates(e);
    
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDraw = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setPredictions([]);
    setPreviewImage128(null);
    setPreviewImage28(null);
  };

  const handlePreview = () => {
    const modelImage128 = createModelImage(128);
    const modelImage28 = createModelImage(28);
    if (modelImage128 && modelImage28) {
      setPreviewImage128(modelImage128);
      setPreviewImage28(modelImage28);
      setShowPreview(true);
    } else {
      alert('Dessinez quelque chose d\'abord !');
    }
  };

  const handleSendToModel = async () => {
    const modelImage = createModelImage(128);
    if (!modelImage) {
      alert('Dessinez quelque chose d\'abord !');
      return;
    }

    setIsLoading(true);
    try {
      const result = await predictDrawing(modelImage);
      
      const predictionsArray = Object.entries(result.probabilities)
        .map(([category, confidence]) => ({
          category,
          confidence
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
      
      setPredictions(predictionsArray);
      console.log('Prédictions:', predictionsArray);
    } catch (error) {
      console.error('Erreur de prédiction:', error);
      alert('Erreur lors de la prédiction');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white overflow-hidden">
      {/* Canvas plein écran */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />

      {/* Barre d'outils en bas */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-300 p-4 flex justify-center gap-4 z-10">
        <button
          onClick={clearCanvas}
          className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
          title="Effacer"
        >
          <Trash2 size={24} />
          <span className="font-semibold">Effacer</span>
        </button>

        <button
          onClick={handlePreview}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-lg"
          title="Aperçu 128x128 et 28x28"
        >
          <Eye size={24} />
          <span className="font-semibold">Aperçu modèle</span>
        </button>

        <button
          onClick={handleSendToModel}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Envoyer au modèle"
        >
          <Send size={24} />
          <span className="font-semibold">
            {isLoading ? 'Analyse...' : 'Envoyer au modèle'}
          </span>
        </button>
      </div>

      {/* Panneau des prédictions */}
      {predictions.length > 0 && (
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl p-6 border-2 border-gray-300 max-w-sm z-10">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Prédictions</h3>
          <div className="space-y-3">
            {predictions.map((pred, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="font-semibold capitalize text-gray-700">
                  {idx + 1}. {pred.category.replace('_', ' ')}
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {Math.round(pred.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de prévisualisation */}
      {showPreview && previewImage128 && previewImage28 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 shadow-2xl max-w-3xl w-full mx-4">
            <h2 className="text-2xl font-bold mb-6 text-center">
              Images envoyées au modèle
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Image 128x128 */}
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-3">128 × 128 pixels</h3>
                <img
                  src={previewImage128}
                  alt="Preview 128x128"
                  className="border-4 border-gray-300 rounded"
                  style={{ width: '256px', height: '256px', imageRendering: 'pixelated' }}
                />
                <p className="text-sm text-gray-500 mt-2">Zoom ×2</p>
              </div>

              {/* Image 28x28 */}
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-3">28 × 28 pixels</h3>
                <img
                  src={previewImage28}
                  alt="Preview 28x28"
                  className="border-4 border-gray-300 rounded"
                  style={{ width: '224px', height: '224px', imageRendering: 'pixelated' }}
                />
                <p className="text-sm text-gray-500 mt-2">Zoom ×8</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6 text-center">
              Bounding box carrée avec padding de 5% autour de votre dessin.
            </p>

            <button
              onClick={() => setShowPreview(false)}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs z-10">
        <h3 className="font-bold text-lg mb-2">Test Canvas Plein Écran</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>✏️ Dessinez en plein écran</li>
          <li>👁️ Visualisez 128×128 et 28×28</li>
          <li>📤 Envoyez au modèle pour prédiction</li>
          <li>🎯 Bounding box carrée (5%)</li>
        </ul>
      </div>
    </div>
  );
}

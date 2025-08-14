import React, { useState, useRef } from 'react';
import ShaderCanvas, { ShaderCanvasRef, Blob } from './components/ShaderCanvas';
import './App.css';

function App() {
  const [time, setTime] = useState(0);
  const [metaballRadius, setMetaballRadius] = useState(0.18);
  const [canvasSize, setCanvasSize] = useState(512);
  const [exportSize, setExportSize] = useState(1024);
  const [isAnimating, setIsAnimating] = useState(false);
  const [useAnimation, setUseAnimation] = useState(true);
  const [blobs, setBlobs] = useState<Blob[]>([
    { id: 1, position: [0, 0], color: [0.4, 0.6, 1.0], radius: 0.18 },
    { id: 2, position: [0.3, 0.2], color: [0.6, 0.8, 1.0], radius: 0.18 },
    { id: 3, position: [-0.2, -0.3], color: [0.55, 0.45, 0.95], radius: 0.18 },
  ]);
  const shaderRef = useRef<ShaderCanvasRef>(null);
  const animationRef = useRef<number | undefined>(undefined);

  const startAnimation = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    
    const animate = () => {
      setTime(prev => prev + 0.016); // ~60fps
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  const stopAnimation = () => {
    setIsAnimating(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const exportImage = () => {
    if (shaderRef.current) {
      const dataURL = shaderRef.current.exportImage(exportSize);
      
      // Create download link
      const link = document.createElement('a');
      link.download = `icon-${exportSize}x${exportSize}-time${time.toFixed(2)}-radius${metaballRadius}.png`;
      link.href = dataURL;
      link.click();
    }
  };

  const resetTime = () => {
    setTime(0);
  };

  // Blob management functions
  const addBlob = () => {
    const newId = Math.max(...blobs.map(b => b.id), 0) + 1;
    const randomX = (Math.random() - 0.5) * 1.5; // Random position between -0.75 and 0.75
    const randomY = (Math.random() - 0.5) * 1.5;
    const randomColor: [number, number, number] = [
      0.3 + Math.random() * 0.5, // R: 0.3-0.8
      0.4 + Math.random() * 0.5, // G: 0.4-0.9
      0.8 + Math.random() * 0.2, // B: 0.8-1.0 (keep it blue-ish)
    ];
    
    setBlobs([...blobs, { 
      id: newId, 
      position: [randomX, randomY], 
      color: randomColor,
      radius: 0.18 // Default radius
    }]);
  };

  const removeBlob = (id: number) => {
    if (blobs.length > 1) { // Keep at least one blob
      setBlobs(blobs.filter(blob => blob.id !== id));
    }
  };

  const updateBlobPosition = (id: number, position: [number, number]) => {
    setBlobs(blobs.map(blob => 
      blob.id === id ? { ...blob, position } : blob
    ));
  };

  const updateBlobColor = (id: number, color: [number, number, number]) => {
    setBlobs(blobs.map(blob => 
      blob.id === id ? { ...blob, color } : blob
    ));
  };

  const updateBlobRadius = (id: number, radius: number) => {
    setBlobs(blobs.map(blob => 
      blob.id === id ? { ...blob, radius } : blob
    ));
  };

  const resetBlobs = () => {
    setBlobs([
      { id: 1, position: [0, 0], color: [0.4, 0.6, 1.0], radius: 0.18 },
      { id: 2, position: [0.3, 0.2], color: [0.6, 0.8, 1.0], radius: 0.18 },
      { id: 3, position: [-0.2, -0.3], color: [0.55, 0.45, 0.95], radius: 0.18 },
    ]);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Icon Generator</h1>
        <p>Generate app icons using the shader background</p>
      </header>
      
      <div className="App-content">
        <div className="canvas-container">
          <ShaderCanvas
            ref={shaderRef}
            time={time}
            metaballRadius={metaballRadius}
            size={canvasSize}
            blobs={blobs}
            useAnimation={useAnimation}
            onBlobPositionChange={updateBlobPosition}
          />
        </div>
        
        <div className="controls">
          <div className="control-group">
            <label htmlFor="time-slider">Time: {time.toFixed(2)}</label>
            <input
              id="time-slider"
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={time}
              onChange={(e) => setTime(parseFloat(e.target.value))}
            />
            <button onClick={resetTime}>Reset Time</button>
          </div>
          
          <div className="control-group">
            <label htmlFor="radius-slider">Metaball Radius: {metaballRadius.toFixed(3)}</label>
            <input
              id="radius-slider"
              type="range"
              min="0.1"
              max="0.5"
              step="0.01"
              value={metaballRadius}
              onChange={(e) => setMetaballRadius(parseFloat(e.target.value))}
            />
          </div>
          
          <div className="control-group">
            <label htmlFor="canvas-size">Preview Size: {canvasSize}px</label>
            <select
              id="canvas-size"
              value={canvasSize}
              onChange={(e) => setCanvasSize(parseInt(e.target.value))}
            >
              <option value={256}>256px</option>
              <option value={512}>512px</option>
              <option value={768}>768px</option>
            </select>
          </div>
          
          <div className="control-group">
            <label htmlFor="export-size">Export Size: {exportSize}px</label>
            <select
              id="export-size"
              value={exportSize}
              onChange={(e) => setExportSize(parseInt(e.target.value))}
            >
              <option value={512}>512px</option>
              <option value={1024}>1024px</option>
              <option value={2048}>2048px</option>
              <option value={4096}>4096px</option>
            </select>
          </div>
          
          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={useAnimation}
                onChange={(e) => setUseAnimation(e.target.checked)}
              />
              Use Animation
            </label>
            <p className="help-text">
              {useAnimation 
                ? "Animation is on - disable to drag blobs around" 
                : "Click and drag blobs on the canvas to move them"
              }
            </p>
          </div>

          <div className="control-group blob-controls">
            <h3>Blob Management</h3>
            <div className="blob-actions">
              <button onClick={addBlob} disabled={blobs.length >= 10}>
                Add Blob ({blobs.length}/10)
              </button>
              <button onClick={resetBlobs}>
                Reset Blobs
              </button>
            </div>
          </div>

          {blobs.map((blob, index) => (
            <div key={blob.id} className="control-group blob-control">
              <h4>Blob {index + 1}</h4>
              
              <div className="blob-position">
                <label>X Position: {blob.position[0].toFixed(2)}</label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={blob.position[0]}
                  onChange={(e) => updateBlobPosition(blob.id, [parseFloat(e.target.value), blob.position[1]])}
                />
                
                <label>Y Position: {blob.position[1].toFixed(2)}</label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={blob.position[1]}
                  onChange={(e) => updateBlobPosition(blob.id, [blob.position[0], parseFloat(e.target.value)])}
                />
              </div>

              <div className="blob-color">
                <label>Red: {blob.color[0].toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={blob.color[0]}
                  onChange={(e) => updateBlobColor(blob.id, [parseFloat(e.target.value), blob.color[1], blob.color[2]])}
                />
                
                <label>Green: {blob.color[1].toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={blob.color[1]}
                  onChange={(e) => updateBlobColor(blob.id, [blob.color[0], parseFloat(e.target.value), blob.color[2]])}
                />
                
                <label>Blue: {blob.color[2].toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={blob.color[2]}
                  onChange={(e) => updateBlobColor(blob.id, [blob.color[0], blob.color[1], parseFloat(e.target.value)])}
                />
              </div>

              <div className="blob-radius">
                <label>Radius: {blob.radius.toFixed(3)}</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.01"
                  value={blob.radius}
                  onChange={(e) => updateBlobRadius(blob.id, parseFloat(e.target.value))}
                />
              </div>

              {blobs.length > 1 && (
                <button 
                  onClick={() => removeBlob(blob.id)} 
                  className="remove-blob-btn"
                >
                  Remove Blob
                </button>
              )}
            </div>
          ))}
          
          <div className="control-group animation-controls">
            <button onClick={isAnimating ? stopAnimation : startAnimation}>
              {isAnimating ? 'Stop Animation' : 'Start Animation'}
            </button>
          </div>
          
          <div className="control-group export-controls">
            <button onClick={exportImage} className="export-button">
              Export Icon ({exportSize}x{exportSize})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

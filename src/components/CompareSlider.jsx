import React, { useState, useRef } from 'react';
import './CompareSlider.css';

/**
 * CompareSlider – split-screen curtain slider for original image vs heatmap.
 * Props:
 *   originalUrl – URL of the original media.
 *   heatmapUrl – URL of the heatmap overlay.
 *   initialOpacity – Heatmap opacity (0‑1).
 *   colorPalette – Curtain line color (default cyan/teal).
 */
export default function CompareSlider({
  originalUrl,
  heatmapUrl,
  initialOpacity = 0.6,
  colorPalette = '#0ff',
}) {
  const containerRef = useRef(null);
  const [position, setPosition] = useState(0.5); // 0‑1 fraction of width
  const [opacity, setOpacity] = useState(initialOpacity);
  const [zoom, setZoom] = useState(1);

  const startDrag = (e) => {
    e.preventDefault();
    const move = (ev) => {
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      let newPos = (clientX - rect.left) / rect.width;
      newPos = Math.max(0, Math.min(1, newPos));
      setPosition(newPos);
    };
    const stop = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(3, Math.max(1, z + delta)));
  };

  return (
    <div
      className="compare-slider-container"
      ref={containerRef}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
      onWheel={handleWheel}
      style={{ position: 'relative', overflow: 'hidden', cursor: 'ew-resize' }}
    >
      <img
        src={originalUrl}
        alt="Original"
        className="compare-image original-image"
        style={{ width: '100%', transform: `scale(${zoom})` }}
      />
      <img
        src={heatmapUrl}
        alt="Heatmap"
        className="compare-image heatmap-image"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          opacity,
          clipPath: `inset(0 ${100 - position * 100}% 0 0)`,
          transform: `scale(${zoom})`,
        }}
      />
      <div
        className="curtain-line"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${position * 100}%`,
          width: '2px',
          backgroundColor: colorPalette,
          pointerEvents: 'none',
        }}
      />
      <div className="compare-controls" style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '4px', color: '#fff' }}>
        <label style={{ marginRight: '8px' }}>
          Opacity
          <input type="range" min={0} max={1} step={0.01} value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} style={{ verticalAlign: 'middle' }} />
        </label>
        <label>
          Zoom
          <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ verticalAlign: 'middle' }} />
        </label>
      </div>
    </div>
  );
}

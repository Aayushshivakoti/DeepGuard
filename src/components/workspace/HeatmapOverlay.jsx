import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ZoomIn, ZoomOut, Maximize2, Move, Columns, Layers } from 'lucide-react';

export default function HeatmapOverlay({ imageUrl, mediaType }) {
  const [compareMode, setCompareMode] = useState('overlay'); // 'overlay' | 'split'
  const [opacity, setOpacity] = useState(0.6);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);

  // Reset zoom & pan when switching modes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [compareMode]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    setZoom(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    // Calculate new pan with boundary limitations to keep image in view
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const renderVisualSource = (showHeatmapLayer, forceFullOpacity = false) => {
    return (
      <div
        className="w-full h-full flex items-center justify-center relative select-none"
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)',
        }}
      >
        <div className="relative w-48 h-48 pointer-events-none">
          {/* Simulated face outline */}
          <svg viewBox="0 0 192 192" className="w-full h-full transition-opacity duration-300" style={{ opacity: showHeatmapLayer && compareMode === 'overlay' ? 0.3 + (1 - opacity) * 0.4 : 0.7 }}>
            <ellipse cx="96" cy="96" rx="70" ry="85" fill="none" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
            <ellipse cx="72" cy="80" rx="10" ry="7" fill="rgba(6,182,212,0.15)" stroke="rgba(6,182,212,0.4)" strokeWidth="1" />
            <ellipse cx="120" cy="80" rx="10" ry="7" fill="rgba(6,182,212,0.15)" stroke="rgba(6,182,212,0.4)" strokeWidth="1" />
            <path d="M88,95 L96,115 L104,95" fill="none" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
            <path d="M76,128 Q96,142 116,128" fill="none" stroke="rgba(6,182,212,0.3)" strokeWidth="1.5" />
            {Array.from({ length: 5 }).map((_, i) => (
              <line
                key={`h-${i}`}
                x1="26" y1={40 + i * 30} x2="166" y2={40 + i * 30}
                stroke="rgba(6,182,212,0.05)" strokeWidth="1"
              />
            ))}
            {Array.from({ length: 5 }).map((_, i) => (
              <line
                key={`v-${i}`}
                x1={36 + i * 30} y1="11" x2={36 + i * 30} y2="181"
                stroke="rgba(6,182,212,0.05)" strokeWidth="1"
              />
            ))}
          </svg>

          {/* Heatmap overlay */}
          {showHeatmapLayer && (
            <div
              className="absolute inset-0 transition-all duration-300"
              style={{
                background: `
                  radial-gradient(ellipse 40% 30% at 37% 42%, rgba(239,68,68,0.85) 0%, rgba(245,158,11,0.5) 45%, transparent 70%),
                  radial-gradient(ellipse 40% 30% at 63% 42%, rgba(239,68,68,0.8) 0%, rgba(245,158,11,0.45) 45%, transparent 70%),
                  radial-gradient(ellipse 30% 20% at 50% 67%, rgba(245,158,11,0.6) 0%, transparent 60%)
                `,
                borderRadius: '50%',
                mixBlendMode: 'screen',
                opacity: forceFullOpacity ? 1 : opacity,
                animation: 'fade-in-up 0.5s ease-out forwards',
              }}
            />
          )}
        </div>

        {/* Scan line animation for heatmap viewports */}
        {showHeatmapLayer && (
          <div
            className="absolute left-0 right-0 h-px opacity-30 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
              animation: 'scan-line 3s linear infinite',
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
        <div>
          <p className="text-sm font-semibold text-slate-200">Grad-CAM Heatmap Viewer</p>
          <p className="text-xs text-slate-500 mt-0.5">Anomaly localization maps</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
            <button
              onClick={() => setCompareMode('overlay')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                compareMode === 'overlay' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={13} />
              Overlay
            </button>
            <button
              onClick={() => setCompareMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                compareMode === 'split' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns size={13} />
              Side-by-Side
            </button>
          </div>

          {/* Zoom Actions */}
          <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800 gap-1">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] font-bold font-mono text-cyan-400 min-w-[28px] text-center">{zoom.toFixed(1)}x</span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 4}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            {zoom > 1 && (
              <button
                onClick={handleResetZoom}
                className="p-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-[10px] font-bold px-1.5 ml-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Opacity Control slider for Overlay Mode */}
      {compareMode === 'overlay' && (
        <div className="flex items-center gap-3 bg-slate-950/20 p-2.5 rounded-xl border border-slate-900/50">
          <span className="text-xs text-slate-400 font-semibold truncate">Heatmap Opacity:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="flex-1 accent-cyan-500 h-1 rounded-full cursor-pointer bg-slate-800"
          />
          <span className="text-xs font-mono font-bold text-cyan-400 min-w-[35px] text-right">{Math.round(opacity * 100)}%</span>
        </div>
      )}

      {/* Main Visualizer Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative rounded-xl overflow-hidden select-none touch-none ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{
          aspectRatio: compareMode === 'split' ? '21/9' : '16/9',
          border: '1px solid rgba(6,182,212,0.12)',
        }}
      >
        <div
          className="w-full h-full flex transition-transform duration-75 ease-out origin-center"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          }}
        >
          {compareMode === 'overlay' ? (
            /* Overlay Viewport */
            <div className="w-full h-full relative">
              {renderVisualSource(true)}
            </div>
          ) : (
            /* Split Viewports */
            <div className="w-full h-full flex divide-x divide-slate-800">
              <div className="w-1/2 h-full relative">
                {renderVisualSource(false)}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-slate-950/80 text-[10px] font-bold text-slate-400 border border-slate-800">
                  Original Media
                </div>
              </div>
              <div className="w-1/2 h-full relative">
                {renderVisualSource(true, true)}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-red-500/10 text-[10px] font-bold text-red-400 border border-red-500/20">
                  Anomaly Heatmap
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating Pan Indicator */}
        {zoom > 1 && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-slate-950/90 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold px-2 py-1 rounded-lg">
            <Move size={11} />
            Drag to pan viewport
          </div>
        )}
      </div>

      {/* Legend & Detection points */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Heatmap Legend */}
        <div className="flex flex-col justify-center bg-slate-950/40 p-3 rounded-xl border border-slate-900">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Grad-CAM Legend</span>
          <div className="flex items-center gap-3">
            <div className="flex h-3 flex-1 rounded bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 border border-slate-950" />
            <div className="flex justify-between text-[10px] font-mono text-slate-400 w-full flex-1">
              <span>Low Prob</span>
              <span>High Prob</span>
            </div>
          </div>
        </div>

        {/* Feature Anomaly Coordinates */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { region: 'Left Eye Region', confidence: '94%', color: '#ef4444' },
            { region: 'Right Eye Region', confidence: '91%', color: '#ef4444' },
            { region: 'Mouth/Jawline', confidence: '73%', color: '#f59e0b' },
            { region: 'Skin Texture', confidence: '62%', color: '#f59e0b' },
          ].map((point) => (
            <div
              key={point.region}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
              style={{ background: 'rgba(15,23,42,0.6)', border: `1px solid ${point.color}25` }}
            >
              <span className="text-slate-400">{point.region}</span>
              <span className="font-bold" style={{ color: point.color }}>{point.confidence}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

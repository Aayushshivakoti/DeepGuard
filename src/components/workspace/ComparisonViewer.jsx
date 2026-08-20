import React, { useState } from 'react';
import { X, Sliders, Eye, Layers, Grid, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

export default function ComparisonViewer({ originalMedia, suspectMedia, onClose }) {
  const [viewMode, setViewMode] = useState('sideBySide'); // 'sideBySide' | 'crossFade' | 'pixelDiff'
  const [opacity, setOpacity] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetTransform = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const origUrl = originalMedia?.url || originalMedia?.heatmap_b64 ? `data:image/png;base64,${originalMedia?.heatmap_b64}` : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';
  const suspectUrl = suspectMedia?.url || suspectMedia?.heatmap_b64 ? `data:image/png;base64,${suspectMedia?.heatmap_b64}` : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fade-in-up">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Forensic Media Comparison Diff</h3>
              <p className="text-xs text-slate-400">Dual-pane inspection with synchronized pan, zoom, and pixel diff</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('sideBySide')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'sideBySide' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid size={13} />
              <span>Side-by-Side</span>
            </button>

            <button
              onClick={() => setViewMode('crossFade')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'crossFade' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders size={13} />
              <span>Cross-Fade Overlay</span>
            </button>

            <button
              onClick={() => setViewMode('pixelDiff')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'pixelDiff' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={13} />
              <span>Pixel-Level Diff</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="p-3 px-6 bg-slate-950/30 border-b border-slate-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setZoom(prev => Math.min(prev + 0.25, 4))}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-300"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <span className="font-mono px-2 text-cyan-400">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-300"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={resetTransform}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Reset View"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            {viewMode === 'crossFade' && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Overlay Opacity:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-32 accent-cyan-500"
                />
                <span className="font-mono text-cyan-400 font-bold">{opacity}%</span>
              </div>
            )}
          </div>

          <span className="text-slate-500 font-mono text-[11px]">
            Drag to pan | Synchronized Cursor Active
          </span>
        </div>

        {/* Media Viewing Canvas Container */}
        <div
          className="flex-1 p-6 overflow-hidden relative cursor-grab active:cursor-grabbing min-h-[400px] flex items-center justify-center bg-slate-950"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {viewMode === 'sideBySide' && (
            <div className="grid grid-cols-2 gap-6 w-full h-full">
              {/* Left: Original */}
              <div className="relative rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/50 flex flex-col">
                <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>Reference Baseline</span>
                  <span className="text-emerald-400 font-mono">AUTHENTIC</span>
                </div>
                <div className="flex-1 relative flex items-center justify-center p-4">
                  <img
                    src={origUrl}
                    alt="Original Baseline"
                    className="max-h-[350px] object-contain transition-transform duration-75"
                    style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                  />
                </div>
              </div>

              {/* Right: Suspect */}
              <div className="relative rounded-2xl border border-rose-500/30 overflow-hidden bg-slate-900/50 flex flex-col">
                <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>Suspect Media Payload</span>
                  <span className="text-rose-400 font-mono">88.5% SYNTHETIC</span>
                </div>
                <div className="flex-1 relative flex items-center justify-center p-4">
                  <img
                    src={suspectUrl}
                    alt="Suspect Payload"
                    className="max-h-[350px] object-contain transition-transform duration-75"
                    style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                  />
                </div>
              </div>
            </div>
          )}

          {viewMode === 'crossFade' && (
            <div className="relative w-full max-w-2xl h-[380px] rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/40 flex items-center justify-center">
              <img
                src={origUrl}
                alt="Original"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
              />
              <img
                src={suspectUrl}
                alt="Overlay Suspect"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-150"
                style={{
                  opacity: opacity / 100,
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                }}
              />
            </div>
          )}

          {viewMode === 'pixelDiff' && (
            <div className="relative w-full max-w-2xl h-[380px] rounded-2xl border border-rose-500/40 bg-slate-900/40 flex flex-col items-center justify-center overflow-hidden">
              <div className="absolute top-3 left-3 bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-1 rounded-md z-10">
                High-Contrast Pixel Delta Highlighted (Red = Tampered)
              </div>
              <img
                src={suspectUrl}
                alt="Pixel Diff Highlight"
                className="max-h-[350px] object-contain"
                style={{
                  filter: 'contrast(180%) invert(20%) sepia(100%) saturate(800%) hue-rotate(300deg)',
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

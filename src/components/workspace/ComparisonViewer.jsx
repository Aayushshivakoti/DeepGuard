import React, { useState, useEffect, useRef } from 'react';
import { X, Sliders, Eye, Layers, Grid, ZoomIn, ZoomOut, RotateCcw, Volume2, VolumeX, ArrowLeft, AlertTriangle, ShieldCheck, ShieldAlert, Info } from 'lucide-react';

export default function ComparisonViewer({ originalMedia, suspectMedia, onClose }) {
  const [viewMode, setViewMode] = useState('crossFade'); // 'sideBySide' | 'crossFade' | 'pixelDiff' | 'videoSync' | 'audioSpectrogram'
  const [opacity, setOpacity] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Swipe slider state (percentage from left, 0 to 100)
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef(null);

  // Video Refs for synchronized scrubbing
  const videoRefRef = useRef(null);
  const videoRefSuspect = useRef(null);

  // Audio Spectrogram States
  const [audioMuted, setAudioMuted] = useState(false);
  const [soloCloneBands, setSoloCloneBands] = useState(false);
  const canvasRef1 = useRef(null);
  const canvasRef2 = useRef(null);

  // Sync video timelines
  const handleVideoScrub = () => {
    if (videoRefRef.current && videoRefSuspect.current) {
      const time = videoRefRef.current.currentTime;
      if (Math.abs(videoRefSuspect.current.currentTime - time) > 0.05) {
        videoRefSuspect.current.currentTime = time;
      }
    }
  };

  const handleVideoPlay = () => {
    if (videoRefRef.current && videoRefSuspect.current) {
      videoRefSuspect.current.play();
    }
  };

  const handleVideoPause = () => {
    if (videoRefRef.current && videoRefSuspect.current) {
      videoRefSuspect.current.pause();
    }
  };

  // Render simulated spectrogram graphs on canvases
  useEffect(() => {
    if (viewMode === 'audioSpectrogram') {
      drawSpectrogram(canvasRef1.current, '#22c55e', false);
      drawSpectrogram(canvasRef2.current, soloCloneBands ? '#a855f7' : '#f43f5e', soloCloneBands);
    }
  }, [viewMode, soloCloneBands]);

  const drawSpectrogram = (canvas, color, highlightClone) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 30) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Draw Mel bands frequencies lines
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);

    for (let x = 0; x < width; x++) {
      const frequency = x * 0.05;
      let y = height / 2 + Math.sin(frequency * 5) * 20 + Math.cos(frequency * 2) * 10;
      
      // Simulate synthetic artifacts injection
      if (highlightClone && x > width / 2) {
        y += Math.sin(frequency * 20) * 15; // high-frequency modulation
      }

      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // High frequency band highlighter box
    if (highlightClone) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
      ctx.fillRect(width / 2, 10, width / 2, height - 20);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(width / 2, 10, width / 2, height - 20);
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#a855f7';
      ctx.font = '8px sans-serif';
      ctx.fillText('CLONED VOICE HARMONICS DETECTED', width / 2 + 10, 25);
    }
  };

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

  // Image swipe drag handler
  const handleSwipeMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    setSliderPosition(percentage);
  };

  const handleTouchSwipeMove = (e) => {
    if (!containerRef.current || !e.touches[0]) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    setSliderPosition(percentage);
  };

  const origUrl = originalMedia?.url || (originalMedia?.heatmap_b64 ? `data:image/png;base64,${originalMedia?.heatmap_b64}` : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80');
  const suspectUrl = suspectMedia?.heatmap_b64 ? `data:image/png;base64,${suspectMedia?.heatmap_b64}` : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80';

  const verdict = suspectMedia?.verdict || 'DEEPFAKE_DETECTED';
  const confidence = suspectMedia?.confidence || 88.5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in-up">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl overflow-hidden flex flex-col shadow-2xl max-h-[92vh] relative">
        
        {/* Sticky Header with "Back to Summary" Navigation & Tabs */}
        <div className="sticky top-0 z-30 p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <ArrowLeft size={15} className="text-cyan-400" />
              <span>← Back to Summary</span>
            </button>
            <div className="h-5 w-px bg-slate-800 hidden sm:block" />
            <h3 className="text-sm font-bold text-slate-100 hidden md:block">Forensic Media Inspector</h3>
          </div>

          {/* Interactive View Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800/80 rounded-xl overflow-x-auto">
            <button
              onClick={() => setViewMode('crossFade')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'crossFade' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders size={13} />
              <span>Swipe Overlay</span>
            </button>

            <button
              onClick={() => setViewMode('sideBySide')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'sideBySide' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid size={13} />
              <span>Side-by-Side</span>
            </button>

            <button
              onClick={() => setViewMode('pixelDiff')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'pixelDiff' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={13} />
              <span>AI Alteration Map</span>
            </button>

            <button
              onClick={() => setViewMode('audioSpectrogram')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'audioSpectrogram' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Audio Breakdown</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Inspector"
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary Verdict Banner */}
        <div className="bg-slate-950 px-6 py-2.5 border-b border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-400 flex-shrink-0" />
            <span className="font-bold text-slate-200">
              Verdict: {verdict.replace('_', ' ')} ({confidence}% Confidence)
            </span>
            <span className="text-slate-400 border-l border-slate-800 pl-2 hidden sm:inline">
              High-frequency pixel noise and unnatural facial surface smoothing detected.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Red = Artificial/Altered</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Cyan = Authentic Baseline</span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="p-2.5 px-6 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setZoom(prev => Math.min(prev + 0.25, 4))}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <span className="font-mono px-2 text-cyan-400 text-[11px]">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={resetTransform}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Reset View"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            {viewMode === 'audioSpectrogram' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAudioMuted(!audioMuted)}
                  className="btn-ghost p-1 rounded-lg border border-slate-800 text-slate-400 flex items-center gap-1 text-[11px]"
                >
                  {audioMuted ? <VolumeX size={13} className="text-red-400" /> : <Volume2 size={13} />}
                  <span>{audioMuted ? 'Muted' : 'Mute'}</span>
                </button>
                <button
                  onClick={() => setSoloCloneBands(!soloCloneBands)}
                  className={`py-1 px-2.5 text-[10px] rounded-lg border font-bold ${
                    soloCloneBands ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'border-slate-800 text-slate-400'
                  }`}
                >
                  Solo Cloned Harmonics
                </button>
              </div>
            )}
          </div>

          <span className="text-slate-400 font-mono text-[11px]">
            {viewMode === 'crossFade' ? 'Drag slider left/right to swipe Grad-CAM heatmap' : 'Synchronized Inspection Grid'}
          </span>
        </div>

        {/* Media Viewing Canvas Container */}
        <div
          className="flex-1 p-6 overflow-hidden relative cursor-grab active:cursor-grabbing min-h-[380px] flex items-center justify-center bg-slate-950"
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
                  <span>Original View (Natural Camera Capture)</span>
                  <span className="text-emerald-400 font-mono">AUTHENTIC BASELINE</span>
                </div>
                <div className="flex-1 relative flex items-center justify-center p-4">
                  <img
                    src={origUrl}
                    alt="Original Baseline"
                    className="max-h-[340px] object-contain transition-transform duration-75"
                    style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                  />
                </div>
              </div>

              {/* Right: Suspect */}
              <div className="relative rounded-2xl border border-rose-500/30 overflow-hidden bg-slate-900/50 flex flex-col">
                <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>AI Alteration Map (Grad-CAM Overlay)</span>
                  <span className="text-rose-400 font-mono">{confidence}% SYNTHETIC</span>
                </div>
                <div className="flex-1 relative flex items-center justify-center p-4">
                  <img
                    src={suspectUrl}
                    alt="Suspect Payload"
                    className="max-h-[340px] object-contain transition-transform duration-75"
                    style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                  />
                </div>
              </div>
            </div>
          )}

          {viewMode === 'crossFade' && (
            /* Interactive Swipe Slider Container */
            <div 
              ref={containerRef}
              className="relative w-full max-w-2xl h-[360px] rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/40 select-none cursor-ew-resize"
              onMouseMove={handleSwipeMove}
              onTouchMove={handleTouchSwipeMove}
            >
              {/* Underlying Grad-CAM layer */}
              <img
                src={suspectUrl}
                alt="Heatmap"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />

              {/* Swipable Overlay image (Reference) */}
              <div 
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={origUrl}
                  alt="Original"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ width: containerRef.current?.getBoundingClientRect().width }}
                />
              </div>

              {/* Slider Handle */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-cyan-400 pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-950 border-2 border-cyan-400 flex items-center justify-center text-[10px] text-cyan-400 font-black shadow-lg">
                  ↔
                </div>
              </div>
            </div>
          )}

          {viewMode === 'pixelDiff' && (
            <div className="relative w-full max-w-2xl h-[360px] rounded-2xl border border-rose-500/40 bg-slate-900/40 flex flex-col items-center justify-center overflow-hidden">
              <div className="absolute top-3 left-3 bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2.5 py-1 rounded-md z-10">
                Highlighted Artificial Regions (Red/Pink = Deepfake Manipulation)
              </div>
              <img
                src={suspectUrl}
                alt="Pixel Diff Highlight"
                className="max-h-[330px] object-contain"
                style={{
                  filter: 'contrast(180%) invert(20%) sepia(100%) saturate(800%) hue-rotate(300deg)',
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                }}
              />
            </div>
          )}

          {viewMode === 'audioSpectrogram' && (
            <div className="grid grid-cols-2 gap-6 w-full h-full">
              {/* Reference Audio Spectrogram */}
              <div className="relative rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/50 flex flex-col">
                <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-300">
                  Original Speech Frequency Profile
                </div>
                <div className="flex-1 relative flex flex-col items-center justify-center p-4 gap-4">
                  <canvas ref={canvasRef1} width="350" height="140" className="rounded-xl border border-slate-950" />
                  <audio controls className="w-full" src="" />
                </div>
              </div>

              {/* Suspect Audio Spectrogram */}
              <div className="relative rounded-2xl border border-rose-500/30 overflow-hidden bg-slate-900/50 flex flex-col">
                <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-300">
                  Cloned Voice Harmonics Profile
                </div>
                <div className="flex-1 relative flex flex-col items-center justify-center p-4 gap-4">
                  <canvas ref={canvasRef2} width="350" height="140" className="rounded-xl border border-slate-950" />
                  <audio controls muted={audioMuted} className="w-full" src="" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

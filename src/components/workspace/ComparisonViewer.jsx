import React, { useState, useEffect, useRef } from 'react';
import { X, Sliders, Eye, Layers, Grid, ZoomIn, ZoomOut, RotateCcw, Volume2, VolumeX } from 'lucide-react';

export default function ComparisonViewer({ originalMedia, suspectMedia, onClose }) {
  const [viewMode, setViewMode] = useState('sideBySide'); // 'sideBySide' | 'crossFade' | 'pixelDiff' | 'videoSync' | 'audioSpectrogram'
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
      ctx.fillText('CLONED HARMONICS DETECTED', width / 2 + 10, 25);
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

  const origUrl = originalMedia?.url || originalMedia?.heatmap_b64 ? `data:image/png;base64,${originalMedia?.heatmap_b64}` : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';
  const suspectUrl = suspectMedia?.heatmap_b64 ? `data:image/png;base64,${suspectMedia?.heatmap_b64}` : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80';

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
              <span>Swipe Overlay</span>
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

            <button
              onClick={() => setViewMode('videoSync')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'videoSync' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Video Sync</span>
            </button>

            <button
              onClick={() => setViewMode('audioSpectrogram')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'audioSpectrogram' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Audio Spectrogram</span>
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

            {viewMode === 'audioSpectrogram' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAudioMuted(!audioMuted)}
                  className="btn-ghost p-1.5 rounded-lg border border-slate-800 text-slate-400 flex items-center gap-1"
                >
                  {audioMuted ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} />}
                  <span>{audioMuted ? 'Muted' : 'Mute'}</span>
                </button>
                <button
                  onClick={() => setSoloCloneBands(!soloCloneBands)}
                  className={`btn-ghost py-1 px-3 text-[10px] rounded-lg border ${
                    soloCloneBands ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'border-slate-800 text-slate-400'
                  }`}
                >
                  Solo Cloned Harmonics
                </button>
              </div>
            )}
          </div>

          <span className="text-slate-500 font-mono text-[11px]">
            {viewMode === 'crossFade' ? 'Drag slider handle to swipe Grad-CAM' : 'Synchronized Cursor Active'}
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
                  <span>Suspect Media Heatmap</span>
                  <span className="text-rose-400 font-mono">{suspectMedia?.confidence}% DEEPFAKE</span>
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
            /* Interactive Swipe Slider Container */
            <div 
              ref={containerRef}
              className="relative w-full max-w-2xl h-[380px] rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/40 select-none cursor-ew-resize"
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

          {viewMode === 'videoSync' && (
            <div className="grid grid-cols-2 gap-6 w-full h-full">
              {/* Reference video */}
              <div className="relative rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/50 flex flex-col">
                <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-300">
                  Reference Sync Video Baseline
                </div>
                <div className="flex-1 relative flex items-center justify-center p-4">
                  <video
                    ref={videoRefRef}
                    onTimeUpdate={handleVideoScrub}
                    onSeeked={handleVideoScrub}
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    controls
                    className="max-h-[300px] w-full"
                    src="https://www.w3schools.com/html/mov_bbb.mp4"
                  />
                </div>
              </div>

              {/* Suspect video */}
              <div className="relative rounded-2xl border border-rose-500/30 overflow-hidden bg-slate-900/50 flex flex-col">
                <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-300">
                  Suspect Sync Video payload
                </div>
                <div className="flex-1 relative flex items-center justify-center p-4">
                  <video
                    ref={videoRefSuspect}
                    controls
                    muted
                    className="max-h-[300px] w-full pointer-events-none"
                    src="https://www.w3schools.com/html/mov_bbb.mp4"
                  />
                </div>
              </div>
            </div>
          )}

          {viewMode === 'audioSpectrogram' && (
            <div className="grid grid-cols-2 gap-6 w-full h-full">
              {/* Reference Audio Spectrogram */}
              <div className="relative rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/50 flex flex-col">
                <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-300">
                  Reference Clean Spectrogram
                </div>
                <div className="flex-1 relative flex flex-col items-center justify-center p-4 gap-4">
                  <canvas ref={canvasRef1} width="350" height="150" className="rounded-xl border border-slate-950" />
                  <audio controls className="w-full" src="" />
                </div>
              </div>

              {/* Suspect Audio Spectrogram */}
              <div className="relative rounded-2xl border border-rose-500/30 overflow-hidden bg-slate-900/50 flex flex-col">
                <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-300">
                  Suspect Cloned Voice Spectrogram
                </div>
                <div className="flex-1 relative flex flex-col items-center justify-center p-4 gap-4">
                  <canvas ref={canvasRef2} width="350" height="150" className="rounded-xl border border-slate-950" />
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

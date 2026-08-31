import React, { useEffect, useRef } from 'react';
import { Cpu, CheckCircle2, XCircle, Loader2, Sparkles, Activity, Layers, Globe, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ScanProgress() {
  const { state, resetScan } = useApp();
  const { scanStatus, scanProgress, scanStepMessage, scanError } = state;

  const isVisible = scanStatus === 'scanning' || scanStatus === 'error';

  const stages = [
    { title: 'Spatial Surface Scan', subtitle: 'Spectral FFT & Noise Artifact Analysis', minProgress: 0, maxProgress: 25, icon: Layers },
    { title: 'Temporal & rPPG Signal', subtitle: 'Biological Pulse & Landmark Jitter Tracking', minProgress: 25, maxProgress: 50, icon: Activity },
    { title: 'Audio & Voice Clone', subtitle: 'LFCC Phase & Spectrum Flatness Check', minProgress: 50, maxProgress: 75, icon: Sparkles },
    { title: 'Cloud & Ensemble Fusion', subtitle: 'Gemini & Hugging Face Multimodal Verification', minProgress: 75, maxProgress: 100, icon: Globe },
  ];

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2, 6, 23, 0.88)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="glass-strong rounded-2xl p-8 w-full max-w-lg animate-fade-in-up relative overflow-hidden shadow-2xl"
        style={{ border: '1px solid rgba(6,182,212,0.25)' }}
      >
        {/* Animated cyber background grid */}
        <div className="absolute inset-0 cyber-grid opacity-25 pointer-events-none" />

        {scanStatus === 'error' ? (
          <div className="text-center animate-fade-in-up relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <XCircle size={36} className="text-red-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-100 mb-1">Scan Failed or Unreadable Media</h3>
            <p className="text-xs text-slate-400 mb-4">An exception occurred during pipeline decoding or API verification.</p>
            
            <div className="p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl mb-6 text-left font-mono text-xs text-red-300 overflow-x-auto max-h-28">
              <span className="font-bold text-red-400">Diagnostic Details: </span>
              {scanError || 'Media decoding failure, unsupported video codec, or missing file stream.'}
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={resetScan}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-lg cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Try Again / Re-upload File</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)' }}
              >
                <Cpu size={24} className="text-cyan-400 animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-100 tracking-wide">Multi-Modal AI Pipeline</h3>
                <p className="text-xs text-cyan-400/80 font-mono mt-0.5">DeepGuard Verification Engine v3.1</p>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="mb-6 relative z-10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-400">Scan Pipeline Progress</span>
                <span className="text-xs font-extrabold text-cyan-400 font-mono">{scanProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800/90 overflow-hidden border border-slate-700/50">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                  style={{
                    width: `${scanProgress}%`,
                    background: 'linear-gradient(90deg, #0891b2, #06b6d4, #38bdf8)',
                  }}
                >
                  <div className="absolute inset-0 animate-shimmer" />
                </div>
              </div>
            </div>

            {/* Granular Pipeline Stage Cards */}
            <div className="space-y-2.5 mb-6 relative z-10">
              {stages.map((stage, idx) => {
                const Icon = stage.icon;
                const isComplete = scanProgress >= stage.maxProgress;
                const isActive = scanProgress >= stage.minProgress && scanProgress < stage.maxProgress;

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-300 ${
                      isComplete
                        ? 'bg-cyan-950/20 border-cyan-500/30 text-slate-200'
                        : isActive
                        ? 'bg-slate-900 border-cyan-500/50 shadow-md text-cyan-300'
                        : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {isComplete ? (
                        <CheckCircle2 size={16} className="text-cyan-400" />
                      ) : isActive ? (
                        <Loader2 size={16} className="text-cyan-400 animate-spin" />
                      ) : (
                        <Icon size={16} className="text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isActive ? 'text-cyan-300' : isComplete ? 'text-slate-200' : 'text-slate-500'}`}>
                        {stage.title}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{stage.subtitle}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                      {isComplete ? '100%' : isActive ? `${scanProgress}%` : 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Current Step Status Banner */}
            <div
              className="px-3.5 py-2 rounded-xl relative z-10 flex items-center justify-between"
              style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping flex-shrink-0" />
                <span className="text-xs text-cyan-300 font-mono font-semibold truncate">
                  {scanStepMessage || 'Executing multi-layer deepfake evaluation...'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

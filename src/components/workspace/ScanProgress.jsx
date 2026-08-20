import React, { useEffect, useRef } from 'react';
import { Cpu, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const STEP_ICONS = {
  done: CheckCircle2,
  active: Loader2,
  pending: null,
};

export default function ScanProgress() {
  const { state, resetScan } = useApp();
  const { scanStatus, scanProgress, scanStepMessage } = state;

  const isVisible = scanStatus === 'scanning' || scanStatus === 'error';
  const prevStepsRef = useRef([]);

  const allSteps = [
    'Initializing scanner...',
    scanStepMessage || 'Processing...',
    'Generating forensic report...',
  ];

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="glass-strong rounded-2xl p-8 w-full max-w-md animate-fade-in-up relative overflow-hidden"
        style={{ border: '1px solid rgba(6,182,212,0.2)' }}
      >
        {/* Animated background grid */}
        <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />

        {scanStatus === 'error' ? (
          <div className="text-center animate-fade-in-up">
            <XCircle size={48} className="text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-200 mb-2">Scan Failed</h3>
            <p className="text-sm text-slate-400 mb-6">An error occurred during analysis. Please try again.</p>
            <button onClick={resetScan} className="btn-primary">
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)' }}
              >
                <Cpu size={26} className="text-cyan-400 animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-200">AI Analysis in Progress</h3>
                <p className="text-xs text-slate-500 mt-0.5">DeepGuard Neural Engine v3.1</p>
              </div>
            </div>

            {/* Current Step Message */}
            <div
              className="mb-6 px-4 py-3 rounded-xl relative z-10"
              style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.1)' }}
            >
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-cyan-400 animate-spin flex-shrink-0" />
                <p className="text-sm text-cyan-300 font-medium font-mono truncate">
                  {scanStepMessage || 'Initializing...'}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6 relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium">Analysis Progress</span>
                <span className="text-xs font-bold text-cyan-400">{scanProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                  style={{
                    width: `${scanProgress}%`,
                    background: 'linear-gradient(90deg, #0891b2, #06b6d4, #22d3ee)',
                  }}
                >
                  <div className="absolute inset-0 animate-shimmer" />
                </div>
              </div>
            </div>

            {/* Step Progress Dots */}
            <div className="flex items-center gap-2 justify-center relative z-10 flex-wrap">
              {Array.from({ length: 7 }).map((_, i) => {
                const stepProgress = (i + 1) / 7 * 100;
                const isDone = scanProgress >= stepProgress;
                const isActive = scanProgress >= stepProgress - 14 && scanProgress < stepProgress;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className={`
                        w-2 h-2 rounded-full transition-all duration-300
                        ${isDone ? 'bg-cyan-400 shadow-lg' : isActive ? 'bg-cyan-400 animate-blink' : 'bg-slate-700'}
                      `}
                      style={isDone ? { boxShadow: '0 0 8px rgba(6,182,212,0.8)' } : {}}
                    />
                    {i < 6 && <div className={`w-4 h-px ${isDone ? 'bg-cyan-600' : 'bg-slate-700'} transition-colors duration-300`} />}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-600 text-center mt-4 relative z-10">
              This may take 2–10 seconds depending on file size
            </p>
          </>
        )}
      </div>
    </div>
  );
}

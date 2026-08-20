import React, { useEffect, useRef } from 'react';
import { Activity, BarChart2 } from 'lucide-react';

function generateWaveformBars(count = 60) {
  return Array.from({ length: count }, (_, i) => {
    const base = Math.sin(i * 0.3) * 0.3 + 0.5;
    const noise = (Math.random() - 0.5) * 0.4;
    return Math.max(0.05, Math.min(1, base + noise));
  });
}

function generateSpectrogram(rows = 20, cols = 60) {
  return Array.from({ length: rows }, (_, row) => {
    const rowBase = row < rows / 2 ? (rows / 2 - row) / (rows / 2) : (row - rows / 2) / (rows / 2);
    return Array.from({ length: cols }, (_, col) => {
      const timeDecay = Math.exp(-col * 0.04);
      const freqBias = rowBase;
      const noise = Math.random() * 0.3;
      return Math.max(0, Math.min(1, freqBias * timeDecay + noise));
    });
  });
}

const waveformBars = generateWaveformBars(80);
const spectrogramData = generateSpectrogram(16, 80);

function getSpectralColor(value) {
  if (value > 0.8) return '#ef4444';
  if (value > 0.6) return '#f59e0b';
  if (value > 0.4) return '#06b6d4';
  if (value > 0.2) return '#1d4ed8';
  return '#1e293b';
}

export default function AudioWaveform({ verdict }) {
  const isAnomaly = verdict === 'DEEPFAKE_DETECTED' || verdict === 'SUSPICIOUS';

  return (
    <div className="space-y-4">
      {/* Waveform */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={14} className="text-cyan-400" />
          <p className="text-sm font-semibold text-slate-200">Audio Waveform</p>
          {isAnomaly && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              Anomalies Detected
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-px h-20 px-3 py-2 rounded-xl overflow-hidden"
          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(6,182,212,0.1)' }}
        >
          {waveformBars.map((height, i) => {
            const isAnomalyRegion = isAnomaly && (i > 25 && i < 45);
            const color = isAnomalyRegion ? '#ef4444' : '#06b6d4';
            const animDelay = `${(i * 0.03).toFixed(2)}s`;
            return (
              <div
                key={i}
                className="flex-1 rounded-full waveform-bar"
                style={{
                  height: `${height * 100}%`,
                  background: isAnomalyRegion
                    ? `linear-gradient(180deg, #ef4444, #dc2626)`
                    : `linear-gradient(180deg, #06b6d4, #0284c7)`,
                  opacity: isAnomalyRegion ? 0.9 : 0.7,
                  animationDelay: animDelay,
                  animationDuration: `${0.8 + Math.random() * 0.4}s`,
                  minWidth: '2px',
                }}
              />
            );
          })}
        </div>
        {isAnomaly && (
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1 rounded bg-cyan-500" />
              <span className="text-xs text-slate-500">Natural vocal tract</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1 rounded bg-red-500" />
              <span className="text-xs text-slate-500">Synthetic markers</span>
            </div>
          </div>
        )}
      </div>

      {/* Spectrogram */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={14} className="text-purple-400" />
          <p className="text-sm font-semibold text-slate-200">Mel-Spectrogram</p>
          <span className="text-xs text-slate-600">Frequency vs. Time</span>
        </div>
        <div
          className="rounded-xl overflow-hidden p-2"
          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(6,182,212,0.1)' }}
        >
          <div className="flex flex-col gap-px">
            {spectrogramData.map((row, ri) => (
              <div key={ri} className="flex gap-px" style={{ height: '6px' }}>
                {row.map((val, ci) => (
                  <div
                    key={ci}
                    className="flex-1 rounded-sm transition-all"
                    style={{
                      background: getSpectralColor(isAnomaly && ci > 25 && ci < 45 ? val * 1.5 : val),
                      opacity: 0.85,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          {/* Axis labels */}
          <div className="flex justify-between mt-2 px-1">
            <span className="text-xs text-slate-600">0 Hz</span>
            <span className="text-xs text-slate-600">Frequency Domain</span>
            <span className="text-xs text-slate-600">8 kHz</span>
          </div>
        </div>

        {/* Color legend */}
        <div className="flex items-center gap-3 mt-2">
          <div
            className="flex-1 h-1.5 rounded-full"
            style={{ background: 'linear-gradient(90deg, #1e293b, #1d4ed8, #06b6d4, #f59e0b, #ef4444)' }}
          />
          <div className="flex justify-between w-full text-xs text-slate-600" style={{ marginTop: '-4px' }}>
            <span>Low</span>
            <span>High Intensity</span>
          </div>
        </div>
      </div>
    </div>
  );
}

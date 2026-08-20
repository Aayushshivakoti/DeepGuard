import React, { useState } from 'react';
import { X, History, Image, Video, Music, FileText, Link, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { useApp, ACTIONS } from '../../context/AppContext';
import StatusBadge from '../common/StatusBadge';

const MEDIA_ICONS = {
  image: Image,
  video: Video,
  audio: Music,
  pdf: FileText,
  url: Link,
};

const MEDIA_COLORS = {
  image: '#06b6d4',
  video: '#8b5cf6',
  audio: '#f59e0b',
  pdf: '#22c55e',
  url: '#ef4444',
};

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function ScanHistory() {
  const { state, dispatch, toggleHistory } = useApp();
  const { historyOpen, scanHistory } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('ALL');

  if (!historyOpen) return null;

  // Filter scan records
  const filteredHistory = scanHistory.filter((item) => {
    const targetName = (item.filename || item.url || '').toLowerCase();
    const matchesSearch = targetName.includes(searchTerm.toLowerCase());
    
    const matchesVerdict = verdictFilter === 'ALL' ||
      (verdictFilter === 'SYNTHETIC' && (item.verdict === 'DEEPFAKE_DETECTED' || item.verdict === 'PHISHING_DETECTED')) ||
      item.verdict === verdictFilter;

    return matchesSearch && matchesVerdict;
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={toggleHistory}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col glass-strong border-l border-slate-700/50 animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <History size={18} className="text-cyan-400" />
            <h2 className="font-bold text-slate-200">Scan History</h2>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full">
              {filteredHistory.length}
            </span>
          </div>
          <button
            onClick={toggleHistory}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Search & Filter Section */}
        <div className="p-4 border-b border-slate-900 bg-slate-950/20 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search history..."
              className="cyber-input pl-9 pr-4 py-1 text-xs"
            />
          </div>

          {/* Verdict Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            <span className="text-slate-500 flex items-center gap-1"><SlidersHorizontal size={10} /> Filter:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'AUTHENTIC', label: 'Authentic' },
              { id: 'SUSPICIOUS', label: 'Suspicious' },
              { id: 'SYNTHETIC', label: 'Synthetic/Threat' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setVerdictFilter(v.id)}
                className={`px-2 py-0.5 rounded transition-all ${
                  verdictFilter === v.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-900/50 text-slate-500 border border-transparent'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <History size={40} className="text-slate-700 mb-4" />
              <p className="text-xs font-semibold text-slate-500">No matching scans found</p>
            </div>
          ) : (
            filteredHistory.map((item, idx) => {
              const Icon = MEDIA_ICONS[item.media_type] || FileText;
              const color = MEDIA_COLORS[item.media_type] || '#06b6d4';

              return (
                <div
                  key={item.id || idx}
                  className="glass rounded-xl p-4 card-hover animate-fade-in-up"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                    >
                      <Icon size={16} style={{ color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-200 truncate">
                          {item.filename || item.url || 'Unknown'}
                        </p>
                        <span className="text-[10px] text-slate-600 flex-shrink-0">{timeAgo(item.timestamp)}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <StatusBadge verdict={item.verdict} size="sm" />
                        <span className="text-xs text-slate-500">{item.confidence?.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {scanHistory.length > 0 && (
          <div className="p-4 border-t border-slate-700/50">
            <button
              onClick={() => dispatch({ type: ACTIONS.SET_HISTORY, payload: [] })}
              className="w-full btn-ghost text-xs flex items-center justify-center gap-2 text-red-400 border-red-500/20 hover:bg-red-500/10"
            >
              <RotateCcw size={13} />
              Clear History Workspace
            </button>
          </div>
        )}
      </div>
    </>
  );
}

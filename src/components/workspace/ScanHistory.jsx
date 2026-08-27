import React, { useEffect, useState } from 'react';
import { X, History, Image, Video, Music, FileText, Link, RotateCcw, Search, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { useApp, ACTIONS } from '../../context/AppContext';
import { getScanHistory, MOCK_HISTORY } from '../../api/scanApi';

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

export default function ScanHistory() {
  const { state, dispatch, toggleHistory } = useApp();
  const { historyOpen, scanHistory } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch scan history from backend or load mock fallback upon drawer mount
  useEffect(() => {
    async function loadHistory() {
      if (!historyOpen) return;
      setIsLoading(true);
      setError(null);
      try {
        let data = await getScanHistory();
        if (!data || data.length === 0) {
          data = MOCK_HISTORY;
        }
        dispatch({ type: ACTIONS.SET_HISTORY, payload: data });
      } catch (err) {
        console.warn('Failed to load database scan history, using mock fallback:', err.message);
        setError('Database offline. Loaded mock records.');
        if (!scanHistory || scanHistory.length === 0) {
          dispatch({ type: ACTIONS.SET_HISTORY, payload: MOCK_HISTORY });
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadHistory();
  }, [historyOpen, dispatch]);

  if (!historyOpen) return null;

  // Filter scan records based on search and verdict filters
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
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={toggleHistory}
      />

      {/* Drawer Container (Expanded width to max-w-2xl for clean table display) */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-2xl z-50 flex flex-col glass-strong border-l border-slate-700/50 animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <History size={18} className="text-cyan-400" />
            <h2 className="font-bold text-slate-200">Forensic Scan History</h2>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">
              {filteredHistory.length}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {isLoading && (
              <RefreshCw size={14} className="text-cyan-400 animate-spin" />
            )}
            <button
              onClick={toggleHistory}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Search & Filter Section */}
        <div className="p-4 border-b border-slate-900 bg-slate-950/20 space-y-3">
          <div className="flex gap-3">
            {/* Search bar */}
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search history by name or link..."
                className="cyber-input pl-9 pr-4 py-1.5 text-xs"
              />
            </div>
            
            {/* Verdict Filter pills */}
            <div className="flex items-center gap-1.5 text-[10px]">
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
                  className={`px-2.5 py-1 rounded transition-all font-bold ${
                    verdictFilter === v.id ? 'bg-cyan-500/25 text-cyan-400 border border-cyan-500/40 shadow-sm' : 'bg-slate-900/60 text-slate-400 border border-transparent'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          
          {error && (
            <p className="text-[10px] text-amber-400 font-semibold bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">{error}</p>
          )}
        </div>

        {/* Tabular List container */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <History size={40} className="text-slate-700 mb-4" />
              <p className="text-xs font-semibold text-slate-500">No matching scans found</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-900/80 bg-slate-950/10">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] uppercase bg-slate-950/80 text-slate-500 border-b border-slate-900/80">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Scan ID</th>
                    <th className="px-4 py-3 font-semibold">Source Target</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Risk Score</th>
                    <th className="px-4 py-3 font-semibold">Trust Verdict</th>
                    <th className="px-4 py-3 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-950 bg-slate-900/5">
                  {filteredHistory.map((item, idx) => {
                    const Icon = MEDIA_ICONS[item.media_type] || FileText;
                    const color = MEDIA_COLORS[item.media_type] || '#06b6d4';
                    
                    // Style verdict badges color-coded
                    let verdictStyle = 'bg-slate-950 text-slate-400 border-slate-800';
                    if (item.verdict === 'AUTHENTIC' || item.verdict === 'CLEAN') {
                      verdictStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    } else if (item.verdict === 'SUSPICIOUS') {
                      verdictStyle = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
                    } else if (item.verdict === 'DEEPFAKE_DETECTED' || item.verdict === 'PHISHING_DETECTED') {
                      verdictStyle = 'bg-red-500/10 text-red-400 border-red-500/20';
                    }

                    const displayName = item.filename || item.url || 'Unknown';

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-900/20 transition-colors border-b border-slate-800/40 last:border-0">
                        <td className="px-4 py-3.5 font-mono text-[10px] text-slate-500">
                          {item.id ? item.id.substring(0, 8) : `scan-${idx}`}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-200 truncate max-w-[180px]" title={displayName}>
                          {displayName}
                        </td>
                        <td className="px-4 py-3.5">
                          <div
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] capitalize font-medium"
                            style={{ background: `${color}12`, border: `1px solid ${color}25` }}
                          >
                            <Icon size={10} style={{ color }} />
                            <span style={{ color }}>{item.media_type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-300">
                          {item.confidence ? `${item.confidence.toFixed(1)}%` : '0.0%'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${verdictStyle}`}>
                            {item.verdict ? item.verdict.replace('_', ' ') : 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 font-mono text-[10px]">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

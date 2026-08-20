import React, { useState } from 'react';
import { ClipboardList, CheckCircle2, XCircle, Image, Video, Music, Link, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const MEDIA_ICONS = {
  image: Image,
  video: Video,
  audio: Music,
  url: Link,
  pdf: FileText,
};

const MEDIA_COLORS = {
  image: '#06b6d4',
  video: '#8b5cf6',
  audio: '#f59e0b',
  url: '#ef4444',
  pdf: '#22c55e',
};

function ConfidenceBar({ value }) {
  const color = value > 60 ? '#f59e0b' : value > 50 ? '#06b6d4' : '#22c55e';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

const PAGE_SIZE = 5;

export default function AuditTable({ cases: initialCases = [] }) {
  const [cases, setCases] = useState(initialCases);
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(cases.length / PAGE_SIZE);
  const paginated = cases.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleAction = (id, action) => {
    setCases(prev => prev.map(c =>
      c.id === id
        ? { ...c, status: action === 'confirm' ? 'confirmed' : 'overridden' }
        : c
    ));
  };

  return (
    <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(6,182,212,0.1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-slate-200">Manual Review & Audit Portal</h3>
        </div>
        <span className="text-xs text-slate-500 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full">
          Borderline: 45%–65% confidence
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-5 py-3 text-slate-500 font-semibold uppercase tracking-wider">File / URL</th>
              <th className="text-left px-3 py-3 text-slate-500 font-semibold uppercase tracking-wider">Type</th>
              <th className="text-left px-3 py-3 text-slate-500 font-semibold uppercase tracking-wider">Confidence</th>
              <th className="text-left px-3 py-3 text-slate-500 font-semibold uppercase tracking-wider">Time</th>
              <th className="text-left px-3 py-3 text-slate-500 font-semibold uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3 text-slate-500 font-semibold uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-600">
                  No borderline cases to review
                </td>
              </tr>
            ) : (
              paginated.map((item, idx) => {
                const Icon = MEDIA_ICONS[item.media_type] || FileText;
                const color = MEDIA_COLORS[item.media_type] || '#06b6d4';
                const isPending = item.status === 'pending';

                return (
                  <tr
                    key={item.id}
                    className="table-row-hover border-b border-slate-800/60 last:border-0"
                  >
                    <td className="px-5 py-3">
                      <p className="text-slate-300 font-medium truncate max-w-xs">
                        {item.filename || item.url || 'Unknown'}
                      </p>
                      <p className="text-slate-600 font-mono mt-0.5">{item.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg capitalize"
                        style={{ background: `${color}12`, border: `1px solid ${color}25` }}
                      >
                        <Icon size={11} style={{ color }} />
                        <span style={{ color }}>{item.media_type}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <ConfidenceBar value={item.confidence} />
                    </td>
                    <td className="px-3 py-3 text-slate-500 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`
                          inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium capitalize
                          ${item.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : item.status === 'confirmed'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-green-500/10 text-green-400 border border-green-500/20'
                          }
                        `}
                      >
                        {item.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-blink" />}
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleAction(item.id, 'confirm')}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all duration-200 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                              title="Confirm as anomaly"
                            >
                              <CheckCircle2 size={11} /> Confirm
                            </button>
                            <button
                              onClick={() => handleAction(item.id, 'override')}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all duration-200 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                              title="Override as authentic"
                            >
                              <XCircle size={11} /> Override
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-600 italic">Reviewed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800">
          <span className="text-xs text-slate-600">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, cases.length)} of {cases.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

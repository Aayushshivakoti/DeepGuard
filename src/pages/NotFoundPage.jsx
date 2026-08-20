import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, Terminal, ArrowRight, ShieldAlert } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-mono"
      style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      {/* Cybersecurity animated background grid */}
      <div className="absolute inset-0 cyber-grid opacity-15 pointer-events-none" />
      <div className="absolute left-0 right-0 h-px bg-red-500/20 animate-scan-line pointer-events-none" />

      {/* Retro glowing visual elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full glass rounded-2xl p-8 border border-red-500/25 relative z-10 text-center space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.15)]">
        {/* Shield Alert Badge */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto animate-pulse">
          <ShieldAlert className="text-red-500" size={32} />
        </div>

        {/* Glitch error header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-red-500 tracking-tighter select-none animate-pulse">
            ERR_404
          </h1>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">
            Access Denied / Unmapped Route
          </p>
        </div>

        {/* Terminal logs */}
        <div className="bg-black/60 border border-slate-900 rounded-xl p-4 text-left text-[10px] space-y-1 text-slate-400 font-mono">
          <p className="text-red-400 font-bold flex items-center gap-1">
            <Terminal size={10} />
            <span>[SYS_ALERT] ROUTE EXCEPTION TRAP</span>
          </p>
          <p>Request: GET {window.location.pathname}</p>
          <p>IP Address: 127.0.0.1</p>
          <p>Firewall: DeepGuard-v3.1 Filter Rules</p>
          <p className="text-red-500/80 animate-blink">Status: CONNECTION_FAILED_UNRESOLVED_PATH</p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary w-full justify-center bg-red-500/10 hover:bg-red-500/25 text-red-400 border-red-500/30 hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] py-3 text-xs font-bold"
        >
          Return to Secure Dashboard
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

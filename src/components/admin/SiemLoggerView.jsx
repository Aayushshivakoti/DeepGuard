import React, { useState, useEffect } from 'react';
import { Terminal, ShieldCheck, Download, RefreshCw, FileText } from 'lucide-react';
import { exportSiemLogs } from '../../api/scanApi';
import { useToast } from '../../context/ToastContext';

export default function SiemLoggerView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await exportSiemLogs();
      setLogs(res.events || []);
    } catch (err) {
      console.warn("Failed to fetch SIEM logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyCef = (cefText) => {
    navigator.clipboard.writeText(cefText);
    addToast('CEF log string copied to clipboard.', 'info');
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 backdrop-blur-md flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Terminal className="text-cyan-400" size={20} />
            SIEM & Audit Log Integration (Syslog / CEF)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Exports cryptographic Common Event Format (CEF) logs with HMAC-SHA256 integrity signatures for Splunk, Datadog, or SIEM integration.
          </p>
        </div>

        <button 
          onClick={fetchLogs}
          className="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5"
        >
          <RefreshCw size={13} /> Refresh Logs
        </button>
      </div>

      {/* Terminal View */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950 font-mono text-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-slate-400">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Live CEF Syslog Stream
          </span>
          <span className="text-[10px] text-cyan-400">HMAC-SHA256 Standard</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Formatting CEF syslog stream...</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {logs.map((e, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5 text-[11px] hover:border-cyan-500/30 transition-colors">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-emerald-400 font-bold">HMAC: {e.hmac_sha256}</span>
                  <button 
                    onClick={() => copyCef(e.cef)}
                    className="text-[10px] text-slate-500 hover:text-cyan-400"
                  >
                    Copy String
                  </button>
                </div>
                <p className="text-slate-400 break-all leading-relaxed font-mono">{e.cef}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

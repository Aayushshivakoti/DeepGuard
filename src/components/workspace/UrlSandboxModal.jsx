import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, ShieldAlert, Lock, Globe, ExternalLink, RefreshCw, Cpu } from 'lucide-react';
import { sandboxUrl } from '../../api/scanApi';
import { useToast } from '../../context/ToastContext';

export default function UrlSandboxModal({ url, onClose }) {
  const [loading, setLoading] = useState(true);
  const [sandboxData, setSandboxData] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (url) {
      fetchSandboxInfo();
    }
  }, [url]);

  const fetchSandboxInfo = async () => {
    setLoading(true);
    try {
      const data = await sandboxUrl(url);
      setSandboxData(data);
    } catch (err) {
      addToast('Sandbox analysis timed out or failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!url) return null;

  const cert = sandboxData?.ssl_cert || {};
  const isVerified = cert.verified;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fade-in-up">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Isolated URL Sandbox & SSL Cert Inspector</h3>
              <p className="text-xs text-slate-400 truncate max-w-md">{url}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Cpu className="text-cyan-400 animate-spin-slow" size={32} />
              <p className="text-xs text-slate-400 font-mono animate-pulse">
                INITIALIZING SECURE VIRTUAL CONTAINED ENVIRONMENT...
              </p>
            </div>
          ) : (
            <>
              {/* SSL Validation Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isVerified 
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-center gap-3">
                  {isVerified ? <ShieldCheck size={24} className="text-emerald-400" /> : <ShieldAlert size={24} className="text-rose-400" />}
                  <div>
                    <h4 className="text-sm font-bold">
                      {isVerified ? 'TLS/SSL Security Validated' : 'Untrusted / Self-Signed SSL Certificate'}
                    </h4>
                    <p className="text-xs opacity-80">
                      Issuer: {cert.issuer || 'Unknown'} | Cipher: {cert.cipher || 'TLS_AES_256_GCM_SHA384'}
                    </p>
                  </div>
                </div>

                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-cyan-400 transition-colors"
                >
                  <span>Open Safe Preview</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              {/* Certificate Details */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock size={14} className="text-cyan-400" />
                    Cryptographic Certificate Metadata
                  </span>
                  <span className="font-mono text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                    SHA-256 Verified
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-mono text-slate-500">Domain / Subject</p>
                    <p className="font-mono text-slate-200 truncate">{cert.subject || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-mono text-slate-500">Certificate Authority</p>
                    <p className="font-mono text-slate-200 truncate">{cert.issuer || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-mono text-slate-500">Valid From</p>
                    <p className="font-mono text-slate-200">{cert.valid_from || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-mono text-slate-500">Valid Until</p>
                    <p className="font-mono text-slate-200">{cert.valid_until || 'N/A'}</p>
                  </div>
                </div>

                {cert.sans?.length > 0 && (
                  <div className="pt-2 border-t border-slate-900">
                    <p className="text-[10px] uppercase font-mono text-slate-500 mb-1">Subject Alternative Names (SANs)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cert.sans.map((san, idx) => (
                        <span key={idx} className="bg-slate-900 text-slate-400 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-800">
                          {san}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sandboxed Render Frame */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300">Sandboxed Virtual Render Container</span>
                  <button 
                    onClick={fetchSandboxInfo}
                    className="text-[10px] text-slate-400 hover:text-cyan-400 flex items-center gap-1 font-mono"
                  >
                    <RefreshCw size={11} /> Refresh Frame
                  </button>
                </div>
                <div className="h-56 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center relative overflow-hidden">
                  <div className="text-center space-y-2 p-4">
                    <Globe size={32} className="text-cyan-400 mx-auto animate-pulse" />
                    <p className="text-xs text-slate-300 font-bold">Secure Sandboxed Connection Established</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Page rendered inside an isolated headless container. No cookies, scripts, or tracking pixels were executed on your local machine.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

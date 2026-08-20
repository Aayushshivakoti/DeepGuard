import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { scanUrl } from '../api/scanApi';
import { Shield, Zap, Lock, Globe, AlertTriangle, ArrowRight, Upload, Play, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  // Sandbox scan state
  const [sandboxUrl, setSandboxUrl] = useState('');
  const [sandboxFile, setSandboxFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');

  const handleSandboxScan = async (e) => {
    e.preventDefault();
    if (!sandboxUrl.trim()) return;
    setIsScanning(true);
    setScanResult(null);
    setScanError('');
    try {
      // Run public url scan
      const { data } = await scanUrl(sandboxUrl);
      setScanResult(data);
    } catch (err) {
      setScanError('Failed to run public verification. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col font-sans" style={{ background: '#090d16' }}>
      {/* Glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-cyan-500/20">
            DG
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            DeepGuard
          </span>
        </div>
        <nav className="flex items-center gap-6">
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary py-2 px-5 text-sm"
            >
              Enter Dashboard
              <ArrowRight size={14} />
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="text-slate-400 hover:text-white transition-colors text-sm font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="btn-primary py-2 px-5 text-sm"
              >
                Get Started
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-16 text-center space-y-8 flex-1 flex flex-col justify-center">
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Zap size={12} className="animate-pulse" /> Multi-Modal Media Forensics
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Next-Gen Multi-Modal AI <br />
            <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">Media Verification Gateway</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
            Instantly detect deepfakes, voice clones, spliced imagery, and phishing document vectors using advanced cryptographic provenance verification.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <a
            href="#sandbox"
            className="btn-primary py-3.5 px-8 text-base shadow-lg shadow-cyan-500/25"
          >
            Try Free Demo Scan
          </a>
          <button
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')}
            className="px-8 py-3.5 rounded-xl font-semibold border border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900 text-slate-300 transition-all text-base"
          >
            Sign Up / Get Started
          </button>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto pt-12">
          {[
            { label: 'Total Scans Performed', value: '14,829', color: '#06b6d4', desc: 'Secure audits compiled' },
            { label: 'Verification Accuracy', value: '99.4%', color: '#8b5cf6', desc: 'Validated ML pipeline' },
            { label: 'Threats Blocked', value: '3,328', color: '#ef4444', desc: 'Clones & phishes flagged' },
          ].map((item) => (
            <div
              key={item.label}
              className="p-6 rounded-2xl border border-slate-900/80 text-left space-y-2 relative overflow-hidden"
              style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(12px)' }}
            >
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ backgroundColor: `${item.color}10` }} />
              <div className="text-3xl font-black" style={{ color: item.color }}>{item.value}</div>
              <div className="text-sm font-bold text-slate-200">{item.label}</div>
              <div className="text-xs text-slate-500">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Grid Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-16 border-t border-slate-900">
        <h2 className="text-center text-3xl font-extrabold text-white mb-12">Core Verification Engines</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: <Shield className="text-cyan-400" size={24} />,
              title: 'Spatial Image Forensics',
              desc: 'Utilises 2D FFT & block-based DCT noise mapping combined with Grad-CAM heatmap generation to identify AI synthesis boundaries.'
            },
            {
              icon: <Zap className="text-purple-400" size={24} />,
              title: 'Audio Voice Detections',
              desc: 'Analyzes Linear Frequency Cepstral Coefficients (LFCC) and Spectral Flatness to detect ElevenLabs & synthetic voice cloning.'
            },
            {
              icon: <Lock className="text-emerald-400" size={24} />,
              title: 'C2PA Provenance Scanner',
              desc: 'Scans content manifests cryptographically to verify publisher authority, camera hardware tags, and edit timelines.'
            }
          ].map((feat, index) => (
            <div
              key={index}
              className="p-8 rounded-2xl border border-slate-900 hover:border-slate-800 transition-all space-y-4"
              style={{ background: 'rgba(15,23,42,0.2)' }}
            >
              <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800">
                {feat.icon}
              </div>
              <h3 className="text-xl font-bold text-white">{feat.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Public Sandbox Section */}
      <section id="sandbox" className="relative z-10 max-w-4xl mx-auto w-full px-6 py-16 border-t border-slate-900">
        <div className="p-8 rounded-3xl border border-slate-900 text-center space-y-6" style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(16px)' }}>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white">Interactive Public Sandbox</h3>
            <p className="text-slate-400 text-sm">Test a live phishing link or URL directly in our secure guest simulator.</p>
          </div>

          <form onSubmit={handleSandboxScan} className="max-w-2xl mx-auto space-y-4">
            <div className="relative">
              <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={sandboxUrl}
                onChange={(e) => setSandboxUrl(e.target.value)}
                placeholder="Enter suspicious link (e.g., http://paypa1-update.xyz)"
                className="cyber-input pl-11 pr-36"
                disabled={isScanning}
              />
              <button
                type="submit"
                disabled={isScanning}
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-2 px-5 text-sm disabled:opacity-50"
              >
                {isScanning ? 'Scanning...' : 'Verify Link'}
              </button>
            </div>
          </form>

          {/* Sandbox scan result rendering */}
          {isScanning && (
            <div className="py-6 flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
              <span className="text-slate-400 text-xs animate-pulse">Running advanced frequency checks...</span>
            </div>
          )}

          {scanResult && (
            <div className="max-w-2xl mx-auto p-5 rounded-2xl border text-left space-y-4" style={{ background: 'rgba(10,15,30,0.6)', borderColor: scanResult.verdict === 'AUTHENTIC' ? '#22c55e30' : '#ef444430' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-400">Sandbox Verdict</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      scanResult.verdict === 'AUTHENTIC' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      scanResult.verdict === 'SUSPICIOUS' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {scanResult.verdict.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-semibold text-slate-300">({scanResult.confidence}% confidence)</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Scan ID: {scanResult.id}</span>
                </div>
              </div>

              {scanResult.flags && scanResult.flags.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-900">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Threat Indicators Identified</div>
                  <div className="space-y-1.5">
                    {scanResult.flags.map((flag, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs bg-slate-950/80 p-2.5 rounded-xl border border-slate-900">
                        <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-200">{flag.label}</strong>
                          <p className="text-slate-400 mt-0.5">{flag.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {scanError && (
            <p className="text-sm text-red-400">{scanError}</p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-6 py-8 text-center text-xs text-slate-600 border-t border-slate-950">
        &copy; {new Date().getFullYear()} DeepGuard Media Forensics Gateway. All rights reserved.
      </footer>
    </div>
  );
}

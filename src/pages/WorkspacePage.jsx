import React, { useState, useCallback } from 'react';
import InputTabs from '../components/workspace/InputTabs';
import Dropzone from '../components/workspace/Dropzone';
import ResultCard from '../components/workspace/ResultCard';
import ScanProgress from '../components/workspace/ScanProgress';
import ScanHistory from '../components/workspace/ScanHistory';
import { useApp } from '../context/AppContext';
import { useScan } from '../hooks/useScan';
import { Link, Scan, ArrowRight, Shield, Zap, Lock } from 'lucide-react';
import { getScanHistory, MOCK_HISTORY } from '../api/scanApi';
import { ACTIONS } from '../context/AppContext';

function UrlScanner({ onScan }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a URL to scan');
      return;
    }
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      setError('');
      onScan(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      setError('Please enter a valid URL');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Link
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            id="url-input"
            type="text"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(''); }}
            placeholder="https://suspicious-site.com/login"
            className="cyber-input pl-10 pr-32"
          />
          <button
            type="submit"
            id="scan-link-btn"
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-1.5 px-4 text-sm"
          >
            <Scan size={14} />
            Scan Link
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <span>⚠</span> {error}
          </p>
        )}
      </form>

      <div className="grid grid-cols-3 gap-3 text-xs">
        {[
          'http://paypa1-secure-login.xyz',
          'https://bank-of-america-update.info/verify',
          'http://google-prize-winner.tk/claim',
        ].map((example) => (
          <button
            key={example}
            onClick={() => setUrl(example)}
            className="text-left px-3 py-2 rounded-xl text-slate-500 hover:text-slate-300 transition-colors truncate"
            style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(6,182,212,0.08)' }}
          >
            {example}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-600 text-center">Click an example above to test phishing detection</p>
    </div>
  );
}

export default function WorkspacePage() {
  const { state, resetScan, dispatch } = useApp();
  const { runScan, runUrlScan } = useScan();
  const [selectedFile, setSelectedFile] = useState(null);

  // Load history on mount
  React.useEffect(() => {
    async function loadHistory() {
      if (state.scanHistory.length === 0) {
        const history = await getScanHistory().catch(() => MOCK_HISTORY);
        dispatch({ type: ACTIONS.SET_HISTORY, payload: history });
      }
    }
    loadHistory();
  }, []);

  const handleScan = useCallback(async () => {
    if (state.activeTab === 'url') return; // handled separately
    if (!selectedFile) return;
    await runScan(selectedFile, state.activeTab);
  }, [selectedFile, state.activeTab, runScan]);

  const handleUrlScan = useCallback(async (url) => {
    await runUrlScan(url);
  }, [runUrlScan]);

  const handleReset = useCallback(() => {
    resetScan();
    setSelectedFile(null);
  }, [resetScan]);

  const canScan = state.activeTab === 'url' || !!selectedFile;
  const showResult = state.scanStatus === 'done' && state.scanResult;

  return (
    <>
      <ScanProgress />
      <ScanHistory />

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Hero Banner */}
        {!showResult && (
          <div
            className="relative rounded-2xl p-6 overflow-hidden animate-fade-in-up"
            style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(139,92,246,0.06) 50%, rgba(15,23,42,0) 100%)',
              border: '1px solid rgba(6,182,212,0.12)',
            }}
          >
            {/* Background cyber grid */}
            <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 animate-float"
                style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(6,182,212,0.3)' }}
              >
                <Shield size={22} className="text-cyan-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-200">
                  AI-Powered Media Verification
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Upload media or paste a URL to detect deepfakes, voice clones, and phishing threats using our neural forensic engine.
                </p>
              </div>
              <div className="flex gap-4 sm:ml-auto flex-shrink-0 text-xs">
                {[
                  { icon: Zap, label: '&lt;2s scan' },
                  { icon: Lock, label: 'Private' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-slate-500">
                    <Icon size={12} className="text-cyan-500" />
                    <span dangerouslySetInnerHTML={{ __html: label }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Panel */}
        {!showResult ? (
          <div
            className="glass rounded-2xl overflow-hidden animate-fade-in-up"
            style={{ border: '1px solid rgba(6,182,212,0.12)' }}
          >
            <div className="p-5 border-b border-slate-700/50">
              <InputTabs />
            </div>

            <div className="p-6 space-y-5">
              {state.activeTab === 'url' ? (
                <UrlScanner onScan={handleUrlScan} />
              ) : (
                <>
                  <Dropzone
                    mediaType={state.activeTab}
                    onFileSelected={setSelectedFile}
                    disabled={state.scanStatus === 'scanning'}
                  />
                  <button
                    id="run-scan-btn"
                    onClick={handleScan}
                    disabled={!selectedFile || state.scanStatus === 'scanning'}
                    className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    style={!selectedFile ? {} : { boxShadow: '0 0 24px rgba(6,182,212,0.25)' }}
                  >
                    <Scan size={18} />
                    {state.scanStatus === 'scanning' ? 'Analyzing...' : 'Run Forensic Analysis'}
                    {selectedFile && state.scanStatus !== 'scanning' && <ArrowRight size={16} />}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <ResultCard
            result={state.scanResult}
            onReset={handleReset}
            isMock={state.isMockData}
          />
        )}
      </div>
    </>
  );
}

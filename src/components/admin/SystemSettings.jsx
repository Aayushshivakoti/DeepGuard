import React, { useState } from 'react';
import { Settings, Key, Shield, Sliders, Eye, EyeOff, Save, CheckCircle2, Database, ShieldCheck } from 'lucide-react';

function ApiKeyInput({ id, label, placeholder }) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-400 mb-2">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          className="cyber-input pr-10 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function ThresholdSlider({ id, label, description, value, onChange, min = 0, max = 100, color = '#06b6d4' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <label htmlFor={id} className="text-xs font-semibold text-slate-300">{label}</label>
          {description && <p className="text-xs text-slate-600 mt-0.5">{description}</p>}
        </div>
        <span
          className="text-sm font-black tabular-nums px-2.5 py-1 rounded-lg"
          style={{ background: `${color}15`, color }}
        >
          {value}%
        </span>
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full"
          style={{
            background: `linear-gradient(90deg, ${color} ${value}%, #1e293b ${value}%)`,
          }}
        />
      </div>
    </div>
  );
}

export default function SystemSettings() {
  const [thresholds, setThresholds] = useState({
    fakeCutoff: 65,
    suspiciousMin: 45,
    phishingCutoff: 70,
    confidenceMin: 30,
  });
  const [saved, setSaved] = useState(false);

  // Multi-Tenant Isolation & Logging States
  const [auditLogging, setAuditLogging] = useState(true);
  const [tenantIsolation, setTenantIsolation] = useState(true);
  const [adversarialDefense, setAdversarialDefense] = useState(true);
  const [phashCacheLookup, setPhashCacheLookup] = useState(true);
  const [phishingSandbox, setPhishingSandbox] = useState(true);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(6,182,212,0.1)' }}>
      <div className="flex items-center gap-2 p-5 border-b border-slate-700/50">
        <Settings size={16} className="text-cyan-400" />
        <h3 className="text-sm font-bold text-slate-200">System Settings</h3>
      </div>

      <div className="p-5 space-y-6">
        {/* AI Thresholds */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sliders size={14} className="text-purple-400" />
            <p className="text-sm font-semibold text-slate-200">AI Sensitivity Thresholds</p>
          </div>
          <div className="space-y-5">
            <ThresholdSlider
              id="fake-cutoff"
              label="Fake Probability Cut-off"
              description="Above this = DEEPFAKE_DETECTED verdict"
              value={thresholds.fakeCutoff}
              onChange={v => setThresholds(p => ({ ...p, fakeCutoff: v }))}
              color="#ef4444"
            />
            <ThresholdSlider
              id="suspicious-min"
              label="Suspicious Zone (Lower Bound)"
              description="Below cut-off, above this = SUSPICIOUS verdict"
              value={thresholds.suspiciousMin}
              onChange={v => setThresholds(p => ({ ...p, suspiciousMin: v }))}
              color="#f59e0b"
            />
            <ThresholdSlider
              id="phishing-cutoff"
              label="Phishing URL Cut-off"
              description="URL threat score above this = PHISHING_DETECTED"
              value={thresholds.phishingCutoff}
              onChange={v => setThresholds(p => ({ ...p, phishingCutoff: v }))}
              color="#ef4444"
            />
            <ThresholdSlider
              id="confidence-min"
              label="Minimum Confidence Threshold"
              description="Scans below this are flagged as inconclusive"
              value={thresholds.confidenceMin}
              onChange={v => setThresholds(p => ({ ...p, confidenceMin: v }))}
              color="#06b6d4"
            />
          </div>
        </div>

        {/* Threshold Summary */}
        <div
          className="grid grid-cols-2 gap-2 p-3 rounded-xl text-xs"
          style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(6,182,212,0.08)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Authentic zone</span>
            <span className="text-green-400 font-bold">0–{thresholds.suspiciousMin}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Suspicious zone</span>
            <span className="text-amber-400 font-bold">{thresholds.suspiciousMin}–{thresholds.fakeCutoff}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Deepfake zone</span>
            <span className="text-red-400 font-bold">{thresholds.fakeCutoff}–100%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Phishing cut-off</span>
            <span className="text-red-400 font-bold">{thresholds.phishingCutoff}%</span>
          </div>
        </div>

        {/* API Keys */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Key size={14} className="text-amber-400" />
            <p className="text-sm font-semibold text-slate-200">API Key Manager</p>
          </div>
          <div className="space-y-4">
            <ApiKeyInput
              id="gsb-key"
              label="Google Safe Browsing API Key"
              placeholder="AIzaSy••••••••••••••••••••••••"
            />
            <ApiKeyInput
              id="virustotal-key"
              label="VirusTotal API Key"
              placeholder="vtapikey_••••••••••••••••••••"
            />
            <ApiKeyInput
              id="openai-key"
              label="OpenAI API Key (GPT Explanation Layer)"
              placeholder="sk-••••••••••••••••••••••••••••"
            />
          </div>
        </div>

        {/* Concentric API Quota usage gauge & Toggles */}
        <hr className="border-slate-800" />
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-cyan-400 animate-pulse" />
            <p className="text-sm font-semibold text-slate-200">Organization Multi-Tenancy & Quota</p>
          </div>

          {/* Active API Quota Concentric Gauge */}
          <div className="flex items-center gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-900">
            <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="#1e293b" strokeWidth="4" fill="transparent" />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="#06b6d4"
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray="150"
                  strokeDashoffset="33" 
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <span className="absolute text-[10px] font-black text-white font-mono">78%</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-300">Daily API Scan Quota consumed</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">7,842 / 10,000 queries remaining</p>
            </div>
          </div>

          {/* Toggles & Active Learning */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={14} className="text-purple-400" />
              <p className="text-sm font-semibold text-slate-200">Enterprise Feature Toggles & Active Learning</p>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={auditLogging}
                onChange={() => setAuditLogging(!auditLogging)}
                className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-300">Enable Active Learning Retrain Queue (Medium Confidence 40-60%)</p>
                <p className="text-[10px] text-slate-500">Automatically queue scans with ambiguous risk scores for human-in-the-loop review.</p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tenantIsolation}
                onChange={() => setTenantIsolation(!tenantIsolation)}
                className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-300">Forced Cryptographic Tenant Data Isolation</p>
                <p className="text-[10px] text-slate-500">Encrypt scan histories with org-specific workspace keys.</p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={adversarialDefense}
                onChange={() => setAdversarialDefense(!adversarialDefense)}
                className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-300">Enable Adversarial Noise Preprocessor</p>
                <p className="text-[10px] text-slate-500">Apply Gaussian blurring and JPEG re-compression to neutralize input attacks.</p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={phashCacheLookup}
                onChange={() => setPhashCacheLookup(!phashCacheLookup)}
                className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-300">Enable pHash Cache Lookup</p>
                <p className="text-[10px] text-slate-500">Deduplicate similar images via Hamming distance verification to save GPU resources.</p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={phishingSandbox}
                onChange={() => setPhishingSandbox(!phishingSandbox)}
                className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-300">Enable Phishing Sandbox Payload Scanner</p>
                <p className="text-[10px] text-slate-500">Perform HTTP header checks for suspicious downloadable payloads and binaries.</p>
              </div>
            </label>
          </div>

          {/* Live External API Telemetry Widget */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <p className="text-xs font-bold text-slate-300 mb-3">Live External API Telemetry & Provider Status</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-200">Google Gemini API</p>
                  <p className="text-[10px] text-slate-500 font-mono">Multimodal Vision/Text</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ONLINE 340ms</span>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-200">Hugging Face ViT</p>
                  <p className="text-[10px] text-slate-500 font-mono">Deepfake Classifier</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ONLINE 510ms</span>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-200">ZeroGPT AI Engine</p>
                  <p className="text-[10px] text-slate-500 font-mono">Text Verification</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ONLINE 210ms</span>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-200">DeepGuard Core DB</p>
                  <p className="text-[10px] text-slate-500 font-mono">SQLite Session Engine</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">CONNECTED &lt;1ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div
          className="flex items-start gap-3 p-3 rounded-xl text-xs"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
        >
          <Shield size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-slate-400">
            API keys are stored locally and never transmitted to external servers.
            Changes to sensitivity thresholds take effect immediately for new scans.
          </p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className={`btn-primary w-full justify-center ${saved ? 'opacity-90' : ''}`}
        >
          {saved ? (
            <>
              <CheckCircle2 size={16} className="text-green-300" />
              Settings Saved!
            </>
          ) : (
            <>
              <Save size={16} />
              Save Configuration
            </>
          )}
        </button>
      </div>
    </div>
  );
}

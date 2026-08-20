import React, { useState } from 'react';
import { Settings, Key, Shield, Sliders, Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react';

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

import React, { useState } from 'react';
import { ShieldAlert, Zap, ToggleLeft, ToggleRight, CheckCircle2, CloudLightning } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function SoarPlaybooks() {
  const [playbooks, setPlaybooks] = useState([
    { id: 'sb-01', name: 'Auto-Block Phishing URLs (>90% Risk)', target: 'AWS WAF / Cloudflare', enabled: true },
    { id: 'sb-02', name: 'Quarantine Synthetic Audio Voice Clones', target: 'SIP Gateway', enabled: true },
    { id: 'sb-03', name: 'Dispatch High Severity Telegram Alert', target: 'Security Operations Channel', enabled: false },
  ]);
  const { addToast } = useToast();

  const togglePlaybook = (id) => {
    setPlaybooks(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
    addToast('SOAR playbook policy updated.', 'info');
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="p-6 rounded-2xl border border-purple-500/30 bg-purple-950/20 backdrop-blur-md flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-purple-300 flex items-center gap-2">
            <Zap size={20} className="text-purple-400" />
            SOAR Automation Playbooks & Firewall Rules
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Automated threat mitigation rules that inject firewall block policies on AWS WAF / Cloudflare when high-risk deepfakes or phishing links are detected.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {playbooks.map(p => (
          <div key={p.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <CloudLightning size={20} className={p.enabled ? 'text-purple-400' : 'text-slate-600'} />
              <div>
                <p className="font-bold text-slate-200">{p.name}</p>
                <p className="text-[10px] text-slate-500 font-mono">Target Integration: {p.target}</p>
              </div>
            </div>

            <button onClick={() => togglePlaybook(p.id)} className="text-purple-400">
              {p.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-slate-600" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

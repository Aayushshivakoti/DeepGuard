import React, { useState } from 'react';
import { SlidersHorizontal, CheckCircle2, Shield } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function UserQuotas() {
  const [users, setUsers] = useState([
    { id: 'u-1', email: 'test@example.com', tier: 'FREE', dailyScans: 50, maxMb: 10 },
    { id: 'u-2', email: 'enterprise-client@bank.com', tier: 'ENTERPRISE', dailyScans: 50000, maxMb: 1000 },
  ]);
  const { addToast } = useToast();

  const handleUpgrade = (id, newTier) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, tier: newTier } : u));
    addToast(`User quota updated to ${newTier}`, 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 backdrop-blur-md flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="text-cyan-400" size={20} />
            User Quota Governance & Tiered Limits
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Enforce daily scan volume limits, maximum media upload sizes (MB), and concurrent API request quotas.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="p-4 rounded-2xl border border-slate-900 bg-slate-900/30 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-200">{u.email}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Daily Limit: {u.dailyScans} Scans | Max File: {u.maxMb} MB
              </p>
            </div>

            <div className="flex items-center gap-2">
              {['FREE', 'PRO', 'ENTERPRISE'].map(t => (
                <button
                  key={t}
                  onClick={() => handleUpgrade(u.id, t)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                    u.tier === t
                      ? 'bg-cyan-500 text-slate-950 border border-cyan-400'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

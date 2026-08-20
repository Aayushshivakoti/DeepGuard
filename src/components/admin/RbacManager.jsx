import React, { useState, useEffect } from 'react';
import { Key, Shield, Plus, CheckCircle2, Copy, Trash2, Lock } from 'lucide-react';
import { getRbacRoles, issueApiKey } from '../../api/scanApi';
import { useToast } from '../../context/ToastContext';

export default function RbacManager() {
  const [roles, setRoles] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tokenName, setTokenName] = useState('');
  const [selectedRole, setSelectedRole] = useState('API_CONSUMER');
  const [rateLimit, setRateLimit] = useState(100);
  const { addToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getRbacRoles();
      setRoles(res.roles || []);
    } catch (err) {
      console.warn("Failed to fetch RBAC roles:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueKey = async (e) => {
    e.preventDefault();
    try {
      const newKey = await issueApiKey({
        name: tokenName || 'Production API Token',
        role: selectedRole,
        rate_limit_rpm: Number(rateLimit),
      });
      setKeys(prev => [newKey, ...prev]);
      addToast('API Key issued successfully.', 'success');
      setTokenName('');
    } catch (err) {
      addToast('Failed to issue API key.', 'error');
    }
  };

  const copyKey = (keyId) => {
    navigator.clipboard.writeText(keyId);
    addToast('API Key copied to clipboard.', 'info');
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 backdrop-blur-md flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Key className="text-cyan-400" size={20} />
            Granular RBAC & Developer API Key Management
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Enforce role-based access controls and manage production API credentials with custom quota rate limits.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role Matrix */}
        <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-md space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Shield size={14} className="text-cyan-400" />
            System Roles
          </h4>

          <div className="space-y-3 text-xs">
            {roles.map((r, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-400 font-mono">{r.name}</span>
                  <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{r.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Key Issuance & Token List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Token Issuer Form */}
          <form onSubmit={handleIssueKey} className="p-6 rounded-2xl border border-cyan-500/30 bg-slate-900/50 backdrop-blur-md space-y-4 text-xs">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Issue New API Credentials</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 mb-1">Token Name</label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={e => setTokenName(e.target.value)}
                  placeholder="e.g. Mobile App Gateway"
                  required
                  className="cyber-input py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Assigned Role</label>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="cyber-input py-2 text-xs bg-slate-950"
                >
                  <option value="API_CONSUMER">API_CONSUMER</option>
                  <option value="FORENSIC_ANALYST">FORENSIC_ANALYST</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Rate Limit (RPM)</label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={e => setRateLimit(e.target.value)}
                  min="10"
                  max="1000"
                  className="cyber-input py-2 text-xs"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary py-2 px-6 font-bold text-xs">
              <Plus size={14} />
              Generate API Token
            </button>
          </form>

          {/* Issued Keys Table */}
          <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-md space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Issued Active API Keys</h4>

            {keys.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono py-4 text-center">No developer tokens issued yet.</p>
            ) : (
              <div className="space-y-2">
                {keys.map(k => (
                  <div key={k.key_id} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{k.name}</span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                          {k.role}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-slate-400 mt-1 truncate">{k.key_id}</p>
                    </div>

                    <button
                      onClick={() => copyKey(k.key_id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                      title="Copy Key"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

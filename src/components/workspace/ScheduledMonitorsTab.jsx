import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Globe, Mail, Bell, Clock, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { getMonitors, createMonitor, deleteMonitor } from '../../api/scanApi';
import { useToast } from '../../context/ToastContext';

export default function ScheduledMonitorsTab() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [frequency, setFrequency] = useState('DAILY');
  const [targetEmail, setTargetEmail] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    fetchMonitors();
  }, []);

  const fetchMonitors = async () => {
    setLoading(true);
    try {
      const data = await getMonitors();
      setMonitors(data || []);
    } catch (err) {
      console.warn("Failed to fetch monitors:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!targetUrl) return;

    try {
      const newMon = await createMonitor({
        url_or_domain: targetUrl,
        frequency,
        target_email: targetEmail || null,
        webhook_url: webhookUrl || null,
      });
      setMonitors(prev => [newMon, ...prev]);
      addToast('Scheduled threat monitor created successfully.', 'success');
      setTargetUrl('');
      setTargetEmail('');
      setWebhookUrl('');
      setShowAddForm(false);
    } catch (err) {
      addToast('Failed to create monitor.', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMonitor(id);
      setMonitors(prev => prev.filter(m => m.id !== id));
      addToast('Scheduled monitor removed.', 'info');
    } catch (err) {
      addToast('Failed to remove monitor.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="text-cyan-400" size={20} />
            Automated Scheduled Monitors & Webhooks
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Re-scans domains and social profiles automatically, triggering webhooks & email alerts when risk scores change.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary py-2 px-4 text-xs font-bold self-start sm:self-center"
        >
          <Plus size={14} />
          {showAddForm ? 'Cancel' : 'New Scheduled Monitor'}
        </button>
      </div>

      {/* Add Monitor Form */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="p-6 rounded-2xl border border-cyan-500/30 bg-slate-900/60 backdrop-blur-md space-y-4 animate-fade-in-up">
          <h4 className="text-sm font-bold text-cyan-400">Configure Target Monitor</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Target URL or Domain</label>
              <input
                type="text"
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="e.g. https://mybrand-login.com"
                required
                className="cyber-input py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Check Frequency</label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                className="cyber-input py-2 text-xs bg-slate-950"
              >
                <option value="HOURLY">Hourly (High Priority)</option>
                <option value="DAILY">Daily (Standard)</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Notification Email (Optional)</label>
              <input
                type="email"
                value={targetEmail}
                onChange={e => setTargetEmail(e.target.value)}
                placeholder="alert@company.com"
                className="cyber-input py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Webhook Dispatch URL (Optional)</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://api.company.com/webhooks/deepguard"
                className="cyber-input py-2 text-xs"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary py-2 px-6 text-xs font-bold">
            <CheckCircle2 size={14} />
            Activate Scheduled Monitor
          </button>
        </form>
      )}

      {/* Monitors List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">Loading scheduled monitors...</div>
        ) : monitors.length === 0 ? (
          <div className="p-8 rounded-2xl border border-slate-900 bg-slate-950/30 text-center space-y-2">
            <Clock size={28} className="text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-bold">No Active Scheduled Monitors</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Create a monitor to automatically watch suspicious domain endpoints and receive automated threat alerts.
            </p>
          </div>
        ) : (
          monitors.map(m => (
            <div key={m.id} className="p-4 rounded-2xl border border-slate-900 bg-slate-900/30 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Globe size={18} className="text-cyan-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-200 truncate">{m.url_or_domain}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {m.frequency} | Last Run: {m.last_run ? new Date(m.last_run).toLocaleString() : 'Just Now'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  {m.status}
                </span>

                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Send, Plus, Check, Play, Settings, AlertCircle, Trash } from 'lucide-react';
import { getWebhooks, configureWebhook, testWebhook } from '../../api/scanApi';
import { useToast } from '../../context/ToastContext';

export default function WebhookSettings() {
  const [webhooks, setWebhooks] = useState([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [threshold, setThreshold] = useState(80);
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState({});
  const { addToast } = useToast();

  const fetchWebhooks = async () => {
    const list = await getWebhooks();
    setWebhooks(list);
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!url.startsWith('http')) {
      addToast('Please enter a valid HTTP/HTTPS webhook URL', 'error');
      return;
    }
    setLoading(true);
    try {
      const newWh = await configureWebhook({ name: name || 'Custom Slack Webhook', url, threshold });
      addToast('Webhook target configured successfully', 'success');
      setWebhooks(prev => [...prev, newWh]);
      setName('');
      setUrl('');
    } catch (err) {
      addToast('Failed to save webhook configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (whId, targetUrl) => {
    setTestStatus(prev => ({ ...prev, [whId]: 'testing' }));
    try {
      const res = await testWebhook(targetUrl);
      if (res.status === 'success') {
        addToast('Webhook test payload sent successfully!', 'success');
        setTestStatus(prev => ({ ...prev, [whId]: 'success' }));
      } else {
        addToast(`Webhook test failed: ${res.message || 'connection error'}`, 'error');
        setTestStatus(prev => ({ ...prev, [whId]: 'failed' }));
      }
    } catch (err) {
      addToast('Failed to fire webhook test trigger', 'error');
      setTestStatus(prev => ({ ...prev, [whId]: 'failed' }));
    }
  };

  return (
    <div className="glass rounded-2xl overflow-hidden text-xs text-slate-300" style={{ border: '1px solid rgba(6,182,212,0.1)' }}>
      <div className="flex items-center gap-2 p-5 border-b border-slate-700/50">
        <Send size={16} className="text-cyan-400" />
        <h3 className="text-sm font-bold text-slate-200">Webhook Alert Integrations</h3>
      </div>

      <div className="p-5 space-y-6">
        {/* Create Webhook Form */}
        <form onSubmit={handleCreate} className="space-y-4 bg-slate-900/30 p-4 rounded-xl border border-slate-800">
          <p className="font-bold text-slate-200">Configure Incoming Webhook Target (Slack / MS Teams)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Friendly Name</label>
              <input 
                type="text" 
                placeholder="Slack Dev Alerts" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="cyber-input font-medium" 
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Webhook URL</label>
              <input 
                type="text" 
                placeholder="https://hooks.slack.com/services/..." 
                value={url} 
                onChange={e => setUrl(e.target.value)}
                required
                className="cyber-input font-mono" 
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-slate-400 font-semibold mb-1">Risk Trigger Threshold ({threshold}%)</label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={threshold} 
                onChange={e => setThreshold(Number(e.target.value))}
                className="w-full" 
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary py-2 px-4 flex items-center gap-1.5 self-end"
            >
              <Plus size={13} />
              Add Webhook
            </button>
          </div>
        </form>

        {/* Webhooks List */}
        <div className="space-y-3">
          <p className="font-bold text-slate-200">Active Webhook Alert Destinations</p>
          {webhooks.length === 0 ? (
            <div className="text-center py-6 text-slate-500 bg-slate-950/20 border border-slate-900 rounded-xl">
              No webhook targets configured. Critical threat logs are logged to DB only.
            </div>
          ) : (
            <div className="space-y-2.5">
              {webhooks.map((wh) => (
                <div key={wh.id} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-950/70 transition-all">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{wh.name}</span>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px]">
                        Trigger at &gt;= {wh.threshold}% Risk
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">{wh.url}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleTest(wh.id, wh.url)}
                      disabled={testStatus[wh.id] === 'testing'}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 ${
                        testStatus[wh.id] === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : testStatus[wh.id] === 'failed'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Play size={10} className={testStatus[wh.id] === 'testing' ? 'animate-pulse' : ''} />
                      {testStatus[wh.id] === 'testing' ? 'Testing...' : testStatus[wh.id] === 'success' ? 'Verified' : 'Fire Test Payload'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

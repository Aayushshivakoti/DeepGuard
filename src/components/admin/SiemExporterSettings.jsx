import React, { useState } from 'react';
import { Send, Server, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function SiemExporterSettings() {
  const [targetSiem, setTargetSiem] = useState('Splunk HEC');
  const [endpointUrl, setEndpointUrl] = useState('https://splunk-hec.company.com/services/collector');
  const [token, setToken] = useState('splk-live-token-884930');
  const { addToast } = useToast();

  const handleSave = (e) => {
    e.preventDefault();
    addToast(`SIEM Forwarder target saved: ${targetSiem}`, 'success');
  };

  return (
    <form onSubmit={handleSave} className="p-6 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-md space-y-4 text-xs animate-fade-in-up">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Server className="text-cyan-400" size={18} />
        Live SIEM Log Forwarding Configuration
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-400 mb-1">Target Collector Platform</label>
          <select
            value={targetSiem}
            onChange={e => setTargetSiem(e.target.value)}
            className="cyber-input py-2 text-xs bg-slate-950"
          >
            <option value="Splunk HEC">Splunk HEC (HTTP Event Collector)</option>
            <option value="Datadog Logs">Datadog Logs API</option>
            <option value="Microsoft Sentinel">Microsoft Sentinel / Azure Monitor</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Collector Endpoint URL</label>
          <input
            type="text"
            value={endpointUrl}
            onChange={e => setEndpointUrl(e.target.value)}
            className="cyber-input py-2 text-xs"
          />
        </div>
      </div>

      <div>
        <label className="block text-slate-400 mb-1">Bearer / Authorization Token</label>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          className="cyber-input py-2 text-xs"
        />
      </div>

      <button type="submit" className="btn-primary py-2 px-6 font-bold text-xs">
        <Send size={14} /> Save SIEM Stream Forwarder
      </button>
    </form>
  );
}

import React from 'react';
import { Activity, Cpu, Clock, AlertTriangle, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function Telemetry() {
  const telemetryData = [
    { time: '00:00', latency: 240, accuracy: 96.5, drift: 0.2 },
    { time: '04:00', latency: 210, accuracy: 97.1, drift: 0.1 },
    { time: '08:00', latency: 310, accuracy: 95.8, drift: 0.4 },
    { time: '12:00', latency: 280, accuracy: 96.9, drift: 0.3 },
    { time: '16:00', latency: 220, accuracy: 97.4, drift: 0.2 },
    { time: '20:00', latency: 195, accuracy: 98.0, drift: 0.1 },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 backdrop-blur-md flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity size={20} className="text-cyan-400" />
            Model Performance Telemetry & Detection Drift
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time inference latency telemetry, neural model accuracy metrics, and concept drift indicators.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
          <span className="text-slate-400 font-medium">Avg Inference Latency</span>
          <p className="text-xl font-black text-cyan-400 font-mono">242 ms</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
          <span className="text-slate-400 font-medium">Model Accuracy Baseline</span>
          <p className="text-xl font-black text-emerald-400 font-mono">97.2%</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
          <span className="text-slate-400 font-medium">Detection Drift Rate</span>
          <p className="text-xl font-black text-amber-400 font-mono">0.22%</p>
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-md space-y-4">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Inference Latency & Model Stability Telemetry</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={telemetryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
              <Area type="monotone" dataKey="latency" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

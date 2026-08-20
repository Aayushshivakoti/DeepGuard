import React, { useState, useEffect } from 'react';
import { Globe, ShieldAlert, TrendingUp, AlertTriangle } from 'lucide-react';
import { getThreatMap } from '../../api/scanApi';

export default function ThreatMap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await getThreatMap();
      setData(res);
    } catch (err) {
      console.warn("Failed to fetch threat map:", err);
    } finally {
      setLoading(false);
    }
  };

  const origins = data?.origins || [
    { country: 'United States', code: 'US', threat_count: 420 },
    { country: 'Germany', code: 'DE', threat_count: 185 },
    { country: 'United Kingdom', code: 'GB', threat_count: 210 },
    { country: 'Japan', code: 'JP', threat_count: 140 },
  ];

  const brands = data?.targeted_brands || [
    { brand: 'PayPal', scans: 340, phishing_rate: 88.5 },
    { brand: 'Bank of America', scans: 220, phishing_rate: 92.1 },
    { brand: 'Microsoft 365', scans: 190, phishing_rate: 84.0 },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 backdrop-blur-md flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Globe className="text-cyan-400" size={20} />
            Global Threat Map & Phishing Attack Trends
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time visualization of geographic attack origins, spoofed domains, and targeted enterprise brand profiles.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map / Origin Visualizer */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-md space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Geographic Threat Attack Origins</h4>

          {/* Interactive World Map Simulation Container */}
          <div className="h-72 rounded-xl border border-slate-800 bg-slate-950 relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
            
            {/* Country Nodes Simulation */}
            <div className="absolute top-1/3 left-1/4 flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[10px] font-mono text-rose-300 bg-slate-900 px-1.5 py-0.5 rounded border border-rose-500/30">
                US (420 Scans)
              </span>
            </div>

            <div className="absolute top-1/2 left-1/2 flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
              <span className="text-[10px] font-mono text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded border border-amber-500/30">
                DE (185 Scans)
              </span>
            </div>

            <div className="absolute top-2/3 right-1/4 flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[10px] font-mono text-rose-300 bg-slate-900 px-1.5 py-0.5 rounded border border-rose-500/30">
                JP (140 Scans)
              </span>
            </div>

            <span className="text-xs text-slate-500 font-mono">Live Geospatial Telemetry Grid</span>
          </div>

          {/* Country Origins Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {origins.map((o, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <p className="text-slate-400 font-medium">{o.country}</p>
                <p className="text-base font-black text-white font-mono mt-0.5">{o.threat_count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Targeted Brands */}
        <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-md space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={14} className="text-red-400" />
            Top Spoofed Brands
          </h4>

          <div className="space-y-3 text-xs">
            {brands.map((b, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{b.brand}</span>
                  <span className="font-mono text-red-400 font-bold">{b.phishing_rate}% Threat</span>
                </div>

                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full" 
                    style={{ width: `${b.phishing_rate}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-mono text-right">{b.scans} URL Scans</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

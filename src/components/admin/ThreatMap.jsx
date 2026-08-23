import React, { useState, useEffect, useRef } from 'react';
import { Globe, ShieldAlert, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getThreatMap } from '../../api/scanApi';

export default function ThreatMap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [arcs, setArcs] = useState([]);
  const socketRef = useRef(null);

  // Nodes configuration representing global city nodes for SVG mapping
  const cityNodes = {
    US: { name: 'New York, US', x: 120, y: 110, flag: '🇺🇸' },
    DE: { name: 'Frankfurt, DE', x: 260, y: 90, flag: '🇩🇪' },
    GB: { name: 'London, GB', x: 240, y: 85, flag: '🇬🇧' },
    JP: { name: 'Tokyo, JP', x: 420, y: 130, flag: '🇯🇵' },
    IN: { name: 'Mumbai, IN', x: 340, y: 180, flag: '🇮🇳' },
    BR: { name: 'São Paulo, BR', x: 180, y: 240, flag: '🇧🇷' },
    SG: { name: 'Singapore, SG', x: 380, y: 210, flag: '🇸🇬' },
    AU: { name: 'Sydney, AU', x: 450, y: 260, flag: '🇦🇺' },
    SERVER: { name: 'DeepGuard HQ', x: 280, y: 140, flag: '🛡️' }
  };

  useEffect(() => {
    fetchData();

    // Setup WebSockets Alerts Client
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:8000/api/v1/ws/alerts`;
    
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log('ThreatMap WebSocket connected');
    };

    socketRef.current.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleIncomingAlert(payload);
      } catch (err) {
        console.warn('Failed to parse WebSocket alert:', err);
      }
    };

    socketRef.current.onclose = () => {
      console.log('ThreatMap WebSocket disconnected');
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
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

  const handleIncomingAlert = (alert) => {
    // Determine random or specified origin location
    const countries = ['US', 'DE', 'GB', 'JP', 'IN', 'BR', 'SG', 'AU'];
    const originCode = alert.country_code || countries[Math.floor(Math.random() * countries.length)];
    const originNode = cityNodes[originCode];
    const targetNode = cityNodes.SERVER;

    if (originNode) {
      // 1. Generate live arc animation path
      const newArc = {
        id: `arc-${Date.now()}-${Math.random()}`,
        x1: originNode.x,
        y1: originNode.y,
        x2: targetNode.x,
        y2: targetNode.y,
        color: alert.severity === 'critical' ? '#ef4444' : '#f59e0b'
      };

      setArcs(prev => [...prev, newArc]);

      // 2. Add to live alert cards
      const newAlert = {
        id: `alert-${Date.now()}`,
        ip: alert.ip || `192.168.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`,
        country: originNode.name,
        flag: originNode.flag,
        threat_score: alert.confidence || alert.threat_score || 92.5,
        vector: alert.message || alert.media_type || 'Malicious URL Scan',
        severity: alert.severity || 'critical'
      };

      setLiveAlerts(prev => [newAlert, ...prev].slice(0, 4));

      // Auto-dismiss arc
      setTimeout(() => {
        setArcs(prev => prev.filter(a => a.id !== newArc.id));
      }, 2000);
    }
  };

  // Demo simulator trigger for user visual wow factor
  const triggerDemoAlert = () => {
    const vectors = [
      'Deepfake Mel-Spectrogram Match',
      'Typosquatted Domain Injection',
      'PDF Executable Payload',
      'GAN Face Fingerprint Detected',
      'C2PA Provenance Signature Mismatch'
    ];
    handleIncomingAlert({
      severity: Math.random() > 0.4 ? 'critical' : 'high',
      confidence: Math.round(75 + Math.random() * 24),
      message: vectors[Math.floor(Math.random() * vectors.length)]
    });
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
            <Globe className="text-cyan-400 animate-pulse" size={20} />
            Global Threat Map & Phishing Attack Trends
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time visualization of geographic attack origins, spoofed domains, and targeted enterprise brand profiles.
          </p>
        </div>
        <button
          onClick={triggerDemoAlert}
          className="btn-primary py-1.5 px-4 text-xs font-bold"
        >
          Inject Test Incident
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map / Origin Visualizer */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-md space-y-4 relative">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Geographic Threat Attack Origins</h4>

          {/* Interactive World Map SVG Container */}
          <div className="h-80 rounded-xl border border-slate-800 bg-slate-950 relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
            
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 300">
              {/* Grid Lines background */}
              <defs>
                <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#ef4444" stopOpacity="1" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Render static nodes */}
              {Object.entries(cityNodes).map(([key, node]) => (
                <g key={key}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={key === 'SERVER' ? 5 : 3.5}
                    fill={key === 'SERVER' ? '#22c55e' : '#f43f5e'}
                    className={key === 'SERVER' ? '' : 'animate-pulse'}
                    style={{ filter: `drop-shadow(0 0 4px ${key === 'SERVER' ? '#22c55e' : '#f43f5e'})` }}
                  />
                  <text
                    x={node.x}
                    y={node.y - 8}
                    fill="#94a3b8"
                    fontSize="7"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {node.flag} {key}
                  </text>
                </g>
              ))}

              {/* Render dynamic alert arcs */}
              {arcs.map((arc) => (
                <g key={arc.id}>
                  {/* Glowing dynamic path */}
                  <path
                    d={`M ${arc.x1} ${arc.y1} Q ${(arc.x1 + arc.x2)/2} ${Math.min(arc.y1, arc.y2) - 40} ${arc.x2} ${arc.y2}`}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    className="animate-dash"
                    style={{ filter: `drop-shadow(0 0 6px ${arc.color})` }}
                  />
                  {/* Pulsing signal node traveling the path */}
                  <circle cx={arc.x1} cy={arc.y1} r="6" fill="none" stroke={arc.color} strokeWidth="1.5" className="animate-ping" />
                </g>
              ))}
            </svg>

            {/* In-Map Auto-Dismissing Incident Toasts Container */}
            <div className="absolute bottom-4 right-4 max-w-xs space-y-2 pointer-events-none">
              {liveAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-slate-900/90 border-l-4 p-3 rounded-r-xl shadow-2xl flex items-start gap-2.5 animate-fade-in-up border-rose-500 backdrop-blur-md"
                  style={{ width: '250px' }}
                >
                  <ShieldAlert size={14} className="text-rose-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-300">
                      <span>{alert.flag} {alert.ip}</span>
                      <span className="text-[8px] px-1 bg-rose-500/20 text-rose-400 rounded">
                        {alert.threat_score}%
                      </span>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-200 truncate">{alert.vector}</p>
                    <p className="text-[8px] text-slate-500 font-mono">{alert.country}</p>
                  </div>
                </div>
              ))}
            </div>

            <span className="absolute bottom-4 left-4 text-[9px] text-slate-500 font-mono uppercase tracking-widest">
              Live Threat Feed WebSockets Listening
            </span>
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

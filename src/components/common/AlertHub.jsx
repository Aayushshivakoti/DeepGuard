import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Bell, X, ShieldX, ArrowRight, BellOff } from 'lucide-react';
import { getAlertFeed } from '../../api/scanApi';

export default function AlertHub({ isOpen, onClose }) {
  const [alerts, setAlerts] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const fetchInitialFeed = async () => {
      try {
        const data = await getAlertFeed();
        if (isMounted) {
          setAlerts(data);
        }
      } catch (err) {
        console.warn("Failed to load initial alert feed:", err);
      }
    };

    fetchInitialFeed();

    // 2. Register WebSockets listener for real-time security alerts
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:8000/api/v1/ws/alerts`;
    
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const newAlert = {
          id: `ws-alert-${Date.now()}-${Math.random()}`,
          severity: payload.severity || 'high',
          message: payload.message || 'Suspicious payload activity blocked.',
          media_type: payload.media_type || 'image',
          timestamp: new Date().toISOString(),
          confidence: payload.confidence || 88.5
        };
        if (isMounted) {
          setAlerts(prev => [newAlert, ...prev]);
        }
      } catch (err) {
        console.warn('Failed to parse WebSocket alert message:', err);
      }
    };

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const handleReviewCase = (alert) => {
    alert('Launching detailed forensic case dossier for inspection: ' + alert.message);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-y-0 right-0 z-50 w-80 bg-slate-950 border-l border-slate-900 shadow-2xl flex flex-col animate-slide-in-right font-sans"
      style={{ backdropFilter: 'blur(16px)', background: 'rgba(9, 13, 22, 0.95)' }}
    >
      {/* Header */}
      <div className="p-4 px-6 border-b border-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="text-cyan-400 animate-pulse" size={16} />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Security Alerts</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition-all">
          <X size={16} />
        </button>
      </div>

      {/* Alerts List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-2">
            <BellOff size={24} />
            <p className="text-xs">No active alerts at this time.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                alert.severity === 'critical' 
                  ? 'bg-red-500/5 border-red-500/20 text-red-400' 
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                  <ShieldAlert size={12} />
                  {alert.severity} Incident
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-200">{alert.message}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Type: {alert.media_type.toUpperCase()} | Confidence: {alert.confidence || 90}%
                </p>
              </div>

              <button
                onClick={() => handleReviewCase(alert)}
                className={`w-full py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border transition-all ${
                  alert.severity === 'critical'
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
                }`}
              >
                <span>Review Case Dossier</span>
                <ArrowRight size={10} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

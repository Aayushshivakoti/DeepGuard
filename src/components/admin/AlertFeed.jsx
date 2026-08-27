import React, { useEffect, useState, useRef } from 'react';
import { Radio, AlertOctagon, AlertTriangle, Info, Image, Video, Music, Link, FileText } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { color: '#ef4444', icon: AlertOctagon, label: 'CRITICAL', bg: 'rgba(239,68,68,0.08)' },
  high: { color: '#f59e0b', icon: AlertTriangle, label: 'HIGH', bg: 'rgba(245,158,11,0.08)' },
  medium: { color: '#06b6d4', icon: Info, label: 'MEDIUM', bg: 'rgba(6,182,212,0.08)' },
  low: { color: '#22c55e', icon: Info, label: 'LOW', bg: 'rgba(34,197,94,0.08)' },
};

const MEDIA_ICONS = {
  image: Image,
  video: Video,
  audio: Music,
  url: Link,
  pdf: FileText,
};

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(diff / 60000);
  if (secs < 60) return `${secs}s ago`;
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function AlertItem({ alert, isNew }) {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
  const Icon = cfg.icon;
  const MediaIcon = MEDIA_ICONS[alert.media_type] || FileText;

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-xl transition-all duration-500
        alert-${alert.severity}
        ${isNew ? 'animate-fade-in-up' : ''}
      `}
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}20` }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${cfg.color}15` }}
      >
        <Icon size={13} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: cfg.color }}
          >
            {cfg.label}
          </span>
          <div className="flex items-center gap-1">
            <MediaIcon size={10} className="text-slate-600" />
            <span className="text-xs text-slate-600 capitalize">{alert.media_type}</span>
          </div>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
      </div>
      <span className="text-xs text-slate-600 flex-shrink-0 font-mono">
        {timeAgo(alert.timestamp)}
      </span>
    </div>
  );
}

export default function AlertFeed({ alerts: initialAlerts = [] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [newAlertId, setNewAlertId] = useState(null);
  const feedRef = useRef(null);

  // Simulate live alerts streaming
  useEffect(() => {
    setAlerts(initialAlerts);
  }, [initialAlerts]);

  useEffect(() => {
    const LIVE_ALERTS = [
      { severity: 'critical', message: 'URL Payload Dropper (.exe detected)', media_type: 'url' },
      { severity: 'high', message: 'AV Lip-Sync Mismatch (Score: 88.4%)', media_type: 'video' },
      { severity: 'medium', message: 'Suspicious audio uploaded for review', media_type: 'audio' },
      { severity: 'critical', message: 'GAN signature detected in identity document', media_type: 'image' },
      { severity: 'high', message: 'Voice clone attempt flagged in customer support call', media_type: 'audio' },
    ];

    const interval = setInterval(() => {
      const template = LIVE_ALERTS[Math.floor(Math.random() * LIVE_ALERTS.length)];
      const newAlert = {
        ...template,
        id: `live-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      setNewAlertId(newAlert.id);
      setAlerts(prev => [newAlert, ...prev].slice(0, 20));
      setTimeout(() => setNewAlertId(null), 1000);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(6,182,212,0.1)' }}>
      <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-red-400 animate-blink" />
          <h3 className="text-sm font-bold text-slate-200">Live Threat Alert Feed</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-blink" />
          <span className="text-xs text-slate-500 font-medium">Live</span>
        </div>
      </div>

      <div
        ref={feedRef}
        className="p-4 space-y-2 overflow-y-auto"
        style={{ maxHeight: '320px' }}
      >
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <Radio size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No alerts at this time</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              isNew={alert.id === newAlertId}
            />
          ))
        )}
      </div>
    </div>
  );
}

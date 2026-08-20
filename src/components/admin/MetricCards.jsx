import React, { useEffect, useState } from 'react';
import { ScanLine, ShieldAlert, Ban, Timer, TrendingUp, TrendingDown } from 'lucide-react';

const METRICS_CONFIG = [
  {
    key: 'total_scanned',
    label: 'Total Files Scanned',
    icon: ScanLine,
    color: '#06b6d4',
    format: (v) => v.toLocaleString(),
    trend: '+12.4%',
    trendUp: true,
  },
  {
    key: 'deepfakes_flagged',
    label: 'Deepfakes Flagged',
    icon: ShieldAlert,
    color: '#ef4444',
    format: (v) => v.toLocaleString(),
    trend: '+8.7%',
    trendUp: true,
  },
  {
    key: 'phishing_blocked',
    label: 'Phishing URLs Blocked',
    icon: Ban,
    color: '#f59e0b',
    format: (v) => v.toLocaleString(),
    trend: '+3.2%',
    trendUp: true,
  },
  {
    key: 'avg_latency_ms',
    label: 'Avg Scanning Latency',
    icon: Timer,
    color: '#22c55e',
    format: (v) => `${v.toLocaleString()} ms`,
    trend: '-5.1%',
    trendUp: false,
  },
];

function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTime = null;
    const startVal = 0;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(startVal + (target - startVal) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return count;
}

function MetricCard({ config, value, idx }) {
  const animatedVal = useCountUp(value, 1200 + idx * 150);
  const Icon = config.icon;
  const TrendIcon = config.trendUp ? TrendingUp : TrendingDown;

  return (
    <div
      className="glass rounded-2xl p-5 card-hover animate-fade-in-up"
      style={{
        border: `1px solid ${config.color}20`,
        animationDelay: `${idx * 0.1}s`,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${config.color}15`, border: `1px solid ${config.color}25` }}
        >
          <Icon size={20} style={{ color: config.color }} />
        </div>
        <div
          className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg"
          style={{
            color: config.trendUp ? (config.key === 'avg_latency_ms' ? '#22c55e' : '#22c55e') : '#ef4444',
            background: config.trendUp
              ? (config.key === 'avg_latency_ms' ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.1)')
              : 'rgba(239,68,68,0.1)',
          }}
        >
          <TrendIcon size={11} />
          {config.trend}
        </div>
      </div>
      <p className="text-2xl font-black text-slate-100 tabular-nums">
        {config.format(animatedVal)}
      </p>
      <p className="text-xs text-slate-500 mt-1">{config.label}</p>
      <div className="mt-3 h-1 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${Math.min(100, (value / (value * 1.3)) * 100)}%`,
            background: `linear-gradient(90deg, ${config.color}80, ${config.color})`,
            transitionDelay: `${idx * 0.1}s`,
          }}
        />
      </div>
    </div>
  );
}

export default function MetricCards({ metrics }) {
  if (!metrics) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton h-36 rounded-2xl" />
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {METRICS_CONFIG.map((config, idx) => (
        <MetricCard
          key={config.key}
          config={config}
          value={metrics[config.key] || 0}
          idx={idx}
        />
      ))}
    </div>
  );
}

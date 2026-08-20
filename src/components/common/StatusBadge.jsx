import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Link2, FileWarning } from 'lucide-react';

const VERDICT_CONFIG = {
  AUTHENTIC: {
    label: 'AUTHENTIC',
    className: 'badge-authentic glow-green',
    icon: ShieldCheck,
    color: '#22c55e',
  },
  SUSPICIOUS: {
    label: 'SUSPICIOUS',
    className: 'badge-suspicious glow-amber',
    icon: AlertTriangle,
    color: '#f59e0b',
  },
  DEEPFAKE_DETECTED: {
    label: 'DEEPFAKE DETECTED',
    className: 'badge-deepfake glow-red',
    icon: AlertOctagon,
    color: '#ef4444',
  },
  PHISHING_DETECTED: {
    label: 'PHISHING DETECTED',
    className: 'badge-phishing glow-red',
    icon: Link2,
    color: '#ef4444',
  },
};

export default function StatusBadge({ verdict, size = 'md', pulse = false }) {
  const config = VERDICT_CONFIG[verdict] || {
    label: verdict,
    className: 'badge-suspicious',
    icon: FileWarning,
    color: '#94a3b8',
  };

  const Icon = config.icon;

  const sizeClasses = {
    sm: { wrapper: 'px-2 py-1 text-xs gap-1', icon: 12 },
    md: { wrapper: 'px-3 py-1.5 text-sm gap-1.5', icon: 14 },
    lg: { wrapper: 'px-5 py-2.5 text-base gap-2', icon: 18 },
    xl: { wrapper: 'px-6 py-3 text-lg gap-2.5', icon: 22 },
  };

  const s = sizeClasses[size] || sizeClasses.md;

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full tracking-wider uppercase ${config.className} ${s.wrapper}`}
      style={{ position: 'relative' }}
    >
      {pulse && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '9999px',
            border: `2px solid ${config.color}`,
            animation: 'pulse-ring 2s ease-out infinite',
          }}
        />
      )}
      <Icon size={s.icon} />
      {config.label}
    </span>
  );
}

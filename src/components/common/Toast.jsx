import React, { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const SEVERITY_CONFIGS = {
  success: {
    icon: CheckCircle2,
    colorClass: 'text-green-400',
    bgClass: 'bg-green-500/10 border-green-500/20',
    progressBg: 'bg-green-500',
  },
  warning: {
    icon: AlertTriangle,
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10 border-amber-500/20',
    progressBg: 'bg-amber-500',
  },
  error: {
    icon: XCircle,
    colorClass: 'text-red-400',
    bgClass: 'bg-red-500/10 border-red-500/20',
    progressBg: 'bg-red-500',
  },
  info: {
    icon: Info,
    colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10 border-cyan-500/20',
    progressBg: 'bg-cyan-500',
  },
};

function ToastItem({ toast }) {
  const { removeToast } = useToast();
  const [progress, setProgress] = useState(100);
  const cfg = SEVERITY_CONFIGS[toast.severity] || SEVERITY_CONFIGS.info;
  const Icon = cfg.icon;

  useEffect(() => {
    if (toast.duration <= 0) return;
    const intervalTime = 40;
    const steps = toast.duration / intervalTime;
    const decrement = 100 / steps;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - decrement;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [toast.duration]);

  return (
    <div
      className={`
        pointer-events-auto flex flex-col w-full max-w-sm rounded-xl border p-4 shadow-2xl backdrop-blur-xl
        animate-fade-in-up transition-all duration-300 ${cfg.bgClass}
      `}
    >
      <div className="flex items-start gap-3">
        <Icon className={`flex-shrink-0 mt-0.5 ${cfg.colorClass}`} size={16} />
        
        <div className="flex-1 text-xs font-medium text-slate-200">
          {toast.message}
        </div>

        <button
          onClick={() => removeToast(toast.id)}
          className="text-slate-500 hover:text-slate-200 transition-colors flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {toast.duration > 0 && (
        <div className="w-full h-0.5 bg-slate-800/80 rounded-full overflow-hidden mt-3">
          <div
            className={`h-full rounded-full transition-all duration-[40ms] ease-linear ${cfg.progressBg}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

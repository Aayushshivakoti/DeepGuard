import React from 'react';
import { Layers, CheckCircle2, Cpu, X } from 'lucide-react';

export default function BatchQueueWidget({ batchFiles, onClose }) {
  if (!batchFiles || batchFiles.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-3 animate-fade-in-up">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-white">
          <Layers size={14} className="text-cyan-400" />
          <span>Batch Processing Queue ({batchFiles.length})</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {batchFiles.map((file, idx) => (
          <div key={idx} className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-bold truncate max-w-[180px]">{file.name}</span>
              <span className="text-[10px] font-mono text-cyan-400">Processing</span>
            </div>
            <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 animate-pulse w-3/4 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

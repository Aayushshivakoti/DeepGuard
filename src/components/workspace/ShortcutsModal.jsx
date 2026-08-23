import React, { useEffect } from 'react';
import { X, Keyboard, HelpCircle } from 'lucide-react';

export default function ShortcutsModal({ isOpen, onClose }) {
  // Listen for Ctrl/Cmd + ? (or Ctrl/Cmd + Shift + /)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMeta = e.ctrlKey || e.metaKey;
      if (e.key === '?' || (isMeta && e.key === '/')) {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in-up font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Keyboard className="text-cyan-400" size={16} />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Keyboard Shortcuts</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-white transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-800/40">
            <span className="text-slate-400 font-medium">Focus URL Scan Input</span>
            <kbd className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-cyan-400 font-mono font-bold">Ctrl + U</kbd>
          </div>
          
          <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-800/40">
            <span className="text-slate-400 font-medium">Toggle Search/History Drawer</span>
            <kbd className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-cyan-400 font-mono font-bold">Ctrl + K</kbd>
          </div>

          <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-800/40">
            <span className="text-slate-400 font-medium">Open Shortcuts Cheat-Sheet</span>
            <kbd className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-cyan-400 font-mono font-bold">?</kbd>
          </div>

          <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-800/40">
            <span className="text-slate-400 font-medium">Close Modals / Previews</span>
            <kbd className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-cyan-400 font-mono font-bold">Escape</kbd>
          </div>

          <div className="mt-4 p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-cyan-400 flex items-start gap-2.5">
            <HelpCircle size={14} className="mt-0.5 flex-shrink-0" />
            <p className="text-[10px] leading-relaxed">
              Using shortcuts to focus input fields will display a flashing cyan ring outline around the active input to assist navigation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

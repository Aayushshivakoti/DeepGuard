import React, { useState } from 'react';
import { Edit3, CheckCircle2, Save, FileText, Layers, Square, Type } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function CaseDossier() {
  const [dossierNotes, setDossierNotes] = useState('# Forensic Analyst Inspection Dossier\n- Visual texture artifacts detected on facial boundary.\n- Audio frequency phase cancellation observed.');
  const [decision, setDecision] = useState('APPROVED_CONFIRMED_FAKE');
  const { addToast } = useToast();

  const handleSave = () => {
    addToast('Case Dossier and Compliance Approval saved.', 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40 backdrop-blur-md flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="text-cyan-400" size={20} />
            Case Dossier & HTML5 Canvas Forensic Annotator
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Draw bounding box overlays, add text callouts to tampered regions, and issue formal compliance sign-offs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Canvas Workspace */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
            <span className="font-bold text-slate-300">Canvas Region Annotator</span>
            <div className="flex gap-2 text-cyan-400">
              <Square size={16} className="cursor-pointer hover:text-white" title="Draw Bounding Box" />
              <Type size={16} className="cursor-pointer hover:text-white" title="Add Text Overlay" />
            </div>
          </div>

          <div className="h-64 rounded-xl border border-dashed border-cyan-500/40 bg-slate-900/50 relative flex items-center justify-center overflow-hidden">
            <div className="absolute border-2 border-red-500 rounded p-1 bg-red-500/10 top-12 left-16">
              <span className="text-[9px] font-mono text-red-300 bg-slate-950 px-1 rounded">Tampered Region</span>
            </div>
            <span className="text-xs font-mono text-slate-500">Interactive Canvas Layer</span>
          </div>
        </div>

        {/* Markdown Dossier & Decision */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950 space-y-4 text-xs">
          <h4 className="font-bold text-slate-300">Analyst Markdown Dossier Notes</h4>
          <textarea
            value={dossierNotes}
            onChange={e => setDossierNotes(e.target.value)}
            rows={5}
            className="cyber-input py-2 text-xs bg-slate-900 w-full font-mono"
          />

          <div>
            <label className="block text-slate-400 mb-1">Final Compliance Approval Decision</label>
            <select
              value={decision}
              onChange={e => setDecision(e.target.value)}
              className="cyber-input py-2 text-xs bg-slate-900"
            >
              <option value="APPROVED_CONFIRMED_FAKE">APPROVED: Confirmed Deepfake Tampered</option>
              <option value="APPROVED_CONFIRMED_REAL">APPROVED: Confirmed Authentic</option>
              <option value="REJECTED_INSUFFICIENT_DATA">REJECTED: Insufficient Evidence</option>
            </select>
          </div>

          <button onClick={handleSave} className="btn-primary py-2.5 px-6 font-bold text-xs w-full">
            <Save size={14} /> Commit Compliance Dossier
          </button>
        </div>
      </div>
    </div>
  );
}

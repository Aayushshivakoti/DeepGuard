import React, { useState } from 'react';
import { Database, Download, CheckCircle2, X } from 'lucide-react';
import { exportDataset } from '../../api/scanApi';
import { useToast } from '../../context/ToastContext';

export default function DatasetExporterModal({ onClose }) {
  const [format, setFormat] = useState('PyTorch');
  const [exporting, setExporting] = useState(false);
  const { addToast } = useToast();

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportDataset(format);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DeepGuard_Dataset_${format}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      addToast(`Exported ${format} dataset archive successfully.`, 'success');
      onClose();
    } catch (err) {
      addToast('Dataset export failed.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fade-in-up">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Database className="text-cyan-400" size={20} />
            <h3 className="text-base font-bold text-white">Active Learning Dataset Collector</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Package human-verified false positives, false negatives, and annotated HITL scans into structured dataset archives for AI model retraining.
        </p>

        <div className="space-y-3 text-xs">
          <label className="block font-bold text-slate-300">Target Framework Format</label>
          <div className="grid grid-cols-3 gap-2">
            {['PyTorch', 'COCO', 'TFRecord'].map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold font-mono transition-all ${
                  format === f
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-primary py-2.5 justify-center font-bold text-xs w-full"
        >
          <Download size={15} />
          {exporting ? 'Generating ZIP Archive...' : `Export ${format} Dataset ZIP`}
        </button>
      </div>
    </div>
  );
}

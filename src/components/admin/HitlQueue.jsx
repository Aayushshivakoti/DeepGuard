import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Edit3, MessageSquare, Save, RefreshCw } from 'lucide-react';
import { getHitlQueue, submitHitlReview } from '../../api/scanApi';
import { useToast } from '../../context/ToastContext';

export default function HitlQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [overrideVerdict, setOverrideVerdict] = useState('AUTHENTIC');
  const [analystNotes, setAnalystNotes] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    fetchHitl();
  }, []);

  const fetchHitl = async () => {
    setLoading(true);
    try {
      const data = await getHitlQueue();
      setItems(data || []);
      if (data && data.length > 0) {
        setSelectedItem(data[0]);
      }
    } catch (err) {
      console.warn("Failed to fetch HITL queue:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!selectedItem) return;
    try {
      await submitHitlReview(selectedItem.id, {
        verdict: overrideVerdict,
        notes: analystNotes,
      });
      addToast(`Overrode verdict for ${selectedItem.filename} to ${overrideVerdict}`, 'success');
      setItems(prev => prev.filter(i => i.id !== selectedItem.id));
      setSelectedItem(null);
    } catch (err) {
      addToast('Failed to submit analyst review.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <ShieldAlert size={20} />
            Human-in-the-Loop (HITL) Review Queue
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Borderline AI scan results (40%–60% confidence) requiring human forensic review and verdict overrides.
          </p>
        </div>

        <button 
          onClick={fetchHitl}
          className="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5 self-start sm:self-center"
        >
          <RefreshCw size={13} /> Refresh Queue
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 font-mono">Fetching pending HITL cases...</div>
      ) : items.length === 0 ? (
        <div className="p-12 rounded-2xl border border-slate-900 bg-slate-950/30 text-center space-y-2">
          <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
          <p className="text-xs text-slate-300 font-bold">Queue Clear — No Pending Reviews</p>
          <p className="text-[11px] text-slate-500">All borderline verification cases have been reviewed by forensic analysts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue List */}
          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedItem?.id === item.id 
                    ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                    : 'border-slate-900 bg-slate-900/30 hover:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <p className="font-bold text-slate-200 truncate">{item.filename}</p>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {item.confidence}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">
                  {item.media_type} | {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>

          {/* Annotation Workspace */}
          {selectedItem && (
            <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-md space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white">Analyst Annotation Workspace</h4>
                  <p className="text-xs text-slate-400">ID: {selectedItem.id}</p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400">
                  AI Confidence: {selectedItem.confidence}%
                </span>
              </div>

              {/* Bounding Box Canvas Annotation Simulator */}
              <div className="h-64 rounded-xl border border-slate-800 bg-slate-900/50 relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 cyber-grid opacity-20" />
                <div className="absolute border-2 border-dashed border-cyan-400 rounded-lg w-48 h-36 flex items-start p-1.5 bg-cyan-500/10">
                  <span className="text-[9px] font-mono font-bold text-cyan-300 bg-slate-950 px-1 rounded">
                    Region Anomaly #01
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono z-10">Interactive Analyst Region Canvas</p>
              </div>

              {/* Verdict Override Inputs */}
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1.5">Human Analyst Verdict Override</label>
                  <select
                    value={overrideVerdict}
                    onChange={e => setOverrideVerdict(e.target.value)}
                    className="cyber-input py-2 text-xs bg-slate-900"
                  >
                    <option value="AUTHENTIC">AUTHENTIC (Confirmed Genuine)</option>
                    <option value="SUSPICIOUS">SUSPICIOUS (Indeterminate)</option>
                    <option value="DEEPFAKE_DETECTED">SYNTHETIC DEEPFAKE (Confirmed Tampered)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1.5">Forensic Analyst Notes</label>
                  <textarea
                    value={analystNotes}
                    onChange={e => setAnalystNotes(e.target.value)}
                    placeholder="Document lighting mismatches, eye-blink frequencies, or metadata anomalies..."
                    rows={3}
                    className="cyber-input py-2 text-xs bg-slate-900 w-full"
                  />
                </div>

                <button
                  onClick={handleReviewSubmit}
                  className="btn-primary py-2.5 px-6 font-bold text-xs flex items-center justify-center gap-2 w-full"
                >
                  <Save size={14} />
                  Submit Human Review & Overide AI Verdict
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

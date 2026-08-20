import React, { useState } from 'react';
import { Cpu, ShieldCheck, AlertOctagon, HelpCircle, ChevronDown, ChevronUp, Star, Play, Sparkles, BookOpen } from 'lucide-react';

export default function AboutPage() {
  const [activePipelineNode, setActivePipelineNode] = useState(null);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const PIPELINE_NODES = [
    {
      id: 'fft',
      title: 'FFT Spectrum Analyzer',
      description: 'Converts media into the frequency domain using Fast Fourier Transforms. Detects microscopic grid-like noise and artificial frequencies left behind by generative models.',
      color: '#06b6d4',
    },
    {
      id: 'efficientnet',
      title: 'EfficientNet Spatial Engine',
      description: 'A deep convolutional backbone that checks individual video frames or images for spatial inconsistencies, pixel blending, facial boundaries, and color distribution mismatches.',
      color: '#8b5cf6',
    },
    {
      id: 'bilstm',
      title: 'BiLSTM Temporal Consistency',
      description: 'Bidirectional Long Short-Term Memory networks scan consecutive video frames or audio blocks over time to detect temporal blending, unnatural eye blinks, or unsynced vocal micro-tremors.',
      color: '#f59e0b',
    },
    {
      id: 'gradcam',
      title: 'Grad-CAM Anomaly Map',
      description: 'Generates gradient-weighted class activation maps pointing directly to areas of high manipulation confidence, pinpointing exactly where modifications took place.',
      color: '#ef4444',
    },
    {
      id: 'verdict',
      title: 'Consolidated Verdict Gating',
      description: 'Collects the scores from each verification node, weighs them dynamically according to the content medium, and computes the final synthetic confidence probability.',
      color: '#10b981',
    },
  ];

  const FAQS = [
    {
      q: 'How does DeepGuard verify media authenticity?',
      a: 'DeepGuard uses a multi-layered neural network ensemble. We process media through frequency analysis (FFT), spatial features (EfficientNet), sequence temporal matching (BiLSTM), and generate explainable Grad-CAM heatmaps showing anomalies before compiling a verdict.',
    },
    {
      q: 'What is the distinction between "Suspicious" and "Synthetic" verdicts?',
      a: '"Suspicious" denotes that the media has passed baseline parameters but contains denoising, metadata anomalies, or compression issues (e.g. 50-70% probability). "Synthetic" indicates absolute artificial manipulation or generation (e.g. StyleGAN, voice clones) exceeding a 70% threshold.',
    },
    {
      q: 'Are my uploaded files privately secured?',
      a: 'Absolutely. DeepGuard employs a strict zero-retention privacy policy. Media buffers are held temporarily in secure memory for execution, analyzed in real time, and immediately destroyed without permanent server storage.',
    },
    {
      q: 'Can DeepGuard detect advanced voice clones and audio deepfakes?',
      a: 'Yes, our audio verification pipeline uses LFCC (Linear Frequency Cepstral Coefficients) and prosody analysis to distinguish synthetic speech patterns, AI vocoders, and cloned audio tracks from authentic human speech.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
          <BookOpen className="text-cyan-400" size={20} />
          Educational Hub: How It Works
        </h2>
        <p className="text-xs text-slate-500 mt-1">Learn about deepfake synthesis, threat intelligence, and our neural verification pipeline.</p>
      </div>

      {/* Visual Guide Card */}
      <div className="glass rounded-2xl p-6 border border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="space-y-4">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Threat Landscape
          </span>
          <h3 className="text-base font-bold text-slate-200">Synthetic Deepfakes & Audio Clones</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Generative AI has democratized the creation of hyper-realistic media manipulations. Modern deepfakes leverage GANs (Generative Adversarial Networks) and Diffusion models to clone voices, swap faces, and forge signatures, introducing significant phishing threats.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            DeepGuard acts as a zero-trust media firewall, examining structural, frequency, and metadata markers to prove provenance and assure integrity.
          </p>
        </div>
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 flex flex-col items-center justify-center min-h-[180px] relative overflow-hidden">
          <div className="absolute inset-0 cyber-grid opacity-25" />
          <Cpu className="text-cyan-500 animate-spin-slow mb-3" size={32} style={{ filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.4))' }} />
          <span className="text-xs font-mono font-bold text-slate-300">NEURAL FORENSIC ENGINE</span>
          <span className="text-[9px] font-mono text-slate-500 mt-1">Multi-layered Gated Architecture</span>
        </div>
      </div>

      {/* Interactive 4-Engine Pipeline Diagram */}
      <div className="glass rounded-2xl p-6 border border-slate-800/80 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Interactive Neural Processing Pipeline</h3>
          <p className="text-xs text-slate-500 mt-0.5">Hover or tap on nodes to inspect individual forensic functions</p>
        </div>

        {/* SVG Flow diagram */}
        <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-900 relative">
          <div className="overflow-x-auto py-4">
            <div className="min-w-[650px] relative flex justify-between items-center px-6">
              {/* Connecting lines */}
              <div className="absolute left-16 right-16 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 pointer-events-none z-0">
                {/* Simulated pulse running through nodes */}
                <div className="w-1/3 h-full bg-gradient-to-r from-cyan-500 to-purple-500 animate-shimmer" />
              </div>

              {PIPELINE_NODES.map((node, index) => {
                const isHovered = activePipelineNode === node.id;
                return (
                  <div
                    key={node.id}
                    onMouseEnter={() => setActivePipelineNode(node.id)}
                    onMouseLeave={() => setActivePipelineNode(null)}
                    className="relative z-10 flex flex-col items-center cursor-help group"
                  >
                    <div
                      className={`
                        w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 border
                        ${isHovered ? 'scale-110 shadow-lg' : 'scale-100'}
                      `}
                      style={{
                        background: isHovered ? `${node.color}25` : 'rgba(15,23,42,0.85)',
                        borderColor: isHovered ? node.color : 'rgba(6,182,212,0.15)',
                        boxShadow: isHovered ? `0 0 12px ${node.color}40` : 'none',
                      }}
                    >
                      <span className="text-[10px] font-mono font-black" style={{ color: isHovered ? '#fff' : node.color }}>
                        0{index + 1}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 mt-2 text-center max-w-[100px]">
                      {node.title.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Node detail display box */}
          <div className="mt-4 p-4 rounded-xl bg-slate-900/40 border border-slate-900 min-h-[90px] flex flex-col justify-center">
            {activePipelineNode ? (
              <div className="space-y-1 animate-fade-in-up">
                {(() => {
                  const node = PIPELINE_NODES.find(n => n.id === activePipelineNode);
                  return (
                    <>
                      <p className="text-xs font-bold" style={{ color: node.color }}>{node.title}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{node.description}</p>
                    </>
                  );
                })()}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center italic">
                Hover over a pipeline stage to inspect forensic analysis details.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="glass rounded-2xl p-6 border border-slate-800/80 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">Technical Capability Comparison</h3>
        
        <div className="overflow-x-auto rounded-xl border border-slate-900">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-900">
              <tr>
                <th className="px-4 py-3">Verification Feature</th>
                <th className="px-4 py-3 text-cyan-400">DeepGuard Gateway</th>
                <th className="px-4 py-3">Legacy Solutions</th>
                <th className="px-4 py-3">Public Detectors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-950 bg-slate-900/10">
              {[
                { feature: 'Multi-Engine FFT Frequency Scan', dg: 'Yes (Live Radar)', leg: 'No', pub: 'Metadata only' },
                { feature: 'Grad-CAM Localization Maps', dg: 'Yes (Interactive Slider)', leg: 'No', pub: 'No' },
                { feature: 'Audio Synthesis Detections', dg: 'Yes (Mel-Spectral)', leg: 'No', pub: 'Audio only' },
                { feature: 'Processing Latency Speed', dg: '<1.8 seconds avg', leg: '10+ seconds', pub: 'Slow Queue' },
                { feature: 'Cryptographic PDF Reports', dg: 'Yes (Secure signature)', leg: 'Yes', pub: 'No' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-slate-900/10 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-slate-300">{row.feature}</td>
                  <td className="px-4 py-2.5 font-bold text-cyan-400 flex items-center gap-1">
                    <Star size={11} className="fill-cyan-400 text-cyan-400" />
                    {row.dg}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{row.leg}</td>
                  <td className="px-4 py-2.5 text-slate-500">{row.pub}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="glass rounded-2xl p-6 border border-slate-800/80 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">Frequently Asked Questions</h3>
        
        <div className="space-y-2">
          {FAQS.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                className="bg-slate-950/20 border border-slate-900/60 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left text-xs font-bold text-slate-200 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle size={14} className="text-cyan-400" />
                    {faq.q}
                  </span>
                  {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                </button>
                {isOpen && (
                  <div className="p-4 pt-0 text-xs text-slate-400 leading-relaxed border-t border-slate-900/30 animate-fade-in-up">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

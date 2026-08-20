import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

const GLOSSARY = {
  rppg: 'rPPG (Remote Photoplethysmography) measures subtle skin color variations caused by blood circulation to verify human liveness.',
  fft: 'FFT (Fast Fourier Transform) analyzes frequency spectrum artifacts left behind by generative AI image models.',
  spectral: 'Spectral Flatness measures voice pitch uniformity to distinguish human breathing from AI voice clones.',
  c2pa: 'C2PA/CAI is a cryptographic open standard for verifying digital media provenance and edit histories.',
  typosquatting: 'Typosquatting detects subtle domain misspellings (e.g. paypa1.com) designed to trick users into phishing sites.'
};

export default function ForensicTooltip({ termKey, label }) {
  const [show, setShow] = useState(false);
  const text = GLOSSARY[termKey?.toLowerCase()] || 'Forensic verification metric.';

  return (
    <span className="relative inline-flex items-center gap-1 group cursor-help">
      <span className="font-medium text-slate-300">{label}</span>
      <HelpCircle
        size={12}
        className="text-slate-500 hover:text-cyan-400 transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />

      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-[11px] leading-relaxed shadow-xl z-50 pointer-events-none animate-fade-in-up">
          {text}
        </span>
      )}
    </span>
  );
}

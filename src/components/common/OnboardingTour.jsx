import React, { useState } from 'react';
import { Sparkles, ArrowRight, CheckCircle2, X } from 'lucide-react';

export default function OnboardingTour({ onClose }) {
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: 'Welcome to DeepGuard Gateway',
      description: 'Verify images, videos, audio clips, documents, or URLs against AI deepfakes and phishing scams.',
      icon: Sparkles
    },
    {
      title: 'Simple Summary vs Advanced Forensics',
      description: 'Toggle between easy-to-read Plain-Language Summaries and deep FFT Neural Spectrum charts at any time.',
      icon: CheckCircle2
    },
    {
      title: 'Automated Monitors & Webhooks',
      description: 'Set up scheduled domain monitoring and receive instant webhook notifications when risk scores change.',
      icon: ArrowRight
    }
  ];

  const current = steps[step - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in-up">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={18} />
        </button>

        <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 w-fit">
          <current.icon size={24} />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
            Step {step} of 3
          </span>
          <h3 className="text-base font-bold text-white">{current.title}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">{current.description}</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1.5">
            {[1, 2, 3].map(i => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${step === i ? 'w-6 bg-cyan-400' : 'bg-slate-800'}`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (step < 3) setStep(step + 1);
              else onClose();
            }}
            className="btn-primary py-2 px-4 text-xs font-bold"
          >
            {step < 3 ? 'Next Step' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  );
}

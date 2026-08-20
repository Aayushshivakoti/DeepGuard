import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  FileText, 
  Download, 
  Info, 
  Lightbulb, 
  HelpCircle,
  Eye,
  Volume2,
  Globe,
  FileCheck,
  Video
} from 'lucide-react';
import jsPDF from 'jspdf';
import { useToast } from '../../context/ToastContext';

export default function SimpleSummaryCard({ result }) {
  const { addToast } = useToast();

  if (!result) return null;

  const summary = result.simple_summary || fallbackSummary(result);
  const {
    verdict_label,
    confidence_percentage,
    trust_level,
    headline,
    key_findings,
    why_this_result,
    action_recommendation
  } = summary;

  // Badge Styling based on Trust Level
  const badgeStyles = {
    GREEN: {
      bg: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400',
      bannerBg: 'from-emerald-950/80 via-emerald-900/40 to-slate-950',
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
      icon: ShieldCheck,
      iconColor: '#22c55e',
      borderAccent: 'border-emerald-500/40',
      barColor: 'bg-emerald-500',
    },
    AMBER: {
      bg: 'bg-amber-950/40 border-amber-500/30 text-amber-400',
      bannerBg: 'from-amber-950/80 via-amber-900/40 to-slate-950',
      badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      icon: AlertTriangle,
      iconColor: '#f59e0b',
      borderAccent: 'border-amber-500/40',
      barColor: 'bg-amber-500',
    },
    RED: {
      bg: 'bg-rose-950/40 border-rose-500/30 text-rose-400',
      bannerBg: 'from-rose-950/80 via-rose-900/40 to-slate-950',
      badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
      icon: ShieldAlert,
      iconColor: '#ef4444',
      borderAccent: 'border-rose-500/40',
      barColor: 'bg-rose-500',
    }
  };

  const style = badgeStyles[trust_level] || badgeStyles.AMBER;
  const TrustIcon = style.icon;

  // Icon mapper for key findings
  const getFindingIcon = (findingText) => {
    const lower = findingText.toLowerCase();
    if (lower.includes('pixel') || lower.includes('lighting') || lower.includes('texture') || lower.includes('face') || lower.includes('visual')) {
      return <Eye size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />;
    }
    if (lower.includes('voice') || lower.includes('pitch') || lower.includes('audio') || lower.includes('sound') || lower.includes('breath')) {
      return <Volume2 size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />;
    }
    if (lower.includes('url') || lower.includes('domain') || lower.includes('web') || lower.includes('ip') || lower.includes('link')) {
      return <Globe size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />;
    }
    if (lower.includes('text') || lower.includes('pdf') || lower.includes('document') || lower.includes('metadata')) {
      return <FileCheck size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />;
    }
    if (lower.includes('video') || lower.includes('frame') || lower.includes('blink') || lower.includes('lip')) {
      return <Video size={16} className="text-purple-400 flex-shrink-0 mt-0.5" />;
    }
    return <Lightbulb size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />;
  };

  // Plain PDF Report Exporter
  const exportPlainPdf = () => {
    try {
      const doc = new jsPDF();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 297, 'F');

      // Title Banner
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(6, 182, 212);
      doc.text('DeepGuard — Plain Language Summary', 20, 25);

      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(`Scanned Item: ${result.filename || result.url || 'Media Object'} | Date: ${new Date().toLocaleDateString()}`, 20, 33);

      doc.setDrawColor(30, 41, 59);
      doc.line(20, 38, 190, 38);

      // Trust Status Box
      doc.setFontSize(14);
      if (trust_level === 'GREEN') doc.setTextColor(34, 197, 94);
      else if (trust_level === 'AMBER') doc.setTextColor(245, 158, 11);
      else doc.setTextColor(239, 68, 68);

      doc.text(`Status: ${verdict_label.toUpperCase()} (${confidence_percentage}% Confidence)`, 20, 48);

      // Headline
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(226, 232, 240);
      const splitHeadline = doc.splitTextToSize(headline, 170);
      doc.text(splitHeadline, 20, 58);

      let y = 58 + (splitHeadline.length * 6) + 6;

      // Key Findings Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(6, 182, 212);
      doc.text('Key Plain-Language Findings:', 20, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(203, 213, 225);

      key_findings.forEach((finding) => {
        const lines = doc.splitTextToSize(`• ${finding}`, 165);
        doc.text(lines, 24, y);
        y += (lines.length * 5) + 3;
      });

      y += 6;
      // Why This Decision
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(6, 182, 212);
      doc.text('Why We Made This Decision:', 20, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(203, 213, 225);
      const splitWhy = doc.splitTextToSize(why_this_result, 170);
      doc.text(splitWhy, 20, y);
      y += (splitWhy.length * 5) + 8;

      // Recommendation
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(245, 158, 11);
      doc.text('Recommended Action:', 20, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(226, 232, 240);
      const splitRec = doc.splitTextToSize(action_recommendation, 170);
      doc.text(splitRec, 20, y);

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Generated automatically by DeepGuard Explainable AI (XAI) System.', 20, 280);

      doc.save(`Plain_Summary_${result.id || 'scan'}.pdf`);
      addToast('Plain-language summary PDF exported successfully.', 'success');
    } catch (err) {
      addToast('Failed to export PDF summary.', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* 1. Large Trust Badge Banner */}
      <div className={`p-5 rounded-2xl border bg-gradient-to-r ${style.bannerBg} ${style.borderAccent} relative overflow-hidden`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl border ${style.badgeBg} flex-shrink-0 mt-0.5`}>
              <TrustIcon size={24} style={{ color: style.iconColor }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${style.badgeBg}`}>
                  {verdict_label}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {confidence_percentage}% Confidence
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1.5 leading-snug">
                {headline}
              </h3>
            </div>
          </div>

          {/* Quick PDF export trigger */}
          <button
            onClick={exportPlainPdf}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-cyan-400 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 px-3 py-2 rounded-xl transition-all shadow-sm flex-shrink-0 self-start sm:self-center"
          >
            <Download size={14} className="text-cyan-400" />
            Export Plain PDF
          </button>
        </div>

        {/* Confidence Meter Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-3">
          <span className="text-[10px] uppercase font-mono font-semibold text-slate-400">Risk Assessment</span>
          <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div 
              className={`h-full ${style.barColor} transition-all duration-500`} 
              style={{ width: `${confidence_percentage}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-slate-200">{confidence_percentage}%</span>
        </div>
      </div>

      {/* 2. Key Findings ("Why We Made This Decision") */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-950/40 backdrop-blur-md space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
          <HelpCircle size={16} className="text-cyan-400" />
          <h4 className="text-sm font-bold text-white">Why We Made This Decision</h4>
        </div>

        <div className="space-y-2.5 pt-1">
          {key_findings.map((finding, idx) => {
            const parts = finding.split(': ');
            const title = parts.length > 1 ? parts[0] : null;
            const text = parts.length > 1 ? parts.slice(1).join(': ') : finding;

            return (
              <div 
                key={idx} 
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/50 hover:border-slate-700/60 transition-colors"
              >
                {getFindingIcon(finding)}
                <div className="text-xs text-slate-300 leading-relaxed">
                  {title && <span className="font-bold text-slate-100 mr-1.5">{title}:</span>}
                  <span>{text}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Deep Analysis Narrative & Actionable Advice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* How It Was Analyzed */}
        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-950/40 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Info size={14} className="text-cyan-400" />
            <span>How This Media Was Analyzed</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {why_this_result}
          </p>
        </div>

        {/* Action Recommendation */}
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-950/20 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Lightbulb size={14} className="text-amber-400" />
            <span>Recommended Next Steps</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            {action_recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}

// Fallback helper for raw results if simple_summary block is absent
function fallbackSummary(result) {
  const conf = result.confidence || 50.0;
  const verdict = result.verdict || 'SUSPICIOUS';
  const media = result.media_type || 'image';

  let trust_level = 'AMBER';
  let verdict_label = 'Suspicious / Needs Review';

  if (verdict === 'AUTHENTIC' || conf < 35) {
    trust_level = 'GREEN';
    verdict_label = 'Authentic';
  } else if (verdict === 'DEEPFAKE_DETECTED' || verdict === 'PHISHING_DETECTED' || conf >= 65) {
    trust_level = 'RED';
    verdict_label = media === 'url' ? 'Likely Phishing' : 'Likely AI-Generated';
  }

  const flags = result.flags || [];
  const key_findings = flags.map(f => `${f.label}: ${f.description}`).slice(0, 3);
  if (key_findings.length === 0) {
    key_findings.push('Structure & Frequency Analysis: Evaluated digital media patterns against forensic benchmarks.');
  }

  return {
    verdict_label,
    confidence_percentage: conf,
    trust_level,
    headline: `Analysis indicates a ${conf}% probability of ${trust_level === 'RED' ? 'artificial generation' : 'authenticity'}.`,
    key_findings,
    why_this_result: `Evaluated ${media} features using DeepGuard multi-engine forensic detectors.`,
    action_recommendation: trust_level === 'RED' ? 'Verify media source before relying on content.' : 'No urgent action required.',
  };
}

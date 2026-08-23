import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, AlertOctagon, HelpCircle, Calendar, Cpu, ArrowLeft, Loader } from 'lucide-react';

export default function PublicReportPage() {
  const { report_hash } = useParams();
  const [status, setStatus] = useState('loading'); // loading | valid | invalid
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    async function verifyCertificate() {
      try {
        const response = await axios.get(`http://localhost:8000/api/v1/scan/verify/${report_hash}`);
        setReportData(response.data);
        if (response.data.status === "VALID_CRYPTOGRAPHIC_CERTIFICATE" && !response.data.is_tampered) {
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      } catch (err) {
        setStatus('invalid');
      }
    }
    if (report_hash) {
      verifyCertificate();
    } else {
      setStatus('invalid');
    }
  }, [report_hash]);

  return (
    <div className="min-h-screen flex items-center justify-center font-sans p-6" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <div className="glass max-w-lg w-full p-8 rounded-3xl border border-slate-800/80 space-y-6 text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader className="w-8 h-8 animate-spin text-cyan-500" />
            <p className="text-sm text-slate-400 font-medium">Validating cryptographic signature hash...</p>
          </div>
        )}

        {status === 'valid' && reportData && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <ShieldCheck size={32} />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-100">Cryptographic Report Verified</h2>
              <p className="text-xs text-slate-500 font-mono select-all">SHA-256 Hash: {report_hash}</p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-left space-y-3 text-slate-300">
              <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
                <span className="font-semibold text-slate-400">Verification Authority</span>
                <span className="font-mono text-emerald-400 font-bold">{reportData.issuer}</span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
                <span className="font-semibold text-slate-400">Signature Status</span>
                <span className="text-emerald-400 font-bold">GENUINE / UNTAMPERED</span>
              </div>
              <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
                <span className="font-semibold text-slate-400">Signing Date</span>
                <span className="flex items-center gap-1 font-mono">
                  <Calendar size={12} />
                  {new Date(reportData.issued_at).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-400">Encryption Standard</span>
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <Cpu size={12} />
                  {reportData.algorithm}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              This report has been verified using DeepGuard's secure decentralized verification protocol. 
              The digital contents are certified matching the baseline audit hash.
            </p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertOctagon size={32} />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-100">Verification Failed</h2>
              <p className="text-xs text-red-400 font-semibold font-mono">Invalid Cryptographic Hash</p>
            </div>

            <p className="text-xs text-slate-400">
              The signature hash you provided could not be matched against any registered certificate authority entries. 
              This could indicate the report was tampered with post-verification.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-900">
          <Link to="/" className="text-xs text-slate-500 hover:text-slate-300 inline-flex items-center gap-1.5 transition-colors">
            <ArrowLeft size={13} />
            Back to DeepGuard Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

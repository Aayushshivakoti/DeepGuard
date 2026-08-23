import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Shield, CheckCircle, XCircle, Loader } from 'lucide-react';
import { verifyEmail } from '../api/scanApi';

export default function EmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function runVerification() {
      if (!token) {
        setStatus('error');
        setErrorMessage('Invalid verification token.');
        return;
      }

      try {
        await verifyEmail(token);
        setStatus('success');
        addToast('Email verified successfully!', 'success');
        setTimeout(() => navigate('/dashboard'), 3000);
      } catch (err) {
        setStatus('error');
        setErrorMessage(err.response?.data?.detail || 'Verification failed.');
      }
    }
    runVerification();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center font-sans p-6" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <div className="glass max-w-md w-full p-8 rounded-3xl border border-slate-800/80 text-center space-y-6">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
          <Shield size={22} />
        </div>

        <h2 className="text-lg font-black text-slate-100">Email Verification</h2>

        {status === 'verifying' && (
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <Loader className="w-6 h-6 animate-spin text-cyan-500" />
            <p className="text-xs text-slate-400 font-medium">Verifying your identity parameters...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl flex items-center gap-2.5 justify-center text-xs">
              <CheckCircle size={16} />
              <span>Identity Verified Successfully</span>
            </div>
            <p className="text-xs text-slate-400">
              Your email address has been verified. Redirecting you to the workspace dashboard...
            </p>
            <Link to="/dashboard" className="btn-primary py-2.5 w-full justify-center text-xs font-bold">
              Go to Dashboard
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-2.5 justify-center text-xs">
              <XCircle size={16} />
              <span>Verification Failed</span>
            </div>
            <p className="text-xs text-red-400 font-semibold">{errorMessage}</p>
            <p className="text-xs text-slate-500">
              The link might have expired or has already been used. Please request a new verification link.
            </p>
            <Link to="/dashboard" className="btn-ghost py-2.5 w-full justify-center text-xs font-bold border border-slate-900">
              Back to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

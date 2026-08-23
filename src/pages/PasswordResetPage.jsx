import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Key, Mail, Shield, CheckCircle, ArrowLeft } from 'lucide-react';
import { requestPasswordReset, confirmPasswordReset } from '../api/scanApi';

export default function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      await requestPasswordReset(email);
      addToast('Reset link sent to your registered email.', 'success');
      setIsSubmitted(true);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to request reset.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match.', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      await confirmPasswordReset(token, newPassword);
      addToast('Password reset successful. Redirecting to login...', 'success');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to reset password.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans p-6" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <div className="glass max-w-md w-full p-8 rounded-3xl border border-slate-800/80 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
            <Key size={22} />
          </div>
          <h2 className="text-lg font-black text-slate-100">
            {token ? 'Reset Your Password' : 'Forgot Password?'}
          </h2>
          <p className="text-xs text-slate-500">
            {token 
              ? 'Enter a new secure password for your DeepGuard account' 
              : 'Enter your email address to receive a recovery link'
            }
          </p>
        </div>

        {token ? (
          /* Confirm Reset Form */
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-semibold">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="cyber-input"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-semibold">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="cyber-input"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 justify-center text-xs font-bold"
            >
              {isLoading ? 'Updating...' : 'Set Password'}
            </button>
          </form>
        ) : isSubmitted ? (
          /* Success Request View */
          <div className="space-y-4 text-center">
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl flex items-center gap-2.5 justify-center text-xs">
              <CheckCircle size={16} />
              <span>Reset parameters dispatched.</span>
            </div>
            <p className="text-xs text-slate-400">
              Please check your inbox. If the email exists, you will find instructions to configure your credentials.
            </p>
            <Link to="/login" className="btn-ghost py-2 w-full justify-center text-xs font-bold border border-slate-900">
              Back to Sign In
            </Link>
          </div>
        ) : (
          /* Request Reset Form */
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-semibold">Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="cyber-input pl-10"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 justify-center text-xs font-bold"
            >
              {isLoading ? 'Requesting...' : 'Send Recovery Link'}
            </button>
            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-slate-500 hover:text-slate-300 inline-flex items-center gap-1.5 transition-colors">
                <ArrowLeft size={13} />
                Return to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

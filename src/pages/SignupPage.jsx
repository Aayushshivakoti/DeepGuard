import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Mail, Lock, Loader2, ArrowRight, UserCheck } from 'lucide-react';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await signup(email, password, role);
      setSuccess(true);
      
      // Auto login
      setTimeout(async () => {
        try {
          const profile = await login(email, password);
          if (profile.role.toUpperCase() === 'ADMIN') {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        } catch {
          navigate('/login');
        }
      }, 1500);
    } catch (err) {
      setError(err.message || 'Registration failed.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans px-4" style={{ background: '#090d16' }}>
      {/* Background blur glow */}
      <div className="absolute w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-3xl border border-slate-900 shadow-2xl relative overflow-hidden" style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(16px)' }}>
        <div className="flex flex-col items-center text-center space-y-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <UserCheck className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Create Account</h2>
          <p className="text-slate-400 text-sm">Register a new profile on DeepGuard gateway</p>
        </div>

        {success ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              ✓
            </div>
            <h3 className="text-lg font-bold text-white">Registration Successful!</h3>
            <p className="text-xs text-slate-400">Logging you into your workspace dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <span>⚠</span> {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="cyber-input pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password (Min 8 chars)</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="cyber-input pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Account Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('USER')}
                  className={`py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
                    role === 'USER'
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400 font-bold'
                      : 'bg-slate-950/45 border-slate-900 text-slate-400 hover:text-slate-300'
                  }`}
                  disabled={isLoading}
                >
                  General User
                </button>
                <button
                  type="button"
                  onClick={() => setRole('ADMIN')}
                  className={`py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
                    role === 'ADMIN'
                      ? 'bg-purple-500/15 border-purple-500/50 text-purple-400 font-bold'
                      : 'bg-slate-950/45 border-slate-900 text-slate-400 hover:text-slate-300'
                  }`}
                  disabled={isLoading}
                >
                  Admin Operator
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 text-base mt-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating Profile...
                </>
              ) : (
                <>
                  Register Profile
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        <div className="text-center mt-6 text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold underline transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

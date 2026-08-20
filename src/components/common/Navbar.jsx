import React, { useState } from 'react';
import { Menu, Bell, Shield, Moon, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function Navbar({ onMenuToggle, mobileOpen }) {
  const { state } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);

  const VIEW_LABELS = {
    workspace: 'Verification Workspace',
    admin: 'Admin Security Dashboard',
  };

  return (
    <header
      className="sticky top-0 z-20 glass-strong border-b border-slate-700/50 px-4 lg:px-6 py-3"
      style={{ backdropFilter: 'blur(20px)' }}
    >
      <div className="flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <div
              className="w-1 h-6 rounded-full"
              style={{ background: 'linear-gradient(180deg, #06b6d4, #8b5cf6)' }}
            />
            <h1 className="text-sm font-semibold text-slate-200">
              {VIEW_LABELS[state.activeView] || 'DeepGuard'}
            </h1>
          </div>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2">
            <Shield size={18} className="text-cyan-400" />
            <span className="font-bold text-sm gradient-text">DeepGuard</span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Mock data indicator */}
          {state.isMockData && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-blink" />
              <span className="text-xs text-amber-400 font-medium">Demo Mode</span>
            </div>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
            >
              <Bell size={18} />
              {state.alertFeed?.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-blink" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 glass-strong rounded-xl shadow-2xl z-50 border border-slate-700/50 overflow-hidden animate-fade-in-up">
                <div className="px-4 py-3 border-b border-slate-700/50">
                  <p className="text-sm font-semibold text-slate-200">Recent Alerts</p>
                </div>
                {state.alertFeed?.slice(0, 4).map((alert) => (
                  <div key={alert.id} className={`px-4 py-3 border-b border-slate-800/50 alert-${alert.severity}`}>
                    <p className="text-xs text-slate-300">{alert.message}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
                {(!state.alertFeed || state.alertFeed.length === 0) && (
                  <div className="px-4 py-6 text-center text-xs text-slate-500">No active alerts</div>
                )}
              </div>
            )}
          </div>

          {/* User Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
          >
            A
          </div>
        </div>
      </div>
    </header>
  );
}

import React from 'react';
import { Shield, LayoutDashboard, History, User, HelpCircle, ChevronRight, Cpu, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar({ mobileOpen, onClose }) {
  const { state, toggleHistory } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path) => {
    navigate(path);
    onClose?.();
  };

  const navItems = [
    { label: 'Verification Workspace', icon: Shield, path: '/dashboard' },
    { label: 'Automated Monitors', icon: Clock, path: '/dashboard/monitors' },
    { label: 'Account Profile', icon: User, path: '/dashboard/profile' },
    { label: 'Educational Hub', icon: HelpCircle, path: '/dashboard/about' },
  ];

  // Render Admin Dashboard only for admin users
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-40 w-64 flex flex-col
          glass-strong border-r border-cyan-500/10
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto lg:h-auto
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
              onClick={() => handleNav('/')}
              style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
            >
              <Cpu size={20} className="text-white" />
            </div>
            <div className="cursor-pointer" onClick={() => handleNav('/')}>
              <p className="font-bold text-sm text-slate-200 leading-tight">DeepGuard</p>
              <p className="text-xs text-slate-500">Verification Gateway</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider px-3 mb-2">Main</p>
          
          {navItems.map(({ label, icon: Icon, path }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => handleNav(path)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 text-left group
                  ${isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }
                `}
              >
                <Icon size={18} className={isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={14} className="text-cyan-400" />}
              </button>
            );
          })}

          {isAdmin && (
            <div className="pt-2">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider px-3 mb-2">Admin</p>
              <button
                onClick={() => handleNav('/admin')}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 text-left group
                  ${location.pathname.startsWith('/admin')
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }
                `}
              >
                <LayoutDashboard size={18} className={location.pathname.startsWith('/admin') ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="flex-1">Admin Dashboard</span>
                {location.pathname.startsWith('/admin') && <ChevronRight size={14} className="text-purple-400" />}
              </button>
            </div>
          )}

          <div className="pt-2">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider px-3 mb-2">Tools</p>
            <button
              onClick={toggleHistory}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-all duration-200 text-left group"
            >
              <History size={18} className="text-slate-500 group-hover:text-slate-300" />
              <span>Scan History</span>
              {state.scanHistory.length > 0 && (
                <span className="ml-auto bg-cyan-500/20 text-cyan-400 text-xs font-bold px-2 py-0.5 rounded-full">
                  {state.scanHistory.length}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* Status Indicator */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-blink" />
              <span className="text-xs text-slate-400 font-medium">System Online</span>
            </div>
            <p className="text-xs text-slate-500">Model: DeepGuard-v3.1</p>
            <p className="text-xs text-slate-600 mt-1">API: localhost:8000</p>
          </div>
        </div>
      </aside>
    </>
  );
}

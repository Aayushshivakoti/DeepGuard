import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp, ACTIONS } from '../context/AppContext';
import { getAdminMetrics, getAlertFeed, getAdminUsersList, toggleUserActiveStatus, assignUserRole, MOCK_ADMIN_METRICS, MOCK_ALERT_FEED } from '../api/scanApi';

// Components
import Sidebar from '../components/common/Sidebar';
import MetricCards from '../components/admin/MetricCards';
import ThreatCharts from '../components/admin/ThreatCharts';
import AlertFeed from '../components/admin/AlertFeed';
import AuditTable from '../components/admin/AuditTable';
import SystemSettings from '../components/admin/SystemSettings';
import HitlQueue from '../components/admin/HitlQueue';
import ThreatMap from '../components/admin/ThreatMap';
import RbacManager from '../components/admin/RbacManager';
import SiemLoggerView from '../components/admin/SiemLoggerView';
import DatasetExporterModal from '../components/admin/DatasetExporterModal';
import SoarPlaybooks from '../components/admin/SoarPlaybooks';
const Telemetry = React.lazy(() => import('../components/admin/Telemetry'));
import SiemExporterSettings from '../components/admin/SiemExporterSettings';
import UserQuotas from '../components/admin/UserQuotas';
import CaseDossier from '../components/admin/CaseDossier';
import WebhookSettings from '../components/admin/WebhookSettings';
import { useTheme } from '../hooks/useTheme';

// Icons
import {
  LogOut, User, Users, Server, RefreshCw, Loader2, Sun, Moon, Menu, Database,
  BarChart3, ShieldAlert, FileText, SlidersHorizontal, Settings as SettingsIcon,
  Activity, Globe, Lock, Zap, Layers, Terminal, Send
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { state, dispatch } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { adminMetrics, alertFeed } = state;

  // Primary 5-Tab Navigation State
  const [activeTab, setActiveTab] = useState('analytics'); // analytics | review | logs | users | settings

  // Sub-View Navigation States
  const [analyticsSubView, setAnalyticsSubView] = useState('overview'); // overview | telemetry | threats
  const [logsSubView, setLogsSubView] = useState('audit'); // audit | stream
  const [usersSubView, setUsersSubView] = useState('accounts'); // accounts | quotas
  const [settingsSubView, setSettingsSubView] = useState('setup'); // setup | rbac | soar

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [showDatasetExporter, setShowDatasetExporter] = useState(false);

  const fetchMetricsAndAlerts = async () => {
    setIsLoadingMetrics(true);
    try {
      const [metrics, alerts] = await Promise.all([
        getAdminMetrics(),
        getAlertFeed(),
      ]);
      dispatch({ type: ACTIONS.SET_ADMIN_METRICS, payload: metrics });
      dispatch({ type: ACTIONS.SET_ALERT_FEED, payload: alerts });
    } catch (err) {
      console.warn('Failed to load admin stats:', err.message);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const list = await getAdminUsersList();
      setUsersList(list);
    } catch (err) {
      console.warn('Failed to load registered users:', err.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchMetricsAndAlerts();
    if (activeTab === 'users' && usersSubView === 'accounts') {
      fetchUsers();
    }
  }, [activeTab, usersSubView]);

  const handleToggleUser = async (userId) => {
    try {
      await toggleUserActiveStatus(userId);
      fetchUsers();
    } catch (err) {
      console.error('Failed to toggle user account status:', err.message);
    }
  };

  const metrics = adminMetrics || MOCK_ADMIN_METRICS;
  const alerts = alertFeed?.length ? alertFeed : MOCK_ALERT_FEED;

  return (
    <div className="flex h-screen overflow-hidden text-slate-100" style={{ background: 'var(--bg-main)' }}>
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Navbar Header */}
        <header className="h-16 border-b border-slate-900 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-all mr-1"
            >
              <Menu size={16} />
            </button>
            <Server className="text-purple-400" size={20} />
            <h1 className="font-extrabold text-base tracking-wider text-slate-100 hidden sm:block">OPERATIONS CONTROL CENTER</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Consolidated 5-Tab Navbar */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'analytics' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 size={14} />
                <span>Analytics</span>
              </button>

              <button
                onClick={() => setActiveTab('review')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'review' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert size={14} />
                <span>Manual Review</span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'logs' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText size={14} />
                <span>Logs & SIEM</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'users' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users size={14} />
                <span>Users Control</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'settings' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <SettingsIcon size={14} />
                <span>Settings</span>
              </button>
            </div>

            {/* Profile */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800">
              <User size={14} className="text-slate-400" />
              <span className="text-xs text-slate-300 font-medium truncate max-w-[140px]">{user?.email}</span>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {user?.role}
              </span>
            </div>
            
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all flex items-center justify-center"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              onClick={logout}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
              title="Logout Profile"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Dashboard Main Content */}
        <main className="flex-1 overflow-y-auto p-6 cyber-grid space-y-6">
          
          {/* TAB 1: ANALYTICS (Overview | Telemetry | Threat Map) */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fade-in-up">
              {/* Sub-View Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900">
                  <button
                    onClick={() => setAnalyticsSubView('overview')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      analyticsSubView === 'overview' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <BarChart3 size={13} />
                    <span>Overview</span>
                  </button>
                  <button
                    onClick={() => setAnalyticsSubView('telemetry')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      analyticsSubView === 'telemetry' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Activity size={13} />
                    <span>Model Telemetry</span>
                  </button>
                  <button
                    onClick={() => setAnalyticsSubView('threats')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      analyticsSubView === 'threats' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Globe size={13} />
                    <span>Threat Map</span>
                  </button>
                </div>

                <button
                  onClick={fetchMetricsAndAlerts}
                  disabled={isLoadingMetrics}
                  className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all flex items-center gap-1.5 text-xs"
                >
                  <RefreshCw size={13} className={isLoadingMetrics ? 'animate-spin' : ''} />
                  <span>Refresh Data</span>
                </button>
              </div>

              {analyticsSubView === 'overview' && (
                <>
                  <MetricCards metrics={metrics} />
                  <ThreatCharts metrics={metrics} />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <AlertFeed alerts={alerts} />
                    <AuditTable cases={metrics.borderline_cases || []} />
                  </div>
                </>
              )}

              {analyticsSubView === 'telemetry' && (
                <React.Suspense fallback={<div className="text-slate-400 text-xs p-6 bg-slate-900/20 border border-slate-800 rounded-2xl">Loading Telemetry...</div>}>
                  <Telemetry />
                </React.Suspense>
              )}
              {analyticsSubView === 'threats' && <ThreatMap />}
            </div>
          )}

          {/* TAB 2: MANUAL REVIEW (HITL Queue + Case Dossier) */}
          {activeTab === 'review' && (
            <div className="space-y-6 animate-fade-in-up">
              <HitlQueue />
              <CaseDossier />
            </div>
          )}

          {/* TAB 3: LOGS & SIEM (Audit Logs | Live Stream) */}
          {activeTab === 'logs' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900 w-fit">
                <button
                  onClick={() => setLogsSubView('audit')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    logsSubView === 'audit' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText size={13} />
                  <span>Audit Logs</span>
                </button>
                <button
                  onClick={() => setLogsSubView('stream')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    logsSubView === 'stream' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Terminal size={13} />
                  <span>Live Stream & Forwarder</span>
                </button>
              </div>

              {logsSubView === 'audit' && (
                <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950/40">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Historical Audit Trail</h3>
                  <AuditTable cases={metrics.borderline_cases || []} />
                </div>
              )}

              {logsSubView === 'stream' && (
                <>
                  <SiemLoggerView />
                  <SiemExporterSettings />
                </>
              )}
            </div>
          )}

          {/* TAB 4: USERS CONTROL (User Accounts | Quota Governance) */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900 w-fit">
                <button
                  onClick={() => setUsersSubView('accounts')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    usersSubView === 'accounts' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users size={13} />
                  <span>User Accounts</span>
                </button>
                <button
                  onClick={() => setUsersSubView('quotas')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    usersSubView === 'quotas' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <SlidersHorizontal size={13} />
                  <span>Quota Governance</span>
                </button>
              </div>

              {usersSubView === 'accounts' && (
                <div className="space-y-6 p-6 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-black text-white flex items-center gap-2">
                        <Users size={20} className="text-purple-400" />
                        User Registry Management
                      </h2>
                      <p className="text-xs text-slate-400">Lock, activate, or view registered user access profiles</p>
                    </div>
                    <button
                      onClick={fetchUsers}
                      disabled={isLoadingUsers}
                      className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900/50 border border-slate-800 hover:bg-slate-900 transition-all"
                    >
                      <RefreshCw size={14} className={isLoadingUsers ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {isLoadingUsers ? (
                    <div className="py-20 flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-purple-400" size={32} />
                      <span className="text-sm text-slate-400">Fetching accounts...</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-900/80">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-900">
                          <tr>
                            <th className="px-6 py-3.5">User ID</th>
                            <th className="px-6 py-3.5">Email Address</th>
                            <th className="px-6 py-3.5">Assigned Role</th>
                            <th className="px-6 py-3.5">Created At</th>
                            <th className="px-6 py-3.5">Status</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-950 bg-slate-900/10">
                          {usersList.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-8 text-slate-500">
                                No registered users found.
                              </td>
                            </tr>
                          ) : (
                            usersList.map((usr) => (
                              <tr key={usr.id} className="hover:bg-slate-900/20 transition-colors">
                                <td className="px-6 py-3 text-xs text-slate-500 font-mono">
                                  {usr.id}
                                </td>
                                <td className="px-6 py-3 font-bold text-slate-200">
                                  {usr.email}
                                </td>
                                <td className="px-6 py-3">
                                  <select
                                    value={usr.role}
                                    onChange={async (e) => {
                                      const newRole = e.target.value;
                                      try {
                                        await assignUserRole(usr.id, newRole);
                                        fetchUsers();
                                      } catch (err) {
                                        console.error("Failed to assign role:", err);
                                      }
                                    }}
                                    className="bg-slate-950 border border-slate-800 text-[10px] rounded px-1.5 py-0.5 text-slate-300 font-bold uppercase cursor-pointer"
                                  >
                                    <option value="USER">User (Analyst)</option>
                                    <option value="ADMIN">Super Admin</option>
                                    <option value="SECURITY_ANALYST">Security Analyst</option>
                                    <option value="AUDITOR">Auditor</option>
                                  </select>
                                </td>
                                <td className="px-6 py-3 text-xs text-slate-400">
                                  {new Date(usr.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    usr.is_active
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  }`}>
                                    {usr.is_active ? 'Active' : 'Locked'}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  {usr.email === user?.email ? (
                                    <span className="text-xs text-slate-600 font-semibold px-2 py-1">Self</span>
                                  ) : (
                                    <button
                                      onClick={() => handleToggleUser(usr.id)}
                                      className={`p-1.5 rounded-lg text-xs font-semibold border transition-all inline-flex items-center gap-1.5 ${
                                        usr.is_active
                                          ? 'bg-red-500/15 border-red-500/20 hover:border-red-500/40 text-red-400'
                                          : 'bg-emerald-500/15 border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400'
                                      }`}
                                    >
                                      {usr.is_active ? 'Lock Account' : 'Unlock Account'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {usersSubView === 'quotas' && <UserQuotas />}
            </div>
          )}

          {/* TAB 5: SETTINGS (General Setup | RBAC & Keys | SOAR Playbooks) */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900">
                  <button
                    onClick={() => setSettingsSubView('setup')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      settingsSubView === 'setup' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <SettingsIcon size={13} />
                    <span>General Setup</span>
                  </button>
                  <button
                    onClick={() => setSettingsSubView('webhooks')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      settingsSubView === 'webhooks' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Send size={13} />
                    <span>Webhooks</span>
                  </button>
                  <button
                    onClick={() => setSettingsSubView('rbac')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      settingsSubView === 'rbac' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Lock size={13} />
                    <span>API Keys & RBAC</span>
                  </button>
                  <button
                    onClick={() => setSettingsSubView('soar')}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      settingsSubView === 'soar' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Zap size={13} />
                    <span>SOAR Automation</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowDatasetExporter(true)}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Database size={13} /> Export Training Dataset ZIP
                </button>
              </div>

              {settingsSubView === 'setup' && <SystemSettings />}
              {settingsSubView === 'webhooks' && <WebhookSettings />}
              {settingsSubView === 'rbac' && <RbacManager />}
              {settingsSubView === 'soar' && <SoarPlaybooks />}
            </div>
          )}
        </main>

        {showDatasetExporter && <DatasetExporterModal onClose={() => setShowDatasetExporter(false)} />}
      </div>
    </div>
  );
}

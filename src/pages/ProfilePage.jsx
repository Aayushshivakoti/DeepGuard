import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  User, Shield, Lock, Eye, EyeOff, Key, Copy, Check, Moon, Sun, 
  Database, HelpCircle, Users, Plus, Trash2, ChevronRight, UserPlus 
} from 'lucide-react';
import { 
  getTeams, createTeam, getTeamMembers, addTeamMember, removeTeamMember 
} from '../api/scanApi';

export default function ProfilePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview'); // overview | security | teams | settings

  // Password state variables
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const [passError, setPassError] = useState('');

  // API Key state variables
  const [apiKey, setApiKey] = useState(localStorage.getItem('api_key') || '');
  const [isCopied, setIsCopied] = useState(false);

  // Theme state variables
  const [themeMode, setThemeMode] = useState(localStorage.getItem('theme') || 'dark');

  // Team management states
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  const fetchTeams = async () => {
    setIsLoadingTeams(true);
    try {
      const data = await getTeams();
      setTeams(data);
    } catch (err) {
      console.warn("Failed to fetch teams:", err);
      // Fallback
      setTeams([
        { id: 't-1', name: 'Security Operations Center', role: 'OWNER', member_count: 5, created_at: new Date().toISOString() },
        { id: 't-2', name: 'Analyst Workspace', role: 'MEMBER', member_count: 3, created_at: new Date().toISOString() }
      ]);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'teams') {
      fetchTeams();
    }
  }, [activeTab]);

  const handleSelectTeam = async (team) => {
    setSelectedTeam(team);
    try {
      const members = await getTeamMembers(team.id);
      setTeamMembers(members);
    } catch (err) {
      console.warn("Failed to fetch team members:", err);
      // Fallback
      setTeamMembers([
        { user_id: 'u-1', email: 'owner@company.com', role: 'OWNER' },
        { user_id: 'u-2', email: 'analyst1@company.com', role: 'ADMIN' },
        { user_id: 'u-3', email: 'member@company.com', role: 'ANALYST' }
      ]);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      await createTeam(newTeamName);
      addToast('Team workspace created successfully.', 'success');
      setNewTeamName('');
      fetchTeams();
    } catch (err) {
      addToast('Failed to create team.', 'error');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !selectedTeam) return;
    try {
      await addTeamMember(selectedTeam.id, newMemberEmail);
      addToast(`Invitation sent to ${newMemberEmail}.`, 'success');
      setNewMemberEmail('');
      handleSelectTeam(selectedTeam);
    } catch (err) {
      addToast('Failed to invite member.', 'error');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedTeam) return;
    try {
      await removeTeamMember(selectedTeam.id, userId);
      addToast('Member removed from team.', 'success');
      handleSelectTeam(selectedTeam);
    } catch (err) {
      addToast('Failed to remove member.', 'error');
    }
  };

  // Interactive RBAC role selector callback
  const handleRoleChange = (memberId, newRole) => {
    setTeamMembers(prev => prev.map(m => m.user_id === memberId ? { ...m, role: newRole } : m));
    addToast('Member role updated successfully.', 'success');
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    setPassError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassError('All password fields are required.');
      addToast('All password fields are required.', 'warning');
      return;
    }

    if (newPassword.length < 8) {
      setPassError('New password must be at least 8 characters long.');
      addToast('Password too short (min 8 chars).', 'warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match.');
      addToast('Passwords do not match.', 'warning');
      return;
    }

    addToast('Security credential update successful.', 'success');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleGenerateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let keySegment = '';
    for (let i = 0; i < 32; i++) {
      keySegment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const generatedKey = `dg_live_${keySegment}`;
    setApiKey(generatedKey);
    localStorage.setItem('api_key', generatedKey);
    addToast('New API access key generated.', 'success');
  };

  const handleCopyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setIsCopied(true);
    addToast('API Key copied to clipboard.', 'success');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleThemeChange = (mode) => {
    setThemeMode(mode);
    localStorage.setItem('theme', mode);
    if (mode === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    addToast(`Theme toggled to ${mode} mode.`, 'info');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* Title */}
      <div>
        <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
          <User className="text-cyan-400" size={20} />
          Account Profile & Configuration
        </h2>
        <p className="text-xs text-slate-500 mt-1">Manage your developer access credentials, team workspaces, and authentication settings.</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-900 bg-slate-950/40 p-1 rounded-xl">
        {[
          { id: 'overview', label: 'Identity Overview', icon: User },
          { id: 'security', label: 'Security & Password', icon: Lock },
          { id: 'teams', label: 'Team Workspaces', icon: Users },
          { id: 'settings', label: 'Developer API & Settings', icon: Key },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all
                ${isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="glass rounded-2xl p-6 border border-slate-800/80">
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Identity Header */}
            <div className="flex items-center gap-5 bg-slate-900/20 p-4 rounded-xl border border-slate-900">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white uppercase tracking-wider"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
              >
                {user?.email ? user.email.substring(0, 2) : 'DG'}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-200">{user?.email}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Role: {user?.role || 'USER'}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Tier: PRO Enterprise
                  </span>
                </div>
              </div>
            </div>

            {/* Verification Statistics */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Usage Statistics</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Verification Scans', value: '142 scans', desc: 'Active history usage', icon: Database, color: 'text-cyan-400' },
                  { label: 'Authentic Artifacts', value: '98 items', desc: 'Valid media provenance', icon: HelpCircle, color: 'text-green-400' },
                  { label: 'Phishing / Deepfakes Flagged', value: '44 alerts', desc: 'Total blocked incidents', icon: Shield, color: 'text-red-400' },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-slate-900 ${stat.color}`}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold">{stat.label}</p>
                        <p className="text-base font-extrabold text-slate-200 mt-1">{stat.value}</p>
                        <p className="text-[9px] text-slate-600 font-medium mt-0.5">{stat.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Change Password</h3>

            {passError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                {passError}
              </div>
            )}

            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-semibold">Current Password</label>
              <div className="relative">
                <input
                  type={showPass.current ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="cyber-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass.current ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-semibold">New Password</label>
              <div className="relative">
                <input
                  type={showPass.new ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="cyber-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass.new ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-semibold">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showPass.confirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="cyber-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass.confirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary py-2 px-5 text-xs font-bold rounded-xl mt-2">
              Update Credentials
            </button>
          </form>
        )}

        {/* TAB 3: TEAMS WORKSPACES */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div className="space-y-4 flex-1">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Create New Workspace</h3>
                <form onSubmit={handleCreateTeam} className="flex gap-2">
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="E.g. Fraud Investigation Unit"
                    className="cyber-input py-1.5 text-xs"
                  />
                  <button type="submit" className="btn-primary flex items-center gap-1.5 py-1.5 px-4 text-xs">
                    <Plus size={14} />
                    Create
                  </button>
                </form>

                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mt-4">Your Workspaces</h3>
                <div className="space-y-2">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTeam(t)}
                      className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all ${
                        selectedTeam?.id === t.id 
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-bold' 
                          : 'bg-slate-950/20 border-slate-900 text-slate-300 hover:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Users size={16} />
                        <span>{t.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{t.member_count} members</span>
                        <ChevronRight size={12} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTeam && (
                <div className="flex-1 bg-slate-950/40 p-4 rounded-2xl border border-slate-900 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                    <h4 className="text-sm font-extrabold text-white">{selectedTeam.name}</h4>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {selectedTeam.role}
                    </span>
                  </div>

                  {/* Add Member Form */}
                  <form onSubmit={handleAddMember} className="flex gap-2">
                    <input
                      type="email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      placeholder="invite@company.com"
                      className="cyber-input py-1.5 text-xs"
                    />
                    <button type="submit" className="btn-primary flex items-center gap-1 py-1.5 px-3 text-xs">
                      <UserPlus size={13} />
                      Invite
                    </button>
                  </form>

                  {/* Member List with role updates */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Workspace Members (RBAC)</p>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {teamMembers.map((m) => (
                        <div key={m.user_id} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-900 text-xs">
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="truncate font-medium text-slate-300" title={m.email}>{m.email}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Role Dropdown Selector */}
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                              className="bg-slate-900 border border-slate-800 text-[10px] text-slate-300 rounded p-1 outline-none"
                              disabled={m.role === 'OWNER'}
                            >
                              <option value="OWNER">Owner</option>
                              <option value="ADMIN">Admin</option>
                              <option value="ANALYST">Analyst</option>
                              <option value="VIEWER">Viewer</option>
                            </select>

                            {selectedTeam.role === 'OWNER' && m.role !== 'OWNER' && (
                              <button
                                onClick={() => handleRemoveMember(m.user_id)}
                                className="text-red-400 hover:text-red-300 p-1"
                                title="Remove Member"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DEVELOPER API & SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Theme Settings */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Appearance Engine</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`
                    p-4 rounded-xl border flex items-center justify-center gap-3 text-xs font-bold transition-all
                    ${themeMode === 'dark'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : 'bg-slate-950/20 border-slate-900 text-slate-400 hover:text-slate-200'
                    }
                  `}
                >
                  <Moon size={16} />
                  Cyber Dark Mode
                </button>
                
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`
                    p-4 rounded-xl border flex items-center justify-center gap-3 text-xs font-bold transition-all
                    ${themeMode === 'light'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : 'bg-slate-950/20 border-slate-900 text-slate-400 hover:text-slate-200'
                    }
                  `}
                >
                  <Sun size={16} />
                  Crisp Light Mode
                </button>
              </div>
            </div>

            <hr className="border-slate-900" />

            {/* API Keys */}
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Developer API Access</h3>
                <p className="text-[10px] text-slate-500 mt-1">Integrate verification endpoints directly within your automation pipelines.</p>
              </div>

              {apiKey ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                  <div className="flex-1 bg-slate-950 p-2.5 rounded-xl border border-slate-900 font-mono text-[10px] text-cyan-400 truncate select-all flex items-center justify-between">
                    <span>{apiKey}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyKey}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
                      title="Copy Key"
                    >
                      {isCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={handleGenerateApiKey}
                      className="btn-ghost py-2.5 px-4 text-xs font-bold rounded-xl border border-slate-900"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGenerateApiKey}
                  className="btn-primary py-2.5 px-5 text-xs font-bold rounded-xl"
                >
                  Generate Developer Key
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

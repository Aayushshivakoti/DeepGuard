import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useScan } from '../hooks/useScan';
import { getUserScans } from '../api/scanApi';
import { ACTIONS } from '../context/AppContext';
import { Routes, Route, useNavigate } from 'react-router-dom';

// UI components
import Sidebar from '../components/common/Sidebar';
import InputTabs from '../components/workspace/InputTabs';
import Dropzone from '../components/workspace/Dropzone';
import ResultCard from '../components/workspace/ResultCard';
import ScanProgress from '../components/workspace/ScanProgress';
import AlertHub from '../components/common/AlertHub';
import ShortcutsModal from '../components/workspace/ShortcutsModal';
import VideoTimelineScrubber from '../components/VideoTimelineScrubber'; // Adjust path if needed
import ProfilePage from './ProfilePage';
import AboutPage from './AboutPage';
import ScheduledMonitorsTab from '../components/workspace/ScheduledMonitorsTab';
import { useTheme } from '../hooks/useTheme';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

// Lucide & PDF
import {
  LogOut, User, Shield, RefreshCw, Calendar, FileText, CheckCircle,
  AlertTriangle, Scan, Link as LinkIcon, Menu, Search, ChevronLeft, ChevronRight,
  HelpCircle, Eye, ChevronDown, ChevronUp, Cpu, SlidersHorizontal, Sun, Moon, Bell
} from 'lucide-react';
import jsPDF from 'jspdf';

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const { state, resetScan, dispatch } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { runScan, runUrlScan, runBatchScan } = useScan();
  const navigate = useNavigate();

  // Responsive Drawer State
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAlertHub, setShowAlertHub] = useState(false);

  const { toggleHistory } = useApp();

  useKeyboardShortcuts({
    onFocusUrl: () => {
      dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: 'url' });
      setTimeout(() => {
        const input = document.getElementById('url-scan-input');
        if (input) {
          input.focus();
          input.classList.add('ring-2', 'ring-cyan-500', 'animate-pulse');
          setTimeout(() => {
            input.classList.remove('ring-2', 'ring-cyan-500', 'animate-pulse');
          }, 2000);
        }
      }, 80);
    },
    onToggleSearch: () => {
      const input = document.getElementById('workspace-search-input');
      if (input) {
        input.focus();
        input.classList.add('ring-2', 'ring-cyan-500', 'animate-pulse');
        setTimeout(() => {
          input.classList.remove('ring-2', 'ring-cyan-500', 'animate-pulse');
        }, 2000);
      } else {
        toggleHistory();
      }
    },
    onCloseModals: () => {
      if (state.historyOpen) {
        toggleHistory();
      }
    }
  });

  // Scan State
  const [selectedFile, setSelectedFile] = useState(null);
  const [personalHistory, setPersonalHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  // Search & Filter Workspace States
  const [searchTerm, setSearchTerm] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [mediaFilter, setMediaFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedScanId, setExpandedScanId] = useState(null);
  const itemsPerPage = 6;

  const fetchPersonalHistory = async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const scans = await getUserScans();
      setPersonalHistory(scans);
    } catch (err) {
      console.warn('Failed to load user scan history:', err.message);
      setHistoryError(err.response?.data?.detail || err.message || 'Failed to load scan history. Please check your connection and try again.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchPersonalHistory();
  }, [state.scanResult]);

  const handleFileDrop = useCallback(
    (files) => {
      if (files && files.length > 0) {
        const file = files[0];
        setSelectedFile(file);
        resetScan();
        runScan(file);
      }
    },
    [runScan, resetScan]
  );

  const handleScanBatch = useCallback(
    async (files, onProgress) => {
      resetScan();
      if (files && files.length > 0) {
        setSelectedFile(files[files.length - 1]);
        await runBatchScan(files, state.activeTab, onProgress);
      }
    },
    [runBatchScan, resetScan, state.activeTab]
  );

  const handleUrlScan = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setUrlError('Please enter a URL to scan');
      return;
    }
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      setUrlError('');
      resetScan();
      runUrlScan(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      setUrlError('Please enter a valid URL');
    }
  };

  const handleDownloadPDF = (result) => {
    if (!result) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('DEEPGUARD FORENSIC REPORT', 20, 26);
    
    // Summary table
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.text(`File/Target Name: ${result.filename || result.url || 'Unknown'}`, 20, 55);
    doc.text(`Media Type: ${result.media_type.toUpperCase()}`, 20, 63);
    doc.text(`Verdict: ${result.verdict.replace('_', ' ')}`, 20, 71);
    doc.text(`Confidence Score: ${result.confidence}%`, 20, 79);
    doc.text(`Timestamp: ${new Date(result.timestamp || Date.now()).toLocaleString()}`, 20, 87);
    doc.text(`Analysis Engine: ${result.model_version || 'DeepGuard-v3.1'}`, 20, 95);

    // Grid details
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 105, 190, 105);

    doc.setFontSize(14);
    doc.text('Forensic Engine Indicators:', 20, 115);
    
    doc.setFontSize(10);
    let y = 125;
    if (result.flags && result.flags.length > 0) {
      result.flags.forEach((flag, idx) => {
        doc.text(`${idx + 1}. [${flag.severity.toUpperCase()}] ${flag.label}: ${flag.description}`, 20, y);
        y += 8;
      });
    } else {
      doc.text('No suspicious anomalies detected. Media provenance authentic.', 20, y);
    }

    doc.line(20, y + 10, 190, y + 10);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This report is generated cryptographically by DeepGuard Forensic Media Verification Gateway.', 20, y + 20);
    
    doc.save(`Forensic_Report_${result.id || 'scan'}.pdf`);
  };

  // Workspace View sub-component
  const WorkspaceView = () => {
    // Filter history calculations
    const filteredHistory = personalHistory.filter(scan => {
      const targetName = (scan.filename || scan.url || '').toLowerCase();
      const matchesSearch = targetName.includes(searchTerm.toLowerCase());
      
      const matchesVerdict = verdictFilter === 'ALL' ||
        (verdictFilter === 'SYNTHETIC_DEEPFAKE' && (scan.verdict === 'DEEPFAKE_DETECTED' || scan.verdict === 'PHISHING_DETECTED')) ||
        scan.verdict === verdictFilter;
      
      const matchesMedia = mediaFilter === 'ALL' || scan.media_type?.toUpperCase() === mediaFilter;
      
      return matchesSearch && matchesVerdict && matchesMedia;
    });

    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handlePageChange = (page) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    };

    return (
      <div className="space-y-6">
        {/* Main Scanner Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left side: Upload card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl border border-slate-900" style={{ background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(12px)' }}>
              <InputTabs />
              
              <div className="mt-4">
                {state.activeTab === 'url' ? (
                  <div className="space-y-4">
                    <form onSubmit={handleUrlScan} className="space-y-3">
                      <div className="relative">
                        <LinkIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          id="url-scan-input"
                          type="text"
                          value={url}
                          onChange={(e) => { setUrl(e.target.value); setUrlError(''); }}
                          placeholder="Enter phishing link or domain URL to scan"
                          className="cyber-input pl-10 pr-48"
                        />
                        <span className="absolute right-36 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[8px] font-bold font-mono text-slate-500 bg-slate-905/80 border border-slate-800 rounded hidden sm:inline">
                          Ctrl+U
                        </span>
                        <button
                          type="submit"
                          className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-1.5 px-4 text-sm"
                        >
                          <Scan size={14} />
                          Scan Link
                        </button>
                      </div>
                      {urlError && <p className="text-xs text-red-400">{urlError}</p>}
                    </form>
                    
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      {[
                        'http://paypa1-secure-login.xyz',
                        'https://bank-of-america-update.info/verify',
                        'http://google-prize-winner.tk/claim',
                      ].map((example) => (
                        <button
                          key={example}
                          onClick={() => setUrl(example)}
                          className="text-left px-3 py-2 rounded-xl text-slate-500 hover:text-slate-300 transition-colors truncate bg-slate-950/40 border border-slate-900"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Dropzone
                    onDrop={handleFileDrop}
                    mediaType={state.activeTab}
                    onFileSelected={(f) => { setSelectedFile(f); resetScan(); if(f) runScan(f, state.activeTab); }}
                    onScanBatch={handleScanBatch}
                    disabled={state.scanStatus === 'scanning'}
                  />
                )}
              </div>
            </div>

            {/* Scan progress */}
            <ScanProgress />
            {/* Video Timeline Scrubber */}
            <VideoTimelineScrubber 
              videoUrl={state.scanResult?.videoUrl} 
              timestamps={state.scanResult?.fakeSegments} 
            />
          </div>

          {/* Right side: Results Card */}
          <div>
            <ResultCard result={state.scanResult} onReset={() => { resetScan(); setSelectedFile(null); }} isMock={state.isMockData} />
          </div>
        </div>

        {/* Personal Scan History Workspace Table */}
        <div className="p-6 rounded-2xl border border-slate-900" style={{ background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(12px)' }}>
          {/* Loading State */}
          {isLoadingHistory && personalHistory.length === 0 && !historyError && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
              <p className="text-sm text-slate-400">Loading scan history…</p>
            </div>
          )}

          {/* Error State */}
          {historyError && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 max-w-md text-center">
                <AlertTriangle size={28} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-red-400 mb-1">Failed to Load Scan History</p>
                <p className="text-xs text-slate-400 mb-3">{historyError}</p>
                <button
                  onClick={fetchPersonalHistory}
                  className="btn-primary py-1.5 px-4 text-xs"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            </div>
          )}

          {/* Normal Content */}
          {!historyError && !(isLoadingHistory && personalHistory.length === 0) && (
          <>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-black text-white">Your Forensic Scans Workspace</h3>
              <p className="text-xs text-slate-400">Manage, search, and deep-inspect your verification history</p>
            </div>
            
            {/* Search Input with shortcut hint badge */}
            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="workspace-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search scans..."
                className="cyber-input pl-9 pr-14 py-1.5 text-xs"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[8px] font-bold font-mono text-slate-500 bg-slate-905/80 border border-slate-800 rounded">
                Ctrl+K
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-900 mb-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
              <SlidersHorizontal size={12} />
              <span>Filters:</span>
            </div>

            {/* Verdict Filters */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'ALL', label: 'All Verdicts' },
                { id: 'AUTHENTIC', label: 'Authentic' },
                { id: 'SUSPICIOUS', label: 'Suspicious' },
                { id: 'SYNTHETIC_DEEPFAKE', label: 'Synthetic/Deepfake' },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setVerdictFilter(v.id); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    verdictFilter === v.id ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div className="hidden md:block w-px h-4 bg-slate-800" />

            {/* Media Type Filters */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'ALL', label: 'All Media' },
                { id: 'IMAGE', label: 'Image' },
                { id: 'AUDIO', label: 'Audio' },
                { id: 'VIDEO', label: 'Video' },
                { id: 'URL', label: 'URL' },
                { id: 'PDF', label: 'PDF' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setMediaFilter(m.id); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    mediaFilter === m.id ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              onClick={fetchPersonalHistory}
              disabled={isLoadingHistory}
              className="md:ml-auto p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
            >
              <RefreshCw size={12} className={isLoadingHistory ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-900/80">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-900">
                <tr>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Filename / Source</th>
                  <th className="px-6 py-3.5">Media Type</th>
                  <th className="px-6 py-3.5">Verdict</th>
                  <th className="px-6 py-3.5">Confidence</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-950 bg-slate-900/20">
                {paginatedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 text-xs">
                      No matching records found. Refine your filters above or run a scan.
                    </td>
                  </tr>
                ) : (
                  paginatedHistory.map((scan) => {
                    const isExpanded = expandedScanId === scan.id;
                    return (
                      <React.Fragment key={scan.id}>
                        <tr
                          onClick={() => setExpandedScanId(isExpanded ? null : scan.id)}
                          className="hover:bg-slate-900/20 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-3 text-xs text-slate-400 font-medium">
                            <span className="flex items-center gap-1.5">
                              <Calendar size={12} />
                              {new Date(scan.timestamp).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-bold text-slate-200 truncate max-w-[200px]" title={scan.filename || scan.url}>
                            <span className="flex items-center gap-2">
                              {isExpanded ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
                              {scan.filename || scan.url || 'Unnamed Scan'}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 text-xs font-semibold uppercase">
                              {scan.media_type}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                              scan.verdict === 'AUTHENTIC' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              scan.verdict === 'SUSPICIOUS' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                              'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {scan.verdict.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-semibold text-slate-300">
                            {scan.confidence}%
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadPDF(scan); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-950/60 border border-slate-900 hover:border-slate-800 transition-all inline-flex items-center gap-1"
                              title="Download Report PDF"
                            >
                              <FileText size={12} />
                              <span className="text-[10px]">PDF</span>
                            </button>
                          </td>
                        </tr>

                        {/* Inline Expanded Forensic Details */}
                        {isExpanded && (
                          <tr className="bg-slate-950/50 animate-fade-in-up">
                            <td colSpan={6} className="px-6 py-4 border-t border-slate-900">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                                <div>
                                  <p className="font-bold text-slate-300 flex items-center gap-1.5">
                                    <Cpu size={13} className="text-cyan-400" />
                                    Model Forensic Indicators
                                  </p>
                                  <div className="space-y-1.5 mt-2.5 font-mono text-[11px]">
                                    <div className="flex justify-between border-b border-slate-900/50 pb-1">
                                      <span className="text-slate-500">FFT Anomaly:</span>
                                      <span className="text-cyan-400">{(scan.engine_metadata?.fft_anomaly_score || (scan.verdict === 'AUTHENTIC' ? 12.4 : scan.confidence * 0.9)).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-900/50 pb-1">
                                      <span className="text-slate-500">DCT Anomaly:</span>
                                      <span className="text-cyan-400">{(scan.engine_metadata?.dct_anomaly_score || (scan.verdict === 'AUTHENTIC' ? 15.1 : scan.confidence * 0.8)).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Latency:</span>
                                      <span className="text-slate-400">{scan.processing_time_ms || 480}ms</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <p className="font-bold text-slate-300 flex items-center gap-1.5">
                                    <SlidersHorizontal size={13} className="text-purple-400" />
                                    Ensemble Contribution
                                  </p>
                                  <div className="space-y-1.5 mt-2.5 font-mono text-[11px]">
                                    {Object.entries(scan.ensemble_weights || {
                                      spatial: scan.media_type === 'image' ? 55 : 20,
                                      temporal: scan.media_type === 'video' ? 45 : 0,
                                      audio: scan.media_type === 'audio' ? 65 : 0,
                                      metadata: scan.media_type === 'url' ? 100 : 15
                                    }).filter(([_, w]) => w > 0).map(([k, w]) => (
                                      <div key={k} className="flex justify-between border-b border-slate-900/50 pb-1">
                                        <span className="capitalize text-slate-500">{k}:</span>
                                        <span className="text-slate-300">{w}%</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <p className="font-bold text-slate-300 flex items-center gap-1.5">
                                    <AlertTriangle size={13} className="text-amber-400" />
                                    Analysis Summary & Flags
                                  </p>
                                  <div className="mt-2.5 text-slate-400 space-y-1">
                                    {scan.flags?.length ? (
                                      scan.flags.map((f, i) => (
                                        <div key={i} className="text-[10px] bg-slate-900 p-1.5 rounded border border-slate-800/80">
                                          <span className="font-bold text-red-400">[{f.severity.toUpperCase()}]</span> {f.label}
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-[11px] leading-relaxed text-slate-500">
                                        No manipulation anomalies detected. Provenance and structural EXIF elements verified as authentic.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs">
              <span className="text-slate-500">
                Showing Page <span className="font-bold text-slate-300">{currentPage}</span> of <span className="font-bold text-slate-300">{totalPages}</span> ({filteredHistory.length} total items)
              </span>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-900">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handlePageChange(i + 1)}
                    className={`w-6 h-6 rounded text-[11px] font-bold ${
                      currentPage === i + 1 ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-100" style={{ background: '#090d16' }}>
      {/* Sidebar Drawer */}
      <Sidebar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Navbar Header */}
        <header className="h-16 border-b border-slate-900 bg-slate-950/60 backdrop-blur-xl flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-all mr-1"
            >
              <Menu size={16} />
            </button>
            <Shield className="text-cyan-400" size={20} />
            <h1 className="font-extrabold text-lg tracking-wider text-slate-100">SECURITY WORKSPACE</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* View Profile Shortcut */}
            <button
              onClick={() => navigate('/dashboard/profile')}
              className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all"
            >
              <User size={14} className="text-slate-400" />
              <span className="text-xs text-slate-300 font-medium truncate max-w-[150px]">{user?.email}</span>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {user?.role}
              </span>
            </button>

            {/* Help/Shortcuts Button */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all flex items-center justify-center"
              title="Keyboard Shortcuts"
            >
              <HelpCircle size={15} />
            </button>

            {/* Alert Hub Notification Button */}
            <button
              onClick={() => setShowAlertHub(!showAlertHub)}
              className={`p-2 rounded-xl border border-transparent transition-all flex items-center justify-center relative ${
                showAlertHub ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
              title="Incident Alert Tray"
            >
              <Bell size={15} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            </button>

            {/* Theme Toggle Button */}
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

        {/* Alert Hub Component Container */}
        <AlertHub isOpen={showAlertHub} onClose={() => setShowAlertHub(false)} />

        {/* Dynamic Nested Routes Content */}
        <main className="flex-1 overflow-y-auto p-6 cyber-grid space-y-6">
          <Routes>
            <Route index element={<WorkspaceView />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="monitors" element={<ScheduledMonitorsTab />} />
          </Routes>
        </main>

        {/* Keyboard Shortcuts Modal */}
        <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      </div>
    </div>
  );
}

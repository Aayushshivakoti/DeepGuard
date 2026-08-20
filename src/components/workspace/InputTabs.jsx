import React from 'react';
import { Image, Video, Music, FileText, Link } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const TABS = [
  { id: 'image', label: 'Image', icon: Image, accept: '.jpg,.jpeg,.png,.webp' },
  { id: 'video', label: 'Video', icon: Video, accept: '.mp4,.mov,.avi,.webm' },
  { id: 'audio', label: 'Audio', icon: Music, accept: '.mp3,.wav,.flac,.ogg' },
  { id: 'pdf', label: 'PDF Doc', icon: FileText, accept: '.pdf' },
  { id: 'url', label: 'URL / Domain', icon: Link, accept: null },
];

export { TABS };

export default function InputTabs({ onTabChange }) {
  const { state, setActiveTab, resetScan } = useApp();

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    resetScan();
    onTabChange?.(tabId);
  };

  return (
    <div className="glass rounded-2xl p-1 flex gap-1 overflow-x-auto scrollbar-none">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = state.activeTab === id;
        return (
          <button
            key={id}
            id={`tab-${id}`}
            onClick={() => handleTabChange(id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              whitespace-nowrap transition-all duration-200 flex-shrink-0
              ${isActive
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
              }
            `}
          >
            <Icon size={16} className={isActive ? 'text-cyan-400' : 'text-slate-600'} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

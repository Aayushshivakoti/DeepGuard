import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, Video, Music, FileText, X, CheckCircle2, AlertCircle, Play, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const MEDIA_TYPE_CONFIG = {
  image: {
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'] },
    icon: Image,
    label: 'Image Files',
    hint: 'JPG, PNG, WEBP, GIF',
    color: '#06b6d4',
  },
  video: {
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.webm'] },
    icon: Video,
    label: 'Video Files',
    hint: 'MP4, MOV, AVI, WEBM',
    color: '#8b5cf6',
  },
  audio: {
    accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.ogg'] },
    icon: Music,
    label: 'Audio Files',
    hint: 'MP3, WAV, FLAC, OGG',
    color: '#f59e0b',
  },
  pdf: {
    accept: { 'application/pdf': ['.pdf'] },
    icon: FileText,
    label: 'PDF Documents',
    hint: 'PDF only',
    color: '#22c55e',
  },
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function Dropzone({ mediaType, onFileSelected, onScanBatch, disabled }) {
  const [files, setFiles] = useState([]);
  const [scanningIndex, setScanningIndex] = useState(-1);
  const { addToast } = useToast();
  const config = MEDIA_TYPE_CONFIG[mediaType] || MEDIA_TYPE_CONFIG.image;
  const Icon = config.icon;

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      addToast('Some files were rejected due to incompatible media types.', 'warning');
      return;
    }
    if (acceptedFiles.length > 0) {
      setFiles(prev => [...prev, ...acceptedFiles]);
      addToast(`Added ${acceptedFiles.length} file(s) to scan queue.`, 'info');
      if (acceptedFiles.length === 1 && onFileSelected) {
        onFileSelected(acceptedFiles[0]);
      }
    }
  }, [addToast, onFileSelected]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: config.accept,
    maxFiles: 10,
    disabled: disabled || scanningIndex !== -1,
    multiple: true,
  });

  const removeFile = (index, e) => {
    e.stopPropagation();
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearQueue = (e) => {
    e.stopPropagation();
    setFiles([]);
    setScanningIndex(-1);
  };

  const handleScanBatchTrigger = async (e) => {
    e.stopPropagation();
    if (files.length === 0) return;

    if (onScanBatch) {
      setScanningIndex(0);
      try {
        await onScanBatch(files, (index) => {
          setScanningIndex(index);
        });
        addToast('Batch scan complete.', 'success');
        setFiles([]);
      } catch (err) {
        addToast('Batch scan encountered an error.', 'error');
      } finally {
        setScanningIndex(-1);
      }
    } else if (onFileSelected) {
      // Fallback single-file
      setScanningIndex(0);
      try {
        for (let i = 0; i < files.length; i++) {
          setScanningIndex(i);
          await onFileSelected(files[i]);
        }
        setFiles([]);
      } finally {
        setScanningIndex(-1);
      }
    }
  };

  const borderColor = isDragReject
    ? '#ef4444'
    : isDragActive
    ? config.color
    : files.length > 0
    ? config.color + '40'
    : 'rgba(6,182,212,0.15)';

  return (
    <div className="space-y-4">
      {/* Drop Target */}
      <div
        {...getRootProps()}
        id={`dropzone-${mediaType}`}
        className={`
          relative rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer
          transition-all duration-300 group overflow-hidden
          ${disabled || scanningIndex !== -1 ? 'opacity-40 cursor-not-allowed' : ''}
          ${isDragActive ? 'dropzone-active' : ''}
        `}
        style={{
          borderColor,
          background: isDragActive
            ? `rgba(6,182,212,0.05)`
            : 'rgba(15,23,42,0.4)',
        }}
      >
        <input {...getInputProps()} />

        {isDragActive && <div className="scan-line" />}

        {/* Core display */}
        <div className="flex flex-col items-center justify-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-105"
            style={{
              background: isDragActive ? `${config.color}20` : 'rgba(6,182,212,0.08)',
              border: `1px solid ${isDragActive ? config.color : 'rgba(6,182,212,0.15)'}`,
            }}
          >
            <Upload size={20} style={{ color: config.color }} />
          </div>

          <p className="text-xs font-bold text-slate-300 mb-0.5">
            {isDragActive ? 'Drop to add items' : `Drag & Drop ${config.label}`}
          </p>
          <p className="text-[10px] text-slate-500">or click to browse local files (up to 10 batch files)</p>
        </div>
      </div>

      {/* Queue Panel */}
      {files.length > 0 && (
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 space-y-3 animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>Verification Queue</span>
              <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] px-1.5 py-0.2 rounded-full">
                {files.length} Files
              </span>
            </span>
            <button
              onClick={clearQueue}
              disabled={scanningIndex !== -1}
              className="text-[10px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <Trash2 size={11} />
              Clear All
            </button>
          </div>

          {/* Scrollable File Queue */}
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {files.map((f, index) => {
              const isScanning = scanningIndex === index;
              const isCompleted = scanningIndex > index;
              const isPending = scanningIndex < index && scanningIndex !== -1;
              
              return (
                <div
                  key={index}
                  className="bg-slate-900/30 border border-slate-900/60 p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Icon size={14} className="text-slate-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-200 truncate">{f.name}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">{formatBytes(f.size)}</p>
                    </div>
                  </div>

                  {/* Status / Actions */}
                  <div className="flex items-center gap-2">
                    {isScanning && (
                      <span className="text-[10px] font-bold text-cyan-400 animate-pulse font-mono bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                        SCANNING...
                      </span>
                    )}
                    {isCompleted && (
                      <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
                        COMPLETED
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded">
                        QUEUED
                      </span>
                    )}
                    
                    {scanningIndex === -1 && (
                      <button
                        onClick={(e) => removeFile(index, e)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="flex gap-2.5 pt-2 border-t border-slate-900">
            <button
              onClick={handleScanBatchTrigger}
              disabled={scanningIndex !== -1}
              className="btn-primary flex-1 justify-center py-2 text-xs font-bold"
            >
              <Play size={13} />
              {scanningIndex !== -1 ? 'Processing Batch...' : 'Verify Media Queue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

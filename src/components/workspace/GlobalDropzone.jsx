import React, { useState, useEffect } from 'react';
import { Upload, Layers } from 'lucide-react';

export default function GlobalDropzone({ onFilesDropped }) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);
      dragCounter = 0;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const filesArray = Array.from(e.dataTransfer.files);
        onFilesDropped?.(filesArray);
        e.dataTransfer.clearData();
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onFilesDropped]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-cyan-950/80 backdrop-blur-xl border-4 border-dashed border-cyan-400 p-8 text-center animate-fade-in-up">
      <div className="p-6 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 mb-4 animate-bounce">
        <Upload size={48} />
      </div>
      <h2 className="text-2xl font-black text-white tracking-wider">DROP MEDIA ANYWHERE TO SCAN</h2>
      <p className="text-sm text-cyan-300 font-mono mt-2 max-w-md">
        DeepGuard Gateway will automatically queue and execute multi-engine verification on all dropped files.
      </p>
    </div>
  );
}

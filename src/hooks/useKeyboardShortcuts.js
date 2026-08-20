import { useEffect } from 'react';

export function useKeyboardShortcuts({ onFocusUrl, onToggleSearch, onCloseModals }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMeta = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd + U: Focus URL Scan Input
      if (isMeta && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        onFocusUrl?.();
      }

      // Ctrl/Cmd + K: Toggle Search/History drawer
      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggleSearch?.();
      }

      // Escape: Close modals/previews
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseModals?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFocusUrl, onToggleSearch, onCloseModals]);
}

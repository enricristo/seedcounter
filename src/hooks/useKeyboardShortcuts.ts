import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onUndo: () => void;
  onSetVisualMode: (mode: 'dots' | 'numbers') => void;
  onNextImage: () => void;
  onPrevImage: () => void;
  onTogglePanning: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onSaveSession: () => void;
  onOpenExport: () => void;
  onToggleTheme: () => void;
  hasImage: boolean;
  hasNextImage: boolean;
  hasPrevImage: boolean;
}

export function useKeyboardShortcuts({
  onUndo,
  onSetVisualMode,
  onNextImage,
  onPrevImage,
  onTogglePanning,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSaveSession,
  onOpenExport,
  onToggleTheme,
  hasImage,
  hasNextImage,
  hasPrevImage
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is focused on an input or textarea, skip single-key shortcuts
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.getAttribute('contenteditable') === 'true'
      );

      // Ctrl/Meta shortcuts are always allowed or checked carefully
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          onUndo();
          return;
        }
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (hasImage) onSaveSession();
          return;
        }
        if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          if (hasImage) onOpenExport();
          return;
        }
      }

      // If user is typing in form, don't execute single letter shortcuts
      if (isTyping) return;

      switch (e.key.toLowerCase()) {
        case '1':
          e.preventDefault();
          onSetVisualMode('dots');
          break;
        case '2':
          e.preventDefault();
          onSetVisualMode('numbers');
          break;
        case 'h':
          e.preventDefault();
          if (hasImage) onTogglePanning();
          break;
        case '+':
        case '=':
          e.preventDefault();
          if (hasImage) onZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          if (hasImage) onZoomOut();
          break;
        case '0':
          e.preventDefault();
          if (hasImage) onResetZoom();
          break;
        case 'd':
          e.preventDefault();
          onToggleTheme();
          break;
        case ' ':
          // Spacebar: next image if we have image queue
          if (hasNextImage) {
            e.preventDefault();
            onNextImage();
          }
          break;
        case 'backspace':
          // Backspace: prev image if we have image queue
          if (hasPrevImage) {
            e.preventDefault();
            onPrevImage();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    onUndo,
    onSetVisualMode,
    onNextImage,
    onPrevImage,
    onTogglePanning,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onSaveSession,
    onOpenExport,
    onToggleTheme,
    hasImage,
    hasNextImage,
    hasPrevImage
  ]);
}

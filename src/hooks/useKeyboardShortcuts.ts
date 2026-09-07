import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onNewTransaction?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts({
  onNewTransaction,
  onSearch,
  onEscape
}: ShortcutHandlers) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' ||
                         target.tagName === 'TEXTAREA' ||
                         target.isContentEditable;

    // Ctrl/Cmd + K  — New Transaction (always)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      onNewTransaction?.();
      return;
    }

    // Ctrl/Cmd + /  — Search (always)
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      onSearch?.();
      return;
    }

    // Skip bare-key shortcuts when typing
    if (isInputField) return;

    // N  — New Transaction (bare key, no modifier)
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      onNewTransaction?.();
      return;
    }

    // /  — Search (bare key)
    if (e.key === '/') {
      e.preventDefault();
      onSearch?.();
      return;
    }

    // Escape — Close modal/search
    if (e.key === 'Escape') {
      onEscape?.();
    }
  }, [onNewTransaction, onSearch, onEscape]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

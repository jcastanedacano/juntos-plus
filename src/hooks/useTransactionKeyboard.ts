import { useEffect, useCallback } from 'react';

interface UseTransactionKeyboardOptions {
  rowCount: number;
  focusedIndex: number;
  onFocusChange: (index: number) => void;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onNewTransaction: () => void;
  onFocusSearch: () => void;
  onEditFocused: () => void;
  onDeleteFocused: () => void;
  onToggleSelectFocused: () => void;
  onTabChange: (tab: 'all' | 'income' | 'expense') => void;
  drawerOpen: boolean;
}

export function useTransactionKeyboard({
  rowCount,
  focusedIndex,
  onFocusChange,
  onOpenDrawer,
  onCloseDrawer,
  onNewTransaction,
  onFocusSearch,
  onEditFocused,
  onDeleteFocused,
  onToggleSelectFocused,
  onTabChange,
  drawerOpen,
}: UseTransactionKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;

      // Always handle Escape
      if (e.key === 'Escape') {
        if (drawerOpen) {
          e.preventDefault();
          onCloseDrawer();
        }
        return;
      }

      // Don't intercept when typing in inputs
      if (isInput) return;

      switch (e.key) {
        case 'n':
          e.preventDefault();
          onNewTransaction();
          break;
        case '/':
          e.preventDefault();
          onFocusSearch();
          break;
        case '1':
          e.preventDefault();
          onTabChange('all');
          break;
        case '2':
          e.preventDefault();
          onTabChange('income');
          break;
        case '3':
          e.preventDefault();
          onTabChange('expense');
          break;
        case 'ArrowUp':
          e.preventDefault();
          onFocusChange(Math.max(0, focusedIndex - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          onFocusChange(Math.min(rowCount - 1, focusedIndex + 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0) onOpenDrawer();
          break;
        case 'e':
          e.preventDefault();
          if (focusedIndex >= 0) onEditFocused();
          break;
        case 'Delete':
          e.preventDefault();
          if (focusedIndex >= 0) onDeleteFocused();
          break;
        case 'a':
          e.preventDefault();
          if (focusedIndex >= 0) onToggleSelectFocused();
          break;
      }
    },
    [
      rowCount,
      focusedIndex,
      onFocusChange,
      onOpenDrawer,
      onCloseDrawer,
      onNewTransaction,
      onFocusSearch,
      onEditFocused,
      onDeleteFocused,
      onToggleSelectFocused,
      onTabChange,
      drawerOpen,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

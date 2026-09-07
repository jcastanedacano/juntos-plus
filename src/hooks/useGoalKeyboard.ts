import { useEffect, useCallback } from 'react';

interface UseGoalKeyboardOptions {
  onNewGoal: () => void;
  onFocusSearch: () => void;
  onCloseDrawer: () => void;
  drawerOpen: boolean;
}

export function useGoalKeyboard({
  onNewGoal,
  onFocusSearch,
  onCloseDrawer,
  drawerOpen,
}: UseGoalKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;

      if (e.key === 'Escape') {
        if (drawerOpen) {
          e.preventDefault();
          onCloseDrawer();
        }
        return;
      }

      if (isInput) return;

      switch (e.key) {
        case 'n':
          e.preventDefault();
          onNewGoal();
          break;
        case '/':
          e.preventDefault();
          onFocusSearch();
          break;
      }
    },
    [onNewGoal, onFocusSearch, onCloseDrawer, drawerOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

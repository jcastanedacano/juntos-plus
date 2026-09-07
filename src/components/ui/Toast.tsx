import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
  /** Optional secondary action for cases like "register as X" vs "register as Y". */
  actionSecondary?: { label: string; onClick: () => void };
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, duration, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="toast-icon" size={20} />;
      case 'error':
        return <XCircle className="toast-icon" size={20} />;
      case 'info':
        return <Info className="toast-icon" size={20} />;
    }
  };

  return (
    <div className={`toast ${toast.type}`}>
      {getIcon()}
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            toast.action!.onClick();
            onRemove(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      {toast.actionSecondary && (
        <button
          className="toast-action toast-action--secondary"
          onClick={() => {
            toast.actionSecondary!.onClick();
            onRemove(toast.id);
          }}
        >
          {toast.actionSecondary.label}
        </button>
      )}
      <button
        className="toast-close"
        onClick={() => onRemove(toast.id)}
        aria-label="Cerrar"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Simple standalone toast functions for use without context
let toastCallback: ((toast: Omit<Toast, 'id'>) => void) | null = null;

export function setToastCallback(callback: (toast: Omit<Toast, 'id'>) => void) {
  toastCallback = callback;
}

export const toast = {
  success: (message: string, duration?: number) => {
    toastCallback?.({ type: 'success', message, duration });
  },
  error: (message: string, duration?: number) => {
    toastCallback?.({ type: 'error', message, duration });
  },
  info: (message: string, duration?: number) => {
    toastCallback?.({ type: 'info', message, duration });
  },
};

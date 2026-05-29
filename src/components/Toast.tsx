import React, { createContext, useContext, useState, useCallback } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  title: string;
  message?: string;
  progress?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: Toast['type'], title: string, message?: string) => string;
  showLoading: (title: string, message?: string) => string;
  updateLoading: (id: string, progress: number, message?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Helper to log activity
const logActivity = async (
  action: string,
  entity: string,
  entityId: number | string | null,
  details: string,
  username: string = 'System'
) => {
  try {
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [null, username, action, entity, entityId, details]
    );
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (type: Toast['type'], title: string, message?: string): string => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, type, title, message }]);

      // Log to activity
      const username = user?.username || 'System';
      const details = message ? `${title}: ${message}` : title;
      const action = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
      logActivity(`toast_${action}`, 'toast', id, details, username);

      if (type !== 'loading') {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, 10000);
      }
      return id;
    },
    [user]
  );

  const showLoading = useCallback(
    (title: string, message?: string): string => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, type: 'loading', title, message, progress: 0 }]);

      // Log to activity
      const username = user?.username || 'System';
      const details = message ? `${title}: ${message}` : title;
      logActivity('toast_loading', 'toast', id, details, username);

      return id;
    },
    [user]
  );

  const updateLoading = useCallback(
    (id: string, progress: number, message?: string) => {
      setToasts(prev => {
        const toast = prev.find(t => t.id === id);
        if (toast && message && message !== toast.message) {
          const username = user?.username || 'System';
          logActivity(
            'toast_progress',
            'toast',
            id,
            `${toast.title}: ${message} (${progress}%)`,
            username
          );
        }
        return prev.map(t => (t.id === id ? { ...t, progress, message: message || t.message } : t));
      });
    },
    [user]
  );

  const dismissToast = useCallback(
    (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, showLoading, updateLoading, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-icon">
            {toast.type === 'success' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
            {toast.type === 'loading' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
            )}
          </span>
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            {toast.message && <div className="toast-message">{toast.message}</div>}
            {toast.type === 'loading' && toast.progress !== undefined && (
              <div
                style={{
                  marginTop: '8px',
                  height: '4px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${toast.progress}%`,
                    background: '#fff',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            )}
          </div>
          {toast.type !== 'loading' && (
            <button className="toast-close" onClick={() => onDismiss(toast.id)}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ToastProvider;

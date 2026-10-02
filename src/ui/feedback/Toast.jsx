import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [queue, setQueue] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now();
    setQueue((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  useEffect(() => {
    if (toast) return;
    if (queue.length === 0) return;

    const [next, ...rest] = queue;
    setQueue(rest);
    setToast(next);

    const timer = setTimeout(() => {
      setToast(null);
    }, next.duration);

    return () => clearTimeout(timer);
  }, [toast, queue]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 'calc(var(--space-4) + var(--safe-top))',
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: 280,
            maxWidth: 'calc(100vw - var(--space-8))',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background:
              toast.type === 'error'
                ? 'var(--color-danger)'
                : toast.type === 'warning'
                ? 'var(--color-warning)'
                : 'var(--color-primary)',
            color: '#FFFFFF',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 'var(--z-toast)',
            textAlign: 'center',
          }}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export default ToastProvider;

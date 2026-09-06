import React from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      right: '2rem',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      background: 'var(--bg-surface-elevated)',
      color: 'var(--text-primary)',
      padding: '1rem 1.4rem',
      borderRadius: 'var(--radius-lg)',
      border: `1px solid ${type === 'success' ? 'var(--brand-olive)' : 'var(--brand-orange)'}`,
      boxShadow: 'var(--shadow-lg)',
      animation: 'fadeIn 0.3s ease-out forwards',
      maxWidth: '420px'
    }}>
      {type === 'success' ? (
        <CheckCircle size={22} className="text-olive" />
      ) : (
        <AlertCircle size={22} className="text-orange" />
      )}
      <div style={{ flex: 1, fontSize: '0.92rem', lineHeight: '1.4' }}>
        {message}
      </div>
      {onClose && (
        <button 
          onClick={onClose}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-muted)', 
            cursor: 'pointer',
            display: 'flex',
            padding: '2px'
          }}
          aria-label="Dismiss toast"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

import React from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;

  return (
    <div 
      className="app-toast-container"
      style={{
        border: `1px solid ${type === 'success' ? 'var(--brand-olive)' : 'var(--brand-orange)'}`
      }}
    >
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

import React, { useEffect } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  Save, 
  RefreshCw, 
  LogOut, 
  CheckCircle2, 
  Info, 
  X 
} from 'lucide-react';

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Please Confirm',
  message = 'Are you sure you want to perform this action?',
  details = null,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning', // 'danger' | 'warning' | 'info' | 'logout' | 'success'
  isLoading = false
}) {
  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  // Visual theming based on modal type
  const typeConfig = {
    danger: {
      icon: <Trash2 size={28} />,
      iconBg: 'rgba(239, 68, 68, 0.15)',
      iconColor: '#ef4444',
      glow: '0 0 24px rgba(239, 68, 68, 0.25)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      confirmBtnStyle: {
        background: '#dc2626',
        color: '#ffffff',
        borderColor: '#ef4444'
      }
    },
    warning: {
      icon: <AlertTriangle size={28} />,
      iconBg: 'rgba(249, 115, 22, 0.15)',
      iconColor: 'var(--brand-orange)',
      glow: '0 0 24px rgba(249, 115, 22, 0.25)',
      borderColor: 'rgba(249, 115, 22, 0.3)',
      confirmBtnStyle: {
        background: 'var(--brand-orange)',
        color: '#ffffff',
        borderColor: 'var(--brand-orange-bright)'
      }
    },
    logout: {
      icon: <LogOut size={28} />,
      iconBg: 'rgba(249, 115, 22, 0.15)',
      iconColor: 'var(--brand-orange)',
      glow: '0 0 24px rgba(249, 115, 22, 0.25)',
      borderColor: 'rgba(249, 115, 22, 0.3)',
      confirmBtnStyle: {
        background: 'var(--brand-orange)',
        color: '#ffffff',
        borderColor: 'var(--brand-orange-bright)'
      }
    },
    info: {
      icon: <Save size={28} />,
      iconBg: 'rgba(107, 143, 73, 0.15)',
      iconColor: 'var(--brand-olive-bright)',
      glow: '0 0 24px rgba(107, 143, 73, 0.25)',
      borderColor: 'rgba(107, 143, 73, 0.3)',
      confirmBtnStyle: {
        background: 'var(--brand-olive)',
        color: '#ffffff',
        borderColor: 'var(--brand-olive-bright)'
      }
    },
    success: {
      icon: <CheckCircle2 size={28} />,
      iconBg: 'rgba(16, 185, 129, 0.15)',
      iconColor: '#10b981',
      glow: '0 0 24px rgba(16, 185, 129, 0.25)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      confirmBtnStyle: {
        background: '#059669',
        color: '#ffffff',
        borderColor: '#10b981'
      }
    }
  };

  const currentTheme = typeConfig[type] || typeConfig.warning;

  return (
    <div className="modal-overlay" onClick={isLoading ? undefined : onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '480px',
          padding: '2rem',
          boxShadow: `var(--shadow-lg), ${currentTheme.glow}`,
          border: `1px solid ${currentTheme.borderColor}`
        }}
      >
        {/* Close Button */}
        {!isLoading && (
          <button 
            type="button"
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        )}

        {/* Modal Header Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: currentTheme.iconBg,
            color: currentTheme.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {currentTheme.icon}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--brand-cream)' }}>
              {title}
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Turf &amp; Taste Confirmation
            </span>
          </div>
        </div>

        {/* Modal Message */}
        <div style={{ 
          fontSize: '0.94rem', 
          color: 'var(--text-secondary)', 
          lineHeight: '1.55',
          marginBottom: details ? '1rem' : '1.75rem' 
        }}>
          {message}
        </div>

        {/* Optional Details Card */}
        {details && (
          <div style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.9rem 1.1rem',
            marginBottom: '1.75rem',
            fontSize: '0.88rem'
          }}>
            {details}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
          >
            {cancelText}
          </button>
          
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="btn"
            style={{ 
              padding: '0.65rem 1.4rem', 
              fontSize: '0.9rem',
              ...currentTheme.confirmBtnStyle
            }}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

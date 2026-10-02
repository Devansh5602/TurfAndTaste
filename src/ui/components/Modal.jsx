import React from 'react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  style,
  ...props
}) {
  if (!isOpen) return null;

  return (
    <div
      className={`ui-modal-overlay ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-modal)',
        padding: 'var(--space-4)',
        ...style,
      }}
      {...props}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-overlay)',
          maxWidth: 'var(--content-max-width)',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <h3
              id="modal-title"
              style={{
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: 18,
              }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ padding: 'var(--space-4)' }}>{children}</div>
      </div>
    </div>
  );
}

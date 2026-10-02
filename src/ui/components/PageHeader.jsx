import React from 'react';

export default function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
  className = '',
  style,
  ...props
}) {
  return (
    <div
      className={`ui-page-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
        ...style,
      }}
      {...props}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-subtle)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ←
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-weight-extrabold)',
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
                margin: '2px 0 0',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

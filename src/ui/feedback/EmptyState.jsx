import React from 'react';

export default function EmptyState({
  icon,
  title,
  message,
  action,
  className = '',
  style,
  ...props
}) {
  return (
    <div
      className={`ui-empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: 'var(--space-8) var(--space-4)',
        ...style,
      }}
      {...props}
    >
      {icon && (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-4)',
            color: 'var(--color-text-muted)',
          }}
        >
          {icon}
        </div>
      )}
      {title && (
        <h3
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
            margin: '0 0 var(--space-2)',
          }}
        >
          {title}
        </h3>
      )}
      {message && (
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            margin: '0 0 var(--space-4)',
            maxWidth: 280,
          }}
        >
          {message}
        </p>
      )}
      {action}
    </div>
  );
}

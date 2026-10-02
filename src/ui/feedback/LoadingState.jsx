import React from 'react';

export default function LoadingState({
  message = 'Loading...',
  className = '',
  style,
  ...props
}) {
  return (
    <div
      className={`ui-loading-state ${className}`}
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8) var(--space-4)',
        ...style,
      }}
      {...props}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-full)',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          animation: 'ui-spin 0.8s linear infinite',
          marginBottom: 'var(--space-3)',
        }}
      />
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
        {message}
      </p>
    </div>
  );
}

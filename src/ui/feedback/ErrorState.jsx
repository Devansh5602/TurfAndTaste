import React from 'react';

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
  style,
  ...props
}) {
  return (
    <div
      className={`ui-error-state ${className}`}
      role="alert"
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
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-danger-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-4)',
          color: 'var(--color-danger)',
          fontSize: 28,
        }}
      >
        ⚠
      </div>
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
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            minHeight: 'var(--control-height)',
            padding: '0 var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}

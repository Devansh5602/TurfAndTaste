import React from 'react';

export default function FormField({
  label,
  error,
  required = false,
  children,
  className = '',
  style,
  ...props
}) {
  return (
    <div
      className={`ui-form-field ${className}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', ...style }}
      {...props}
    >
      {label && (
        <label
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
        </label>
      )}
      {children}
      {error && (
        <span style={{ fontSize: 'var(--text-xs)',          color: 'var(--color-danger)', fontWeight: 'var(--font-weight-medium)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

import React from 'react';

export default function Textarea({
  label,
  error,
  disabled = false,
  required = false,
  className = '',
  style,
  id,
  rows = 3,
  ...props
}) {
  const inputId = id || props.name || label;

  return (
    <div className={`ui-form-field ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {label && (
        <label
          htmlFor={inputId}
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
      <textarea
        id={inputId}
        disabled={disabled}
        required={required}
        rows={rows}
        aria-invalid={!!error}
        style={{
          minHeight: 'calc(var(--control-height) * 2)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          background: 'var(--color-surface-input)',
          color: 'var(--color-text-primary)',
          fontSize: 'var(--text-base)',
          lineHeight: 'var(--line-height-normal)',
          outline: 'none',
          resize: 'vertical',
          transition: 'border-color var(--transition-fast)',
          ...style,
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: 'var(--text-xs)',          color: 'var(--color-danger)', fontWeight: 'var(--font-weight-medium)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

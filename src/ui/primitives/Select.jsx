import React from 'react';

export default function Select({
  label,
  error,
  disabled = false,
  required = false,
  options = [],
  className = '',
  style,
  id,
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
      <select
        id={inputId}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        style={{
          minHeight: 'var(--control-height)',
          padding: '0 var(--space-3)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          background: 'var(--color-surface-input)',
          color: 'var(--color-text-primary)',
          fontSize: 'var(--text-base)',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color var(--transition-fast)',
          ...style,
        }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span style={{ fontSize: 'var(--text-xs)',          color: 'var(--color-danger)', fontWeight: 'var(--font-weight-medium)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

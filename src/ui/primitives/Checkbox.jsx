import React from 'react';

export default function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  required = false,
  className = '',
  style,
  id,
  ...props
}) {
  const inputId = id || props.name || label;

  return (
    <label
      htmlFor={inputId}
      className={`ui-checkbox ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        required={required}
        style={{
          width: 20,
          height: 20,
          accentColor: 'var(--color-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        {...props}
      />
      {label && (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
          {label}
          {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
        </span>
      )}
    </label>
  );
}

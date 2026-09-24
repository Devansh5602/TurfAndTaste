import React from 'react';

/**
 * Standard Form Input Primitive
 */
export default function Input({
  label,
  error,
  icon: Icon,
  type = 'text',
  className = '',
  id,
  required,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="form-group" style={{ marginBottom: '1rem' }}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label} {required && <span style={{ color: 'var(--brand-orange)' }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {Icon && (
          <Icon
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none'
            }}
          />
        )}
        <input
          id={inputId}
          type={type}
          required={required}
          className={`form-input ${error ? 'input-error' : ''} ${className}`.trim()}
          style={Icon ? { paddingLeft: '38px' } : {}}
          {...props}
        />
      </div>
      {error && (
        <span className="form-error-msg" role="alert" style={{ fontSize: '0.78rem', color: 'var(--brand-orange)', marginTop: '4px', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  );
}

import React from 'react';

const variants = {
  error: { background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' },
  warning: { background: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)', color: 'var(--color-warning)' },
  success: { background: 'var(--color-success-bg)', borderColor: 'var(--color-success)', color: 'var(--color-success)' },
  info: { background: 'var(--color-info-bg)', borderColor: 'var(--color-info)', color: 'var(--color-info)' },
};

export default function Alert({
  children,
  variant = 'info',
  className = '',
  style,
  ...props
}) {
  const variantStyle = variants[variant] || variants.info;

  return (
    <div
      className={`ui-alert ${className}`}
      role="alert"
      style={{
        ...variantStyle,
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-weight-medium)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

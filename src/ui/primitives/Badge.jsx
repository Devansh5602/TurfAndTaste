import React from 'react';

const variants = {
  default: {
    background: 'var(--color-surface-subtle)',
    color: 'var(--color-text-secondary)',
  },
  success: {
    background: 'var(--color-success-bg)',
    color: 'var(--color-success)',
  },
  warning: {
    background: 'var(--color-warning-bg)',
    color: 'var(--color-warning)',
  },
  danger: {
    background: 'var(--color-danger-bg)',
    color: 'var(--color-danger)',
  },
  info: {
    background: 'var(--color-info-bg)',
    color: 'var(--color-info)',
  },
  primary: {
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
  },
};

export default function Badge({
  label,
  variant = 'default',
  className = '',
  style,
  ...props
}) {
  const variantStyle = variants[variant] || variants.default;

  return (
    <span
      className={`ui-badge ${className}`}
      style={{
        ...variantStyle,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px var(--space-2)',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-weight-semibold)',
        lineHeight: 'var(--line-height-tight)',
        ...style,
      }}
      {...props}
    >
      {label}
    </span>
  );
}

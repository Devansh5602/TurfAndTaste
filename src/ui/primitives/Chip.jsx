import React from 'react';

export default function Chip({
  label,
  selected = false,
  onClick,
  disabled = false,
  variant = 'default',
  className = '',
  style,
  ...props
}) {
  const variants = {
    default: {
      background: selected ? 'var(--color-primary)' : 'var(--color-surface)',
      color: selected ? '#FFFFFF' : 'var(--color-text-primary)',
      border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
    },
    subtle: {
      background: selected ? 'var(--color-primary-light)' : 'var(--color-surface-subtle)',
      color: selected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
      border: 'none',
    },
  };

  const variantStyle = variants[variant] || variants.default;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`ui-chip ${className}`}
      style={{
        ...variantStyle,
        minHeight: 'var(--touch-target-min)',
        padding: '0 var(--space-3)',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-weight-semibold)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--transition-fast), color var(--transition-fast)',
        ...style,
      }}
      {...props}
    >
      {label}
    </button>
  );
}

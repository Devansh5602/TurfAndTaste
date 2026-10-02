import React from 'react';

const variants = {
  primary: {
    background: 'var(--color-primary)',
    color: '#FFFFFF',
    border: 'none',
  },
  secondary: {
    background: 'var(--color-surface-subtle)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
  },
  danger: {
    background: 'var(--color-danger)',
    color: '#FFFFFF',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-primary)',
    border: 'none',
  },
};

const sizes = {
  sm: { minHeight: 'var(--control-height-sm)', padding: '0 12px', fontSize: 'var(--text-sm)' },
  md: { minHeight: 'var(--control-height)', padding: '0 16px', fontSize: 'var(--text-base)' },
  lg: { minHeight: 'var(--control-height-lg)', padding: '0 20px', fontSize: 'var(--text-md)' },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  onClick,
  type = 'button',
  className = '',
  style,
  ...props
}) {
  const variantStyle = variants[variant] || variants.primary;
  const sizeStyle = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`ui-button ${className}`}
      style={{
        ...variantStyle,
        ...sizeStyle,
        borderRadius: 'var(--radius-md)',
        fontWeight: 'var(--font-weight-semibold)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--transition-fast), opacity var(--transition-fast)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

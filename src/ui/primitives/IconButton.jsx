import React from 'react';

export default function IconButton({
  children,
  onClick,
  disabled = false,
  label,
  variant = 'default',
  size = 'md',
  className = '',
  style,
  ...props
}) {
  const variants = {
    default: {
      background: 'transparent',
      color: 'var(--color-text-primary)',
      border: 'none',
    },
    subtle: {
      background: 'var(--color-surface-subtle)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border)',
    },
    danger: {
      background: 'transparent',
      color: 'var(--color-danger)',
      border: 'none',
    },
  };

  const sizes = {
    sm: { width: 32, height: 32 },
    md: { width: 44, height: 44 },
    lg: { width: 52, height: 52 },
  };

  const variantStyle = variants[variant] || variants.default;
  const sizeStyle = sizes[size] || sizes.md;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`ui-icon-button ${className}`}
      style={{
        ...variantStyle,
        ...sizeStyle,
        borderRadius: 'var(--radius-full)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background var(--transition-fast)',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

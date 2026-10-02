import React from 'react';

export default function Card({
  children,
  variant = 'default',
  className = '',
  style,
  onClick,
  ...props
}) {
  const variants = {
    default: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      shadow: 'var(--shadow-sm)',
    },
    elevated: {
      background: 'var(--color-surface-elevated)',
      border: '1px solid var(--color-border)',
      shadow: 'var(--shadow-md)',
    },
    subtle: {
      background: 'var(--color-surface-subtle)',
      border: 'none',
      shadow: 'none',
    },
  };

  const variantStyle = variants[variant] || variants.default;

  return (
    <div
      className={`ui-card ${className}`}
      style={{
        ...variantStyle,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        ...style,
      }}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

import React from 'react';

export default function PriceDisplay({
  amount,
  currency = '₹',
  period = '/hr',
  label,
  size = 'md',
  className = '',
  style,
  ...props
}) {
  const sizes = {
    sm: { fontSize: 'var(--text-sm)', labelSize: 'var(--text-xs)' },
    md: { fontSize: 'var(--text-md)', labelSize: 'var(--text-sm)' },
    lg: { fontSize: 'var(--text-xl)', labelSize: 'var(--text-base)' },
  };

  const sizeStyle = sizes[size] || sizes.md;

  return (
    <div
      className={`ui-price-display ${className}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', ...style }}
      {...props}
    >
      {label && (
        <span style={{ fontSize: sizeStyle.labelSize, color: 'var(--color-text-muted)', fontWeight: 'var(--font-weight-medium)' }}>
          {label}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ fontSize: sizeStyle.fontSize, fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-primary)' }}>
          {currency}{amount}
        </span>
        {period && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {period}
          </span>
        )}
      </div>
    </div>
  );
}

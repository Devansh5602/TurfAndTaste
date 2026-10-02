import React from 'react';

export default function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 'var(--radius-sm)',
  className = '',
  style,
  ...props
}) {
  return (
    <div
      className={`ui-skeleton ${className}`}
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--color-skeleton-base) 25%, var(--color-skeleton-highlight) 50%, var(--color-skeleton-base) 75%)',
        backgroundSize: '200% 100%',
        animation: 'ui-shimmer 1.5s infinite',
        ...style,
      }}
      {...props}
    />
  );
}

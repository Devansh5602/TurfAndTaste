import React from 'react';

/**
 * Standard Status Badge & Chip Primitive
 */
export default function Badge({
  children,
  variant = 'green', // 'green' | 'orange' | 'olive' | 'surface' | 'crimson' | 'muted'
  size = 'md',        // 'sm' | 'md'
  icon: Icon,
  className = '',
  style = {},
  ...props
}) {
  const variantClass = variant === 'green' ? 'badge-green'
    : variant === 'orange' ? 'badge-orange'
    : variant === 'olive' ? 'badge-olive'
    : variant === 'surface' ? 'badge-surface'
    : variant === 'crimson' ? 'badge-crimson'
    : variant === 'muted' ? 'badge-muted'
    : 'badge-green';

  const sizeStyle = size === 'sm' ? { fontSize: '0.68rem', padding: '0.15rem 0.45rem' } : {};

  return (
    <span
      className={`badge ${variantClass} ${className}`.trim()}
      style={{ ...sizeStyle, ...style }}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 10 : 12} style={{ flexShrink: 0 }} />}
      {children}
    </span>
  );
}

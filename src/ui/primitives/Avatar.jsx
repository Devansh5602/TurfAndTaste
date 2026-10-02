import React from 'react';

const sizes = {
  sm: { width: 32, height: 32, fontSize: 'var(--text-xs)' },
  md: { width: 44, height: 44, fontSize: 'var(--text-sm)' },
  lg: { width: 56, height: 56, fontSize: 'var(--text-md)' },
  xl: { width: 72, height: 72, fontSize: 'var(--text-lg)' },
};

export default function Avatar({
  name,
  src,
  size = 'md',
  className = '',
  style,
  ...props
}) {
  const sizeStyle = sizes[size] || sizes.md;
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={`ui-avatar ${className}`}
        style={{
          ...sizeStyle,
          borderRadius: 'var(--radius-full)',
          objectFit: 'cover',
          ...style,
        }}
        {...props}
      />
    );
  }

  return (
    <div
      className={`ui-avatar ${className}`}
      style={{
        ...sizeStyle,
        borderRadius: 'var(--radius-full)',
        background: 'var(--color-primary-light)',
        color: 'var(--color-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'var(--font-weight-bold)',
        ...style,
      }}
      {...props}
    >
      {initial}
    </div>
  );
}

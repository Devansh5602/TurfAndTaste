import React from 'react';

/**
 * Standard Card Container Primitive
 */
export default function Card({
  children,
  variant = 'default', // 'default' | 'highlight' | 'surface'
  className = '',
  style = {},
  onClick,
  ...props
}) {
  const variantClass = variant === 'highlight' ? 'highlight' : '';

  return (
    <div
      className={`card-arena ${variantClass} ${className}`.trim()}
      style={style}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

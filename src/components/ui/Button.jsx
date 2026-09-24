import React from 'react';

/**
 * Standard UI Button Primitive
 * Backed by existing design system tokens and utility classes
 */
export default function Button({
  children,
  variant = 'primary', // 'primary' | 'outline' | 'ghost' | 'danger' | 'surface'
  size = 'md',        // 'sm' | 'md' | 'lg'
  block = false,
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  icon: Icon,
  iconRight: IconRight,
  onClick,
  ...props
}) {
  const variantClass = variant === 'primary' ? 'btn-primary'
    : variant === 'outline' ? 'btn-outline'
    : variant === 'ghost' ? 'btn-ghost'
    : variant === 'danger' ? 'btn-danger'
    : variant === 'surface' ? 'btn-surface'
    : 'btn-primary';

  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  const blockClass = block ? 'btn-block' : '';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`btn ${variantClass} ${sizeClass} ${blockClass} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <span className="btn-spinner" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} className="btn-icon-left" />
      ) : null}
      <span>{children}</span>
      {!loading && IconRight ? (
        <IconRight size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} className="btn-icon-right" />
      ) : null}
    </button>
  );
}

import React from 'react';

export default function StickyActionBar({
  children,
  className = '',
  style,
  ...props
}) {
  return (
    <div
      className={`ui-sticky-action-bar ${className}`}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: 'var(--sticky-action-height)',
        padding: 'var(--space-3) var(--page-gutter) calc(var(--space-3) + var(--safe-bottom))',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        zIndex: 'var(--z-sticky)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

import React from 'react';

export default function SectionHeader({
  title,
  action,
  className = '',
  style,
  ...props
}) {
  return (
    <div
      className={`ui-section-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-3)',
        ...style,
      }}
      {...props}
    >
      <h3
        style={{
          fontSize: 'var(--text-md)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h3>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

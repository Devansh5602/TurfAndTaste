import React from 'react';

const statusVariants = {
  confirmed: { background: 'var(--color-success-bg)', color: 'var(--color-success)' },
  pending: { background: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  cancelled: { background: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
  active: { background: 'var(--color-success-bg)', color: 'var(--color-success)' },
  inactive: { background: 'var(--color-surface-subtle)', color: 'var(--color-text-muted)' },
  'in-progress': { background: 'var(--color-info-bg)', color: 'var(--color-info)' },
  'checked-in': { background: 'var(--color-info-bg)', color: 'var(--color-info)' },
  completed: { background: 'var(--color-success-bg)', color: 'var(--color-success)' },
  'payment-review': { background: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
};

export default function StatusBadge({
  status,
  className = '',
  style,
  ...props
}) {
  const normalized = String(status || '').toLowerCase().replace(/\s+/g, '-');
  const variantStyle = statusVariants[normalized] || statusVariants.inactive;

  return (
    <span
      className={`ui-status-badge ${className}`}
      style={{
        ...variantStyle,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px var(--space-2)',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-weight-semibold)',
        lineHeight: 'var(--line-height-tight)',
        textTransform: 'capitalize',
        ...style,
      }}
      {...props}
    >
      {status}
    </span>
  );
}

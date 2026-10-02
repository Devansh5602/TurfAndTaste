import React from 'react';
import { Card } from '../primitives';
import { Badge } from '../primitives';

export default function FacilityCard({
  name,
  type,
  image,
  rating,
  reviewCount,
  status,
  tariff,
  onClick,
  className = '',
  style,
  ...props
}) {
  return (
    <Card
      className={`ui-facility-card ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', padding: 0, overflow: 'hidden', ...style }}
      {...props}
    >
      {image && (
        <img
          src={image}
          alt={name}
          style={{ width: '100%', height: 120, objectFit: 'cover' }}
        />
      )}
      <div style={{ padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-1)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {type}
          </span>
          {status && <Badge label={status} variant="success" />}
        </div>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
          {name}
        </div>
        {rating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            <span>★ {rating}</span>
            {reviewCount && <span>({reviewCount})</span>}
          </div>
        )}
        {tariff && (
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-primary)', marginTop: 'var(--space-2)' }}>
            ₹{tariff}/hr
          </div>
        )}
      </div>
    </Card>
  );
}

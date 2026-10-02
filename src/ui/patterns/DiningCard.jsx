import React from 'react';
import { Card } from '../primitives';
import { Badge } from '../primitives';

export default function DiningCard({
  name,
  type,
  image,
  hours,
  status,
  onClick,
  className = '',
  style,
  ...props
}) {
  return (
    <Card
      className={`ui-dining-card ${className}`}
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
          {type && <Badge label={type} variant="default" />}
          {status && <Badge label={status} variant="success" />}
        </div>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
          {name}
        </div>
        {hours && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {hours}
          </div>
        )}
      </div>
    </Card>
  );
}

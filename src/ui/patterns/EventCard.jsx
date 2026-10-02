import React from 'react';
import { Card } from '../primitives';
import { Badge } from '../primitives';

export default function EventCard({
  title,
  tag,
  date,
  time,
  image,
  status,
  onClick,
  className = '',
  style,
  ...props
}) {
  return (
    <Card
      className={`ui-event-card ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', padding: 0, overflow: 'hidden', ...style }}
      {...props}
    >
      {image && (
        <img
          src={image}
          alt={title}
          style={{ width: '100%', height: 140, objectFit: 'cover' }}
        />
      )}
      <div style={{ padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-1)' }}>
          {tag && <Badge label={tag} variant="primary" />}
          {status && <Badge label={status} variant="success" />}
        </div>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
          {title}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {date} • {time}
        </div>
      </div>
    </Card>
  );
}

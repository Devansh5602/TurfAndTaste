import React from 'react';
import { Card } from '../primitives';
import { StatusBadge } from '../primitives';

export default function BookingCard({
  bookingReference,
  facilityName,
  date,
  time,
  status,
  amount,
  customerName,
  onClick,
  className = '',
  style,
  ...props
}) {
  return (
    <Card
      className={`ui-booking-card ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
      {...props}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-muted)' }}>
          {bookingReference}
        </span>
        <StatusBadge status={status} />
      </div>
      <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
        {facilityName}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
        {date} • {time}
      </div>
      {customerName && (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
          {customerName}
        </div>
      )}
      {amount && (
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-primary)' }}>
          ₹{amount}
        </div>
      )}
    </Card>
  );
}

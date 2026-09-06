import React from 'react';

export default function SectionHeading({
  badge,
  badgeType = 'olive',
  title,
  highlight,
  subtitle,
  center = false,
  className = ''
}) {
  return (
    <div className={`section-header ${center ? 'center' : ''} ${className}`}>
      {badge && (
        <div style={{ marginBottom: '0.85rem' }}>
          <span className={`badge badge-${badgeType}`}>{badge}</span>
        </div>
      )}
      <h2>
        {title} {highlight && <span className="text-olive">{highlight}</span>}
      </h2>
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link } from '../context/RouterContext';
import { adminStore } from '../services/adminStore';
import { ArrowRight, Calendar, Clock, Tag } from 'lucide-react';

const SPORT_COLORS = {
  sports:   { bg: 'rgba(74,222,128,0.12)',  text: '#4ADE80',  border: 'rgba(74,222,128,0.25)' },
  practice: { bg: 'rgba(249,115,22,0.12)',  text: '#F97316',  border: 'rgba(249,115,22,0.25)' },
  dining:   { bg: 'rgba(234,179,8,0.12)',   text: '#EAB308',  border: 'rgba(234,179,8,0.25)' },
};

export default function FacilityCard({ facility, compact = false }) {
  const colors = SPORT_COLORS[facility.category] || SPORT_COLORS.sports;
  const isDining = facility.category === 'dining' || facility.id === 'cafe' || facility.id === 'snack-parlours';
  const [livePrice, setLivePrice] = useState(() => isDining ? null : adminStore.getFacilityPricing(facility.id));

  useEffect(() => {
    if (isDining) return undefined;
    const refreshPrice = () => setLivePrice(adminStore.getFacilityPricing(facility.id));
    adminStore.fetchPricingAsync().then(refreshPrice);
    window.addEventListener('tt_pricing_updated', refreshPrice);
    window.addEventListener('storage', refreshPrice);
    return () => {
      window.removeEventListener('tt_pricing_updated', refreshPrice);
      window.removeEventListener('storage', refreshPrice);
    };
  }, [facility.id, isDining]);

  const priceLabel = isDining
    ? facility.pricing?.standardRate?.split('/')[0].trim()
    : livePrice?.dayRate || facility.pricing?.standardRate?.split('/')[0].trim();

  return (
    <div className="facility-card">
      {/* Image */}
      <div className="facility-card-image-wrap">
        <img
          src={facility.image}
          alt={facility.name}
          className="facility-card-image"
          loading="lazy"
        />
        {/* Gradient overlay */}
        <div className="facility-card-img-gradient" />

        {/* Sport type tag */}
        <span
          className="facility-card-sport-tag"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          <Tag size={11} />
          {facility.category === 'practice' ? 'Training' : facility.category === 'dining' ? 'Dining' : 'Sports'}
        </span>

        {/* Price badge — bottom right */}
        {priceLabel && (
          <div className="facility-card-price-badge">
            <span>{priceLabel}</span>
            {!isDining && <span className="price-per">/hr</span>}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="facility-card-content">
        <div className="facility-card-top">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
            <h3 className="facility-card-title">{facility.name}</h3>
            {facility.badge && (
              <span className="badge badge-orange facility-card-status-badge">{facility.badge}</span>
            )}
          </div>
          <p className="facility-card-desc">{facility.shortDesc}</p>
        </div>

        {/* Schedules are administrator-owned; avoid displaying stale static hours. */}
        <div className="facility-card-spec-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
          <Clock size={13} style={{ color: colors.text, flexShrink: 0 }} />
          <span><strong>Current hours</strong> available in venue details</span>
        </div>

        {facility.specs && (
          <div className="facility-card-spec-row">
            <span className="facility-card-spec-text">
              {facility.specs.regulations || facility.specs.surface || facility.specs.ambience}
            </span>
          </div>
        )}

        {/* Quick feature tags */}
        {facility.features && facility.features.length > 0 && (
          <div className="facility-card-feature-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '0.5rem 0' }}>
            {facility.features.slice(0, 2).map((feat, idx) => (
              <span key={idx} className="badge badge-surface" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                {feat}
              </span>
            ))}
          </div>
        )}

        {/* CTA row */}
        <div className="facility-card-cta">
          {isDining ? (
            <Link
              to={`/facilities/${facility.slug}`}
              className="btn btn-outline btn-sm"
              aria-label={`Explore ${facility.name}`}
              style={{ flex: 1 }}
            >
              Explore Menu <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link
                to={`/facilities/${facility.slug}`}
                className="btn btn-outline btn-sm"
                aria-label={`View details for ${facility.name}`}
              >
                Details
              </Link>
              <Link
                to={`/booking?facility=${facility.slug}`}
                className="btn btn-primary btn-sm"
                aria-label={`Book a slot for ${facility.name}`}
                style={{ flex: 1 }}
              >
                <Calendar size={13} /> Book Now
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

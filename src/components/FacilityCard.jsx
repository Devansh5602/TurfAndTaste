import React from 'react';
import { Link } from '../context/RouterContext';
import { ArrowRight, Calendar, ShieldCheck } from 'lucide-react';

export default function FacilityCard({ facility }) {
  return (
    <div className="facility-card">
      <div className="facility-card-image-wrap">
        <img 
          src={facility.image} 
          alt={facility.name} 
          className="facility-card-image" 
          loading="lazy" 
        />
        {facility.tag && (
          <span className="badge badge-olive facility-card-badge">
            {facility.tag}
          </span>
        )}
      </div>

      <div className="facility-card-content">
        <div className="facility-card-header">
          <h3 className="facility-card-title">{facility.name}</h3>
          {facility.badge && (
            <span className="badge badge-orange facility-card-status-badge">
              {facility.badge}
            </span>
          )}
        </div>

        <p className="facility-card-desc">{facility.shortDesc}</p>

        {facility.specs && (
          <div className="facility-card-spec-box">
            <div className="facility-card-spec-item">
              <ShieldCheck size={16} className="text-olive" style={{ flexShrink: 0 }} />
              <span className="facility-card-spec-text">
                {facility.specs.regulations || facility.specs.surface || facility.specs.ambience}
              </span>
            </div>
          </div>
        )}

        <div className="facility-card-meta">
          <Link 
            to={`/facilities/${facility.slug}`} 
            className="btn btn-outline btn-sm"
          >
            Details <ArrowRight size={15} />
          </Link>

          {facility.category === 'dining' || facility.id === 'cafe' || facility.id === 'snack-parlours' ? (
            <Link 
              to={`/facilities/${facility.slug}`} 
              className="btn btn-secondary btn-sm"
            >
              Walk-in Dining
            </Link>
          ) : (
            <Link 
              to={`/booking?facility=${facility.slug}`} 
              className="btn btn-primary btn-sm"
            >
              <Calendar size={14} /> Book Slot
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

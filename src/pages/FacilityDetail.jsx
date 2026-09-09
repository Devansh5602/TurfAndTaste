import React from 'react';
import { Link, useRouter } from '../context/RouterContext';
import { facilitiesData } from '../data/facilitiesData';
import CourtBackground from '../components/CourtBackground';
import FacilityCard from '../components/FacilityCard';
import { 
  ArrowLeft, 
  Calendar, 
  CheckCircle2, 
  ShieldAlert, 
  Tag, 
  Users, 
  Sparkles, 
  Clock, 
  Info,
  ArrowRight
} from 'lucide-react';

export default function FacilityDetail({ slug }) {
  const { navigate } = useRouter();

  const facility = facilitiesData.find(f => f.slug === slug) || facilitiesData[0];
  const relatedFacilities = facilitiesData
    .filter(f => f.slug !== facility.slug)
    .slice(0, 3);

  return (
    <div className="page-facility-detail">
      {/* Back Navigation Bar */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0.85rem 0' }}>
        <div className="container">
          <Link to="/facilities" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', gap: '0.4rem' }}>
            <ArrowLeft size={16} /> Back to All Facilities
          </Link>
        </div>
      </div>

      {/* Hero Banner with Facility Image */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden', paddingBottom: '3rem' }}>
        <CourtBackground />
        
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="grid grid-2" style={{ alignItems: 'center', gap: '3rem' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <span className="badge badge-olive">{facility.tag}</span>
                {facility.badge && <span className="badge badge-orange">{facility.badge}</span>}
                <span className="badge badge-cream">Patan Arena</span>
              </div>

              <h1 style={{ marginBottom: '1.25rem', fontSize: 'clamp(2.4rem, 5.5vw, 4rem)' }}>
                {facility.name}
              </h1>

              <p style={{ fontSize: '1.15rem', lineHeight: '1.65', marginBottom: '2rem' }}>
                {facility.fullDesc}
              </p>

              {/* CTAs */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {facility.category === 'dining' || facility.id === 'cafe' || facility.id === 'snack-parlours' ? (
                  <Link to={`/inquiry?facility=${facility.slug}`} className="btn btn-primary btn-lg">
                    Inquire / View Menu
                  </Link>
                ) : (
                  <>
                    <Link to={`/booking?facility=${facility.slug}`} className="btn btn-primary btn-lg">
                      <Calendar size={18} /> Book This Facility
                    </Link>
                    <Link to={`/inquiry?facility=${facility.slug}`} className="btn btn-outline btn-lg">
                      Inquire for Events
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                border: '1px solid var(--border-strong)',
                boxShadow: 'var(--shadow-lg), var(--glow-olive)',
                aspectRatio: '16 / 10'
              }}>
                <img 
                  src={facility.image} 
                  alt={facility.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Details & Specs */}
      <section className="section" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <div className="grid grid-2" style={{ gap: '3rem' }}>
            {/* Left Column: Specifications & Highlights */}
            <div>
              <h3 style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>
                Arena <span className="text-olive">Specifications</span>
              </h3>

              <div className="card-arena" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  {Object.entries(facility.specs).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', gap: '1rem' }}>
                      <span style={{ textTransform: 'capitalize', color: 'var(--brand-cream-muted)', fontWeight: 600 }}>
                        {key.replace(/([A-Z])/g, ' $1')}
                      </span>
                      <span style={{ color: 'var(--text-primary)', textAlign: 'right', fontWeight: 500 }}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <h3 style={{ fontSize: '1.8rem', marginBottom: '1.25rem' }}>
                What Players <span className="text-orange">Can Expect</span>
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {facility.highlights.map((item, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '1rem' }}>
                    <CheckCircle2 size={18} className="text-olive" style={{ flexShrink: 0, marginTop: '3px' }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Column: Pricing & Booking Architecture */}
            <div>
              <h3 style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>
                Pricing &amp; <span className="text-olive">Reservation Model</span>
              </h3>

              <div className="card-arena highlight" style={{ marginBottom: '2rem' }}>
                <span className="badge badge-orange" style={{ marginBottom: '0.85rem' }}>
                  Editable Phase 1 Rate Structure
                </span>

                <div style={{ marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Standard Session:</span>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', color: 'var(--brand-cream)', lineHeight: 1 }}>
                    {facility.pricing.standardRate}
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Floodlit / Prime Slot:</span>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--brand-olive-bright)', lineHeight: 1 }}>
                    {facility.pricing.peakRate}
                  </div>
                </div>

                <div style={{ 
                  background: 'var(--bg-surface)', 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '1.5rem' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <Info size={16} className="text-orange" />
                    <strong style={{ fontSize: '0.9rem', color: 'var(--brand-cream)' }}>Flexible Payment Options</strong>
                  </div>
                  <p style={{ fontSize: '0.86rem', lineHeight: '1.5' }}>
                    Reserve your slot with <strong>{facility.pricing.bookingAmount}</strong>, or choose <strong>{facility.pricing.fullPayment}</strong> for zero check-in delays.
                  </p>
                </div>

                {facility.category === 'dining' || facility.id === 'cafe' || facility.id === 'snack-parlours' ? (
                  <Link to={`/inquiry?facility=${facility.slug}`} className="btn btn-primary btn-block btn-lg">
                    Send Dining / Event Inquiry
                  </Link>
                ) : (
                  <Link to={`/booking?facility=${facility.slug}`} className="btn btn-primary btn-block btn-lg">
                    <Calendar size={18} /> Reserve This Slot Now
                  </Link>
                )}
                <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                  {facility.pricing.note}
                </p>
              </div>

              {/* Rules & Etiquette */}
              <div className="card-arena">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <ShieldAlert size={20} className="text-orange" />
                  <h4 style={{ margin: 0, fontSize: '1.2rem' }}>Arena Rules &amp; Etiquette</h4>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {facility.rules.map((rule, idx) => (
                    <li key={idx} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                      <span className="text-olive">&bull;</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Facilities */}
      <section className="section">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
            <div>
              <span className="badge badge-olive" style={{ marginBottom: '0.5rem' }}>Also at Turf &amp; Taste</span>
              <h2>Explore Related Facilities</h2>
            </div>
            <Link to="/facilities" className="btn btn-outline btn-sm">
              All Facilities <ArrowRight size={15} />
            </Link>
          </div>

          <div className="grid grid-3">
            {relatedFacilities.map(f => (
              <FacilityCard key={f.id} facility={f} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

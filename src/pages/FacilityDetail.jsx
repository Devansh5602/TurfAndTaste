import React, { useState, useEffect } from 'react';
import { Link, useRouter } from '../context/RouterContext';
import { facilitiesData } from '../data/facilitiesData';
import { adminStore } from '../services/adminStore';
import { api } from '../services/api';
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
  ArrowRight,
  Utensils,
  Coffee
} from 'lucide-react';

export default function FacilityDetail({ slug }) {
  const { navigate } = useRouter();

  const fallbackFacility = facilitiesData.find(f => f.slug === slug) || null;
  const [facility, setFacility] = useState(fallbackFacility);
  const [notFound, setNotFound] = useState(false);
  const relatedFacilities = facilitiesData
    .filter(f => f.slug !== fallbackFacility?.slug)
    .slice(0, 3);

  const [livePricing, setLivePricing] = useState(() => adminStore.getFacilityPricing(slug));

  useEffect(() => {
    let cancelled = false;
    api.getFacilities().then((result) => {
      if (cancelled) return;
      // A failed managed-inventory read must not turn a known static fallback
      // venue into a false 404. Only an authoritative successful response can
      // establish that the requested public slug no longer exists.
      if (!result?.success || !Array.isArray(result.facilities)) return;
      const record = result.facilities.find((item) => item.slug === slug);
      if (!record) {
        setNotFound(true);
        return;
      }
      setNotFound(false);
      const metadata = record.metadata || {};
      setFacility({
        ...(fallbackFacility || {}),
        id: record.id,
        slug: record.slug,
        name: record.name,
        category: record.type === 'sport' ? (fallbackFacility?.category || 'sports') : (record.type || fallbackFacility?.category),
        image: record.coverImageUrl || fallbackFacility?.image,
        shortDesc: record.shortDescription || fallbackFacility?.shortDesc || '',
        fullDesc: record.description || fallbackFacility?.fullDesc || record.shortDescription || '',
        highlights: record.amenities?.length ? record.amenities : (metadata.highlights || fallbackFacility?.highlights || []),
        rules: record.rules?.length ? record.rules : (fallbackFacility?.rules || []),
        specs: metadata.specs || fallbackFacility?.specs || {},
        suitableFor: metadata.suitableFor || fallbackFacility?.suitableFor || [],
        pricing: metadata.legacyPricing || fallbackFacility?.pricing || {},
        tag: metadata.tag || fallbackFacility?.tag || record.type,
        badge: metadata.badge || fallbackFacility?.badge,
        bookingEnabled: record.bookingEnabled,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [slug, fallbackFacility]);

  useEffect(() => {
    adminStore.fetchPricingAsync().then(() => {
      setLivePricing(adminStore.getFacilityPricing(slug));
    });

    const handleUpdate = () => {
    setLivePricing(adminStore.getFacilityPricing(slug));
    };

    window.addEventListener('tt_pricing_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('tt_pricing_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [slug]);

  if (notFound) {
    return <div className="section" style={{ minHeight: '55vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><h1>Facility not found</h1><p>This venue is not currently available to the public.</p><Link to="/facilities" className="btn btn-primary">Browse facilities</Link></div></div>;
  }
  if (!facility) {
    return <div className="section" style={{ minHeight: '55vh', display: 'grid', placeItems: 'center' }}>Loading facility…</div>;
  }

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
                {!facility.bookingEnabled || facility.category === 'dining' || facility.id === 'cafe' || facility.id === 'snack-parlours' ? (
                  <>
                    <Link to="/facilities" className="btn btn-primary btn-lg">
                      Explore Sports Arenas
                    </Link>
                    <Link to="/contact" className="btn btn-outline btn-lg">
                      Location &amp; Opening Hours
                    </Link>
                  </>
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

            {/* Right Column: Pricing & Booking Architecture for Sports vs Walk-In Experience for Dining */}
            <div>
              {!facility.bookingEnabled || facility.category === 'dining' || facility.id === 'cafe' || facility.id === 'snack-parlours' ? (
                <>
                  <h3 style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>
                    Walk-In <span className="text-olive">Dining &amp; Counter Orders</span>
                  </h3>

                  <div className="card-arena highlight" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span className="badge badge-olive">
                        Walk-In Experience
                      </span>
                      <span className="badge badge-orange">
                        No Booking Required
                      </span>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Service hours:</span>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--brand-cream)', lineHeight: 1.2, marginTop: '0.25rem' }}>
                        Check before visiting <span style={{ fontSize: '0.9rem', fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>Hours can vary by venue</span>
                      </div>
                    </div>

                    <div style={{ 
                      background: 'var(--bg-surface)', 
                      padding: '1.25rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-subtle)',
                      marginBottom: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Utensils size={18} className="text-olive" />
                        <strong style={{ fontSize: '0.92rem', color: 'var(--brand-cream)' }}>Artisan Food &amp; Recovery Smoothies</strong>
                      </div>
                      <p style={{ fontSize: '0.88rem', lineHeight: '1.55', color: 'var(--text-secondary)', margin: 0 }}>
                        Enjoy fresh chef-prepared bowls, wood-fired pizzas, healthy wraps, and cold-pressed juices directly from our counter.
                      </p>
                      <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--brand-cream-muted)' }}>
                        <Coffee size={15} className="text-orange" />
                        <span>Open-Air Turf Deck &amp; Indoor AC Lounge Seating</span>
                      </div>
                    </div>

                    <div style={{ 
                      background: 'rgba(107, 143, 73, 0.08)', 
                      padding: '1rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid rgba(107, 143, 73, 0.25)',
                      marginBottom: '1.5rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem'
                    }}>
                      <Info size={18} className="text-olive" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--brand-cream)', display: 'block', marginBottom: '0.2rem' }}>Walk-in Service Model</strong>
                        Turf &amp; Taste Café operates on a walk-in counter ordering model for all players and visitors. No advance reservation or private event packages are required.
                      </div>
                    </div>

                    <Link to="/facilities" className="btn btn-outline btn-block btn-lg">
                      Explore Sports Arenas &amp; Rates
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>
                    Pricing &amp; <span className="text-olive">Reservation Model</span>
                  </h3>

                  <div className="card-arena highlight" style={{ marginBottom: '2rem' }}>
                    <span className="badge badge-orange" style={{ marginBottom: '0.85rem' }}>
                      Current Facility Rates
                    </span>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Standard Session ({livePricing.dayHours}):</span>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', color: 'var(--brand-cream)', lineHeight: 1 }}>
                        {livePricing.dayRate} <span style={{ fontSize: '1rem', fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>/ hour</span>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Floodlit / Prime Slot ({livePricing.nightHours}):</span>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--brand-olive-bright)', lineHeight: 1 }}>
                        {livePricing.nightRate} <span style={{ fontSize: '1rem', fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>/ hour</span>
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
                        Reserve your preferred slot with a token booking deposit of <strong style={{ color: 'var(--brand-orange)' }}>{livePricing.bookingDeposit}</strong>, or pay in full for express game-day entry.
                      </p>
                    </div>

                    <Link to={`/booking?facility=${facility.slug}`} className="btn btn-primary btn-block btn-lg">
                      <Calendar size={18} /> Reserve This Slot Now
                    </Link>
                    <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                      {facility.pricing.note}
                    </p>
                  </div>
                </>
              )}

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

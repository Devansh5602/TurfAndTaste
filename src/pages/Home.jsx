import React, { useState, useEffect } from 'react';
import { Link } from '../context/RouterContext';
import { facilitiesData } from '../data/facilitiesData';
import { adminStore } from '../services/adminStore';
import { api } from '../services/api';
import FacilityCard from '../components/FacilityCard';
import SectionHeading from '../components/SectionHeading';
import {
  Calendar, ArrowRight, Zap, MapPin, CheckCircle2,
  Clock, Trophy, ChevronRight, Star, Shield, Utensils,
  Activity, X, Sparkles, QrCode, Tag
} from 'lucide-react';

const QUICK_PLAY_FACILITIES = [
  {
    slug: 'box-cricket',
    name: 'Box Cricket',
    image: '/images/box_cricket.jpg',
    desc: '72-ft enclosed tournament turf with anti-glare floodlights',
    availability: 'Slots Open Today',
    badge: 'Most Popular',
    category: 'sports'
  },
  {
    slug: 'pickleball',
    name: 'Pickleball',
    image: '/images/pickleball.jpg',
    desc: 'Cushioned regulation USA Pickleball court with pro nets',
    availability: 'Slots Open Today',
    badge: 'Trending',
    category: 'sports'
  },
  {
    slug: 'cricket-nets',
    name: 'Cricket Nets',
    image: '/images/cricket_nets.jpg',
    desc: 'Dual dedicated practice lanes with full bowler run-up',
    availability: 'Slots Open Today',
    badge: 'Training',
    category: 'practice'
  },
  {
    slug: 'ball-machine',
    name: 'Bowling Machine',
    image: '/images/ball_machine.jpg',
    desc: '60–150 km/h programmable speed, swing, and spin lane',
    availability: 'Slots Open Today',
    badge: 'Pro Lane',
    category: 'practice'
  },
  {
    slug: 'skating',
    name: 'Skating Rink',
    image: '/images/skating_rink.jpg',
    desc: 'Smooth polished concrete arena for speed and roller skating',
    availability: 'Slots Open Today',
    badge: 'All Ages',
    category: 'sports'
  }
];

const WHY_US_FEATURES = [
  {
    title: 'ICC & FIFA Grade Turf',
    desc: '40mm monofilament artificial grass with shock absorption for peak athletic safety.',
    icon: Shield,
    color: '#4ADE80',
    bg: 'rgba(74,222,128,0.12)'
  },
  {
    title: '500-Lux Floodlighting',
    desc: 'Anti-glare shadowless illumination designed for competitive evening and night play.',
    icon: Zap,
    color: '#F97316',
    bg: 'rgba(249,115,22,0.12)'
  },
  {
    title: 'Instant Slot Lock',
    desc: 'Reserve your court in 60 seconds with a token deposit via UPI or card.',
    icon: Calendar,
    color: '#EAB308',
    bg: 'rgba(234,179,8,0.12)'
  },
  {
    title: 'Café & Player Dugouts',
    desc: 'Air-cooled spectator pavilions, protein shakes, fresh snacks, and artisan coffee.',
    icon: Utensils,
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)'
  }
];

export default function Home() {
  const [bookingSuccess, setBookingSuccess] = useState(() => {
    try {
      const d = sessionStorage.getItem('tt_booking_success');
      return d ? JSON.parse(d) : null;
    } catch { return null; }
  });

  const [latestBooking, setLatestBooking] = useState(null);
  const [, setPricingVersion] = useState(0);
  const [publicFacilities, setPublicFacilities] = useState(facilitiesData);

  useEffect(() => {
    let cancelled = false;
    api.getFacilities().then((result) => {
      if (!result?.success || !Array.isArray(result.facilities) || cancelled) return;
      setPublicFacilities(result.facilities.map((record) => {
        const fallback = facilitiesData.find((item) => item.id === record.id || item.slug === record.slug) || {};
        return { ...fallback, id: record.id, slug: record.slug, name: record.name, category: record.type === 'sport' ? (fallback.category || 'sports') : (record.type || fallback.category || 'sports'), image: record.coverImageUrl || fallback.image, shortDesc: record.shortDescription || fallback.shortDesc || '', bookingEnabled: record.bookingEnabled };
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const checkUpcoming = async () => {
      const phone = String(localStorage.getItem('turf_user_phone') || '').replace(/\D/g, '').slice(-10);
      if (!/^[6-9]\d{9}$/.test(phone)) {
        setLatestBooking(null);
        return;
      }
      const response = await api.getBookingHistory({ phone });
      if (!response.success) {
        setLatestBooking(null);
        return;
      }
      const list = response.history || [];
      const todayStr = new Date().toISOString().split('T')[0];
      const upcoming = list.find(b => {
        const s = (b.status || '').toLowerCase();
        return s !== 'cancelled' && s !== 'completed' && (!b.date || b.date >= todayStr);
      });
      setLatestBooking(upcoming || null);
    };

    checkUpcoming().catch(() => setLatestBooking(null));

    const onStorage = () => checkUpcoming().catch(() => setLatestBooking(null));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const refreshPricing = () => setPricingVersion(version => version + 1);
    adminStore.fetchPricingAsync().then(refreshPricing);
    window.addEventListener('tt_pricing_updated', refreshPricing);
    window.addEventListener('storage', refreshPricing);
    return () => {
      window.removeEventListener('tt_pricing_updated', refreshPricing);
      window.removeEventListener('storage', refreshPricing);
    };
  }, []);

  const sports = publicFacilities.filter(f => f.category !== 'dining' && f.bookingEnabled !== false);
  const dining = publicFacilities.filter(f => f.category === 'dining');
  const quickPlayFacilities = QUICK_PLAY_FACILITIES.map((quick) => {
    const managed = sports.find((facility) => facility.slug === quick.slug);
    return managed ? { ...quick, ...managed, desc: managed.shortDesc || quick.desc } : null;
  }).filter(Boolean);

  return (
    <div className="page-home">

      {/* ══════════════════════════════════════════
          CONFIRMATION NOTIFICATION BANNER
          ══════════════════════════════════════════ */}
      {bookingSuccess && (
        <div className="booking-confirm-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <div className="confirm-icon-wrap">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>Booking Confirmed</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Pass ID: <strong style={{ color: 'var(--brand-cream)', fontFamily: 'monospace' }}>{bookingSuccess.id}</strong>
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--brand-cream)', marginTop: '2px' }}>
                {bookingSuccess.facility} • {bookingSuccess.date} • {bookingSuccess.time}
              </div>
            </div>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem('tt_booking_success'); setBookingSuccess(null); }}
            className="confirm-dismiss-btn"
            aria-label="Dismiss banner"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          COMPACT MOBILE HERO SECTION
          ══════════════════════════════════════════ */}
      <section className="home-hero section-hero">
        {/* Background visual with rich dark gradient */}
        <div className="home-hero-bg">
          <img src="/images/hero_arena.jpg" alt="Turf & Taste Sports Complex" aria-hidden="true" className="home-hero-bg-img" />
          <div className="home-hero-bg-gradient" />
        </div>

        <div className="container home-hero-content" style={{ position: 'relative', zIndex: 2 }}>
          {/* Header Context / Badges */}
          <div className="home-hero-badges">
            <span className="badge badge-green">
              <MapPin size={12} /> Patan, Gujarat
            </span>
            <span className="badge badge-orange">
              <Clock size={12} /> Sports Open 24 Hours
            </span>
          </div>

          {/* Headline */}
          <h1 className="home-hero-headline">
            Patan's Premier<br />
            <span className="text-green">Sports Arena</span>
          </h1>

          <p className="home-hero-sub">
            Tournament turf, automated batting nets, courts, café and snack dugouts. Lock your slot with a token deposit.
          </p>

          {/* Primary CTA and Secondary Action */}
          <div className="home-hero-cta-row">
            <Link to="/booking" className="btn btn-primary btn-hero-cta" id="hero-book-cta">
              <Calendar size={18} /> Book a Slot
            </Link>
            <Link to="/facilities" className="home-hero-secondary-link" id="hero-explore-link">
              Explore Facilities <ArrowRight size={15} />
            </Link>
          </div>

          {/* First-Time User Discovery Strip: Complete Platform Inventory at a Glance */}
          <div className="home-hero-inventory-strip" style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--brand-green)', fontWeight: 700, display: 'block', marginBottom: '0.45rem' }}>
              All {publicFacilities.length} Venues &amp; Activities in Patan:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {publicFacilities.map(item => (
                <Link
                  key={item.slug}
                  to={item.category === 'dining' ? `/facilities/${item.slug}` : `/booking?facility=${item.slug}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(13, 20, 16, 0.75)',
                    border: '1px solid rgba(74, 222, 128, 0.25)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 'var(--radius-full)',
                    padding: '4px 11px',
                    fontSize: '0.78rem',
                    color: 'var(--brand-cream)',
                    textDecoration: 'none',
                    transition: 'all var(--transition-fast)'
                  }}
                  className="hero-inventory-pill"
                >
                  <span>{item.category === 'dining' ? '☕' : item.slug === 'pickleball' ? '🎾' : item.slug === 'skating' ? '⛸️' : item.slug === 'ball-machine' ? '🎯' : '🏏'}</span>
                  <span style={{ fontWeight: 600 }}>{item.name.replace(' Arena', '').replace(' Courts', '')}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          UPCOMING BOOKING WIDGET (OR EMPTY CTA)
          ══════════════════════════════════════════ */}
      <section className="upcoming-widget-section">
        <div className="container">
          {latestBooking ? (
            <div className="upcoming-booking-card">
              <div className="upcoming-booking-badge-row">
                <span className="badge badge-green">
                  <span className="pulse-dot" /> Upcoming Booking
                </span>
                <span className="upcoming-booking-id">ID: {latestBooking.id}</span>
              </div>
              <div className="upcoming-booking-details">
                <h3 className="upcoming-facility-name">
                  {latestBooking.facility || latestBooking.facilityName}
                </h3>
                <div className="upcoming-time-row">
                  <Calendar size={14} className="text-green" />
                  <span>{latestBooking.date || 'Today'}</span>
                  <span className="dot-divider">•</span>
                  <Clock size={14} className="text-orange" />
                  <span>{latestBooking.slot?.time || latestBooking.time || 'Scheduled Slot'}</span>
                </div>
              </div>
              <div className="upcoming-action-row">
                <Link to="/my-bookings" className="btn btn-outline btn-sm upcoming-view-btn">
                  <QrCode size={14} /> View Booking Pass
                </Link>
              </div>
            </div>
          ) : (
            <div className="upcoming-empty-card">
              <div className="upcoming-empty-icon">
                <Calendar size={20} className="text-muted" />
              </div>
              <div className="upcoming-empty-text">
                <span className="upcoming-empty-title">No upcoming bookings</span>
                <span className="upcoming-empty-sub">Reserve your ground in under 60 seconds</span>
              </div>
              <Link to="/booking" className="btn btn-primary btn-sm upcoming-empty-cta">
                Book Your First Slot
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          QUICK BOOKING: "WHAT DO YOU WANT TO PLAY?"
          ══════════════════════════════════════════ */}
      <section className="section-sm quick-play-section">
        <div className="container">
          <div className="section-row-header">
            <div>
              <p className="section-label">Instant Court Reservation</p>
              <h2 className="section-row-title">What do you want to play?</h2>
            </div>
            <Link to="/facilities" className="see-all-link">
              All Venues <ArrowRight size={14} />
            </Link>
          </div>

          <div className="quick-play-grid">
            {quickPlayFacilities.map((facility) => {
              const livePricing = adminStore.getFacilityPricing(facility.slug);
              return (
              <Link
                key={facility.slug}
                to={`/booking?facility=${facility.slug}`}
                className="quick-play-card"
                id={`quick-play-${facility.slug}`}
              >
                <div className="quick-play-img-wrap">
                  <img
                    src={facility.image}
                    alt={facility.name}
                    className="quick-play-img"
                    loading="lazy"
                  />
                  <div className="quick-play-img-gradient" />
                  <span className="quick-play-badge">{facility.badge}</span>
                  <div className="quick-play-price-tag">
                    From <strong>{livePricing.dayRate}</strong>/hr
                  </div>
                </div>

                <div className="quick-play-content">
                  <div className="quick-play-top-row">
                    <h3 className="quick-play-name">{facility.name}</h3>
                    <div className="quick-play-availability">
                      <span className="live-status-dot" />
                      {facility.availability}
                    </div>
                  </div>
                  <p className="quick-play-desc">{facility.desc}</p>

                  <div className="quick-play-footer">
                    <span className="quick-play-action-text">
                      Select Slot <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          WHY TURF & TASTE (COMPACT MOBILE CARDS)
          ══════════════════════════════════════════ */}
      <section className="section-sm why-us-section" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <div className="section-row-header">
            <div>
              <p className="section-label">Engineered For Athletes</p>
              <h2 className="section-row-title">Why Turf & Taste</h2>
            </div>
            <Link to="/about" className="see-all-link">
              Our Vision <ArrowRight size={14} />
            </Link>
          </div>

          <div className="why-us-grid">
            {WHY_US_FEATURES.map((item, idx) => {
              const { icon: Icon } = item;
              return (
                <div key={idx} className="why-us-card">
                  <div className="why-us-icon-wrap" style={{ background: item.bg, color: item.color }}>
                    <Icon size={22} />
                  </div>
                  <div className="why-us-text">
                    <h4 className="why-us-card-title">{item.title}</h4>
                    <p className="why-us-card-desc">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          DINING & REFUEL STRIP
          ══════════════════════════════════════════ */}
      <section className="section-sm">
        <div className="container">
          <div className="section-row-header">
            <div>
              <p className="section-label">Play Hard • Eat Well</p>
              <h2 className="section-row-title">Turf & Taste Café</h2>
            </div>
            <Link to="/facilities/cafe" className="see-all-link">
              Menu & Details <ArrowRight size={14} />
            </Link>
          </div>

          <div className="scroll-strip facilities-carousel">
            {dining.map((f) => (
              <div key={f.id} className="carousel-card-wrap">
                <FacilityCard facility={f} />
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

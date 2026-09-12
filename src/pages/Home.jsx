import React, { useState } from 'react';
import { Link } from '../context/RouterContext';
import { facilitiesData, facilityCategories } from '../data/facilitiesData';
import FacilityCard from '../components/FacilityCard';
import SectionHeading from '../components/SectionHeading';
import CourtBackground from '../components/CourtBackground';
import { 
  Calendar, 
  ArrowRight, 
  Zap, 
  ShieldCheck, 
  Award, 
  Coffee, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Sparkles,
  Users,
  Trophy,
  X
} from 'lucide-react';

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [bookingSuccess, setBookingSuccess] = useState(() => {
    try {
      const data = sessionStorage.getItem('tt_booking_success');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });

  const filteredFacilities = activeCategory === 'all'
    ? facilitiesData
    : facilitiesData.filter(f => f.category === activeCategory);

  return (
    <div className="page-home">
      {/* 1. HERO SECTION */}
      <section className="section-hero">
        <CourtBackground />
        
        <div className="container" style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          {/* Booking Confirmation Celebration Banner */}
          {bookingSuccess && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(22, 28, 22, 0.98), rgba(16, 22, 16, 0.98))',
              border: '1.5px solid var(--brand-olive-bright)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.1rem 1.5rem',
              marginBottom: '1.75rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: 'var(--glow-olive)',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(107, 143, 73, 0.25)',
                  border: '1px solid var(--brand-olive-bright)',
                  color: 'var(--brand-olive-bright)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-olive" style={{ fontSize: '0.72rem' }}>Reservation Confirmed</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Reference: <strong style={{ color: 'var(--brand-cream)', fontFamily: 'monospace' }}>{bookingSuccess.id}</strong></span>
                  </div>
                  <div style={{ fontSize: '0.94rem', color: 'var(--brand-cream)', marginTop: '2px', fontWeight: 600 }}>
                    {bookingSuccess.facility} on {bookingSuccess.date} ({bookingSuccess.time})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('tt_booking_success');
                  setBookingSuccess(null);
                }}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="hero-grid">
            <div className="hero-content">
              {/* Grounded Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <span className="badge badge-olive">
                  <MapPin size={13} /> Patan, Gujarat
                </span>
                <span className="badge badge-orange">
                  Open Daily 6:00 AM – 11:30 PM
                </span>
              </div>

              {/* Concrete Outcome Headline & Audience Subtitle */}
              <h1 className="hero-headline" style={{ textTransform: 'none', letterSpacing: '0.01em', fontSize: 'clamp(2.4rem, 4.8vw, 3.8rem)', lineHeight: 1.15 }}>
                Book tournament turf, practice nets, and court time in Patan.
              </h1>

              {/* Supporting Text */}
              <p className="hero-supporting-text">
                For box cricket squads, competitive batsmen, and weekend games. Pick your 60-minute morning or floodlit night slot, lock it with a ₹200 deposit, and walk straight onto the pitch.
              </p>

              {/* 90/10 CTA: One primary button + one text link */}
              <div className="hero-cta-group" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                <Link to="/booking" className="btn btn-primary btn-lg">
                  <Calendar size={18} /> Check Live Slot Timings &amp; Reserve
                </Link>
                <Link to="/facilities" className="text-action-link">
                  View all 5 facilities with hourly rates <ArrowRight size={16} />
                </Link>
              </div>

              {/* Concrete Facility Specs */}
              <div className="hero-chips">
                <div className="hero-chip">
                  <CheckCircle2 size={16} className="text-olive" />
                  <span>72-Ft Enclosed Pitch</span>
                </div>
                <div className="hero-chip">
                  <CheckCircle2 size={16} className="text-olive" />
                  <span>60–150 km/h Bowling Machine</span>
                </div>
                <div className="hero-chip">
                  <CheckCircle2 size={16} className="text-olive" />
                  <span>Anti-Glare Floodlights</span>
                </div>
              </div>
            </div>

            {/* Hero Visual Composition with Concrete Annotations */}
            <div className="hero-visual-card">
              <div className="hero-image-frame">
                <img 
                  src="/images/hero_arena.jpg" 
                  alt="Turf & Taste Sports Arena and Cafe at Twilight" 
                  className="hero-main-img" 
                />
                <div className="hero-overlay-gradient" />
                
                {/* Real Arena Annotations */}
                <div className="hero-floating-stat left animate-float">
                  <Trophy size={18} className="text-orange" />
                  <div>
                    <strong>72-Ft Match Pitch</strong>
                    <span>Non-slip turf with 360° nylon netting</span>
                  </div>
                </div>

                <div className="hero-floating-stat right">
                  <Coffee size={18} className="text-olive" />
                  <div>
                    <strong>Automated Bowling Lane</strong>
                    <span>100+ deliveries/hr &bull; Up to 150 km/h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Authentic Customer Quote with Role & Measurable Result */}
          <div className="proof-quote-card">
            <div className="proof-quote-text">
              &ldquo;We booked 3 consecutive night floodlight slots for our inter-society cricket league. Paid the ₹200 token deposit online, received the WhatsApp entry pass immediately, and walked straight onto the pitch at 7:00 PM without any reception wait. 14 matches scheduled across 2 weekends with zero booking overlaps.&rdquo;
            </div>
            <div className="proof-quote-author">
              <div>
                <strong style={{ color: 'var(--brand-cream)', display: 'block', fontSize: '0.94rem' }}>Bhavik Soni</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Captain, Patan Super Kings &bull; Box Cricket League 2026</span>
              </div>
              <div className="proof-metric-badge">
                <strong>14 Matches Completed</strong>
                <span>0 Scheduling Overlaps</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. BRAND INTRODUCTION */}
      <section className="section" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="container">
          <div className="brand-intro-grid">
            <div>
              <span className="badge badge-olive" style={{ marginBottom: '1rem' }}>
                The Concept
              </span>
              <h2 style={{ marginBottom: '1.25rem' }}>
                A Modern Sports Sanctuary <br />
                <span className="text-olive">Crafted for Patan</span>
              </h2>
              <p style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>
                Turf &amp; Taste is Patan’s premier sports, training, and dining destination. 
                We created a vibrant ecosystem where athletes can push their limits, friends can 
                compete under the floodlights, and families can gather over wholesome food.
              </p>
              <p style={{ marginBottom: '1.75rem' }}>
                Whether you’re perfecting your cover drive against our automated ball-shooting machine, 
                playing a high-intensity 8-a-side box cricket showdown, gliding across our polished skating rink, 
                or savoring cold-pressed smoothies at the café, Turf &amp; Taste is where memories are forged.
              </p>
              <Link to="/about" className="btn btn-outline">
                Read Our Story &amp; Vision <ArrowRight size={16} />
              </Link>
            </div>

            <div className="annotated-showcase">
              <div className="annotated-item">
                <span className="annotated-badge">01 PITCH</span>
                <div>
                  <strong>72-Ft Shock-Absorbent Match Turf</strong>
                  <p>Synthetic astro-turf over concrete base with 360° perimeter netting. Fast ball return, zero street interruptions, and joint-friendly cushioning.</p>
                </div>
              </div>

              <div className="annotated-item">
                <span className="annotated-badge">02 FEEDER</span>
                <div>
                  <strong>Automated Bowling Simulator Lane</strong>
                  <p>Calibrate delivery speed from 60 km/h to 150+ km/h with out-swing, in-swing, off-cutters, and bouncers. Over 100 deliveries per 60-min session.</p>
                </div>
              </div>

              <div className="annotated-item">
                <span className="annotated-badge">03 LIGHTS</span>
                <div>
                  <strong>High-Mast Anti-Glare LED System</strong>
                  <p>Daylight-balanced illumination covering the entire outfield and creases from 6:00 PM to 11:30 PM for high-contrast white and leather ball tracking.</p>
                </div>
              </div>

              <div className="annotated-item">
                <span className="annotated-badge">04 REFUEL</span>
                <div>
                  <strong>Concourse Sports Café &amp; Terrace</strong>
                  <p>Open-air pergola deck and indoor AC lounge. Cold-pressed recovery smoothies, artisan coffee, electrolyte drinks, and hot post-match meals.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. EXPLORE OUR FACILITIES */}
      <section className="section" id="facilities-preview">
        <div className="container">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem' }}>
            <SectionHeading
              badge="World-Class Amenities"
              title="Explore Our"
              highlight="Facilities"
              subtitle="From tournament turf to gourmet recovery dining, explore what makes Turf & Taste Patan's premier sports club."
              center
            />

            {/* Filter Tabs */}
            <div className="tabs-container" style={{ marginTop: '1rem' }}>
              {facilityCategories.map(cat => (
                <button
                  key={cat.id}
                  className={`tab-btn ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Facility Cards Grid */}
          <div className="grid grid-3">
            {filteredFacilities.slice(0, 6).map((facility) => (
              <FacilityCard key={facility.id} facility={facility} />
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link to="/facilities" className="btn btn-outline btn-lg">
              View All 7 Facilities with Specs &amp; Rules <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. WHY CHOOSE TURF & TASTE */}
      <section className="section" style={{ background: 'var(--bg-surface-elevated)' }}>
        <div className="container">
          <SectionHeading
            badge="The Turf & Taste Standard"
            title="Why Choose"
            highlight="Our Arena"
            subtitle="Built without compromises to deliver safety, thrill, and hospitality."
            center
          />

          <div className="grid grid-4" style={{ marginTop: '2.5rem' }}>
            <div className="card-arena">
              <div className="feature-num text-olive">01</div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '0.6rem' }}>Shock-Absorbent Turf</h3>
              <p style={{ fontSize: '0.94rem' }}>
                Joint-friendly high-pile synthetic turf reduces impact strain, letting you sprint, dive, and slide with confidence.
              </p>
            </div>

            <div className="card-arena">
              <div className="feature-num text-orange">02</div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '0.6rem' }}>Automated Ball Feeder</h3>
              <p style={{ fontSize: '0.94rem' }}>
                Calibrate ball speed from 60 km/h to 150+ km/h with variable swing and bounce to elevate your batting technique.
              </p>
            </div>

            <div className="card-arena">
              <div className="feature-num text-olive">03</div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '0.6rem' }}>Anti-Glare Floodlights</h3>
              <p style={{ fontSize: '0.94rem' }}>
                Evenly distributed daylight-balanced LED lighting ensures high ball tracking clarity for late-night showdowns.
              </p>
            </div>

            <div className="card-arena">
              <div className="feature-num text-orange">04</div>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '0.6rem' }}>Chef-Curated Dining</h3>
              <p style={{ fontSize: '0.94rem' }}>
                Not just standard snack counters: enjoy artisan coffees, wholesome post-game recovery bowls, and delicious bites.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SPORTS + FOOD EXPERIENCE (FROM PITCH TO PLATE) */}
      <section className="section">
        <div className="container">
          <div className="experience-highlight-card">
            <div className="experience-content">
              <span className="badge badge-orange" style={{ marginBottom: '1rem' }}>
                Dual Experience
              </span>
              <h2>
                From the Pitch to the Plate: <br />
                <span className="text-olive">Play Hard. Eat Well.</span>
              </h2>
              <p style={{ margin: '1.25rem 0', fontSize: '1.05rem', lineHeight: '1.65' }}>
                At Turf &amp; Taste, sport doesn't end when the final ball is bowled. 
                Step directly from the high-energy court into our relaxed, air-conditioned 
                café lounge. Discuss match highlights with your teammates, rehydrate with 
                fresh cold-pressed juices, and enjoy delicious pizzas and grilled snacks.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                <Link to="/facilities/cafe" className="btn btn-primary">
                  Explore Café Menu &amp; Ambience <ArrowRight size={16} />
                </Link>
                <Link to="/facilities" className="text-action-link">
                  Explore all sports arenas <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="experience-image-side">
              <img 
                src="/images/cafe.jpg" 
                alt="Turf & Taste Sports Cafe" 
                className="experience-img" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* 6. HOW BOOKING WORKS */}
      <section className="section" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <SectionHeading
            badge="Fast & Transparent"
            title="How Booking"
            highlight="Will Work"
            subtitle="Four effortless steps to reserve your game slot or practice lane."
            center
          />

          <div className="booking-steps-grid">
            <div className="step-card">
              <div className="step-circle">1</div>
              <h4>Select Facility</h4>
              <p>Choose Box Cricket, Skating Rink, Pickleball, or Cricket Practice Nets.</p>
            </div>

            <div className="step-card">
              <div className="step-circle">2</div>
              <h4>Choose Date &amp; Slot</h4>
              <p>Pick your preferred morning, afternoon, or floodlit night time slot.</p>
            </div>

            <div className="step-card">
              <div className="step-circle">3</div>
              <h4>Flexible Payment</h4>
              <p>Reserve with a small booking deposit or pay in full for express game-day entry.</p>
            </div>

            <div className="step-card">
              <div className="step-circle">4</div>
              <h4>Play &amp; Refuel</h4>
              <p>Show your digital pass on arrival, take the field, and enjoy café privileges.</p>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <Link to="/booking" className="btn btn-primary btn-lg">
              <Calendar size={18} /> Book Your Arena Slot Now
            </Link>
          </div>
        </div>
      </section>

      {/* 7. FEATURED EXPERIENCE / PROMOTIONAL SECTION */}
      <section className="section">
        <div className="container">
          <div className="promo-banner-card">
            <div className="promo-badge">
              <Award size={18} /> UPCOMING IN PATAN
            </div>
            <h2 className="promo-title">
              Weekend Night Tournaments &amp; Corporate Cups
            </h2>
            <p className="promo-desc">
              Looking to host an inter-firm box cricket championship, a pickleball tournament, 
              or a birthday sports party? We provide floodlit arenas, digital scoreboards, 
              custom umpire setups, and full-service café catering.
            </p>
            <div className="promo-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <Link to="/inquiry" className="btn btn-primary btn-lg">
                Submit Tournament &amp; Group Request <ArrowRight size={18} />
              </Link>
              <Link to="/pricing" className="text-action-link">
                Review rate packages &amp; duration discounts <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 8. LOCATION PREVIEW & HOURS */}
      <section className="section" style={{ background: 'var(--bg-surface-elevated)' }}>
        <div className="container">
          <div className="grid grid-2" style={{ alignItems: 'center' }}>
            <div>
              <span className="badge badge-olive" style={{ marginBottom: '1rem' }}>
                Location Preview
              </span>
              <h2>
                Easy to Reach in <span className="text-olive">Patan, Gujarat</span>
              </h2>
              <p style={{ margin: '1.25rem 0 1.75rem', fontSize: '1.05rem' }}>
                Strategically positioned in Patan with swift road connectivity, ample dedicated parking, 
                and comprehensive security. Perfect for everyday practice or grand weekend events.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '0.85rem' }}>
                  <MapPin size={22} className="text-orange" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Prime Address:</strong>
                    <p style={{ fontSize: '0.95rem' }}>Opposite New Sports Complex, Bypass Road, Patan 384265, Gujarat, India</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem' }}>
                  <Clock size={22} className="text-olive" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Daily Operational Hours:</strong>
                    <p style={{ fontSize: '0.95rem' }}>Arenas: 6:00 AM – 11:30 PM &bull; Café: 7:00 AM – 11:00 PM</p>
                  </div>
                </div>
              </div>

              <Link to="/contact" className="btn btn-outline">
                Get Directions &amp; Contact Details <ArrowRight size={16} />
              </Link>
            </div>

            <div className="card-arena" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ 
                height: '280px', 
                background: 'var(--bg-surface)', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div className="court-bg-pattern" style={{ opacity: 0.4 }} />
                <MapPin size={48} className="text-orange animate-pulse-subtle" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Turf &amp; Taste Patan</h3>
                <p style={{ fontSize: '0.95rem', maxWidth: '300px' }}>
                  Bypass Road Corridor, Patan, Gujarat 384265
                </p>
                <span className="badge badge-olive" style={{ marginTop: '1rem' }}>
                  Google Maps Integration Ready
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FINAL CTA BANNER */}
      <section className="section" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <span className="badge badge-orange" style={{ marginBottom: '1rem' }}>
              Grand Opening Phase
            </span>
            <h2 style={{ fontSize: 'clamp(2.4rem, 5vw, 3.6rem)', marginBottom: '1.25rem' }}>
              Ready to <span className="text-olive">Take the Field?</span>
            </h2>
            <p style={{ fontSize: '1.15rem', marginBottom: '2rem' }}>
              Preview slot availability, test the booking experience, or reach out for group event packages.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/booking" className="btn btn-primary btn-lg">
                <Calendar size={18} /> Book a Slot Now
              </Link>
              <Link to="/inquiry" className="btn btn-outline btn-lg">
                Submit an Inquiry
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from '../context/RouterContext';
import { durationMultipliers, paymentOptionsInfo } from '../data/pricingData';
import { adminStore } from '../services/adminStore';
import SectionHeading from '../components/SectionHeading';
import CourtBackground from '../components/CourtBackground';
import { 
  Check, 
  HelpCircle, 
  Calendar, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  CreditCard, 
  Clock, 
  Users 
} from 'lucide-react';

export default function Pricing() {
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [pricingList, setPricingList] = useState(() => adminStore.getPricing());

  useEffect(() => {
    adminStore.fetchPricingAsync().then((list) => {
      if (list && list.length > 0) setPricingList(list);
    });

    const handleUpdate = () => {
      setPricingList(adminStore.getPricing());
    };

    window.addEventListener('tt_pricing_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('tt_pricing_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return (
    <div className="page-pricing">
      {/* Header */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden', paddingBottom: '2.5rem' }}>
        <CourtBackground />
        <div className="container" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <span className="badge badge-olive" style={{ marginBottom: '1rem' }}>
            Transparent &amp; Flexible Rates
          </span>
          <h1 style={{ marginBottom: '1rem' }}>
            Pricing <span className="text-olive">&amp; Packages</span>
          </h1>
          <p style={{ maxWidth: '720px', margin: '0 auto', fontSize: '1.2rem', lineHeight: '1.6' }}>
            Engineered for fair, transparent play. Pay a token booking amount to secure your slot, or complete full payment upfront for instant express entry.
          </p>

          {/* Duration Selector Tabs */}
          <div style={{ marginTop: '2.5rem', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--brand-cream-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Select Session Duration:
            </span>
            <div className="tabs-container">
              {durationMultipliers.map(dur => (
                <button
                  key={dur.value}
                  className={`tab-btn ${selectedDuration === dur.value ? 'active' : ''}`}
                  onClick={() => setSelectedDuration(dur.value)}
                >
                  {dur.label} <span style={{ opacity: 0.7, fontSize: '0.75rem', marginLeft: '4px' }}>({dur.discount})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="section" style={{ paddingTop: '1rem' }}>
        <div className="container">
          <div className="grid grid-3">
            {pricingList.map((tier) => {
              const dayNum = adminStore.parsePrice(tier.dayRate) || 800;
              const nightNum = adminStore.parsePrice(tier.nightRate) || 1200;
              const depositNum = adminStore.parsePrice(tier.bookingDeposit) || 400;

              const displayDayRate = selectedDuration > 1 ? `₹${dayNum * selectedDuration}` : `₹${dayNum}`;
              const displayNightRate = selectedDuration > 1 ? `₹${nightNum * selectedDuration}` : `₹${nightNum}`;

              return (
                <div 
                  key={tier.facilityId} 
                  className={`card-arena ${tier.popular ? 'highlight' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                >
                  {/* Header Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span className={`badge ${tier.popular ? 'badge-orange' : 'badge-olive'}`}>
                      {tier.badge}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {selectedDuration} Hour{selectedDuration > 1 ? 's' : ''} Block
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '1.6rem', marginBottom: '1.25rem' }}>{tier.facilityName}</h3>

                  {/* Price Display */}
                  <div style={{
                    background: 'var(--bg-surface-elevated)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.5rem',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Day Hours:</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--brand-cream)' }}>
                        {displayDayRate} <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>{selectedDuration > 1 ? `(${selectedDuration} hrs)` : '/ hr'}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Floodlight Prime:</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--brand-olive-bright)' }}>
                        {displayNightRate} <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>{selectedDuration > 1 ? `(${selectedDuration} hrs)` : '/ hr'}</span>
                      </span>
                    </div>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--brand-orange)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Sparkles size={14} /> Token Booking Amount: <strong>₹{depositNum}</strong>
                    </div>
                  </div>

                {/* Timings */}
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Clock size={15} className="text-olive" style={{ flexShrink: 0 }} />
                    <span>Day: {tier.dayHours}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Clock size={15} className="text-orange" style={{ flexShrink: 0 }} />
                    <span>Night: {tier.nightHours}</span>
                  </div>
                </div>

                {/* Included Items */}
                <div style={{ flex: 1, marginBottom: '1.75rem' }}>
                  <span style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--brand-cream-muted)', display: 'block', marginBottom: '0.75rem' }}>
                    Included With Reservation:
                  </span>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {tier.includedItems.map((item, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        <Check size={16} className="text-olive" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Target group */}
                <div style={{ fontSize: '0.82rem', color: 'var(--brand-cream-muted)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Users size={15} className="text-olive" />
                  <span>{tier.groupRecommendation}</span>
                </div>

                {/* CTAs */}
                <Link 
                  to={`/booking?facility=${tier.facilityId}`} 
                  className={`btn ${tier.popular ? 'btn-primary' : 'btn-outline'} btn-block`}
                >
                  <Calendar size={16} /> Book for This Sport
                </Link>
              </div>
            );
          })}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)' }}>
              * All rates are transparent with no hidden surcharges. Rates may vary during special festival tournaments and late-night floodlight hours.
            </p>
          </div>
        </div>
      </section>

      {/* Payment Options Explained (Booking Amount vs Full Payment) */}
      <section className="section" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <SectionHeading
            badge="Payment Model"
            title="How Payments Work:"
            highlight="Token vs Full Payment"
            subtitle="We offer two convenient payment paths to match your squad's preferences."
            center
          />

          <div className="grid grid-2" style={{ marginTop: '2.5rem', gap: '2rem' }}>
            {paymentOptionsInfo.map(opt => (
              <div key={opt.id} className="card-arena" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span className={`badge ${opt.recommended ? 'badge-orange' : 'badge-olive'}`}>
                    {opt.badge}
                  </span>
                  <CreditCard size={22} className={opt.recommended ? 'text-orange' : 'text-olive'} />
                </div>

                <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>{opt.title}</h3>
                <p style={{ fontSize: '0.95rem', color: 'var(--brand-cream)', marginBottom: '1rem', fontWeight: 500 }}>
                  {opt.subtitle}
                </p>
                <p style={{ fontSize: '0.92rem', lineHeight: '1.6' }}>
                  {opt.description}
                </p>

                <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--brand-cream-muted)' }}>
                  <ShieldCheck size={16} className="text-olive" />
                  <span>Supports UPI, Cards, Net Banking &amp; Front-Desk Payment</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Custom Event Packages CTA */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="card-arena highlight" style={{ padding: 'clamp(2rem, 5vw, 3.5rem)', maxWidth: '820px', margin: '0 auto' }}>
            <span className="badge badge-orange" style={{ marginBottom: '1rem' }}>
              Custom Tournaments &amp; Corporate Deals
            </span>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>
              Hosting a League or Large Celebration?
            </h2>
            <p style={{ fontSize: '1.05rem', marginBottom: '2rem', maxWidth: '620px', margin: '0 auto 2rem' }}>
              We tailor custom half-day and full-day arena buyouts including dedicated scoreboards, umpire setups, custom sound, and tournament coordination.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/inquiry" className="btn btn-primary btn-lg">
                Submit Group Inquiry <ArrowRight size={18} />
              </Link>
              <Link to="/contact" className="btn btn-outline btn-lg">
                Contact Management
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

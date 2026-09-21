import React from 'react';
import { Link } from '../context/RouterContext';
import SectionHeading from '../components/SectionHeading';
import CourtBackground from '../components/CourtBackground';
import { 
  Target, 
  Compass, 
  Users, 
  Trophy, 
  HeartHandshake, 
  Coffee, 
  Calendar, 
  ArrowRight,
  Shield,
  Smile
} from 'lucide-react';

export default function About() {
  return (
    <div className="page-about">
      {/* Page Header */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden', paddingBottom: '2rem' }}>
        <CourtBackground />
        <div className="container" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <span className="badge badge-olive" style={{ marginBottom: '1rem' }}>
            Our Heritage &amp; Vision
          </span>
          <h1 style={{ marginBottom: '1rem' }}>
            About <span className="text-olive">Turf &amp; Taste</span>
          </h1>
          <p style={{ maxWidth: '680px', margin: '0 auto', fontSize: '1.2rem', lineHeight: '1.6' }}>
            Building Patan’s premier sports and recreation sanctuary — where athletic energy, wholesome dining, and community spirit thrive together.
          </p>
        </div>
      </section>

      {/* Origin & Story */}
      <section className="section" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <div className="grid grid-2" style={{ alignItems: 'center', gap: '3.5rem' }}>
            <div>
              <span className="badge badge-orange" style={{ marginBottom: '1rem' }}>
                The Genesis
              </span>
              <h2 style={{ marginBottom: '1.25rem' }}>
                Why We Created <br />
                <span className="text-olive">Turf &amp; Taste</span>
              </h2>
              <p style={{ marginBottom: '1.2rem', fontSize: '1.05rem', lineHeight: '1.65' }}>
                For sports enthusiasts in Patan and North Gujarat, finding high-quality facilities often meant settling for uneven local grounds, poorly lit turfs, or disconnected venues where players had nowhere comfortable to relax after a grueling match.
              </p>
              <p style={{ marginBottom: '1.2rem', fontSize: '1.05rem', lineHeight: '1.65' }}>
                We envisioned a unified destination built to professional standards. A place where a cricket enthusiast can test their batting against a 140 km/h bowling machine, friends can book a floodlit box cricket match after sunset, children can safely learn roller skating, and everyone can sit together at a stylish café enjoying wholesome food and cold smoothies.
              </p>
              <p style={{ marginBottom: '2rem', fontSize: '1.05rem', lineHeight: '1.65' }}>
                <strong>Turf &amp; Taste is that vision realized:</strong> professional sports infrastructure paired with genuine hospitality under one roof.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <Link to="/booking" className="btn btn-primary btn-lg">
                  <Calendar size={18} /> Reserve a Slot Online
                </Link>
                <Link to="/facilities" className="text-action-link">
                  Explore all facility specifications <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                border: '1px solid var(--border-strong)',
                boxShadow: 'var(--shadow-lg), var(--glow-olive)'
              }}>
                <img 
                  src="/images/hero_arena.jpg" 
                  alt="Turf and Taste sports complex in Patan" 
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
              <div style={{
                position: 'absolute',
                bottom: '-1.5rem',
                right: '1.5rem',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-strong)',
                padding: '1rem 1.5rem',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)',
                maxWidth: '260px'
              }}>
                <span className="text-orange" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>
                  PLAY HARD • EAT WELL
                </span>
                <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Authentic brand philosophy in Patan, Gujarat.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 3 Core Pillars */}
      <section className="section">
        <div className="container">
          <SectionHeading
            badge="Our Foundation"
            title="The Three"
            highlight="Core Pillars"
            subtitle="How we balance competitive athletics with social relaxation."
            center
          />

          <div className="grid grid-3" style={{ marginTop: '2.5rem' }}>
            <div className="card-arena">
              <div className="pillar-icon-wrap olive">
                <Target size={26} />
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>1. Athletic Precision</h3>
              <p>
                No compromises on playing surfaces. From shock-cushioned synthetic turf that protects knees to regulation USAPA pickleball court coatings and high-tensile containment netting, every square foot is engineered for safety and performance.
              </p>
            </div>

            <div className="card-arena">
              <div className="pillar-icon-wrap orange">
                <Coffee size={26} />
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>2. Nourishing Hospitality</h3>
              <p>
                We reject low-quality stadium junk food. Our café and snack counters serve cold-pressed juices, protein smoothies, artisan espresso, and chef-crafted meals designed to replenish energy and satisfy flavor cravings.
              </p>
            </div>

            <div className="card-arena">
              <div className="pillar-icon-wrap olive">
                <HeartHandshake size={26} />
              </div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>3. Community Inclusivity</h3>
              <p>
                Turf &amp; Taste is built for everyone — from youth taking their first skating glides to corporate colleagues unwinding after hours and families spending quality weekend time together in a safe, clean environment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who We Are Designed For */}
      <section className="section" style={{ background: 'var(--bg-surface-elevated)' }}>
        <div className="container">
          <SectionHeading
            badge="Audience & Use Cases"
            title="Designed For"
            highlight="Every Passion"
            subtitle="Whether you seek high-stakes competition, focused technique training, or leisure."
            center
          />

          <div className="grid grid-4" style={{ marginTop: '2.5rem' }}>
            <div className="card-arena">
              <Trophy size={28} className="text-orange" style={{ marginBottom: '1rem' }} />
              <h4>Casual Match Squads</h4>
              <p style={{ fontSize: '0.92rem', marginTop: '0.5rem' }}>
                Weekend evening box cricket, friendly pickleball doubles, and lively matches with your regular circle.
              </p>
            </div>

            <div className="card-arena">
              <Target size={28} className="text-olive" style={{ marginBottom: '1rem' }} />
              <h4>Serious Cricketers</h4>
              <p style={{ fontSize: '0.92rem', marginTop: '0.5rem' }}>
                Isolate shot technique against pace, spin, and bouncers in our automated ball-shooting machine net lanes.
              </p>
            </div>

            <div className="card-arena">
              <Smile size={28} className="text-orange" style={{ marginBottom: '1rem' }} />
              <h4>Kids &amp; Young Learners</h4>
              <p style={{ fontSize: '0.92rem', marginTop: '0.5rem' }}>
                Smooth, safe skating rink with certified gear and protective perimeter bars to build athletic balance.
              </p>
            </div>

            <div className="card-arena">
              <Users size={28} className="text-olive" style={{ marginBottom: '1rem' }} />
              <h4>Corporate Teams</h4>
              <p style={{ fontSize: '0.92rem', marginTop: '0.5rem' }}>
                Structured company tournaments, employee wellness days, and memorable celebrations with café packages.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Realistic Roadmap & Future Plans */}
      <section className="section">
        <div className="container">
          <SectionHeading
            badge="Phase 1 & Beyond"
            title="Our Growth"
            highlight="Roadmap"
            subtitle="Transparent development plans as we prepare for grand opening in Patan."
            center
          />

          <div className="grid grid-3" style={{ marginTop: '2.5rem' }}>
            <div className="card-arena highlight">
              <span className="badge badge-orange" style={{ marginBottom: '0.75rem' }}>
                Phase 1 (Current)
              </span>
              <h3 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>Destination Foundation</h3>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.92rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <li>Arena court construction and turf certification</li>
                <li>Automated bowling machine installation &amp; calibration</li>
                <li>Café interior setup and chef recipe tastings</li>
                <li>Live slot availability, booking requests, and customer pass lookup</li>
              </ul>
            </div>

            <div className="card-arena">
              <span className="badge badge-olive" style={{ marginBottom: '0.75rem' }}>
                Phase 2 (Upcoming)
              </span>
              <h3 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>Gateway Automation &amp; Service</h3>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.92rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <li>Automated UPI review and verified payment-gateway confirmations</li>
                <li>Self-service reschedule and cancellation requests</li>
                <li>Expanded customer pass and receipt experience</li>
                <li>Operational reporting and staff workflow improvements</li>
              </ul>
            </div>

            <div className="card-arena">
              <span className="badge badge-cream" style={{ marginBottom: '0.75rem' }}>
                Phase 3 (Vision)
              </span>
              <h3 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>Leagues &amp; Memberships</h3>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.92rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <li>Annual Patan Box Cricket Premier Championship</li>
                <li>Monthly athlete memberships &amp; practice subscriptions</li>
                <li>Youth cricket &amp; skating coaching academies</li>
                <li>Expanded outdoor turf lounge deck</li>
              </ul>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link to="/contact" className="btn btn-primary btn-lg">
              Visit or Inquire Today <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

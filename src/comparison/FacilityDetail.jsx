import React from "react";
import {
  ArrowRight,
  Camera,
  ChevronRight,
  Clock3,
  Footprints,
  Sprout,
  Plug,
  QrCode,
  Settings,
  Timer,
  WandSparkles,
  Handshake,
} from "lucide-react";
import { asset, Header, SectionHeading } from "./components";
import { Link } from "../context/RouterContext";

const specifications = [
  [Timer, "Slot Duration", "60m / 90m Blocks"],
  [Clock3, "Operating Window", "06:00 AM - 10:00 PM"],
  [Sprout, "Pitch Surface", "Synthetic Turfed Enclosure"],
  [WandSparkles, "Equipment", "Feeder & Stumps Provided"],
];
const guidelines = [
  [
    Footprints,
    "Approved Footwear",
    "Flat rubber-soled turf trainers or non-marking sport shoes required. Metal spikes strictly prohibited.",
  ],
  [
    QrCode,
    "Turnstile Check-In",
    "Digital pass scan at turnstile gate 10 mins prior to slot commencement.",
  ],
  [
    Handshake,
    "Equipment Provision",
    "Club training balls included; protective batting gear and pads available on request at bay desk.",
  ],
];
export default function FacilityDetail({ onNotice }) {
  return (
    <>
      <Header detail onNotice={onNotice} />
      <main className="detail-page">
        <div className="detail-image">
          <img
            src={asset("detail-nets")}
            alt="Indoor cricket green net practice bay with shooting machine"
          />
          <span className="active-badge">● ACTIVE &amp; BOOKABLE</span>
          <div className="detail-image-bottom">
            <span>
              <WandSparkles size={15} />
              Cricket Green Net Practice
            </span>
            <button onClick={onNotice}>
              <Camera size={13} />1 of 4 Photos
            </button>
          </div>
        </div>
        <div className="detail-content">
          <section className="detail-intro">
            <div className="reference-line">
              <span>[FACILITY REFERENCE]</span>
              <span>[Facility Sector / Wing]</span>
            </div>
            <h2>[Facility Name]</h2>
            <div className="review-line">
              <span className="star">★</span>
              <strong>4.9</strong>
              <span>•</span>
              <button onClick={onNotice}>
                [Review Count] Verified Reviews →
              </button>
            </div>
            <div className="service-label">
              <WandSparkles size={15} />
              <span>Cricket Green Net Practice with Shooting Machine</span>
            </div>
          </section>
          <section
            className="specifications"
            aria-label="Facility specifications"
          >
            {specifications.map(([Icon, label, value]) => (
              <div className="specification" key={label}>
                <span className="spec-icon">
                  <Icon size={21} />
                </span>
                <p>{label}</p>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
          <section className="detail-section">
            <SectionHeading title="About This Facility" />
            <div className="about-card">
              <p>
                Standard training bay equipped with heavy-duty surround
                tensioned netting, high-resilience synthetic turf underlay, and
                dedicated programmable shooting machine options. Configured for
                practice and coached sessions.
              </p>
              <div>
                <span>
                  <Settings size={14} />
                  Indoor Covered Bay
                </span>
                <span>
                  <Plug size={14} />
                  Power Feeder Ports
                </span>
              </div>
            </div>
          </section>
          <section className="detail-section">
            <SectionHeading
              title="Pricing & Tariffs"
              action="Member Rates Apply"
              onAction={onNotice}
            />
            <div className="pricing-card">
              <div className="pricing-title">
                <h3>[Configured Tariff]</h3>
                <span>Standard Tier</span>
              </div>
              <p>Based on verified patron bookings</p>
              <dl>
                <div>
                  <dt>Standard Net Lane (Off-Peak)</dt>
                  <dd>[Standard / Prime Rates]</dd>
                </div>
                <div>
                  <dt>Prime Net Lane (Peak Evening)</dt>
                  <dd>[Standard / Prime Rates]</dd>
                </div>
                <div>
                  <dt>Automated Feeder Inclusion</dt>
                  <dd className="included">Included</dd>
                </div>
              </dl>
              <p className="pricing-note">Based on verified patron bookings</p>
            </div>
          </section>
          <section className="detail-section">
            <SectionHeading title="Venue Guidelines" />
            <div className="guidelines">
              {guidelines.map(([Icon, title, body]) => (
                <div key={title}>
                  <span>
                    <Icon size={18} />
                  </span>
                  <p>
                    <strong>{title}</strong>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <SectionHeading
              title="Patron Feedback"
              action="Verified Bookers"
              onAction={onNotice}
            />
            <div className="feedback-card">
              <div className="feedback-summary">
                <strong className="review-score">4.9</strong>
                <div>
                  <span className="star">★★★★★</span>
                  <p>Based on verified patron bookings</p>
                </div>
                <button aria-label="View verified reviews" onClick={onNotice}>
                  <ChevronRight size={17} />
                </button>
              </div>
              <blockquote>
                <div>
                  <strong>[Verified Patron]</strong>
                  <span>Based on verified patron bookings</span>
                </div>
                <p>
                  “Pitch bounce is completely true across length drills. The
                  automated feeder syncs without delay.”
                </p>
              </blockquote>
            </div>
          </section>
        </div>
      </main>
      <footer className="detail-action">
        <div>
          <span>Starting from</span>
          <strong>[Configured Tariff]</strong>
        </div>
        <Link className="primary-button" to="/booking">
          Select Date &amp;
          <br /> Time <ArrowRight size={21} />
        </Link>
      </footer>
    </>
  );
}

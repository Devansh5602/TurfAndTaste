import React, { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Gem,
  Trophy,
  UsersRound,
  Utensils,
  Handshake,
} from "lucide-react";
import { Link, useRouter } from "../context/RouterContext";
import {
  asset,
  Header,
  BottomNavigation,
  LocationSelector,
  ServiceFilters,
  SectionHeading,
  VenueCard,
} from "./components";
import { homeVenues, matchesService } from "./fixtures";

function ClubTeasers({ onNotice }) {
  return (
    <>
      <section className="home-section">
        <SectionHeading
          icon={Trophy}
          title="Happening at the Club"
          action="All Events"
          onAction={onNotice}
        />
        <article className="teaser-card event-card">
          <div className="teaser-image">
            <img
              src={asset("home-event")}
              alt="Club cricket tournament celebration"
            />
            <span className="event-badge">REGISTRATION CLOSING SOON</span>
          </div>
          <div className="teaser-body">
            <div className="event-title">
              <div>
                <small>CLUB INVITATIONAL TOURNAMENT</small>
                <h3>Autumn Box Cricket Championship</h3>
              </div>
              <div className="event-date">
                <small>OCT</small>
                <strong>12–14</strong>
              </div>
            </div>
            <div className="teaser-strip">
              <span>
                <UsersRound size={15} />
                16 Teams Total
              </span>
              <span>
                <CircleDollarSign size={15} />
                ₹50,000 Prize Pool
              </span>
            </div>
            <button className="secondary-button" onClick={onNotice}>
              View Tournament Fixtures ›
            </button>
          </div>
        </article>
      </section>
      <section className="home-section">
        <SectionHeading
          icon={Utensils}
          title="Pitchside Dining"
          action="Level 1 Terrace"
          onAction={onNotice}
        />
        <article className="teaser-card dining-card">
          <div className="teaser-image">
            <img
              src={asset("home-dining")}
              alt="Pizza on the pitchside terrace"
            />
            <span className="dining-badge">● Open till 11:00 PM</span>
          </div>
          <div className="teaser-body">
            <div className="dining-title">
              <h3>The Boundary Bistro &amp; Terrace</h3>
              <span>⭐ 4.9</span>
            </div>
            <p>Wood-fired Pinsa, Artisan Smoothies &amp; Matchside Espresso</p>
            <div className="teaser-strip">
              <span>
                <Gem size={16} />
                Chef's Special: Truffle Burrata Pinsa
              </span>
              <strong>₹480</strong>
            </div>
            <div className="dining-actions">
              <button className="secondary-button" onClick={onNotice}>
                View Menu
              </button>
              <button className="primary-button" onClick={onNotice}>
                Reserve Table
              </button>
            </div>
          </div>
        </article>
      </section>
      <aside className="players">
        <span className="players-icon">
          <Handshake size={19} />
        </span>
        <div>
          <strong>Need a 6th player?</strong>
          <p>Join the Bopal turf lobby tonight</p>
        </div>
        <button onClick={onNotice}>Find Players</button>
      </aside>
    </>
  );
}
export default function Home({ onNotice }) {
  const [selected, setSelected] = useState("All");
  const { navigate } = useRouter();
  const filtered = homeVenues.filter((v) => matchesService(v, selected));
  return (
    <>
      <Header onNotice={onNotice} />
      <main className="home-page">
        <div className="location-row">
          <LocationSelector onClick={onNotice} />
          <span className="lights">● TURF LIGHTS ON</span>
        </div>
        <section className="welcome">
          <p>CLUBHOUSE LOUNGE</p>
          <h2>Good afternoon, Devansh</h2>
        </section>
        <section className="reserve-hero" aria-label="Reserve Your Slot">
          <img src={asset("hero")} alt="Floodlit club grounds at dusk" />
          <div className="hero-content">
            <div className="hero-status">
              <span>PRIME EVENING SLOTS</span>
              <small>Fast Filling Today</small>
            </div>
            <div className="hero-bottom">
              <div>
                <h2>Reserve Your Slot</h2>
                <p>Box cricket nets &amp; pickleball floodlit...</p>
              </div>
              <Link to="/facilities">Book Now</Link>
            </div>
          </div>
        </section>
        <section className="activities">
          <div className="activity-heading">
            <h2>Authorized Arenas</h2>
            <span>5 Disciplines</span>
          </div>
          <ServiceFilters home selected={selected} onChange={setSelected} />
        </section>
        <section className="quick-booking">
          <SectionHeading
            icon={CalendarDays}
            title="Quick Match Booking"
            action="View Map"
            onAction={() => navigate("/facilities")}
          />
          <div className="card-stack">
            {filtered.map((v) => (
              <VenueCard key={v.image} venue={v} home />
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              Explore this activity in{" "}
              <Link to="/facilities">
                Venues <ArrowRight size={15} />
              </Link>
              .
            </div>
          )}
        </section>
        <ClubTeasers onNotice={onNotice} />
      </main>
      <BottomNavigation active="Home" onNotice={onNotice} />
    </>
  );
}

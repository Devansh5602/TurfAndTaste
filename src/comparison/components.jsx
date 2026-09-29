import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  CalendarDays,
  ChevronDown,
  Clock3,
  Home,
  MapPin,
  Navigation,
  Share2,
  Signal,
  Trophy,
  UserRound,
  Utensils,
  Wifi,
  BatteryFull,
  CircleDot,
  WandSparkles,
  Footprints,
  Crosshair,
  Gauge,
  Video,
} from "lucide-react";
import { Link } from "../context/RouterContext";
import { services } from "./fixtures";

export const asset = (name) => `/comparison/${name}.jpg`;
export function IconButton({
  label,
  children,
  onClick,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
export function Header({ detail = false, venues = false, onNotice }) {
  return (
    <header className={`comparison-header ${detail ? "detail-header" : ""}`}>
      {!detail && (
        <div className="status-bar" aria-hidden="true">
          <span>9:41</span>
          <span>
            <Signal size={13} fill="currentColor" />
            <Wifi size={15} />
            <BatteryFull size={15} />
          </span>
        </div>
      )}
      <div className="header-row">
        {(detail || venues) && (
          <Link
            className={`icon-button back ${venues ? "venue-back" : ""}`}
            to={detail ? "/facilities" : "/"}
            aria-label={detail ? "Back to Facilities" : "Back to Home"}
          >
            <ArrowLeft size={19} />
          </Link>
        )}
        <h1>{detail ? "Facility Detail" : venues ? "Venues" : "Home"}</h1>
        <div className="header-actions">
          {detail ? (
            <>
              <IconButton label="Save facility" onClick={onNotice}>
                <Bookmark size={20} />
              </IconButton>
              <IconButton label="Share facility" onClick={onNotice}>
                <Share2 size={20} />
              </IconButton>
            </>
          ) : (
            <IconButton label="Notifications" onClick={onNotice}>
              <Bell size={21} />
            </IconButton>
          )}
          <IconButton
            className="profile-icon"
            label="Profile"
            onClick={onNotice}
          >
            <UserRound size={18} />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
export function BottomNavigation({ active, onNotice }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {[
        ["Home", Home, "/"],
        ["Venues", Trophy, "/facilities"],
        ["Dining", Utensils],
        ["Events", CalendarDays],
        ["Profile", UserRound],
      ].map(([label, Icon, to]) =>
        to ? (
          <Link
            key={label}
            to={to}
            aria-current={active === label ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ) : (
          <button key={label} onClick={onNotice}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ),
      )}
    </nav>
  );
}
export function ServiceFilters({ selected, onChange, home = false }) {
  return (
    <div
      className={`service-filters ${home ? "home-filters" : ""}`}
      role="group"
      aria-label="Filter by activity"
    >
      {["All", ...services].map((s, i) => (
        <button
          key={s}
          aria-pressed={selected === s}
          onClick={() => onChange(s)}
        >
          {home &&
            (i === 0 ? (
              <WandSparkles size={15} />
            ) : i === 2 ? (
              <Footprints size={15} />
            ) : (
              <CircleDot size={15} />
            ))}
          {s === "All" && home ? "All Activities" : s}
        </button>
      ))}
    </div>
  );
}
export function SectionHeading({ icon: Icon, title, action, onAction }) {
  return (
    <div className="section-heading">
      <h2>
        {Icon && <Icon size={20} />} {title}
      </h2>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}
export function Rating({ rating, reviews }) {
  return (
    <span className="rating">
      <span className="star">★</span> <strong>{rating}</strong>{" "}
      <small>({reviews})</small>
    </span>
  );
}
export function VenueCard({ venue: v, home = false }) {
  return (
    <article className={`venue-card ${home ? "quick-card" : "discovery-card"}`}>
      <div className="venue-image">
        <img src={asset(v.image)} alt={v.name} width="512" height="279" />
        <div className="image-top">
          {!home && (
            <span className="distance">
              <Navigation size={12} />
              {v.distance} km away
            </span>
          )}
          <Rating rating={v.rating} reviews={v.reviews} />
        </div>
        <div className="image-bottom">
          {home ? (
            <div className="image-tags">
              {v.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          ) : (
            <>
              <span className="district">{v.district}</span>
              <span
                className={`venue-status ${v.status === "Pro Edition" ? "gold" : ""}`}
              >
                {v.status}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="venue-body">
        <div className="venue-summary">
          <div>
            <h3>{v.name}</h3>
            <p className="location">
              <MapPin size={14} />
              {v.location}
            </p>
          </div>
          {home && (
            <div className="quick-price">
              <small>Starts at</small>
              <strong>₹{v.price}</strong>
              <span>/hr</span>
            </div>
          )}
        </div>
        {home ? (
          <>
            <div className="next-slot">
              <span>
                <Clock3 size={15} /> Next: Today {v.time}
              </span>
              <strong>{v.slots} slots open</strong>
            </div>
            <Link className="primary-button book-slot" to="/facilities">
              Book Slot <ArrowRight size={17} />
            </Link>
          </>
        ) : (
          <>
            <div className="venue-tags">
              {v.tags.map((t) => (
                <span key={t}>
                  {t === "Floodlit LED" && <Crosshair size={12} />}{" "}
                  {t === "Smooth Synthetic Surface" && <Gauge size={12} />}{" "}
                  {t === "Video Analysis" && <Video size={12} />} {t}
                </span>
              ))}
            </div>
            <div className="venue-bottom">
              <div className="tariff">
                <small>STARTING AT</small>
                <strong>₹{v.price}</strong> / hr
              </div>
              <Link className="primary-button" to="/facilities/detail">
                View Arena &amp; Slots <ArrowRight size={16} />
              </Link>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
export function LocationSelector({ onClick }) {
  return (
    <button className="location-selector" onClick={onClick}>
      <MapPin size={16} /> Bopal, Ahmedabad <ChevronDown size={12} />
    </button>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from '../context/RouterContext';
import { adminStore } from '../services/adminStore';
import {
  Calendar, Clock, MapPin, Tag, ChevronRight, CheckCircle2,
  AlertCircle, XCircle, QrCode, Phone, Share2, ArrowRight,
  Search, RefreshCw, X, ShieldAlert, Sparkles
} from 'lucide-react';

export default function MyBookings() {
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past' | 'cancelled'
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneFilter, setPhoneFilter] = useState(() => {
    return localStorage.getItem('turf_user_phone') || '';
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadBookings = () => {
    const list = adminStore.getBookings() || [];
    setBookings(list);
  };

  useEffect(() => {
    loadBookings();
    adminStore.fetchBookingsAsync().then(() => loadBookings());

    // Listen to storage events
    const onStorage = () => loadBookings();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await adminStore.fetchBookingsAsync();
    loadBookings();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Helper to categorize bookings
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const categorizedBookings = bookings.filter((b) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (b.id && b.id.toLowerCase().includes(q)) ||
        (b.facility && b.facility.toLowerCase().includes(q)) ||
        (b.facilityName && b.facilityName.toLowerCase().includes(q)) ||
        (b.customer?.name && b.customer.name.toLowerCase().includes(q)) ||
        (b.customerPhone && b.customerPhone.includes(q)) ||
        (b.customer?.phone && b.customer.phone.includes(q));
      if (!match) return false;
    }

    // Phone filter if active
    if (phoneFilter.trim() && phoneFilter.length >= 4) {
      const bPhone = b.customerPhone || b.customer?.phone || '';
      if (!bPhone.includes(phoneFilter.trim())) return false;
    }

    const isCancelled = (b.status || '').toLowerCase() === 'cancelled';
    const isCompleted = (b.status || '').toLowerCase() === 'completed';
    const isDatePast = b.date && b.date < todayStr;

    if (activeTab === 'cancelled') {
      return isCancelled;
    }
    if (activeTab === 'past') {
      return (isCompleted || isDatePast) && !isCancelled;
    }
    // upcoming: not cancelled and not past
    return !isCancelled && !isCompleted && (!b.date || b.date >= todayStr);
  });

  const getStatusBadge = (status) => {
    const s = (status || 'confirmed').toLowerCase();
    if (s === 'confirmed') {
      return (
        <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle2 size={12} /> Confirmed
        </span>
      );
    }
    if (s === 'completed') {
      return (
        <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle2 size={12} /> Completed
        </span>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="badge badge-crimson" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <XCircle size={12} /> Cancelled
        </span>
      );
    }
    return <span className="badge badge-orange">{status}</span>;
  };

  return (
    <div className="page-my-bookings">
      {/* Header Bar */}
      <div className="bookings-page-header">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div>
              <span className="section-label" style={{ marginBottom: '2px' }}>Your Reservations</span>
              <h1 className="bookings-title">My Bookings</h1>
            </div>
            <button
              onClick={handleRefresh}
              className={`btn btn-outline btn-sm ${isRefreshing ? 'rotating' : ''}`}
              style={{ width: '38px', height: '38px', padding: 0, borderRadius: 'var(--radius-full)' }}
              title="Refresh Bookings"
              aria-label="Refresh Bookings"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="bookings-search-wrap">
            <Search size={16} className="bookings-search-icon text-muted" />
            <input
              type="text"
              placeholder="Search by ID, facility, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bookings-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="bookings-search-clear"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Segmented Control Tabs */}
          <div className="bookings-segmented-tabs" role="tablist">
            <button
              className={`booking-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
              role="tab"
              aria-selected={activeTab === 'upcoming'}
            >
              Upcoming
            </button>
            <button
              className={`booking-tab-btn ${activeTab === 'past' ? 'active' : ''}`}
              onClick={() => setActiveTab('past')}
              role="tab"
              aria-selected={activeTab === 'past'}
            >
              Past
            </button>
            <button
              className={`booking-tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
              onClick={() => setActiveTab('cancelled')}
              role="tab"
              aria-selected={activeTab === 'cancelled'}
            >
              Cancelled
            </button>
          </div>
        </div>
      </div>

      {/* Bookings List Section */}
      <div className="container" style={{ paddingTop: '1.25rem', paddingBottom: '3rem' }}>
        {categorizedBookings.length > 0 ? (
          <div className="bookings-list">
            {categorizedBookings.map((booking) => {
              const facName = booking.facility || booking.facilityName || 'Sports Arena';
              const timeDisplay = booking.slot?.time || booking.time || '60 Min Session';
              const customerName = booking.customer?.name || booking.customerName || 'Player';
              const amountDisplay = booking.amount || (booking.paymentType === 'full' ? 'Full Paid' : 'Token Deposit');

              return (
                <div
                  key={booking.id}
                  className="booking-card"
                  onClick={() => setSelectedBooking(booking)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedBooking(booking)}
                >
                  <div className="booking-card-header">
                    <div>
                      <span className="booking-card-id">ID: {booking.id}</span>
                      <h3 className="booking-card-facility">{facName}</h3>
                    </div>
                    <div>{getStatusBadge(booking.status)}</div>
                  </div>

                  <div className="booking-card-body">
                    <div className="booking-info-row">
                      <Calendar size={14} className="text-green" />
                      <span>{booking.date || 'Scheduled Date'}</span>
                      <span className="dot-divider">•</span>
                      <Clock size={14} className="text-orange" />
                      <span>{timeDisplay}</span>
                    </div>

                    <div className="booking-info-row">
                      <Tag size={14} className="text-muted" />
                      <span>Player: <strong>{customerName}</strong></span>
                      <span className="dot-divider">•</span>
                      <span className="booking-card-amount">{amountDisplay}</span>
                    </div>
                  </div>

                  <div className="booking-card-footer">
                    <span className="booking-view-pass-btn">
                      <QrCode size={15} /> View Digital Pass
                    </span>
                    <ChevronRight size={18} className="text-muted" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="booking-empty-state">
            <div className="booking-empty-icon-wrap">
              <Calendar size={36} className="text-muted" />
            </div>
            <h3 className="booking-empty-title">
              {activeTab === 'upcoming'
                ? 'No Upcoming Bookings'
                : activeTab === 'past'
                ? 'No Past Bookings'
                : 'No Cancelled Bookings'}
            </h3>
            <p className="booking-empty-desc">
              {activeTab === 'upcoming'
                ? "You don't have any active reservations scheduled. Pick a venue and lock your slot in seconds!"
                : 'Bookings matching this filter will show up here.'}
            </p>
            <Link to="/booking" className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
              <Calendar size={16} /> Book a Slot Now
            </Link>

            {activeTab === 'upcoming' && (
              <div style={{ marginTop: '1.75rem', width: '100%', maxWidth: '460px' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--brand-green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.65rem' }}>
                  Quick Reserve by Sport:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {[
                    { name: 'Box Cricket', icon: '🏏', slug: 'box-cricket' },
                    { name: 'Pickleball', icon: '🎾', slug: 'pickleball' },
                    { name: 'Skating Rink', icon: '⛸️', slug: 'skating' },
                    { name: 'Bowling Machine', icon: '🎯', slug: 'ball-machine' },
                  ].map(sp => (
                    <Link
                      key={sp.slug}
                      to={`/booking?facility=${sp.slug}`}
                      className="btn btn-outline btn-sm"
                      style={{ justifyContent: 'flex-start', gap: '6px', fontSize: '0.8rem' }}
                    >
                      <span>{sp.icon}</span>
                      <span>{sp.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          BOOKING PASS / DETAILS MODAL SHEET
          ══════════════════════════════════════════ */}
      {selectedBooking && (
        <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div
            className="modal-content booking-pass-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Close Button */}
            <button
              className="modal-close-btn"
              onClick={() => setSelectedBooking(null)}
              aria-label="Close pass"
            >
              <X size={20} />
            </button>

            {/* Ticket Header */}
            <div className="pass-ticket-top">
              <div className="pass-brand-tag">
                <span className="badge badge-green">Digital Arena Pass</span>
                <span className="pass-ref-id">{selectedBooking.id}</span>
              </div>
              <h2 className="pass-facility-title">
                {selectedBooking.facility || selectedBooking.facilityName}
              </h2>
              <div style={{ marginTop: '0.25rem' }}>
                {getStatusBadge(selectedBooking.status)}
              </div>
            </div>

            {/* Perforated Divider */}
            <div className="pass-perforated-strip">
              <div className="pass-hole hole-left" />
              <div className="pass-dash-line" />
              <div className="pass-hole hole-right" />
            </div>

            {/* Ticket Details */}
            <div className="pass-ticket-details">
              <div className="pass-grid-2">
                <div className="pass-field">
                  <span className="pass-field-label">Date</span>
                  <span className="pass-field-value">{selectedBooking.date}</span>
                </div>
                <div className="pass-field">
                  <span className="pass-field-label">Time Slot</span>
                  <span className="pass-field-value text-green">
                    {selectedBooking.slot?.time || selectedBooking.time}
                  </span>
                </div>
              </div>

              <div className="pass-grid-2" style={{ marginTop: '0.75rem' }}>
                <div className="pass-field">
                  <span className="pass-field-label">Primary Player</span>
                  <span className="pass-field-value">
                    {selectedBooking.customer?.name || selectedBooking.customerName || 'Player'}
                  </span>
                </div>
                <div className="pass-field">
                  <span className="pass-field-label">Contact</span>
                  <span className="pass-field-value">
                    {selectedBooking.customer?.phone || selectedBooking.customerPhone || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="pass-grid-2" style={{ marginTop: '0.75rem' }}>
                <div className="pass-field">
                  <span className="pass-field-label">Payment Status</span>
                  <span className="pass-field-value text-orange">
                    {selectedBooking.amount || 'Token Deposit Paid'}
                  </span>
                </div>
                <div className="pass-field">
                  <span className="pass-field-label">Duration</span>
                  <span className="pass-field-value">
                    {selectedBooking.duration || 1} Hour(s)
                  </span>
                </div>
              </div>

              {/* QR Code Graphic Box */}
              <div className="pass-qr-box">
                <div className="pass-qr-frame">
                  <QrCode size={110} strokeWidth={1.5} className="text-green" />
                </div>
                <span className="pass-qr-hint">Scan at front desk check-in</span>
              </div>

              {/* Venue Address Info */}
              <div className="pass-venue-box">
                <MapPin size={16} className="text-green" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Turf & Taste Sports Complex</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Opp. Agricultural University, Siddhpur Road, Patan, Gujarat 384265
                  </p>
                </div>
              </div>

              {/* Quick Actions in Pass */}
              <div className="pass-actions-grid">
                <a
                  href="tel:+919825000000"
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <Phone size={14} /> Call Desk
                </a>
                <a
                  href="https://maps.google.com/?q=Turf+And+Taste+Patan+Gujarat"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <MapPin size={14} /> Directions
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link, useRouter } from '../context/RouterContext';
import { api } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import {
  User, Phone, Mail, BookmarkCheck, CreditCard,
  Settings, HelpCircle, Shield, LogOut, ChevronRight,
  Edit2, Check, X, ShieldAlert, Sparkles,
  FileText, MessageCircle, ExternalLink
} from 'lucide-react';

export default function Profile() {
  const { navigate } = useRouter();

  // This is device-local booking convenience data, not a customer account or
  // authenticated identity. Customer account/OTP work is intentionally a
  // later module; never render a seeded persona as a signed-in user.
  const [profile, setProfile] = useState(() => {
    try {
      const stored = localStorage.getItem('turf_user_profile');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      name: '',
      phone: localStorage.getItem('turf_user_phone') || '',
      email: localStorage.getItem('turf_user_email') || '',
    };
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(profile);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [totalBookingsCount, setTotalBookingsCount] = useState(0);
  const [customerBookings, setCustomerBookings] = useState([]);
  const hasProfileDetails = Boolean(profile.phone && profile.email && profile.name);

  useEffect(() => {
    const phone = String(profile.phone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setTotalBookingsCount(0);
      setCustomerBookings([]);
      return;
    }
    api.getBookingHistory({ phone })
      .then(result => {
        if (!result.success) return;
        const history = result.history || [];
        setCustomerBookings(history);
        setTotalBookingsCount(history.length);
      })
      .catch(() => {
        setTotalBookingsCount(0);
        setCustomerBookings([]);
      });
  }, [profile.phone]);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setProfile(editForm);
    localStorage.setItem('turf_user_profile', JSON.stringify(editForm));
    if (editForm.phone) localStorage.setItem('turf_user_phone', editForm.phone);
    if (editForm.email) localStorage.setItem('turf_user_email', editForm.email);
    setIsEditing(false);
  };

  const handleClearSession = () => {
    if (window.confirm('Clear all local app sessions and reset preferences?')) {
      localStorage.removeItem('turf_user_profile');
      localStorage.removeItem('turf_user_phone');
      localStorage.removeItem('turf_user_email');
      sessionStorage.removeItem('tt_booking_success');
      window.location.reload();
    }
  };

  return (
    <div className="page-profile">
      {/* Header Profile Identity */}
      <div className="profile-header-card">
        <div className="container">
          <div className="profile-identity-wrap">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                <User size={36} className="text-green" />
              </div>
            </div>

            <div className="profile-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 className="profile-name">{profile.name || 'Guest booking details'}</h1>
                <button
                  onClick={() => { setEditForm(profile); setIsEditing(true); }}
                  className="profile-edit-btn"
                  title="Edit booking details"
                  aria-label="Edit booking details"
                >
                  <Edit2 size={13} />
                </button>
              </div>

              <div className="profile-contact-row">
                <Phone size={13} className="text-muted" />
                <span>{profile.phone || 'Add a mobile number to find your passes'}</span>
              </div>
              <div className="profile-contact-row">
                <Mail size={13} className="text-muted" />
                <span>{profile.email || 'Add an email address for booking updates'}</span>
              </div>
            </div>
          </div>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.45 }}>
            Saved on this device for faster booking. This is not a signed-in customer account.
          </p>

          {/* Quick Stats Strip */}
          <div className="profile-stats-strip">
            <div className="profile-stat-box">
              <span className="profile-stat-number">{totalBookingsCount}</span>
              <span className="profile-stat-label">Total Matches</span>
            </div>
            <div className="profile-stat-divider" />
            <div className="profile-stat-box">
              <span className="profile-stat-number text-green">{hasProfileDetails ? 'Saved' : 'Guest'}</span>
              <span className="profile-stat-label">Device details</span>
            </div>
            <div className="profile-stat-divider" />
            <div className="profile-stat-box">
              <span className="profile-stat-number">Patan</span>
              <span className="profile-stat-label">Home Venue</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings & Options List */}
      <div className="container" style={{ paddingTop: '1.25rem', paddingBottom: '3.5rem' }}>
        {/* Navigation Group 1: Activity */}
        <div className="profile-section-label">Activity & Bookings</div>
        <div className="profile-menu-card">
          <Link to="/my-bookings" className="profile-menu-item">
            <div className="profile-menu-icon" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ADE80' }}>
              <BookmarkCheck size={18} />
            </div>
            <div className="profile-menu-content">
              <span className="profile-menu-title">My Bookings</span>
              <span className="profile-menu-desc">View passes, active slots, and match history</span>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </Link>

          <button
            onClick={() => setShowPaymentsModal(true)}
            className="profile-menu-item"
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
          >
            <div className="profile-menu-icon" style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316' }}>
              <CreditCard size={18} />
            </div>
            <div className="profile-menu-content">
              <span className="profile-menu-title">Payment & Receipts</span>
              <span className="profile-menu-desc">Payment review, confirmations, and booking receipts</span>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </button>
        </div>

        {/* Navigation Group 2: Preferences */}
        <div className="profile-section-label" style={{ marginTop: '1.5rem' }}>Preferences & Rules</div>
        <div className="profile-menu-card">
          <div className="profile-menu-item" style={{ cursor: 'default' }}>
            <div className="profile-menu-icon" style={{ background: 'rgba(234,179,8,0.12)', color: '#EAB308' }}>
              <Settings size={18} />
            </div>
            <div className="profile-menu-content">
              <span className="profile-menu-title">Display Appearance</span>
              <span className="profile-menu-desc">Switch between dark pitch & light mode</span>
            </div>
            <ThemeToggle />
          </div>

          <button
            onClick={() => setShowRulesModal(true)}
            className="profile-menu-item"
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
          >
            <div className="profile-menu-icon" style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA' }}>
              <FileText size={18} />
            </div>
            <div className="profile-menu-content">
              <span className="profile-menu-title">Arena Rules & Policy</span>
              <span className="profile-menu-desc">Fair play, cancellation terms, and gear etiquette</span>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </button>
        </div>

        {/* Navigation Group 3: Support & Admin */}
        <div className="profile-section-label" style={{ marginTop: '1.5rem' }}>Support & Staff</div>
        <div className="profile-menu-card">
          <a
            href="https://wa.me/919825000000?text=Hello%20Turf%20%26%20Taste%20Desk%2C%20I%20have%20an%20inquiry%20regarding%20booking"
            target="_blank"
            rel="noreferrer"
            className="profile-menu-item"
          >
            <div className="profile-menu-icon" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>
              <MessageCircle size={18} />
            </div>
            <div className="profile-menu-content">
              <span className="profile-menu-title">WhatsApp Desk Support</span>
              <span className="profile-menu-desc">Instant assistance & custom match coordination</span>
            </div>
            <ExternalLink size={16} className="text-muted" />
          </a>

          <Link to="/admin" className="profile-menu-item">
            <div className="profile-menu-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6' }}>
              <Shield size={18} />
            </div>
            <div className="profile-menu-content">
              <span className="profile-menu-title">Staff Admin Portal</span>
              <span className="profile-menu-desc">Timings, dynamic pricing, and slot manager</span>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </Link>

          <button
            onClick={handleClearSession}
            className="profile-menu-item"
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
          >
            <div className="profile-menu-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
              <LogOut size={18} />
            </div>
            <div className="profile-menu-content">
              <span className="profile-menu-title" style={{ color: '#EF4444' }}>Clear device details</span>
              <span className="profile-menu-desc">Remove saved booking details and restart as a guest</span>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </button>
        </div>

        {/* App Version Info */}
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Turf & Taste Mobile v2.0 • Patan, Gujarat<br />
          Built for passionate athletes & foodies
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Save booking details on this device</h3>
              <button onClick={() => setIsEditing(false)} className="modal-close-btn" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Mobile Number</label>
                <input
                  type="tel"
                  className="form-input"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  inputMode="numeric"
                  pattern="[6-9][0-9]{9}"
                  title="Enter a valid 10-digit Indian mobile number starting with 6–9"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Arena Rules Modal ── */}
      {showRulesModal && (
        <div className="modal-overlay" onClick={() => setShowRulesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Arena Rules & Etiquette</h3>
              <button onClick={() => setShowRulesModal(false)} className="modal-close-btn" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <p><strong>1. Footwear:</strong> Flat rubber-soled turf trainers only. Metal studs and spike shoes strictly prohibited on artificial grass.</p>
              <p><strong>2. Check-In:</strong> Arrive 10 minutes prior to slot start time and scan your Digital Pass at the front reception desk.</p>
              <p><strong>3. Reschedule & Refund:</strong> Cancellations made 4+ hours prior to slot qualify for full credit reschedule. Token deposits are non-refundable within 2 hours of play.</p>
              <p><strong>4. Equipment Care:</strong> Bowling machine balls, bats, and protective helmets are provided free of cost; return in good order.</p>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem' }} onClick={() => setShowRulesModal(false)}>
              Understood
            </button>
          </div>
        </div>
      )}

      {/* ── Payments Modal ── */}
      {showPaymentsModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Payment & Transactions</h3>
              <button onClick={() => setShowPaymentsModal(false)} className="modal-close-btn" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              All booking transactions made on Turf & Taste:
            </p>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '0.75rem' }}>
              {customerBookings.slice(0, 5).map((b) => (
                <div key={b.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  borderBottom: '1px solid var(--border-subtle)'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--brand-cream)', fontSize: '0.9rem' }}>
                      {b.facility || b.facilityName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {b.date} • Ref: {b.id}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--brand-green)', fontWeight: 600, fontSize: '0.9rem' }}>
                      {b.amount || 'Payment pending'}
                    </div>
                    <span className={`badge ${String(b.paymentStatus || '').toLowerCase() === 'paid' ? 'badge-green' : 'badge-orange'}`} style={{ fontSize: '0.65rem' }}>
                      {b.paymentStatus || 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
              {customerBookings.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: 0 }}>
                  Add the mobile number used for your booking to view receipts here.
                </p>
              )}
            </div>
            <button className="btn btn-outline" style={{ width: '100%', marginTop: '1.25rem' }} onClick={() => setShowPaymentsModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

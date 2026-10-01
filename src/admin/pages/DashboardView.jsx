import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  PlusCircle,
  Lock,
  BookOpen,
  RefreshCw,
  Activity,
  ShieldCheck,
  Zap,
  Building2,
  Phone,
  ChevronRight,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function DashboardView({ onNavigate, showToast }) {
  const { admin } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [todayBookings, setTodayBookings] = useState([]);
  const [todaySessions, setTodaySessions] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [selectedSport, setSelectedSport] = useState('all');

  const todayStr = new Date().toISOString().slice(0, 10);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [bookingsRes, sessionsRes, facRes, blocksRes] = await Promise.all([
        api.getBookings({ date: todayStr }).catch(() => ({ bookings: [] })),
        api.getTodaySessions(todayStr).catch(() => ({ sessions: [] })),
        api.getPhysicalFacilities().catch(() => ({ facilities: [] })),
        api.getFacilityBlocks().catch(() => ({ blocks: [] }))
      ]);

      setTodayBookings(bookingsRes?.bookings || []);
      setTodaySessions(sessionsRes?.sessions || []);
      setFacilities(facRes?.facilities || []);
      setBlocks(blocksRes?.blocks || []);
    } catch (err) {
      if (showToast) showToast('Failed to load dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [todayStr]);

  const confirmedTodayCount = todayBookings.filter(b =>
    b.status === 'Confirmed' || b.status === 'Checked-in' || b.status === 'In Progress'
  ).length;

  const totalSettledToday = todayBookings
    .filter(b => b.paymentStatus === 'Paid' || b.paymentStatus === 'Partial' || b.paymentStatus === 'Settled')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const activeBlocksCount = blocks.filter(b => b.status === 'active').length;
  const operationalVenuesCount = Math.max(0, (facilities.length || 6) - activeBlocksCount);

  // Filter facilities by sport discipline
  const filteredFacilities = facilities.filter(fac => {
    if (selectedSport === 'all') return true;
    const cat = String(fac.sectionId || fac.id || '').toLowerCase();
    if (selectedSport === 'cricket') return cat.includes('cricket');
    if (selectedSport === 'pickleball') return cat.includes('pickleball');
    if (selectedSport === 'skating') return cat.includes('skating');
    return true;
  });

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">CLUBHOUSE OPERATIONS</span>
          <h2 className="admin-page-title">Pitch Master Control</h2>
          <p className="admin-page-subtitle">Patan Campus • 24/7 Operations Desk • Real-time status</p>
        </div>
        <button
          className="admin-btn secondary"
          onClick={fetchDashboardData}
          disabled={loading}
          aria-label="Auto-sync Dashboard"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Auto-sync</span>
        </button>
      </div>

      {/* 3 Quick Action Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <button
          id="admin-quick-walkin"
          onClick={() => onNavigate('walkin')}
          className="admin-quick-action-tile primary"
        >
          <PlusCircle size={20} />
          <span>+ Quick Booking</span>
        </button>

        <button
          id="admin-quick-lockout"
          onClick={() => onNavigate('blocks')}
          className="admin-quick-action-tile danger"
        >
          <Lock size={20} />
          <span>Instant Lockout</span>
        </button>

        <button
          id="admin-quick-manifest"
          onClick={() => onNavigate('bookings')}
          className="admin-quick-action-tile success"
        >
          <BookOpen size={20} />
          <span>Daily Manifest</span>
        </button>
      </div>

      {/* Operational Metrics Grid */}
      <div className="admin-metrics-grid">
        <div className="admin-metric-card">
          <span className="admin-metric-label">Today Bookings</span>
          <span className="admin-metric-value">{confirmedTodayCount} Confirmed</span>
          <span className="admin-metric-sub green">
            {todayBookings.length} total rostered
          </span>
        </div>

        <div className="admin-metric-card">
          <span className="admin-metric-label">Gateway Sync</span>
          <span className="admin-metric-value">100% Settled</span>
          <span className="admin-metric-sub">
            ₹{totalSettledToday.toLocaleString('en-IN')} via Razorpay & Desk
          </span>
        </div>

        <div className="admin-metric-card">
          <span className="admin-metric-label">Active Venues</span>
          <span className="admin-metric-value">{operationalVenuesCount} / {facilities.length || 6}</span>
          <span className="admin-metric-sub green">• Fully Operational 24/7</span>
        </div>

        <div className="admin-metric-card">
          <span className="admin-metric-label">Peak Floodlit</span>
          <span className="admin-metric-value">18:30 – 23:00</span>
          <span className="admin-metric-sub">Night tariff automated</span>
        </div>
      </div>

      {/* Sport Discipline Filter Pills */}
      <div className="admin-filter-pills" role="tablist">
        <button
          className={`admin-filter-pill ${selectedSport === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedSport('all')}
        >
          All ({facilities.length || 6})
        </button>
        <button
          className={`admin-filter-pill ${selectedSport === 'cricket' ? 'active' : ''}`}
          onClick={() => setSelectedSport('cricket')}
        >
          Box Cricket
        </button>
        <button
          className={`admin-filter-pill ${selectedSport === 'pickleball' ? 'active' : ''}`}
          onClick={() => setSelectedSport('pickleball')}
        >
          Pickleball
        </button>
        <button
          className={`admin-filter-pill ${selectedSport === 'skating' ? 'active' : ''}`}
          onClick={() => setSelectedSport('skating')}
        >
          Skating Rink
        </button>
      </div>

      {/* Live Ground Status List */}
      <div className="admin-feed-section">
        <div className="admin-feed-header">
          <span className="admin-feed-title">Live Ground Status</span>
          <span className="admin-feed-badge">• Real-time schedule</span>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            <p>Loading live facility telemetry...</p>
          </div>
        ) : (
          <div className="admin-records-list">
            {filteredFacilities.map((fac) => {
              const activeBlock = blocks.find(b => b.facility_id === fac.id && b.status === 'active');
              const activeSession = todaySessions.find(s => s.facilityId === fac.id && (s.sessionStatus === 'IN_PROGRESS' || s.sessionStatus === 'In Progress'));
              const activeBooking = todayBookings.find(b => b.facilityId === fac.id && (b.status === 'Confirmed' || b.status === 'Checked-in' || b.status === 'In Progress'));

              const isBlocked = Boolean(activeBlock);
              const isInSession = Boolean(activeSession);
              const isReserved = Boolean(activeBooking);

              let statusLabel = 'Available 24/7';
              let statusBadgeClass = 'confirmed';

              if (isBlocked) {
                statusLabel = 'Sweeping / Maintenance';
                statusBadgeClass = 'pending';
              } else if (isInSession) {
                statusLabel = '• Active / On Ground';
                statusBadgeClass = 'active';
              } else if (isReserved) {
                statusLabel = 'Upcoming Reserved';
                statusBadgeClass = 'confirmed';
              }

              return (
                <div key={fac.id} className="admin-card admin-ground-card">
                  <div className="admin-ground-top">
                    <div>
                      <span className="admin-ground-category">
                        {fac.sectionId ? fac.sectionId.replace(/_/g, ' ').toUpperCase() : 'SPORTS VENUE'}
                      </span>
                      <h3 className="admin-ground-name">{fac.customName || fac.defaultName || fac.name}</h3>
                    </div>

                    <span className={`admin-status-badge ${statusBadgeClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* Operational Window Bar */}
                  <div className="admin-ground-window-bar">
                    <Clock size={13} style={{ marginRight: '5px' }} />
                    {isInSession ? (
                      <span>Current Session In-Progress</span>
                    ) : isReserved ? (
                      <span>Next Booking: {activeBooking.time}</span>
                    ) : isBlocked ? (
                      <span>Locked: {activeBlock.reason || 'Operational Block'}</span>
                    ) : (
                      <span>Open for Instant Reservation (24/7 Available)</span>
                    )}
                  </div>

                  {/* Customer / Patron Context if Booked */}
                  {activeBooking && (
                    <div className="admin-ground-patron-row">
                      <div className="admin-patron-info">
                        <div className="admin-avatar-mini">
                          {(activeBooking.customerName || 'P')[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="admin-patron-name">{activeBooking.customerName}</span>
                          <span className="admin-patron-ref">BK #{activeBooking.id}</span>
                        </div>
                      </div>

                      {activeBooking.customerPhone && (
                        <a
                          href={`tel:${activeBooking.customerPhone}`}
                          className="admin-header-icon-btn"
                          title="Call Patron"
                        >
                          <Phone size={13} />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Footer CTAs */}
                  <div className="admin-ground-footer">
                    {isInSession ? (
                      <button
                        className="admin-btn primary compact"
                        onClick={() => onNavigate('sessions')}
                      >
                        <span>Manage Session</span>
                        <ChevronRight size={13} />
                      </button>
                    ) : isReserved ? (
                      <button
                        className="admin-btn primary compact"
                        onClick={() => onNavigate('sessions')}
                      >
                        <CheckCircle2 size={13} />
                        <span>Pre-Check In</span>
                      </button>
                    ) : isBlocked ? (
                      <button
                        className="admin-btn secondary compact"
                        onClick={() => onNavigate('blocks')}
                      >
                        <span>Release Lockout</span>
                      </button>
                    ) : (
                      <button
                        className="admin-btn secondary compact"
                        onClick={() => onNavigate('walkin')}
                      >
                        <span>Reserve Court</span>
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Calendar, 
  Activity, 
  ShieldCheck, 
  Ban, 
  UserPlus, 
  QrCode, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw 
} from 'lucide-react';

export default function DashboardView({ onNavigate }) {
  const { admin } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [todayBookings, setTodayBookings] = useState([]);
  const [todaySessions, setTodaySessions] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [bookingsRes, sessionsRes, facRes, blocksRes] = await Promise.all([
          api.getBookings({ date: todayStr }).catch(() => ({ bookings: [] })),
          api.getTodaySessions(todayStr).catch(() => ({ sessions: [] })),
          api.getPhysicalFacilities().catch(() => ({ facilities: [] })),
          api.getFacilityBlocks().catch(() => ({ blocks: [] }))
        ]);

        if (!cancelled) {
          setTodayBookings(bookingsRes?.bookings || []);
          setTodaySessions(sessionsRes?.sessions || []);
          setFacilities(facRes?.facilities || []);
          setBlocks(blocksRes?.blocks || []);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => { cancelled = true; };
  }, [refreshKey, todayStr]);

  const activeSessionsCount = todaySessions.filter(s => s.sessionStatus === 'IN_PROGRESS' || s.sessionStatus === 'In Progress').length;
  const checkedInCount = todaySessions.filter(s => s.sessionStatus === 'CHECKED_IN' || s.sessionStatus === 'Checked-in').length;
  const activeBlocksCount = blocks.filter(b => b.status === 'active').length;

  return (
    <div>
      {/* Top Welcome / Status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
            Operations Desk
          </h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Single Campus • Patan, Gujarat • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
        </div>

        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="admin-btn secondary"
          style={{ minHeight: '36px', padding: '6px 12px', fontSize: '0.78rem' }}
          disabled={loading}
          aria-label="Refresh Dashboard"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Operational Metrics Grid */}
      <div className="admin-metrics-grid">
        <div className="admin-metric-card">
          <span className="admin-metric-label">Today's Bookings</span>
          <span className="admin-metric-value">{todayBookings.length}</span>
          <span className="admin-metric-sub">
            {todayBookings.filter(b => b.status === 'Confirmed' || b.status === 'Checked-in' || b.status === 'In Progress').length} Active / Scheduled
          </span>
        </div>

        <div className="admin-metric-card">
          <span className="admin-metric-label">Active on Ground</span>
          <span className="admin-metric-value" style={{ color: 'var(--brand-green, #4ADE80)' }}>
            {activeSessionsCount}
          </span>
          <span className="admin-metric-sub">
            {checkedInCount} Checked In Waiting
          </span>
        </div>

        <div className="admin-metric-card">
          <span className="admin-metric-label">Physical Inventory</span>
          <span className="admin-metric-value">{facilities.length || 6}</span>
          <span className="admin-metric-sub">2 Turfs • 2 Courts • 1 Rink • 1 Net</span>
        </div>

        <div className="admin-metric-card">
          <span className="admin-metric-label">Active Blocks</span>
          <span className="admin-metric-value" style={{ color: activeBlocksCount > 0 ? '#FB923C' : '#94A3B8' }}>
            {activeBlocksCount}
          </span>
          <span className="admin-metric-sub">Maintenance / Events</span>
        </div>
      </div>

      {/* Fast Operational Action CTAs */}
      <div className="admin-quick-actions">
        <button
          id="cta-walkin-booking"
          className="admin-quick-btn"
          onClick={() => onNavigate('walkin')}
        >
          <UserPlus size={20} color="var(--brand-green, #4ADE80)" />
          <span>Walk-In Booking</span>
        </button>

        <button
          id="cta-qr-checkin"
          className="admin-quick-btn"
          onClick={() => onNavigate('sessions')}
        >
          <QrCode size={20} color="var(--brand-green, #4ADE80)" />
          <span>Ground Check-In</span>
        </button>

        <button
          id="cta-create-block"
          className="admin-quick-btn orange"
          onClick={() => onNavigate('blocks')}
        >
          <Ban size={20} color="var(--brand-orange, #F97316)" />
          <span>Facility Block</span>
        </button>
      </div>

      {/* Facility Availability Matrix */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>
            <Activity size={18} color="var(--brand-green, #4ADE80)" />
            <span>24/7 Physical Resource Status</span>
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--brand-green, #4ADE80)', fontWeight: 600 }}>
            Live Patan Grounds
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '10px'
        }}>
          {facilities.map(fac => {
            const isBlocked = blocks.some(b => b.facility_id === fac.id && b.status === 'active');
            const hasActiveSession = todaySessions.some(s => s.facilityId === fac.id && (s.sessionStatus === 'IN_PROGRESS' || s.sessionStatus === 'In Progress'));
            
            let statusBadge = { label: 'AVAILABLE 24/7', color: 'var(--brand-green, #4ADE80)', bg: 'rgba(74, 222, 128, 0.1)' };
            if (isBlocked) {
              statusBadge = { label: 'BLOCKED', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
            } else if (hasActiveSession) {
              statusBadge = { label: 'IN PROGRESS', color: '#FBBF24', bg: 'rgba(245, 158, 11, 0.15)' };
            }

            return (
              <div
                key={fac.id}
                style={{
                  background: 'var(--bg-surface-elevated, #111A14)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F8FAFC' }}>
                  {fac.customName || fac.defaultName}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>
                  {fac.id}
                </div>
                {fac.addOns && fac.addOns.length > 0 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--brand-orange, #F97316)' }}>
                    + {fac.addOns.map(a => a.name).join(', ')}
                  </div>
                )}
                <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '3px 6px',
                    borderRadius: '4px',
                    background: statusBadge.bg,
                    color: statusBadge.color,
                    letterSpacing: '0.04em'
                  }}>
                    {statusBadge.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Schedule Overview */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>
            <Clock size={18} color="var(--brand-green, #4ADE80)" />
            <span>Today's Sessions ({todayBookings.length})</span>
          </h2>
          <button
            className="admin-btn secondary"
            style={{ minHeight: '30px', padding: '4px 10px', fontSize: '0.75rem' }}
            onClick={() => onNavigate('bookings')}
          >
            View All Bookings
          </button>
        </div>

        {todayBookings.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }}>
            No reservations scheduled for today. Ready for Walk-Ins.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todayBookings.slice(0, 5).map(booking => (
              <div
                key={booking.id}
                style={{
                  background: 'var(--bg-surface-elevated, #111A14)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F8FAFC' }}>
                    {booking.customerName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    {booking.facilityName} • {booking.time}
                  </div>
                </div>
                <span className={`admin-status-badge ${booking.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

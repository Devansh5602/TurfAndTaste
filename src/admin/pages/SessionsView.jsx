import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  QrCode, 
  Search, 
  Clock, 
  User, 
  Play, 
  Square, 
  CheckCircle, 
  AlertTriangle, 
  PlusCircle, 
  RefreshCw,
  X,
  ShieldAlert
} from 'lucide-react';

export default function SessionsView({ showToast }) {
  const { can } = useAdminAuth();
  const [lookupQuery, setLookupQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [todaySessions, setTodaySessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Active Selected Session / Booking for Operations
  const [selectedSession, setSelectedSession] = useState(null);

  // Extension Modal State
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [extensionMinutes, setExtensionMinutes] = useState(15);
  const [isFreeExtension, setIsFreeExtension] = useState(false);
  const [extensionChargePaise, setExtensionChargePaise] = useState(20000); // ₹200
  const [extensionReason, setExtensionReason] = useState('Staff Approved Extension');
  const [isExtending, setIsExtending] = useState(false);
  const [extensionError, setExtensionError] = useState('');

  // Delay Modal State
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [delayReason, setDelayReason] = useState('Previous Session Handover');
  const [delayNotes, setDelayNotes] = useState('');

  useEffect(() => {
    loadTodaySessions();
  }, []);

  const loadTodaySessions = async () => {
    setLoading(true);
    try {
      const res = await api.getTodaySessions();
      if (res?.success) {
        setTodaySessions(res.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load today sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e) => {
    e?.preventDefault();
    if (!lookupQuery.trim()) return;
    setLoading(true);
    try {
      const res = await api.lookupSession(lookupQuery.trim());
      if (res?.success) {
        setSearchResults(res.sessions || []);
        if (res.sessions?.length === 1) {
          setSelectedSession(res.sessions[0]);
        }
      }
    } catch (err) {
      if (showToast) showToast('Search lookup failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (bookingId) => {
    try {
      const res = await api.checkInSession(bookingId);
      if (res?.success) {
        if (showToast) showToast(`Player checked in for booking ${bookingId}!`);
        await loadTodaySessions();
        if (selectedSession && selectedSession.id === bookingId) {
          setSelectedSession(prev => ({ ...prev, bookingStatus: 'Checked-in', sessionStatus: 'CHECKED_IN' }));
        }
      } else {
        if (showToast) showToast(res?.error || 'Check-in failed.', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message || 'Check-in failed.', 'error');
    }
  };

  const handleStartSession = async (bookingId) => {
    try {
      const res = await api.startSession(bookingId);
      if (res?.success) {
        if (showToast) showToast(`Session started on ground for ${bookingId}!`);
        await loadTodaySessions();
        if (selectedSession && selectedSession.id === bookingId) {
          setSelectedSession(prev => ({ ...prev, bookingStatus: 'In Progress', sessionStatus: 'IN_PROGRESS', actualStartAt: res.actualStartAt }));
        }
      } else {
        if (showToast) showToast(res?.error || 'Session start failed.', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message || 'Session start failed.', 'error');
    }
  };

  const handleEndSession = async (bookingId) => {
    try {
      const res = await api.endSession(bookingId);
      if (res?.success) {
        if (showToast) showToast(`Session completed and logged for ${bookingId}!`);
        await loadTodaySessions();
        if (selectedSession && selectedSession.id === bookingId) {
          setSelectedSession(prev => ({ ...prev, bookingStatus: 'Completed', sessionStatus: 'COMPLETED', actualEndAt: res.actualEndAt }));
        }
      } else {
        if (showToast) showToast(res?.error || 'Session completion failed.', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message || 'Session completion failed.', 'error');
    }
  };

  const handleApplyExtension = async (e) => {
    e.preventDefault();
    if (!selectedSession) return;
    setIsExtending(true);
    setExtensionError('');

    try {
      const res = await api.extendSession({
        bookingId: selectedSession.id,
        extensionMinutes: Number(extensionMinutes) || 15,
        isFree: isFreeExtension,
        chargePaise: isFreeExtension ? 0 : Number(extensionChargePaise) || 0,
        reason: extensionReason.trim()
      });

      if (res?.success) {
        if (showToast) showToast(res.message || 'Session extended successfully!');
        setIsExtendModalOpen(false);
        await loadTodaySessions();
        setSelectedSession(null);
      } else {
        setExtensionError(res?.error || 'Extension request rejected.');
      }
    } catch (err) {
      setExtensionError(err.message || 'Extension request rejected.');
    } finally {
      setIsExtending(false);
    }
  };

  const handleRecordDelay = async (e) => {
    e.preventDefault();
    if (!selectedSession) return;
    try {
      const res = await api.recordSessionDelay({
        bookingId: selectedSession.id,
        delayMinutes: Number(delayMinutes) || 0,
        delayReason,
        notes: delayNotes
      });
      if (res?.success) {
        if (showToast) showToast('Ground delay details saved.');
        setIsDelayModalOpen(false);
        await loadTodaySessions();
      }
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to save delay.', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--admin-text-main, #1A1C1A)' }}>
            QR Check-In & Ground Desk
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)' }}>
            Scan passes, start sessions & manage 15-minute extensions
          </span>
        </div>

        <button
          onClick={loadTodaySessions}
          className="admin-btn secondary"
          style={{ minHeight: '36px', padding: '6px 12px', fontSize: '0.78rem' }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Lookup Bar (Booking Reference / QR scan payload / Phone) */}
      <form onSubmit={handleLookup} className="admin-search-bar">
        <div className="admin-input-wrap">
          <input
            id="session-lookup-input"
            type="text"
            className="admin-input"
            placeholder="Scan pass or enter Booking ID / Phone..."
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
          />
        </div>
        <button
          id="btn-session-lookup"
          type="submit"
          className="admin-btn"
          style={{ minHeight: '44px', padding: '0 16px' }}
        >
          <Search size={16} />
          <span>Lookup</span>
        </button>
      </form>

      {/* Selected / Search Result Session Inspector */}
      {selectedSession && (
        <div className="admin-card" style={{ borderColor: 'var(--admin-forest, #0F3D2E)', background: 'var(--admin-surface, #FFFFFF)' }}>
          <div className="admin-card-header">
            <div>
              <span className="admin-ref-code" style={{ fontSize: '1.1rem' }}>{selectedSession.id}</span>
              <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted, #5A645E)' }}>{selectedSession.customerName} • {selectedSession.customerPhone}</div>
            </div>
            <button className="admin-modal-close" onClick={() => setSelectedSession(null)}>
              <X size={18} />
            </button>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-main, #1A1C1A)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            <div>Resource: <strong>{selectedSession.facilityName || selectedSession.facilityId}</strong></div>
            <div>Scheduled: <strong>{selectedSession.date} • {selectedSession.timeSlot || selectedSession.time}</strong></div>
            
            {selectedSession.actualStartAt && (
              <div style={{ color: 'var(--admin-forest, #0F3D2E)', fontWeight: 600 }}>
                Actual Start: {new Date(selectedSession.actualStartAt).toLocaleTimeString()}
                {selectedSession.delayMinutes > 0 && ` (${selectedSession.delayMinutes}m delay recorded)`}
              </div>
            )}

            <div>Status: <span className={`admin-status-badge ${selectedSession.bookingStatus?.toLowerCase().replace(/\s+/g, '-')}`}>{selectedSession.bookingStatus}</span></div>
          </div>

          {/* Operational Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            {selectedSession.bookingStatus === 'Confirmed' && can('booking.checkin') && (
              <button
                id="btn-action-checkin"
                className="admin-btn"
                onClick={() => handleCheckIn(selectedSession.id)}
              >
                <CheckCircle size={15} />
                <span>Check In Player</span>
              </button>
            )}

            {selectedSession.bookingStatus === 'Checked-in' && can('booking.checkin') && (
              <button
                id="btn-action-start"
                className="admin-btn"
                style={{ background: '#F59E0B', color: '#050807' }}
                onClick={() => handleStartSession(selectedSession.id)}
              >
                <Play size={15} />
                <span>Start Session</span>
              </button>
            )}

            {(selectedSession.bookingStatus === 'In Progress' || selectedSession.sessionStatus === 'IN_PROGRESS') && can('booking.checkin') && (
              <button
                id="btn-action-end"
                className="admin-btn secondary"
                onClick={() => handleEndSession(selectedSession.id)}
              >
                <Square size={15} />
                <span>End Session</span>
              </button>
            )}

            {can('booking.extend') && (selectedSession.bookingStatus === 'In Progress' || selectedSession.sessionStatus === 'IN_PROGRESS') && (
              <button
                id="btn-action-extend"
                className="admin-btn"
                style={{ background: 'var(--brand-orange, #F97316)', color: '#050807' }}
                onClick={() => {
                  setExtensionError('');
                  setIsExtendModalOpen(true);
                }}
              >
                <PlusCircle size={15} />
                <span>15m Extension</span>
              </button>
            )}

            {can('booking.update') && (selectedSession.bookingStatus === 'Checked-in' || selectedSession.bookingStatus === 'In Progress' || selectedSession.sessionStatus === 'CHECKED_IN' || selectedSession.sessionStatus === 'IN_PROGRESS') && (
              <button
                id="btn-action-delay"
                className="admin-btn secondary"
                onClick={() => setIsDelayModalOpen(true)}
              >
                <Clock size={15} />
                <span>Log Delay</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Today's Operational Board */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>
            <Clock size={18} color="var(--brand-green, #4ADE80)" />
            <span>Today's Sessions ({todaySessions.length})</span>
          </h2>
        </div>

        {todaySessions.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--admin-text-muted, #5A645E)', fontSize: '0.85rem' }}>
            No sessions scheduled on ground today.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todaySessions.map(ses => (
              <div
                key={ses.id}
                className="admin-booking-card"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedSession(ses)}
              >
                <div className="admin-booking-header">
                  <span className="admin-ref-code">{ses.id}</span>
                  <span className={`admin-status-badge ${ses.bookingStatus?.toLowerCase().replace(/\s+/g, '-')}`}>
                    {ses.bookingStatus}
                  </span>
                </div>

                <div className="admin-booking-body">
                  <div className="admin-customer-info">
                    <span className="admin-customer-name">{ses.customerName}</span>
                    <span className="admin-customer-sub">{ses.facilityName || ses.facilityId} • {ses.timeSlot || ses.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 15-Minute Extension Modal */}
      {isExtendModalOpen && selectedSession && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-orange, #F97316)' }}>
                <PlusCircle size={20} />
                <span>Approve Session Extension</span>
              </h3>
              <button className="admin-modal-close" onClick={() => setIsExtendModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {extensionError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '10px',
                color: 'var(--admin-danger, #BA1A1A)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                <span>{extensionError}</span>
              </div>
            )}

            <form onSubmit={handleApplyExtension} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-main, #1A1C1A)' }}>
                Extending session for <strong>{selectedSession.customerName}</strong> on <strong>{selectedSession.facilityName || selectedSession.facilityId}</strong>.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px', fontWeight: 600 }}>
                  Extension Duration (15-min increments)
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[15, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      id={`btn-ext-dur-${mins}`}
                      className={`admin-chip ${extensionMinutes === mins ? 'active' : ''}`}
                      style={{ flex: 1, padding: '8px 0', textAlign: 'center' }}
                      onClick={() => setExtensionMinutes(mins)}
                    >
                      +{mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    id="checkbox-free-extension"
                    type="checkbox"
                    checked={isFreeExtension}
                    onChange={(e) => setIsFreeExtension(e.target.checked)}
                  />
                  <span>Free Extension (Staff Courtesy)</span>
                </label>
              </div>

              {!isFreeExtension && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px' }}>
                    Extension Charge (₹)
                  </label>
                  <input
                    id="input-extension-charge"
                    type="number"
                    className="admin-input"
                    value={extensionChargePaise / 100}
                    onChange={(e) => setExtensionChargePaise(Number(e.target.value) * 100)}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px' }}>
                  Approval Reason / Note
                </label>
                <input
                  id="input-extension-reason"
                  type="text"
                  className="admin-input"
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="e.g. Match finish extra overs"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="admin-btn secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsExtendModalOpen(false)}
                  disabled={isExtending}
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-extension"
                  type="submit"
                  className="admin-btn"
                  style={{ flex: 1, background: 'var(--brand-orange, #F97316)', color: '#050807' }}
                  disabled={isExtending}
                >
                  {isExtending ? 'Checking Next Bookings...' : 'Authorize Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delay Recording Modal */}
      {isDelayModalOpen && selectedSession && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Record Ground Delay</h3>
              <button className="admin-modal-close" onClick={() => setIsDelayModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordDelay} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px' }}>Delay Minutes</label>
                <input
                  id="input-delay-mins"
                  type="number"
                  className="admin-input"
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px' }}>Reason</label>
                <select
                  id="select-delay-reason"
                  className="admin-select"
                  style={{ width: '100%' }}
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                >
                  <option value="Previous Session Handover">Previous Session Handover</option>
                  <option value="Customer Late Arrival">Customer Late Arrival</option>
                  <option value="Turf Maintenance Check">Turf Maintenance Check</option>
                  <option value="Lighting Adjustment">Lighting Adjustment</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px' }}>Notes</label>
                <textarea
                  id="textarea-delay-notes"
                  className="admin-input"
                  style={{ minHeight: '60px' }}
                  value={delayNotes}
                  onChange={(e) => setDelayNotes(e.target.value)}
                  placeholder="Additional operational details"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="admin-btn secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsDelayModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-delay"
                  type="submit"
                  className="admin-btn"
                  style={{ flex: 1 }}
                >
                  Save Delay Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

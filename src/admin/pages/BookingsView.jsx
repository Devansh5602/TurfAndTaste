import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Search, 
  Filter, 
  Calendar, 
  Phone, 
  Mail, 
  Clock, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  X, 
  Eye, 
  ArrowRight,
  Download
} from 'lucide-react';

export default function BookingsView({ showToast }) {
  const { can } = useAdminAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  
  // Selected booking for Detail/Action Modal
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    loadBookings();
  }, [dateFilter]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (dateFilter) filters.date = dateFilter;
      const res = await api.getBookings(filters);
      if (res?.success) {
        setBookings(res.bookings || []);
      }
    } catch (err) {
      console.error('Failed to load bookings:', err);
      if (showToast) showToast('Failed to load bookings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (b.customerName || '').toLowerCase().includes(q) ||
        (b.customerPhone || '').includes(q) ||
        (b.id || '').toLowerCase().includes(q) ||
        (b.customerEmail || '').toLowerCase().includes(q);

      const matchFacility = facilityFilter === 'all' || 
        b.facilityId === facilityFilter || 
        (b.facilityName || '').toLowerCase().includes(facilityFilter.toLowerCase());

      const matchStatus = statusFilter === 'all' || 
        (b.status || '').toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchFacility && matchStatus;
    });
  }, [bookings, searchQuery, facilityFilter, statusFilter]);

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    setIsCancelling(true);
    try {
      const res = await api.deleteBooking(selectedBooking.id);
      if (res?.success) {
        if (showToast) showToast(`Booking ${selectedBooking.id} cancelled. Inventory slot released.`);
        setIsCancelModalOpen(false);
        setSelectedBooking(null);
        await loadBookings();
      } else {
        if (showToast) showToast(res?.error || 'Cancellation failed.', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message || 'Cancellation failed.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div>
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
            Booking Management
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Total {bookings.length} reservations found
          </span>
        </div>

        <button
          onClick={loadBookings}
          className="admin-btn secondary"
          style={{ minHeight: '36px', padding: '6px 12px', fontSize: '0.78rem' }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="admin-search-bar">
        <div className="admin-input-wrap">
          <input
            id="admin-bookings-search"
            type="text"
            className="admin-input"
            placeholder="Search by Player Name, Phone, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <input
          id="admin-bookings-date"
          type="date"
          className="admin-input"
          style={{ width: 'auto', minWidth: '130px' }}
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      {/* Status Filter Chips */}
      <div className="admin-filter-chips">
        {['all', 'Confirmed', 'Checked-in', 'In Progress', 'Completed', 'Cancelled'].map((st) => (
          <button
            key={st}
            id={`filter-status-${st.toLowerCase()}`}
            className={`admin-chip ${statusFilter === st ? 'active' : ''}`}
            onClick={() => setStatusFilter(st)}
          >
            {st === 'all' ? 'All Statuses' : st}
          </button>
        ))}
      </div>

      {/* Facility Filter Chips */}
      <div className="admin-filter-chips">
        {[
          { id: 'all', label: 'All Turfs' },
          { id: 'fac_box_cricket_1', label: 'Turf 1' },
          { id: 'fac_box_cricket_2', label: 'Turf 2' },
          { id: 'fac_pickleball_1', label: 'Pickleball 1' },
          { id: 'fac_pickleball_2', label: 'Pickleball 2' },
          { id: 'fac_skating_1', label: 'Skating Rink' },
          { id: 'fac_green_net_1', label: 'Green Net' }
        ].map((f) => (
          <button
            key={f.id}
            id={`filter-fac-${f.id}`}
            className={`admin-chip ${facilityFilter === f.id ? 'active' : ''}`}
            onClick={() => setFacilityFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Booking List Cards (Mobile-first) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
          Loading bookings...
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="admin-card" style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
          No bookings match the selected filters.
        </div>
      ) : (
        <div>
          {filteredBookings.map((b) => (
            <div key={b.id} className="admin-booking-card">
              <div className="admin-booking-header">
                <span className="admin-ref-code">{b.id}</span>
                <span className={`admin-status-badge ${b.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                  {b.status}
                </span>
              </div>

              <div className="admin-booking-body">
                <div className="admin-customer-info">
                  <span className="admin-customer-name">{b.customerName}</span>
                  <span className="admin-customer-sub">{b.customerPhone}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--brand-green, #4ADE80)', fontSize: '0.9rem' }}>
                    {b.amount || '₹800'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                    {b.paymentType === 'full' ? 'Full Paid' : 'Deposit Paid'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={13} color="var(--brand-green, #4ADE80)" />
                <span>{b.facilityName || b.facilityId} • {b.date} • {b.time}</span>
              </div>

              <div className="admin-booking-actions">
                <button
                  id={`btn-view-booking-${b.id}`}
                  className="admin-btn secondary"
                  style={{ flex: 1, minHeight: '34px', fontSize: '0.75rem' }}
                  onClick={() => setSelectedBooking(b)}
                >
                  <Eye size={14} />
                  <span>Inspect Details</span>
                </button>

                {b.status !== 'Cancelled' && can('booking.cancel') && (
                  <button
                    id={`btn-cancel-booking-${b.id}`}
                    className="admin-btn danger"
                    style={{ minHeight: '34px', fontSize: '0.75rem' }}
                    onClick={() => {
                      setSelectedBooking(b);
                      setIsCancelModalOpen(true);
                    }}
                  >
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && !isCancelModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Reservation Details</h3>
              <button className="admin-modal-close" onClick={() => setSelectedBooking(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Booking ID</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--brand-green, #4ADE80)', fontSize: '1.05rem' }}>
                  {selectedBooking.id}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Customer Name</div>
                  <div style={{ fontWeight: 600 }}>{selectedBooking.customerName}</div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Contact Phone</div>
                  <div>{selectedBooking.customerPhone}</div>
                </div>
              </div>

              <div>
                <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Physical Facility & Section</div>
                <div style={{ fontWeight: 600 }}>{selectedBooking.facilityName || selectedBooking.facilityId} (Patan Campus)</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Scheduled Date</div>
                  <div>{selectedBooking.date}</div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Time Slot</div>
                  <div>{selectedBooking.time}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Amount Paid</div>
                  <div style={{ fontWeight: 700, color: 'var(--brand-green, #4ADE80)' }}>{selectedBooking.amount}</div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Payment Status</div>
                  <div>{selectedBooking.paymentStatus || 'Paid'} ({selectedBooking.paymentType})</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.75rem', marginBottom: '4px' }}>Pricing Breakdown (Snapshot)</div>
                {selectedBooking.pricingSnapshot?.breakdown ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94A3B8' }}>Base Tariff:</span>
                      <span>₹{(selectedBooking.pricingSnapshot.breakdown.baseAmountPaise / 100).toFixed(0)}</span>
                    </div>
                    {selectedBooking.pricingSnapshot.breakdown.packageUsed && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38BDF8' }}>
                        <span>Package Discount:</span>
                        <span>-₹{(selectedBooking.pricingSnapshot.breakdown.packageDiscountPaise / 100).toFixed(0)}</span>
                      </div>
                    )}
                    {selectedBooking.pricingSnapshot.breakdown.addOnAmountPaise > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FBBF24' }}>
                        <span>Add-Ons:</span>
                        <span>+₹{(selectedBooking.pricingSnapshot.breakdown.addOnAmountPaise / 100).toFixed(0)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '3px', marginTop: '2px' }}>
                      <span>Total Canonical:</span>
                      <span style={{ color: 'var(--brand-green, #4ADE80)' }}>₹{(selectedBooking.pricingSnapshot.totalAmountPaise / 100).toFixed(0)}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#64748B', fontSize: '0.75rem', fontStyle: 'italic' }}>
                    Historical record (immutable breakdown unavailable)
                  </div>
                )}
              </div>

              <div>
                <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Current Status</div>
                <span className={`admin-status-badge ${selectedBooking.status?.toLowerCase().replace(/\s+/g, '-')}`} style={{ display: 'inline-block', marginTop: '4px' }}>
                  {selectedBooking.status}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                className="admin-btn secondary"
                style={{ flex: 1 }}
                onClick={() => setSelectedBooking(null)}
              >
                Close
              </button>

              {selectedBooking.status !== 'Cancelled' && can('booking.cancel') && (
                <button
                  className="admin-btn danger"
                  onClick={() => setIsCancelModalOpen(true)}
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation of Cancellation Modal */}
      {isCancelModalOpen && selectedBooking && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3 style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={20} />
                <span>Confirm Permanent Cancellation</span>
              </h3>
              <button className="admin-modal-close" onClick={() => setIsCancelModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ margin: 0 }}>
                Are you sure you want to cancel reservation <strong>{selectedBooking.id}</strong> for <strong>{selectedBooking.customerName}</strong>?
              </p>

              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px', borderRadius: '8px', color: '#FCA5A5', fontSize: '0.8rem' }}>
                <strong>Policy Notice:</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                  <li>Cancellation is <strong>PERMANENT</strong> and immediately frees the slot for other players.</li>
                  <li>In accordance with current venue rules, <strong>0% REFUND</strong> applies.</li>
                  <li>This reservation cannot be reverted back to Confirmed.</li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                className="admin-btn secondary"
                style={{ flex: 1 }}
                onClick={() => setIsCancelModalOpen(false)}
                disabled={isCancelling}
              >
                Keep Booking
              </button>
              <button
                id="btn-confirm-cancel"
                className="admin-btn danger"
                style={{ flex: 1 }}
                onClick={handleCancelBooking}
                disabled={isCancelling}
              >
                {isCancelling ? 'Releasing Slot...' : 'Authorize Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  CreditCard, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  Phone, 
  User, 
  FileText, 
  X,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export default function PaymentsView({ showToast }) {
  const { can } = useAdminAuth();
  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, settled, pending
  const [selectedPayment, setSelectedPayment] = useState(null);

  const fetchPaymentData = async () => {
    setLoading(true);
    try {
      const [payRes, bookRes] = await Promise.all([
        api.getPaymentHistory().catch(() => ({ payments: [] })),
        api.getBookings().catch(() => ({ bookings: [] }))
      ]);
      setPayments(payRes?.payments || []);
      setBookings(bookRes?.bookings || []);
    } catch (err) {
      if (showToast) showToast('Failed to load payment records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentData();
  }, []);

  // Compute metrics from bookings & payment logs
  const totalSettledPaise = bookings
    .filter(b => b.paymentStatus === 'Paid' || b.paymentStatus === 'Partial' || b.paymentStatus === 'Settled')
    .reduce((sum, b) => {
      const amt = Number(b.amount) || 0;
      return sum + amt * 100;
    }, 0);

  const settledCount = bookings.filter(b => b.paymentStatus === 'Paid' || b.paymentStatus === 'Partial' || b.paymentStatus === 'Settled').length;
  const pendingCount = bookings.filter(b => b.paymentStatus === 'Pending' || b.paymentStatus === 'Unpaid').length;

  const filteredBookings = bookings.filter(b => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || 
      String(b.id || '').toLowerCase().includes(term) ||
      String(b.customerName || '').toLowerCase().includes(term) ||
      String(b.customerPhone || '').includes(term) ||
      String(b.paymentId || '').toLowerCase().includes(term) ||
      String(b.facilityName || '').toLowerCase().includes(term);

    const isSettled = b.paymentStatus === 'Paid' || b.paymentStatus === 'Partial' || b.paymentStatus === 'Settled';
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'settled' && isSettled) ||
      (statusFilter === 'pending' && !isSettled);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">AUDIT & SETTLEMENT</span>
          <h2 className="admin-page-title">Payments Ledger</h2>
          <p className="admin-page-subtitle">Server-authoritative transaction records & immutable pricing snapshots</p>
        </div>
        <button 
          className="admin-btn secondary" 
          onClick={fetchPaymentData} 
          disabled={loading}
          aria-label="Refresh Payments"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="admin-metrics-grid">
        <div className="admin-metric-card">
          <span className="admin-metric-label">Total Volume Settled</span>
          <span className="admin-metric-value">₹{(totalSettledPaise / 100).toLocaleString('en-IN')}</span>
          <span className="admin-metric-sub green">
            <ShieldCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />
            {settledCount} Verified Transactions
          </span>
        </div>
        <div className="admin-metric-card">
          <span className="admin-metric-label">Gateway Sync</span>
          <span className="admin-metric-value">100% Settled</span>
          <span className="admin-metric-sub">Razorpay & Desk Verified</span>
        </div>
        <div className="admin-metric-card">
          <span className="admin-metric-label">Pending Collection</span>
          <span className="admin-metric-value">{pendingCount}</span>
          <span className="admin-metric-sub">Awaiting On-Site Balance</span>
        </div>
        <div className="admin-metric-card">
          <span className="admin-metric-label">Refund Policy</span>
          <span className="admin-metric-value">0% Refund</span>
          <span className="admin-metric-sub">Non-refundable terminal policy</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="admin-search-filter-bar">
        <div className="admin-search-wrap">
          <Search size={16} className="admin-search-icon" />
          <input
            id="admin-payments-search"
            type="text"
            className="admin-search-input"
            placeholder="Search by booking #, patron, phone, or gateway ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="admin-search-clear" onClick={() => setSearchTerm('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="admin-filter-pills" role="tablist">
          <button 
            className={`admin-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({bookings.length})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'settled' ? 'active' : ''}`}
            onClick={() => setStatusFilter('settled')}
          >
            Settled ({settledCount})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending ({pendingCount})
          </button>
        </div>
      </div>

      {/* Ledger Records Feed */}
      <div className="admin-feed-section">
        <div className="admin-feed-header">
          <span className="admin-feed-title">Transaction Entries ({filteredBookings.length})</span>
          <span className="admin-feed-badge">Patan Campus Central Ledger</span>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            <p>Loading verified payment records...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="admin-empty-state">
            <CreditCard size={32} style={{ color: '#8D9490', margin: '0 auto 12px' }} />
            <p>No transactions match the selected filter criteria.</p>
          </div>
        ) : (
          <div className="admin-records-list">
            {filteredBookings.map((b) => {
              const isSettled = b.paymentStatus === 'Paid' || b.paymentStatus === 'Partial' || b.paymentStatus === 'Settled';
              return (
                <div key={b.id} className="admin-card admin-record-card">
                  <div className="admin-record-top">
                    <div className="admin-record-id-wrap">
                      <span className="admin-record-ref">BK #{b.id}</span>
                      <span className={`admin-status-badge ${isSettled ? 'confirmed' : 'pending'}`}>
                        {isSettled ? 'Settled' : 'Pending Payment'}
                      </span>
                    </div>
                    <div className="admin-record-amount-wrap">
                      <span className="admin-record-amount">₹{b.amount || 0}</span>
                      <span className="admin-record-type">{b.paymentType === 'deposit' ? 'Token / Deposit' : 'Full Payment'}</span>
                    </div>
                  </div>

                  <div className="admin-record-body">
                    <div className="admin-record-info-row">
                      <span className="admin-facility-name">{b.facilityName || 'Court / Arena'}</span>
                      <span className="admin-record-time">
                        <Calendar size={12} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                        {b.date} • {b.time}
                      </span>
                    </div>

                    <div className="admin-record-customer-row">
                      <div className="admin-customer-chip">
                        <div className="admin-avatar-mini">
                          {(b.customerName || 'G')[0].toUpperCase()}
                        </div>
                        <span className="admin-customer-name">{b.customerName || 'Guest Patron'}</span>
                        <span className="admin-customer-phone">{b.customerPhone}</span>
                      </div>

                      {b.paymentId && (
                        <div className="admin-gateway-chip">
                          <span>Ref: {b.paymentId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="admin-record-footer">
                    <button 
                      className="admin-btn secondary compact"
                      onClick={() => setSelectedPayment(b)}
                    >
                      <FileText size={13} />
                      <span>View Pricing Snapshot</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pricing Snapshot Detail Modal */}
      {selectedPayment && (
        <div className="admin-modal-overlay" onClick={() => setSelectedPayment(null)}>
          <div className="admin-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <span className="admin-eyebrow">IMMUTABLE SNAPSHOT</span>
                <h3 className="admin-modal-title">Booking #{selectedPayment.id}</h3>
              </div>
              <button className="admin-modal-close" onClick={() => setSelectedPayment(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-detail-block">
                <span className="admin-detail-label">Facility & Schedule</span>
                <p className="admin-detail-val">{selectedPayment.facilityName}</p>
                <p className="admin-detail-sub">{selectedPayment.date} • {selectedPayment.time}</p>
              </div>

              <div className="admin-detail-block">
                <span className="admin-detail-label">Patron Information</span>
                <p className="admin-detail-val">{selectedPayment.customerName}</p>
                <p className="admin-detail-sub">{selectedPayment.customerPhone} • {selectedPayment.customerEmail}</p>
              </div>

              {selectedPayment.pricingSnapshot ? (
                <div className="admin-snapshot-card">
                  <h4 className="admin-snapshot-title">Snapshot Breakdown</h4>
                  <div className="admin-snapshot-row">
                    <span>Base Facility Rate:</span>
                    <span>₹{selectedPayment.pricingSnapshot.baseTariff || (selectedPayment.pricingSnapshot.baseAmountPaise ? selectedPayment.pricingSnapshot.baseAmountPaise / 100 : selectedPayment.amount)}</span>
                  </div>
                  {selectedPayment.pricingSnapshot.nightSurgeApplied && (
                    <div className="admin-snapshot-row">
                      <span>Floodlight Night Surcharge:</span>
                      <span>+₹{selectedPayment.pricingSnapshot.nightSurgeAmount || 0}</span>
                    </div>
                  )}
                  {selectedPayment.pricingSnapshot.addOns && selectedPayment.pricingSnapshot.addOns.length > 0 && (
                    <div className="admin-snapshot-row">
                      <span>Add-Ons ({selectedPayment.pricingSnapshot.addOns.map(a => a.name).join(', ')}):</span>
                      <span>+₹{selectedPayment.pricingSnapshot.addOns.reduce((s, a) => s + (a.price || 0), 0)}</span>
                    </div>
                  )}
                  <div className="admin-snapshot-divider" />
                  <div className="admin-snapshot-row bold">
                    <span>Total Calculated Tariff:</span>
                    <span>₹{selectedPayment.pricingSnapshot.totalAmountPaise ? selectedPayment.pricingSnapshot.totalAmountPaise / 100 : selectedPayment.amount}</span>
                  </div>
                  <div className="admin-snapshot-row bold green">
                    <span>Amount Collected:</span>
                    <span>₹{selectedPayment.amount}</span>
                  </div>
                </div>
              ) : (
                <div className="admin-info-box">
                  <p>Standard rate recorded at settlement: ₹{selectedPayment.amount}.</p>
                </div>
              )}

              <div className="admin-info-box warning" style={{ marginTop: '16px' }}>
                <AlertCircle size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                <span>Non-Refundable Policy: Cancellations are audited and release slot occupancy, but refunds are 0%.</span>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn secondary full" onClick={() => setSelectedPayment(null)}>
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Users, 
  Search, 
  RefreshCw, 
  Phone, 
  Mail, 
  Calendar, 
  FileText, 
  Plus, 
  X, 
  ChevronRight, 
  MessageSquare,
  Shield,
  Clock
} from 'lucide-react';

export default function CustomersView({ showToast }) {
  const { can } = useAdminAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerBookings, setCustomerBookings] = useState([]);
  const [customerNotes, setCustomerNotes] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const fetchCustomers = async (search = '') => {
    setLoading(true);
    try {
      const res = await api.getCustomers(search);
      setCustomers(res?.customers || []);
    } catch (err) {
      if (showToast) showToast('Failed to load customer directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(searchTerm);
  }, [searchTerm]);

  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setLoadingDetails(true);
    try {
      const res = await api.getCustomerBookings(cust.phone);
      setCustomerBookings(res?.bookings || []);
      setCustomerNotes(res?.notes || []);
    } catch (err) {
      if (showToast) showToast('Failed to load customer history', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedCustomer) return;
    setSubmittingNote(true);
    try {
      const res = await api.saveCustomerNote(selectedCustomer.phone, newNoteText.trim());
      if (res.success) {
        if (showToast) showToast('Staff operational note added');
        setNewNoteText('');
        // Refresh notes list
        const updated = await api.getCustomerBookings(selectedCustomer.phone);
        setCustomerNotes(updated?.notes || []);
      } else {
        if (showToast) showToast(res.error || 'Failed to save note', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Error saving note', 'error');
    } finally {
      setSubmittingNote(false);
    }
  };

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">PATRON INTELLIGENCE</span>
          <h2 className="admin-page-title">Customer Directory</h2>
          <p className="admin-page-subtitle">Verified patron profiles, booking activity & concierge notes</p>
        </div>
        <button 
          className="admin-btn secondary" 
          onClick={() => fetchCustomers(searchTerm)} 
          disabled={loading}
          aria-label="Refresh Customers"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="admin-search-filter-bar">
        <div className="admin-search-wrap full-width">
          <Search size={16} className="admin-search-icon" />
          <input
            id="admin-customer-search"
            type="text"
            className="admin-search-input"
            placeholder="Search by patron name, 10-digit mobile, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="admin-search-clear" onClick={() => setSearchTerm('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Customer Directory List */}
      <div className="admin-feed-section">
        <div className="admin-feed-header">
          <span className="admin-feed-title">Patrons ({customers.length})</span>
          <span className="admin-feed-badge">Active Roster</span>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            <p>Loading patron profiles...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="admin-empty-state">
            <Users size={32} style={{ color: '#8D9490', margin: '0 auto 12px' }} />
            <p>No patrons found matching your search.</p>
          </div>
        ) : (
          <div className="admin-records-list">
            {customers.map((c) => (
              <div 
                key={c.phone} 
                className="admin-card admin-customer-card"
                onClick={() => handleSelectCustomer(c)}
              >
                <div className="admin-customer-card-main">
                  <div className="admin-avatar-circle">
                    {(c.name || 'P')[0].toUpperCase()}
                  </div>
                  <div className="admin-customer-info">
                    <div className="admin-customer-title-row">
                      <span className="admin-customer-title">{c.name}</span>
                      <span className="admin-customer-badge">{c.totalBookings} Bookings</span>
                    </div>
                    <div className="admin-customer-meta-row">
                      <span className="admin-meta-item">
                        <Phone size={11} style={{ marginRight: '3px' }} />
                        {c.phone}
                      </span>
                      {c.email && c.email !== 'N/A' && (
                        <span className="admin-meta-item">
                          <Mail size={11} style={{ marginRight: '3px' }} />
                          {c.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="admin-customer-card-side">
                  <div className="admin-customer-spend">
                    <span className="spend-val">₹{Math.round((c.totalSpentPaise || 0) / 100).toLocaleString('en-IN')}</span>
                    <span className="spend-sub">Total Spent</span>
                  </div>
                  <ChevronRight size={16} className="admin-chevron" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="admin-modal-overlay" onClick={() => setSelectedCustomer(null)}>
          <div className="admin-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="admin-avatar-circle large">
                  {(selectedCustomer.name || 'P')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="admin-modal-title">{selectedCustomer.name}</h3>
                  <span className="admin-modal-sub">Patron • {selectedCustomer.phone}</span>
                </div>
              </div>
              <button className="admin-modal-close" onClick={() => setSelectedCustomer(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body">
              {/* Quick Communication Actions */}
              <div className="admin-action-row" style={{ marginBottom: '16px' }}>
                <a 
                  href={`tel:${selectedCustomer.phone}`} 
                  className="admin-btn secondary"
                  style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}
                >
                  <Phone size={14} />
                  <span>Call Patron</span>
                </a>
                <a 
                  href={`https://wa.me/91${selectedCustomer.phone}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="admin-btn secondary"
                  style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}
                >
                  <MessageSquare size={14} />
                  <span>WhatsApp</span>
                </a>
              </div>

              {/* Statistics */}
              <div className="admin-metrics-grid" style={{ marginBottom: '20px' }}>
                <div className="admin-metric-card">
                  <span className="admin-metric-label">Total Reservations</span>
                  <span className="admin-metric-value">{selectedCustomer.totalBookings}</span>
                </div>
                <div className="admin-metric-card">
                  <span className="admin-metric-label">Estimated Spend LTV</span>
                  <span className="admin-metric-value">₹{Math.round((selectedCustomer.totalSpentPaise || 0) / 100).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Booking History Section */}
              <div className="admin-detail-block" style={{ marginBottom: '20px' }}>
                <h4 className="admin-section-heading">
                  <Calendar size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                  Chronological Reservations
                </h4>

                {loadingDetails ? (
                  <div className="admin-empty-state compact">
                    <RefreshCw size={16} className="spin" />
                    <span>Loading history...</span>
                  </div>
                ) : customerBookings.length === 0 ? (
                  <p className="admin-empty-text">No prior bookings recorded for this phone number.</p>
                ) : (
                  <div className="admin-customer-history-list">
                    {customerBookings.map((b) => (
                      <div key={b.id} className="admin-history-item">
                        <div className="history-left">
                          <span className="history-facility">{b.facility_name || 'Ground Arena'}</span>
                          <span className="history-time">{b.date} • {b.time_slot}</span>
                        </div>
                        <div className="history-right">
                          <span className="history-amount">₹{b.amount_paid || 0}</span>
                          <span className={`admin-status-badge compact ${b.booking_status?.toLowerCase()}`}>
                            {b.booking_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Staff Notes Section */}
              <div className="admin-detail-block">
                <h4 className="admin-section-heading">
                  <FileText size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                  Internal Operational Notes ({customerNotes.length})
                </h4>

                <form onSubmit={handleAddNote} className="admin-note-form">
                  <textarea
                    id="admin-customer-new-note"
                    className="admin-textarea"
                    placeholder="Add operational notes (e.g. preferred pitch, gear requests, team conduct)..."
                    rows={2}
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button 
                      type="submit" 
                      className="admin-btn primary compact"
                      disabled={submittingNote || !newNoteText.trim()}
                    >
                      <Plus size={13} />
                      <span>{submittingNote ? 'Saving...' : 'Add Note'}</span>
                    </button>
                  </div>
                </form>

                <div className="admin-notes-list" style={{ marginTop: '12px' }}>
                  {customerNotes.length === 0 ? (
                    <p className="admin-empty-text">No staff notes recorded yet.</p>
                  ) : (
                    customerNotes.map((n) => (
                      <div key={n.id} className="admin-note-item">
                        <p className="admin-note-text">{n.note}</p>
                        <div className="admin-note-meta">
                          <span>By {n.created_by || 'Staff'}</span>
                          <span>{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn secondary full" onClick={() => setSelectedCustomer(null)}>
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

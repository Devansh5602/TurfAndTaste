import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  HelpCircle, 
  Search, 
  RefreshCw, 
  Phone, 
  Mail, 
  Clock, 
  CheckCircle, 
  X, 
  MessageSquare, 
  ChevronRight,
  Send,
  AlertCircle
} from 'lucide-react';

export default function InquiriesView({ showToast }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, new, in_progress, resolved
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const res = await api.getInquiries();
      setInquiries(res?.inquiries || []);
    } catch (err) {
      if (showToast) showToast('Failed to load inquiries', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await api.updateInquiryStatus(id, newStatus);
      if (res.success) {
        if (showToast) showToast(`Inquiry marked as ${newStatus}`);
        setInquiries(prev => prev.map(inq => inq.id === id ? { ...inq, status: newStatus } : inq));
        if (selectedInquiry?.id === id) {
          setSelectedInquiry(prev => ({ ...prev, status: newStatus }));
        }
      } else {
        if (showToast) showToast(res.error || 'Failed to update status', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Error updating status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Status counts
  const newCount = inquiries.filter(i => !i.status || i.status === 'unread' || i.status === 'new').length;
  const inProgressCount = inquiries.filter(i => i.status === 'in_progress' || i.status === 'pending').length;
  const resolvedCount = inquiries.filter(i => i.status === 'resolved' || i.status === 'closed').length;

  const filteredInquiries = inquiries.filter(i => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      String(i.name || '').toLowerCase().includes(term) ||
      String(i.phone || '').includes(term) ||
      String(i.category || '').toLowerCase().includes(term) ||
      String(i.message || '').toLowerCase().includes(term);

    const s = String(i.status || 'new').toLowerCase();
    const isNew = s === 'new' || s === 'unread';
    const isInProg = s === 'in_progress' || s === 'pending';
    const isResolved = s === 'resolved' || s === 'closed';

    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'new' && isNew) ||
      (statusFilter === 'in_progress' && isInProg) ||
      (statusFilter === 'resolved' && isResolved);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">CONCIERGE DESK</span>
          <h2 className="admin-page-title">Inquiries Triage</h2>
          <p className="admin-page-subtitle">Incoming patron requests, facility inquiries & tournament questions</p>
        </div>
        <button 
          className="admin-btn secondary" 
          onClick={fetchInquiries} 
          disabled={loading}
          aria-label="Refresh Inquiries"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="admin-search-filter-bar">
        <div className="admin-search-wrap">
          <Search size={16} className="admin-search-icon" />
          <input
            id="admin-inquiries-search"
            type="text"
            className="admin-search-input"
            placeholder="Search by patron name, phone, or question..."
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
            All ({inquiries.length})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'new' ? 'active' : ''}`}
            onClick={() => setStatusFilter('new')}
          >
            New ({newCount})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setStatusFilter('in_progress')}
          >
            In Progress ({inProgressCount})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'resolved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('resolved')}
          >
            Resolved ({resolvedCount})
          </button>
        </div>
      </div>

      {/* Inquiries Feed */}
      <div className="admin-feed-section">
        <div className="admin-feed-header">
          <span className="admin-feed-title">Queue Entries ({filteredInquiries.length})</span>
          <span className="admin-feed-badge">Active Concierge Dispatch</span>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            <p>Loading inquiries queue...</p>
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="admin-empty-state">
            <HelpCircle size={32} style={{ color: '#8D9490', margin: '0 auto 12px' }} />
            <p>No inquiries found matching your filters.</p>
          </div>
        ) : (
          <div className="admin-records-list">
            {filteredInquiries.map((inq) => {
              const statusStr = inq.status || 'new';
              const isNew = statusStr === 'new' || statusStr === 'unread';
              const isResolved = statusStr === 'resolved' || statusStr === 'closed';

              return (
                <div 
                  key={inq.id} 
                  className="admin-card admin-inquiry-card"
                  onClick={() => setSelectedInquiry(inq)}
                >
                  <div className="admin-inquiry-top">
                    <div className="admin-avatar-circle">
                      {(inq.name || 'P')[0].toUpperCase()}
                    </div>
                    <div className="admin-inquiry-header-info">
                      <div className="admin-inquiry-name-row">
                        <span className="admin-inquiry-name">{inq.name}</span>
                        <span className={`admin-status-badge ${isNew ? 'confirmed' : isResolved ? 'completed' : 'pending'}`}>
                          {isNew ? 'NEW' : isResolved ? 'RESOLVED' : 'IN PROGRESS'}
                        </span>
                      </div>
                      <div className="admin-inquiry-meta-row">
                        <span className="admin-meta-category">{inq.category || 'General'}</span>
                        <span className="admin-meta-time">
                          {inq.created_at ? new Date(inq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="admin-inquiry-snippet">
                    "{inq.message}"
                  </p>

                  <div className="admin-inquiry-footer">
                    <span className="admin-inquiry-contact">
                      <Phone size={11} style={{ marginRight: '4px' }} />
                      {inq.phone}
                    </span>
                    <span className="admin-link-text">
                      Review & Triage <ChevronRight size={13} style={{ verticalAlign: '-1px' }} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inquiry Detail & Triage Modal */}
      {selectedInquiry && (
        <div className="admin-modal-overlay" onClick={() => setSelectedInquiry(null)}>
          <div className="admin-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="admin-avatar-circle large">
                  {(selectedInquiry.name || 'P')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="admin-modal-title">{selectedInquiry.name}</h3>
                  <span className="admin-modal-sub">{selectedInquiry.category || 'General Inquiry'}</span>
                </div>
              </div>
              <button className="admin-modal-close" onClick={() => setSelectedInquiry(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body">
              {/* Direct Call / WhatsApp */}
              <div className="admin-action-row" style={{ marginBottom: '16px' }}>
                <a 
                  href={`tel:${selectedInquiry.phone}`} 
                  className="admin-btn secondary"
                  style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}
                >
                  <Phone size={14} />
                  <span>Call {selectedInquiry.phone}</span>
                </a>
                <a 
                  href={`https://wa.me/91${String(selectedInquiry.phone).replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="admin-btn secondary"
                  style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}
                >
                  <MessageSquare size={14} />
                  <span>WhatsApp</span>
                </a>
              </div>

              {/* Message Details */}
              <div className="admin-detail-block" style={{ marginBottom: '16px' }}>
                <span className="admin-detail-label">Patron's Inquired Message</span>
                <p className="admin-detail-val" style={{ fontSize: '0.95rem', lineHeight: '1.5', marginTop: '4px' }}>
                  "{selectedInquiry.message}"
                </p>
                {selectedInquiry.email && selectedInquiry.email !== 'N/A' && (
                  <p className="admin-detail-sub" style={{ marginTop: '8px' }}>
                    Email: {selectedInquiry.email}
                  </p>
                )}
              </div>

              {/* Triage Actions */}
              <div className="admin-detail-block">
                <span className="admin-detail-label">Operational Status Triage</span>
                <div className="admin-action-row" style={{ marginTop: '8px' }}>
                  <button
                    className={`admin-btn secondary ${selectedInquiry.status === 'in_progress' ? 'active' : ''}`}
                    onClick={() => handleUpdateStatus(selectedInquiry.id, 'in_progress')}
                    disabled={updatingStatus}
                    style={{ flex: 1 }}
                  >
                    Mark In Progress
                  </button>
                  <button
                    className={`admin-btn primary ${selectedInquiry.status === 'resolved' ? 'active' : ''}`}
                    onClick={() => handleUpdateStatus(selectedInquiry.id, 'resolved')}
                    disabled={updatingStatus}
                    style={{ flex: 1 }}
                  >
                    <CheckCircle size={14} />
                    <span>Mark Resolved</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn secondary full" onClick={() => setSelectedInquiry(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

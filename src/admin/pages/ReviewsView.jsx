import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Star, 
  Search, 
  RefreshCw, 
  CheckCircle, 
  Flag, 
  EyeOff, 
  X, 
  ChevronRight, 
  MessageSquare,
  ShieldCheck,
  Send,
  Calendar,
  Building2
} from 'lucide-react';

export default function ReviewsView({ showToast }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, approved, rejected
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  const [moderationState, setModerationState] = useState('approved');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async (status = '') => {
    setLoading(true);
    try {
      const res = await api.getAdminReviews(status === 'all' ? '' : status);
      setReviews(res?.reviews || []);
    } catch (err) {
      if (showToast) showToast('Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(statusFilter);
  }, [statusFilter]);

  const handleOpenDetail = (rev) => {
    setSelectedReview(rev);
    setModerationState(rev.status || 'pending');
    setReplyText(rev.admin_response || '');
  };

  const handleConfirmModeration = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    try {
      // 1. Update status
      const resStatus = await api.updateReviewStatus(selectedReview.id, moderationState);
      // 2. Update reply if entered
      if (replyText.trim() && replyText.trim() !== selectedReview.admin_response) {
        await api.replyReview(selectedReview.id, replyText.trim());
      }

      if (resStatus.success) {
        if (showToast) showToast(`Review status updated to ${moderationState}`);
        setSelectedReview(null);
        fetchReviews(statusFilter);
      } else {
        if (showToast) showToast(resStatus.error || 'Failed to update review', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Error during review moderation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = reviews.filter(r => r.status === 'pending').length;
  const approvedCount = reviews.filter(r => r.status === 'approved').length;
  const flaggedCount = reviews.filter(r => r.status === 'rejected' || r.status === 'hidden' || r.status === 'flagged').length;

  const filteredReviews = reviews.filter(r => {
    const term = searchTerm.toLowerCase();
    return !term ||
      String(r.customer_name || '').toLowerCase().includes(term) ||
      String(r.comment || '').toLowerCase().includes(term) ||
      String(r.facility_id || '').toLowerCase().includes(term);
  });

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">AUDIT QUEUE</span>
          <h2 className="admin-page-title">Customer Feedback</h2>
          <p className="admin-page-subtitle">Player session ratings, public visibility moderation & responses</p>
        </div>
        <button 
          className="admin-btn secondary" 
          onClick={() => fetchReviews(statusFilter)} 
          disabled={loading}
          aria-label="Refresh Reviews"
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
            id="admin-reviews-search"
            type="text"
            className="admin-search-input"
            placeholder="Search by patron name, comment keyword, or facility..."
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
            All ({reviews.length})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending ({pendingCount})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            Published ({approvedCount})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            Flagged ({flaggedCount})
          </button>
        </div>
      </div>

      {/* Reviews Queue Feed */}
      <div className="admin-feed-section">
        <div className="admin-feed-header">
          <span className="admin-feed-title">Feedback Entries ({filteredReviews.length})</span>
          <span className="admin-feed-badge">Moderated Roster</span>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            <p>Loading feedback moderation queue...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="admin-empty-state">
            <Star size={32} style={{ color: '#8D9490', margin: '0 auto 12px' }} />
            <p>No customer reviews in this moderation queue.</p>
          </div>
        ) : (
          <div className="admin-records-list">
            {filteredReviews.map((rev) => {
              const isApproved = rev.status === 'approved';
              const isPending = !rev.status || rev.status === 'pending';

              return (
                <div 
                  key={rev.id} 
                  className="admin-card admin-review-card"
                  onClick={() => handleOpenDetail(rev)}
                >
                  <div className="admin-review-top">
                    <div className="admin-review-status-wrap">
                      <span className={`admin-status-badge ${isApproved ? 'confirmed' : isPending ? 'pending' : 'cancelled'}`}>
                        {isApproved ? '• Published' : isPending ? '• Pending Review' : 'Flagged / Hidden'}
                      </span>
                    </div>
                    <div className="admin-rating-stars">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star 
                          key={s} 
                          size={13} 
                          fill={s <= (rev.rating || 5) ? '#EAB308' : 'none'} 
                          color={s <= (rev.rating || 5) ? '#EAB308' : '#D1D5DB'} 
                        />
                      ))}
                      <span className="admin-rating-num">{rev.rating || 5}.0</span>
                    </div>
                  </div>

                  <div className="admin-review-author-row">
                    <span className="admin-review-name">{rev.customer_name || 'Guest Patron'}</span>
                    {rev.created_at && (
                      <span className="admin-review-date">
                        {new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>

                  <p className="admin-review-quote">
                    "{rev.comment}"
                  </p>

                  {rev.admin_response && (
                    <div className="admin-review-reply-preview">
                      <strong>Clubhouse Response:</strong> {rev.admin_response}
                    </div>
                  )}

                  <div className="admin-review-footer">
                    <span className="admin-review-facility">
                      <Building2 size={11} style={{ marginRight: '4px' }} />
                      {rev.facility_id ? rev.facility_id.replace('fac_', '').replace('_', ' ').toUpperCase() : 'Arena Grounds'}
                    </span>
                    <span className="admin-link-text">
                      Review Detail <ChevronRight size={13} style={{ verticalAlign: '-1px' }} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Moderation Detail Modal */}
      {selectedReview && (
        <div className="admin-modal-overlay" onClick={() => setSelectedReview(null)}>
          <div className="admin-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <span className="admin-eyebrow">AUDIT CONSOLE</span>
                <h3 className="admin-modal-title">Moderation Detail</h3>
              </div>
              <button className="admin-modal-close" onClick={() => setSelectedReview(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body">
              {/* Patron & Rating Block */}
              <div className="admin-detail-block" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="admin-detail-val" style={{ fontWeight: 700 }}>
                    {selectedReview.customer_name}
                  </span>
                  <div className="admin-rating-stars">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star 
                        key={s} 
                        size={14} 
                        fill={s <= (selectedReview.rating || 5) ? '#EAB308' : 'none'} 
                        color={s <= (selectedReview.rating || 5) ? '#EAB308' : '#D1D5DB'} 
                      />
                    ))}
                    <span className="admin-rating-num" style={{ fontSize: '0.85rem' }}>{selectedReview.rating}.0 / 5.0</span>
                  </div>
                </div>
                <p className="admin-detail-sub" style={{ marginTop: '4px' }}>
                  Facility: {selectedReview.facility_id || 'Campus Grounds'}
                </p>
                <div className="admin-snapshot-card" style={{ marginTop: '10px' }}>
                  <p style={{ margin: 0, fontStyle: 'italic', color: '#1A1C1A' }}>
                    "{selectedReview.comment}"
                  </p>
                </div>
              </div>

              {/* Moderation State Radio Options */}
              <div className="admin-detail-block" style={{ marginBottom: '16px' }}>
                <span className="admin-detail-label">MODERATION STATE (SINGLE CHOICE)</span>
                <div className="admin-radio-group" style={{ marginTop: '8px' }}>
                  <label className={`admin-radio-card ${moderationState === 'approved' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="mod_state" 
                      value="approved" 
                      checked={moderationState === 'approved'}
                      onChange={() => setModerationState('approved')}
                    />
                    <div>
                      <strong>Published</strong>
                      <p>Visible on customer-facing venue and ratings surfaces.</p>
                    </div>
                  </label>

                  <label className={`admin-radio-card ${moderationState === 'pending' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="mod_state" 
                      value="pending" 
                      checked={moderationState === 'pending'}
                      onChange={() => setModerationState('pending')}
                    />
                    <div>
                      <strong>Pending Audit</strong>
                      <p>Held in moderation queue awaiting management review.</p>
                    </div>
                  </label>

                  <label className={`admin-radio-card ${moderationState === 'rejected' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="mod_state" 
                      value="rejected" 
                      checked={moderationState === 'rejected'}
                      onChange={() => setModerationState('rejected')}
                    />
                    <div>
                      <strong>Flagged / Hidden</strong>
                      <p>Suppressed from public view in compliance with ground conduct rules.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Public Clubhouse Response */}
              <div className="admin-detail-block">
                <span className="admin-detail-label">CLUBHOUSE OFFICIAL RESPONSE (OPTIONAL)</span>
                <textarea
                  id="admin-review-reply-input"
                  className="admin-textarea"
                  placeholder="Provide an official public reply from Clubhouse management..."
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{ marginTop: '6px' }}
                />
              </div>
            </div>

            <div className="admin-modal-footer">
              <button 
                className="admin-btn primary full"
                onClick={handleConfirmModeration}
                disabled={submitting}
              >
                <CheckCircle size={14} />
                <span>{submitting ? 'Updating...' : 'Confirm Moderation Update'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

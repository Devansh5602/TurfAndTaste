import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Bell, 
  Search, 
  RefreshCw, 
  Plus, 
  Pin, 
  X, 
  CheckCircle, 
  Edit3, 
  Trash2, 
  AlertTriangle,
  Info,
  Wrench,
  Clock
} from 'lucide-react';

export default function NoticesView({ showToast }) {
  const { can } = useAdminAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // all, published, draft
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [deleteConfirmNotice, setDeleteConfirmNotice] = useState(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState('info'); // info, alert, maintenance
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formStatus, setFormStatus] = useState('published');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminNotices();
      setNotices(res?.notices || []);
    } catch (err) {
      if (showToast) showToast('Failed to load notices', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const openCreateModal = () => {
    setEditingNotice(null);
    setFormTitle('');
    setFormContent('');
    setFormType('info');
    setFormIsPinned(false);
    setFormStatus('published');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (notice) => {
    setEditingNotice(notice);
    setFormTitle(notice.title || '');
    setFormContent(notice.content || '');
    setFormType(notice.type || 'info');
    setFormIsPinned(Boolean(notice.is_pinned));
    setFormStatus(notice.status || 'published');
    setFormError('');
    setShowModal(true);
  };

  const handleSaveNotice = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Notice title is required.');
      return;
    }
    if (!formContent.trim()) {
      setFormError('Notice body is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        id: editingNotice ? editingNotice.id : undefined,
        title: formTitle.trim(),
        content: formContent.trim(),
        type: formType,
        isPinned: formIsPinned,
        status: formStatus
      };

      const res = await api.saveNotice(payload, !editingNotice);
      if (res.success) {
        if (showToast) showToast(editingNotice ? 'Notice updated successfully' : 'Notice published successfully');
        setShowModal(false);
        fetchNotices();
      } else {
        setFormError(res.error || 'Failed to save notice');
      }
    } catch (err) {
      setFormError(err.message || 'Error occurred while saving notice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotice = async () => {
    if (!deleteConfirmNotice) return;
    try {
      const res = await api.deleteNotice(deleteConfirmNotice.id);
      if (res.success) {
        if (showToast) showToast('Notice deleted successfully');
        setDeleteConfirmNotice(null);
        fetchNotices();
      } else {
        if (showToast) showToast(res.error || 'Failed to delete notice', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Error deleting notice', 'error');
    }
  };

  const publishedCount = notices.filter(n => n.status === 'published').length;
  const draftCount = notices.filter(n => n.status === 'draft' || !n.status).length;

  const filteredNotices = notices.filter(n => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      String(n.title || '').toLowerCase().includes(term) ||
      String(n.content || '').toLowerCase().includes(term) ||
      String(n.type || '').toLowerCase().includes(term);

    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'published' && n.status === 'published') ||
      (statusFilter === 'draft' && (n.status === 'draft' || !n.status));

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">COMMUNICATIONS</span>
          <h2 className="admin-page-title">Notices Console</h2>
          <p className="admin-page-subtitle">Clubhouse member broadcasts, maintenance advisories & bulletins</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="admin-btn secondary" 
            onClick={fetchNotices} 
            disabled={loading}
            aria-label="Refresh Notices"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button 
            id="admin-btn-create-notice"
            className="admin-btn primary" 
            onClick={openCreateModal}
          >
            <Plus size={14} />
            <span>Create Notice</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="admin-metrics-grid">
        <div className="admin-metric-card">
          <span className="admin-metric-label">Total Notices</span>
          <span className="admin-metric-value">{notices.length}</span>
          <span className="admin-metric-sub">Communications Archive</span>
        </div>
        <div className="admin-metric-card">
          <span className="admin-metric-label">Published Live</span>
          <span className="admin-metric-value">{publishedCount}</span>
          <span className="admin-metric-sub green">Visible on App Feed</span>
        </div>
        <div className="admin-metric-card">
          <span className="admin-metric-label">Drafts</span>
          <span className="admin-metric-value">{draftCount}</span>
          <span className="admin-metric-sub">Pending Review</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="admin-search-filter-bar">
        <div className="admin-search-wrap">
          <Search size={16} className="admin-search-icon" />
          <input
            id="admin-notices-search"
            type="text"
            className="admin-search-input"
            placeholder="Search notices by title or content keywords..."
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
            All ({notices.length})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'published' ? 'active' : ''}`}
            onClick={() => setStatusFilter('published')}
          >
            Published ({publishedCount})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'draft' ? 'active' : ''}`}
            onClick={() => setStatusFilter('draft')}
          >
            Drafts ({draftCount})
          </button>
        </div>
      </div>

      {/* Notices Feed */}
      <div className="admin-feed-section">
        <div className="admin-feed-header">
          <span className="admin-feed-title">Bulletins ({filteredNotices.length})</span>
          <span className="admin-feed-badge">Live Broadcast Queue</span>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            <p>Loading member notices...</p>
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="admin-empty-state">
            <Bell size={32} style={{ color: '#8D9490', margin: '0 auto 12px' }} />
            <p>No notices found matching your search filter.</p>
          </div>
        ) : (
          <div className="admin-records-list">
            {filteredNotices.map((n) => {
              const isPublished = n.status === 'published';
              const isPinned = Boolean(n.is_pinned);

              const categoryBadge = n.type === 'maintenance' ? 'Maintenance Update' :
                n.type === 'alert' ? 'Schedule Update' : 'Facility Notice';

              return (
                <div key={n.id} className="admin-card admin-notice-card">
                  <div className="admin-notice-top">
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className={`admin-category-badge ${n.type || 'info'}`}>
                        {categoryBadge}
                      </span>
                      {isPinned && (
                        <span className="admin-pinned-badge">
                          <Pin size={10} style={{ marginRight: '3px' }} />
                          Pinned
                        </span>
                      )}
                    </div>
                    <span className={`admin-status-badge ${isPublished ? 'confirmed' : 'pending'}`}>
                      {isPublished ? '• Published' : '• Draft'}
                    </span>
                  </div>

                  <h3 className="admin-notice-title">{n.title}</h3>
                  <p className="admin-notice-body">{n.content}</p>

                  <div className="admin-notice-footer">
                    <div className="admin-notice-meta">
                      <Clock size={11} style={{ marginRight: '3px' }} />
                      <span>{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>

                    <div className="admin-notice-actions">
                      <button 
                        className="admin-btn secondary compact"
                        onClick={() => openEditModal(n)}
                        title="Edit Notice"
                      >
                        <Edit3 size={12} />
                        <span>Edit</span>
                      </button>
                      <button 
                        className="admin-btn danger compact"
                        onClick={() => setDeleteConfirmNotice(n)}
                        title="Delete Notice"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Notice Modal */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <span className="admin-eyebrow">BROADCAST BULLETIN</span>
                <h3 className="admin-modal-title">
                  {editingNotice ? 'Edit Notice' : 'Create Notice'}
                </h3>
              </div>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNotice} className="admin-modal-body">
              {formError && (
                <div className="admin-form-error-banner">
                  {formError}
                </div>
              )}

              <div className="admin-form-group">
                <label className="admin-form-label required" htmlFor="notice-form-title">
                  Notice Title *
                </label>
                <input
                  id="notice-form-title"
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. Lawn Aerification & Maintenance Schedule"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  maxLength={120}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Notice Classification
                </label>
                <div className="admin-radio-pills">
                  <button
                    type="button"
                    className={`admin-radio-pill ${formType === 'info' ? 'active' : ''}`}
                    onClick={() => setFormType('info')}
                  >
                    <Info size={13} style={{ marginRight: '4px' }} />
                    General Notice
                  </button>
                  <button
                    type="button"
                    className={`admin-radio-pill ${formType === 'maintenance' ? 'active' : ''}`}
                    onClick={() => setFormType('maintenance')}
                  >
                    <Wrench size={13} style={{ marginRight: '4px' }} />
                    Maintenance
                  </button>
                  <button
                    type="button"
                    className={`admin-radio-pill ${formType === 'alert' ? 'active' : ''}`}
                    onClick={() => setFormType('alert')}
                  >
                    <AlertTriangle size={13} style={{ marginRight: '4px' }} />
                    Alert / Schedule
                  </button>
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label required" htmlFor="notice-form-content">
                  Notice Body Content *
                </label>
                <textarea
                  id="notice-form-content"
                  className="admin-textarea"
                  rows={4}
                  placeholder="Provide comprehensive details for patrons regarding court availability, grounds work, or operational hours..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  maxLength={600}
                  required
                />
                <span className="admin-char-count">{formContent.length} / 600</span>
              </div>

              <div className="admin-form-row" style={{ alignItems: 'center', marginTop: '10px' }}>
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                  />
                  <span>Pin Notice to Top of Customer App</span>
                </label>
              </div>

              <div className="admin-form-group" style={{ marginTop: '12px' }}>
                <label className="admin-form-label" htmlFor="notice-form-status">
                  Publication Status
                </label>
                <select
                  id="notice-form-status"
                  className="admin-form-select"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                >
                  <option value="published">Published (Visible immediately)</option>
                  <option value="draft">Draft (Saved internally)</option>
                </select>
              </div>

              <div className="admin-modal-footer" style={{ padding: '16px 0 0' }}>
                <button 
                  type="submit" 
                  className="admin-btn primary full"
                  disabled={submitting}
                >
                  <CheckCircle size={14} />
                  <span>{submitting ? 'Saving...' : editingNotice ? 'Save Notice' : 'Broadcast Notice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Branded In-App Confirmation Modal for Notice Deletion */}
      {deleteConfirmNotice && (
        <div className="admin-modal-overlay" onClick={() => setDeleteConfirmNotice(null)}>
          <div className="admin-modal-sheet dialog" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header danger">
              <div>
                <span className="admin-eyebrow red">DESTRUCTIVE ACTION</span>
                <h3 className="admin-modal-title">Delete Notice?</h3>
              </div>
              <button className="admin-modal-close" onClick={() => setDeleteConfirmNotice(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal-body">
              <p>Are you sure you want to permanently delete this notice? This action is terminal and will remove the bulletin from all member feeds.</p>
              <div className="admin-snapshot-card" style={{ marginTop: '8px' }}>
                <strong>"{deleteConfirmNotice.title}"</strong>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button 
                className="admin-btn secondary"
                onClick={() => setDeleteConfirmNotice(null)}
              >
                Cancel
              </button>
              <button 
                className="admin-btn danger"
                onClick={handleDeleteNotice}
              >
                <Trash2 size={14} />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

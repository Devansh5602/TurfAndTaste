import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Trophy, 
  Search, 
  RefreshCw, 
  Plus, 
  Calendar, 
  Clock, 
  Building2, 
  X, 
  CheckCircle, 
  Edit3,
  MapPin,
  Tag,
  ChevronRight
} from 'lucide-react';

export default function EventsView({ showToast }) {
  const { can } = useAdminAuth();
  const [events, setEvents] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, draft
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formShortDesc, setFormShortDesc] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formFacilityId, setFormFacilityId] = useState('');
  const [formLocation, setFormLocation] = useState('Turf & Taste • Patan Campus');
  const [formStatus, setFormStatus] = useState('active');
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchEventsData = async () => {
    setLoading(true);
    try {
      const [evRes, facRes] = await Promise.all([
        api.getAdminEvents().catch(() => ({ events: [] })),
        api.getPhysicalFacilities().catch(() => ({ facilities: [] }))
      ]);
      setEvents(evRes?.events || []);
      setFacilities(facRes?.facilities || []);
    } catch (err) {
      if (showToast) showToast('Failed to load events', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventsData();
  }, []);

  const openCreateModal = () => {
    setEditingEvent(null);
    setFormTitle('');
    setFormSlug('');
    setFormShortDesc('');
    setFormDesc('');
    // Default to tomorrow 18:00
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const dateStr = d.toISOString().slice(0, 10);
    setFormStart(`${dateStr}T18:00`);
    setFormEnd(`${dateStr}T21:00`);
    setFormFacilityId(facilities[0]?.id || 'fac_box_cricket_1');
    setFormLocation('Patan Campus Arena');
    setFormStatus('active');
    setFormCoverUrl('');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (ev) => {
    setEditingEvent(ev);
    setFormTitle(ev.title || '');
    setFormSlug(ev.slug || '');
    setFormShortDesc(ev.shortDescription || '');
    setFormDesc(ev.description || '');
    setFormStart(ev.startsAt ? ev.startsAt.slice(0, 16) : '');
    setFormEnd(ev.endsAt ? ev.endsAt.slice(0, 16) : '');
    setFormFacilityId(ev.facilityId || facilities[0]?.id || '');
    setFormLocation(ev.locationText || 'Patan Campus Arena');
    setFormStatus(ev.status || 'draft');
    setFormCoverUrl(ev.coverImageUrl || '');
    setFormError('');
    setShowModal(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Event title is required.');
      return;
    }
    const slug = (formSlug.trim() || formTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    if (!slug) {
      setFormError('A valid slug is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        id: editingEvent ? editingEvent.id : `evt-${Date.now().toString(36)}`,
        slug,
        title: formTitle.trim(),
        shortDescription: formShortDesc.trim() || null,
        description: formDesc.trim() || null,
        startsAt: new Date(formStart).toISOString(),
        endsAt: formEnd ? new Date(formEnd).toISOString() : null,
        facilityId: formFacilityId || null,
        locationText: formLocation.trim() || 'Patan Campus Arena',
        coverImageUrl: formCoverUrl.trim() || null,
        status: formStatus
      };

      const res = await api.saveEvent(payload, !editingEvent);
      if (res.success) {
        if (showToast) showToast(editingEvent ? 'Event updated successfully' : 'Event created successfully');
        setShowModal(false);
        fetchEventsData();
      } else {
        setFormError(res.error || 'Failed to save event');
      }
    } catch (err) {
      setFormError(err.message || 'Error occurred while saving event');
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = events.filter(e => e.status === 'active').length;
  const draftCount = events.filter(e => e.status === 'draft' || !e.status).length;

  const filteredEvents = events.filter(ev => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      String(ev.title || '').toLowerCase().includes(term) ||
      String(ev.locationText || '').toLowerCase().includes(term) ||
      String(ev.facilityId || '').toLowerCase().includes(term);

    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && ev.status === 'active') ||
      (statusFilter === 'draft' && (ev.status === 'draft' || !ev.status));

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">CLUBHOUSE CMS</span>
          <h2 className="admin-page-title">Events Console</h2>
          <p className="admin-page-subtitle">Tournaments, training clinics, member scrimmages & exhibitions</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="admin-btn secondary" 
            onClick={fetchEventsData} 
            disabled={loading}
            aria-label="Refresh Events"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button 
            id="admin-btn-create-event"
            className="admin-btn primary" 
            onClick={openCreateModal}
          >
            <Plus size={14} />
            <span>Create Event</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="admin-metrics-grid">
        <div className="admin-metric-card">
          <span className="admin-metric-label">Total Events</span>
          <span className="admin-metric-value">{events.length}</span>
          <span className="admin-metric-sub">Rostered on Campus</span>
        </div>
        <div className="admin-metric-card">
          <span className="admin-metric-label">Live Published</span>
          <span className="admin-metric-value">{activeCount}</span>
          <span className="admin-metric-sub green">Visible to Patrons</span>
        </div>
        <div className="admin-metric-card">
          <span className="admin-metric-label">Drafts Pending</span>
          <span className="admin-metric-value">{draftCount}</span>
          <span className="admin-metric-sub">In CMS Review</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="admin-search-filter-bar">
        <div className="admin-search-wrap">
          <Search size={16} className="admin-search-icon" />
          <input
            id="admin-events-search"
            type="text"
            className="admin-search-input"
            placeholder="Search event title, venue, or discipline..."
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
            All ({events.length})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            Published ({activeCount})
          </button>
          <button 
            className={`admin-filter-pill ${statusFilter === 'draft' ? 'active' : ''}`}
            onClick={() => setStatusFilter('draft')}
          >
            Drafts ({draftCount})
          </button>
        </div>
      </div>

      {/* Events List Feed */}
      <div className="admin-feed-section">
        <div className="admin-feed-header">
          <span className="admin-feed-title">Scheduled Events ({filteredEvents.length})</span>
          <span className="admin-feed-badge">Patan Campus</span>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            <p>Loading clubhouse events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="admin-empty-state">
            <Trophy size={32} style={{ color: '#8D9490', margin: '0 auto 12px' }} />
            <p>No events found matching your filter criteria.</p>
          </div>
        ) : (
          <div className="admin-records-list">
            {filteredEvents.map((ev) => {
              const isActive = ev.status === 'active';
              const startDateStr = ev.startsAt ? new Date(ev.startsAt).toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              }) : 'Scheduled Date TBD';

              return (
                <div key={ev.id} className="admin-card admin-event-card">
                  <div className="admin-event-top">
                    <span className={`admin-status-badge ${isActive ? 'confirmed' : 'pending'}`}>
                      {isActive ? '• Published' : '• Draft'}
                    </span>
                    <span className="admin-event-location">
                      <MapPin size={11} style={{ marginRight: '3px' }} />
                      {ev.locationText || 'Patan Campus'}
                    </span>
                  </div>

                  <h3 className="admin-event-title">{ev.title}</h3>
                  {ev.shortDescription && (
                    <p className="admin-event-desc">{ev.shortDescription}</p>
                  )}

                  <div className="admin-event-schedule-box">
                    <div className="admin-event-timing">
                      <Clock size={13} style={{ marginRight: '5px' }} />
                      <span>{startDateStr}</span>
                    </div>
                    {ev.facilityId && (
                      <div className="admin-event-facility">
                        <Building2 size={13} style={{ marginRight: '5px' }} />
                        <span>{ev.facilityId.replace('fac_', '').replace(/_/g, ' ').toUpperCase()}</span>
                      </div>
                    )}
                  </div>

                  <div className="admin-event-footer">
                    <span className="admin-record-ref">Ref: {ev.slug}</span>
                    <button 
                      className="admin-btn secondary compact"
                      onClick={() => openEditModal(ev)}
                    >
                      <Edit3 size={13} />
                      <span>Edit Event</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Event Modal */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <span className="admin-eyebrow">EVENT CONFIGURATION</span>
                <h3 className="admin-modal-title">
                  {editingEvent ? 'Edit Event' : 'Create New Event'}
                </h3>
              </div>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="admin-modal-body">
              {formError && (
                <div className="admin-form-error-banner">
                  {formError}
                </div>
              )}

              <div className="admin-form-group">
                <label className="admin-form-label required" htmlFor="event-form-title">
                  Event Title *
                </label>
                <input
                  id="event-form-title"
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. Monsoon Under-Lights Trophy '25"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="event-form-slug">
                  URL Slug (Auto-generated if blank)
                </label>
                <input
                  id="event-form-slug"
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. monsoon-trophy-2025"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                />
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group" style={{ flex: 1 }}>
                  <label className="admin-form-label required" htmlFor="event-form-start">
                    Start Date & Time *
                  </label>
                  <input
                    id="event-form-start"
                    type="datetime-local"
                    className="admin-form-input"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    required
                  />
                </div>

                <div className="admin-form-group" style={{ flex: 1 }}>
                  <label className="admin-form-label" htmlFor="event-form-end">
                    End Date & Time
                  </label>
                  <input
                    id="event-form-end"
                    type="datetime-local"
                    className="admin-form-input"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="event-form-facility">
                  Host Facility / Arena
                </label>
                <select
                  id="event-form-facility"
                  className="admin-form-select"
                  value={formFacilityId}
                  onChange={(e) => setFormFacilityId(e.target.value)}
                >
                  <option value="">Campus Grounds (General)</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="event-form-short-desc">
                  Summary / Highlight
                </label>
                <input
                  id="event-form-short-desc"
                  type="text"
                  className="admin-form-input"
                  placeholder="Short one-line description for tournament feed..."
                  value={formShortDesc}
                  onChange={(e) => setFormShortDesc(e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="event-form-desc">
                  Full Rules & Description
                </label>
                <textarea
                  id="event-form-desc"
                  className="admin-textarea"
                  rows={3}
                  placeholder="Full match regulations, roster limits, admission fee..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="event-form-status">
                  Publication Status
                </label>
                <select
                  id="event-form-status"
                  className="admin-form-select"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                >
                  <option value="active">Published (Live to Patrons)</option>
                  <option value="draft">Draft (Internal Only)</option>
                  <option value="inactive">Archived / Cancelled</option>
                </select>
              </div>

              <div className="admin-modal-footer" style={{ padding: '16px 0 0' }}>
                <button 
                  type="submit" 
                  className="admin-btn primary full"
                  disabled={submitting}
                >
                  <CheckCircle size={14} />
                  <span>{submitting ? 'Saving...' : editingEvent ? 'Save Event Changes' : 'Publish Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

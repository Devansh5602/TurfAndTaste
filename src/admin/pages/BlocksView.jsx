import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Ban, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  Building2, 
  Calendar, 
  CheckCircle,
  RefreshCw,
  X
} from 'lucide-react';

const VENUE_TIME_ZONE = 'Asia/Kolkata';

const venueDate = (now = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: VENUE_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

// The date/time fields are venue civil time. Never let the administrator's
// device timezone silently change a Patan facility block.
const venueDateTimeToIso = (date, time) => new Date(`${date}T${time}:00+05:30`).toISOString();

export default function BlocksView({ showToast }) {
  const { can } = useAdminAuth();
  const [blocks, setBlocks] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingReleaseBlock, setPendingReleaseBlock] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const todayStr = venueDate();
  const [newBlock, setNewBlock] = useState({
    facilityId: 'fac_box_cricket_1',
    startDate: todayStr,
    startTime: '08:00',
    endDate: todayStr,
    endTime: '12:00',
    reasonCode: 'MAINTENANCE',
    internalNote: '',
    customerMessage: 'Facility temporarily closed for turf maintenance.'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [blocksRes, facRes] = await Promise.all([
        api.getFacilityBlocks().catch(() => ({ blocks: [] })),
        api.getPhysicalFacilities().catch(() => ({ facilities: [] }))
      ]);
      setBlocks(blocksRes?.blocks || []);
      setFacilities(facRes?.facilities || []);
    } catch (err) {
      console.error('Failed to load blocks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBlock = async (e) => {
    e.preventDefault();
    setFormError('');

    const startISO = venueDateTimeToIso(newBlock.startDate, newBlock.startTime);
    const endISO = venueDateTimeToIso(newBlock.endDate, newBlock.endTime);

    if (new Date(endISO) <= new Date(startISO)) {
      setFormError('End time must be strictly after start time.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createFacilityBlock({
        facilityId: newBlock.facilityId,
        startAt: startISO,
        endAt: endISO,
        reasonCode: newBlock.reasonCode,
        internalNote: newBlock.internalNote.trim(),
        customerMessage: newBlock.customerMessage.trim()
      });

      if (res?.success) {
        if (showToast) showToast('Facility block created and inventory updated.');
        setIsModalOpen(false);
        setNewBlock({
          facilityId: 'fac_box_cricket_1',
          startDate: todayStr,
          startTime: '08:00',
          endDate: todayStr,
          endTime: '12:00',
          reasonCode: 'MAINTENANCE',
          internalNote: '',
          customerMessage: 'Facility temporarily closed for turf maintenance.'
        });
        await loadData();
      } else {
        setFormError(res?.error || 'Failed to create facility block.');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create facility block.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBlock = async (blockId) => {
    try {
      const res = await api.deleteFacilityBlock(blockId);
      if (res?.success) {
        if (showToast) showToast('Facility block removed. Slot released.');
        await loadData();
        return true;
      }
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to delete block.', 'error');
    }
    return false;
  };

  const confirmReleaseBlock = async () => {
    if (!pendingReleaseBlock) return;
    setIsSubmitting(true);
    const released = await handleDeleteBlock(pendingReleaseBlock.id);
    if (released) setPendingReleaseBlock(null);
    setIsSubmitting(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
            Availability & Facility Blocks
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Sports operate 24/7 by default • Manage exception blocks
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={loadData}
            className="admin-btn secondary"
            style={{ minHeight: '36px', padding: '6px 12px', fontSize: '0.78rem' }}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          
          {can('facility.block') && (
            <button
              id="btn-open-block-modal"
              className="admin-btn"
              style={{ minHeight: '36px', padding: '6px 14px', fontSize: '0.8rem' }}
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={15} />
              <span>Create Block</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
          Loading facility blocks...
        </div>
      ) : blocks.length === 0 ? (
        <div className="admin-card" style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
          All sports facilities are currently 100% available with zero active blocks.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {blocks.map((blk) => (
            <div key={blk.id} className="admin-card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Ban size={18} color="#EF4444" />
                  <div>
                    <strong style={{ color: '#F8FAFC', fontSize: '0.95rem' }}>
                      {blk.facility_name || blk.facility_id}
                    </strong>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                      {blk.id} • Reason: {blk.reason_code}
                    </div>
                  </div>
                </div>

                {can('facility.block') && (
                  <button
                    id={`btn-delete-block-${blk.id}`}
                    className="admin-btn danger"
                    style={{ minHeight: '32px', padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => setPendingReleaseBlock(blk)}
                  >
                    <Trash2 size={13} />
                    <span>Release</span>
                  </button>
                )}
              </div>

              <div style={{ fontSize: '0.82rem', color: '#CBD5E1', margin: '6px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={13} color="var(--brand-orange, #F97316)" />
                  <span>
                    {new Date(blk.start_at).toLocaleString('en-IN', { timeZone: VENUE_TIME_ZONE })} ➔ {new Date(blk.end_at).toLocaleString('en-IN', { timeZone: VENUE_TIME_ZONE })}
                  </span>
                </div>
              </div>

              {blk.customer_message && (
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '6px' }}>
                  Customer Note: "{blk.customer_message}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingReleaseBlock && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="release-block-title">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3 id="release-block-title">Release facility block?</h3>
              <button className="admin-modal-close" onClick={() => setPendingReleaseBlock(null)} disabled={isSubmitting} aria-label="Close release confirmation">
                <X size={20} />
              </button>
            </div>
            <p style={{ margin: '0 0 16px', color: '#CBD5E1', fontSize: '0.86rem', lineHeight: 1.5 }}>
              This will make <strong>{pendingReleaseBlock.facility_name || 'this facility'}</strong> available again for the blocked interval.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="admin-btn secondary" style={{ flex: 1 }} onClick={() => setPendingReleaseBlock(null)} disabled={isSubmitting}>Keep Block</button>
              <button id="btn-confirm-release-block" type="button" className="admin-btn danger" style={{ flex: 1 }} onClick={confirmReleaseBlock} disabled={isSubmitting}>
                {isSubmitting ? 'Releasing…' : 'Release Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Block Modal */}
      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Create Facility Block</h3>
              <button className="admin-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '10px',
                color: '#FCA5A5',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBlock} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px', fontWeight: 600 }}>
                  Select Facility
                </label>
                <select
                  id="block-facility-select"
                  className="admin-select"
                  style={{ width: '100%' }}
                  value={newBlock.facilityId}
                  onChange={(e) => setNewBlock({ ...newBlock, facilityId: e.target.value })}
                >
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.customName || f.defaultName} ({f.id})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>Start Date</label>
                  <input
                    id="block-start-date"
                    type="date"
                    className="admin-input"
                    value={newBlock.startDate}
                    onChange={(e) => setNewBlock({ ...newBlock, startDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>Start Time</label>
                  <input
                    id="block-start-time"
                    type="time"
                    className="admin-input"
                    value={newBlock.startTime}
                    onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>End Date</label>
                  <input
                    id="block-end-date"
                    type="date"
                    className="admin-input"
                    value={newBlock.endDate}
                    onChange={(e) => setNewBlock({ ...newBlock, endDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>End Time</label>
                  <input
                    id="block-end-time"
                    type="time"
                    className="admin-input"
                    value={newBlock.endTime}
                    onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px', fontWeight: 600 }}>
                  Reason Category
                </label>
                <select
                  id="block-reason-code"
                  className="admin-select"
                  style={{ width: '100%' }}
                  value={newBlock.reasonCode}
                  onChange={(e) => setNewBlock({ ...newBlock, reasonCode: e.target.value })}
                >
                  <option value="MAINTENANCE">Turf Maintenance / Re-turfing</option>
                  <option value="TOURNAMENT">Club Tournament / Coaching Clinic</option>
                  <option value="PRIVATE_EVENT">Private Hire / Exclusive Block</option>
                  <option value="WEATHER">Heavy Rain / Weather Closure</option>
                  <option value="OPERATIONAL_ISSUE">Operational Issue / Lighting Repair</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>
                  Customer-Facing Message
                </label>
                <input
                  id="block-customer-message"
                  type="text"
                  className="admin-input"
                  value={newBlock.customerMessage}
                  onChange={(e) => setNewBlock({ ...newBlock, customerMessage: e.target.value })}
                  placeholder="e.g. Turf maintenance in progress"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="admin-btn secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-block"
                  type="submit"
                  className="admin-btn"
                  style={{ flex: 1 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Validating Conflicts...' : 'Save Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

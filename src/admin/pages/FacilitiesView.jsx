import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Building2, 
  Layers, 
  Plus, 
  Edit2, 
  Check, 
  X, 
  AlertCircle, 
  RefreshCw,
  Sparkles,
  Zap
} from 'lucide-react';

export default function FacilitiesView({ showToast }) {
  const { can } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('physical'); // 'physical' | 'sections' | 'addons'
  const [facilities, setFacilities] = useState([]);
  const [sections, setSections] = useState([]);
  const [services, setServices] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editingFacility, setEditingFacility] = useState(null);
  const [editForm, setEditForm] = useState({ customName: '', capacity: 10, isActive: true, isBookable: true });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [facRes, secRes, srvRes, addRes] = await Promise.all([
        api.getPhysicalFacilities().catch(() => ({ facilities: [] })),
        api.getSections().catch(() => ({ sections: [] })),
        api.getServices().catch(() => ({ services: [] })),
        api.getAddOns().catch(() => ({ addOns: [] }))
      ]);

      setFacilities(facRes?.facilities || []);
      setSections(secRes?.sections || []);
      setServices(srvRes?.services || []);
      setAddOns(addRes?.addOns || []);
    } catch (err) {
      console.error('Failed to load facility CMS data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (fac) => {
    setEditingFacility(fac);
    setEditForm({
      customName: fac.customName || fac.defaultName,
      capacity: fac.capacity || 10,
      isActive: fac.isActive,
      isBookable: fac.isBookable
    });
  };

  const handleSaveFacility = async (e) => {
    e.preventDefault();
    if (!editingFacility) return;
    setIsSaving(true);
    try {
      const res = await api.savePhysicalFacility({
        id: editingFacility.id,
        customName: editForm.customName.trim(),
        capacity: Number(editForm.capacity) || 10,
        isActive: editForm.isActive,
        isBookable: editForm.isBookable
      }, false);

      if (res?.success) {
        if (showToast) showToast(`Facility ${editingFacility.id} updated successfully!`);
        setEditingFacility(null);
        await loadData();
      } else {
        if (showToast) showToast(res?.error || 'Update failed.', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message || 'Update failed.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--admin-text-main, #1A1C1A)' }}>
            Facility & Section CMS
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)' }}>
            Physical Ground Inventory • Patan, Gujarat
          </span>
        </div>

        <button
          onClick={loadData}
          className="admin-btn secondary"
          style={{ minHeight: '36px', padding: '6px 12px', fontSize: '0.78rem' }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Sub-Tabs */}
      <div className="admin-filter-chips">
        <button
          id="tab-physical-facilities"
          className={`admin-chip ${activeTab === 'physical' ? 'active' : ''}`}
          onClick={() => setActiveTab('physical')}
        >
          Physical Facilities ({facilities.length})
        </button>
        <button
          id="tab-sections-cms"
          className={`admin-chip ${activeTab === 'sections' ? 'active' : ''}`}
          onClick={() => setActiveTab('sections')}
        >
          Property Sections ({sections.length})
        </button>
        <button
          id="tab-services-addons"
          className={`admin-chip ${activeTab === 'addons' ? 'active' : ''}`}
          onClick={() => setActiveTab('addons')}
        >
          Services & Add-Ons ({addOns.length})
        </button>
      </div>

      {/* Tab 1: Physical Facilities */}
      {activeTab === 'physical' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {facilities.map((fac) => (
            <div key={fac.id} className="admin-card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--admin-text-main, #1A1C1A)' }}>
                    {fac.customName || fac.defaultName}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted, #5A645E)', fontFamily: 'monospace' }}>
                    ID: {fac.id} • Code: {fac.code}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className={`admin-status-badge ${fac.isActive ? 'confirmed' : 'cancelled'}`}>
                    {fac.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className={`admin-status-badge ${fac.isBookable ? 'confirmed' : 'cancelled'}`}>
                    {fac.isBookable ? 'Bookable' : 'Offline'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-muted, #5A645E)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                <div>Section: <strong style={{ color: 'var(--admin-text-main, #1A1C1A)' }}>{fac.sectionName || 'Sports Arena'}</strong></div>
                <div>Capacity: <strong style={{ color: 'var(--admin-text-main, #1A1C1A)' }}>{fac.capacity} Players</strong></div>
                
                {fac.services && fac.services.length > 0 && (
                  <div>Primary Sport: <span style={{ color: 'var(--admin-forest, #0F3D2E)', fontWeight: 600 }}>{fac.services.map(s => s.name).join(', ')}</span></div>
                )}

                {fac.addOns && fac.addOns.length > 0 && (
                  <div style={{ background: 'rgba(217, 119, 6, 0.08)', padding: '6px 8px', borderRadius: '6px', color: '#D97706', fontSize: '0.78rem' }}>
                    <strong>Attached Add-On:</strong> {fac.addOns.map(a => a.name).join(', ')} (Single Resource Attachment)
                  </div>
                )}
              </div>

              {can('facility.update') && (
                <button
                  id={`btn-edit-facility-${fac.id}`}
                  className="admin-btn secondary"
                  style={{ width: '100%', minHeight: '36px', fontSize: '0.8rem' }}
                  onClick={() => handleOpenEdit(fac)}
                >
                  <Edit2 size={14} />
                  <span>Configure Facility</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Sections CMS */}
      {activeTab === 'sections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sections.map((sec) => (
            <div key={sec.id} className="admin-card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--admin-text-main, #1A1C1A)' }}>
                  {sec.display_name}
                </h3>
                <span className="admin-status-badge confirmed">
                  {sec.status || 'Active'}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)' }}>
                Code: {sec.code} • Type: {sec.section_type} • Order: {sec.display_order}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Services & Add-Ons */}
      {activeTab === 'addons' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="admin-card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 8px 0', color: '#D97706' }}>
              Ball-Shooting Machine Add-On Model
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--admin-text-muted, #5A645E)' }}>
              The Ball-Shooting Machine is an optional paid add-on on the single Cricket Green Net facility (<code>fac_green_net_1</code>). It occupies the same physical resource, maintaining conflict safety.
            </p>
          </div>

          {addOns.map((add) => (
            <div key={add.id} className="admin-card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--admin-text-main, #1A1C1A)' }}>
                  {add.name}
                </h3>
                <span className="admin-status-badge confirmed">Add-On</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px' }}>
                {add.description}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted, #5A645E)', fontFamily: 'monospace' }}>
                ID: {add.id} • Attached to: Cricket Green Net 1
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Facility Modal */}
      {editingFacility && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Configure {editingFacility.defaultName}</h3>
              <button className="admin-modal-close" onClick={() => setEditingFacility(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFacility} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px', fontWeight: 600 }}>
                  Custom Display Name
                </label>
                <input
                  id="input-facility-custom-name"
                  type="text"
                  className="admin-input"
                  value={editForm.customName}
                  onChange={(e) => setEditForm({ ...editForm, customName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px', fontWeight: 600 }}>
                  Player Capacity
                </label>
                <input
                  id="input-facility-capacity"
                  type="number"
                  className="admin-input"
                  min="1"
                  max="100"
                  value={editForm.capacity}
                  onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    id="checkbox-facility-active"
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  />
                  <span>Active Resource</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    id="checkbox-facility-bookable"
                    type="checkbox"
                    checked={editForm.isBookable}
                    onChange={(e) => setEditForm({ ...editForm, isBookable: e.target.checked })}
                  />
                  <span>Bookable Online</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="admin-btn secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEditingFacility(null)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-facility"
                  type="submit"
                  className="admin-btn"
                  style={{ flex: 1 }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving Changes...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

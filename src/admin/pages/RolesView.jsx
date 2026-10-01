import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Shield, 
  Users, 
  Key, 
  RefreshCw, 
  CheckCircle, 
  X, 
  Lock, 
  Check, 
  Layers, 
  UserCheck,
  ChevronRight
} from 'lucide-react';

export default function RolesView({ showToast }) {
  const { can, admin } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('roles'); // roles, staff
  const [roles, setRoles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [vocabulary, setVocabulary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const fetchRbacData = async () => {
    setLoading(true);
    try {
      const [rolesRes, staffRes, vocabRes] = await Promise.all([
        api.getRoles().catch(() => ({ roles: [] })),
        api.getStaff().catch(() => ({ staff: [] })),
        api.getPermissionsVocabulary().catch(() => ({ permissions: [] }))
      ]);
      setRoles(rolesRes?.roles || []);
      setStaff(staffRes?.staff || []);
      setVocabulary(vocabRes?.permissions || []);
    } catch (err) {
      if (showToast) showToast('Failed to load RBAC permissions data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRbacData();
  }, []);

  const handleOpenRolePermissions = (role) => {
    setSelectedRole(role);
    const assignedKeys = (role.permissions || []).map(p => p.key || p);
    setRolePermissions(assignedKeys);
  };

  const handleTogglePermission = (key) => {
    setRolePermissions(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSavingPermissions(true);
    try {
      const res = await api.saveRolePermissions(selectedRole.id, rolePermissions);
      if (res.success) {
        if (showToast) showToast(`Permissions updated for role ${selectedRole.name}`);
        setSelectedRole(null);
        fetchRbacData();
      } else {
        if (showToast) showToast(res.error || 'Failed to update role permissions', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Error updating permissions', 'error');
    } finally {
      setSavingPermissions(false);
    }
  };

  // Group vocabulary permissions by module
  const groupedVocabulary = vocabulary.reduce((acc, p) => {
    const mod = p.module || 'general';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {});

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">ACCESS CONTROL</span>
          <h2 className="admin-page-title">Roles & RBAC Matrix</h2>
          <p className="admin-page-subtitle">Permission scopes, operational roles & staff account roster</p>
        </div>
        <button 
          className="admin-btn secondary" 
          onClick={fetchRbacData} 
          disabled={loading}
          aria-label="Refresh RBAC Data"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="admin-tabs-row" style={{ marginBottom: '16px' }}>
        <button 
          className={`admin-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          <Key size={15} />
          <span>Defined Roles ({roles.length})</span>
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          <Users size={15} />
          <span>Staff Accounts ({staff.length})</span>
        </button>
      </div>

      {/* Defined Roles Tab */}
      {activeTab === 'roles' && (
        <div className="admin-feed-section">
          <div className="admin-feed-header">
            <span className="admin-feed-title">Security Roles</span>
            <span className="admin-feed-badge">Permission Authority</span>
          </div>

          {loading ? (
            <div className="admin-empty-state">
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
              <p>Loading security roles...</p>
            </div>
          ) : (
            <div className="admin-records-list">
              {roles.map((r) => {
                const isSuper = r.id === 'super_admin' || r.name === 'Super Admin';
                const permCount = (r.permissions || []).length;

                return (
                  <div key={r.id} className="admin-card admin-role-card">
                    <div className="admin-role-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="admin-role-icon-box">
                          <Shield size={16} color="#0F3D2E" />
                        </div>
                        <div>
                          <h3 className="admin-role-title">{r.name}</h3>
                          <span className="admin-role-id-sub">System ID: {r.id}</span>
                        </div>
                      </div>
                      <span className={`admin-status-badge ${isSuper ? 'confirmed' : 'pending'}`}>
                        {Boolean(r.is_system) ? 'System Authority' : 'Custom Role'}
                      </span>
                    </div>

                    <p className="admin-role-desc">
                      {r.description || 'Pre-configured access control profile for clubhouse operations.'}
                    </p>

                    <div className="admin-role-footer">
                      <span className="admin-role-perms-count">
                        <Lock size={12} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                        {isSuper ? 'All System Permissions (Unrestricted)' : `${permCount} Permissions Granted`}
                      </span>

                      {!isSuper && (
                        <button 
                          className="admin-btn secondary compact"
                          onClick={() => handleOpenRolePermissions(r)}
                        >
                          <span>Manage Matrix</span>
                          <ChevronRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Staff Accounts Tab */}
      {activeTab === 'staff' && (
        <div className="admin-feed-section">
          <div className="admin-feed-header">
            <span className="admin-feed-title">Staff Operators</span>
            <span className="admin-feed-badge">Desk Credentials</span>
          </div>

          {loading ? (
            <div className="admin-empty-state">
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
              <p>Loading staff roster...</p>
            </div>
          ) : (
            <div className="admin-records-list">
              {staff.map((s) => (
                <div key={s.id} className="admin-card admin-staff-card">
                  <div className="admin-staff-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="admin-avatar-circle">
                        {(s.username || 'S')[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="admin-staff-name">{s.username}</h4>
                        <span className="admin-staff-email">{s.email || 'staff@turfandtaste.internal'}</span>
                      </div>
                    </div>

                    <span className="admin-status-badge confirmed">
                      {s.role ? s.role.replace(/_/g, ' ').toUpperCase() : 'STAFF'}
                    </span>
                  </div>

                  <div className="admin-staff-footer">
                    <span className="admin-meta-time">
                      Created: {s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Verified Active'}
                    </span>
                    <span className="admin-staff-status-pill green">
                      <UserCheck size={11} style={{ marginRight: '3px' }} />
                      Active Operator
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Role Permissions Matrix Modal */}
      {selectedRole && (
        <div className="admin-modal-overlay" onClick={() => setSelectedRole(null)}>
          <div className="admin-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <span className="admin-eyebrow">RBAC MATRIX</span>
                <h3 className="admin-modal-title">{selectedRole.name} Permissions</h3>
              </div>
              <button className="admin-modal-close" onClick={() => setSelectedRole(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body">
              <p className="admin-modal-sub" style={{ marginBottom: '16px' }}>
                Toggle individual permissions granted to this operational role.
              </p>

              {Object.entries(groupedVocabulary).map(([moduleName, perms]) => (
                <div key={moduleName} className="admin-detail-block" style={{ marginBottom: '16px' }}>
                  <h4 className="admin-section-heading" style={{ textTransform: 'capitalize' }}>
                    {moduleName} Module ({perms.length})
                  </h4>

                  <div className="admin-permissions-grid">
                    {perms.map((p) => {
                      const isChecked = rolePermissions.includes(p.key);
                      return (
                        <label key={p.key} className={`admin-permission-item ${isChecked ? 'active' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePermission(p.key)}
                          />
                          <div>
                            <strong>{p.key}</strong>
                            <p>{p.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-modal-footer">
              <button 
                className="admin-btn primary full"
                onClick={handleSavePermissions}
                disabled={savingPermissions}
              >
                <CheckCircle size={14} />
                <span>{savingPermissions ? 'Saving...' : 'Save Role Permissions'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

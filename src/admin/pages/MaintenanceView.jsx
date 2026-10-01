import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  Archive, 
  FileText, 
  Download, 
  Mail, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Server, 
  Database, 
  ShieldCheck, 
  Calendar, 
  X,
  Send,
  Lock
} from 'lucide-react';

export default function MaintenanceView({ showToast }) {
  const { can } = useAdminAuth();
  const [archiveYears, setArchiveYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearData, setYearData] = useState(null);
  const [emailListStr, setEmailListStr] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [loading, setLoading] = useState(true);

  // In-App Purge Confirmation Modal
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeInputText, setPurgeInputText] = useState('');
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState('');

  const fetchArchiveData = async () => {
    setLoading(true);
    try {
      const [yearsRes, settingsRes] = await Promise.all([
        api.getArchiveYears().catch(() => ({ years: [] })),
        api.getArchiveSettings().catch(() => ({ emailListStr: '' }))
      ]);

      const yList = yearsRes?.years || [];
      setArchiveYears(yList);
      setEmailListStr(settingsRes?.emailListStr || '');

      if (yList.length > 0) {
        const found = yList.find(y => y.year === selectedYear) || yList[0];
        setSelectedYear(found.year);
        setYearData(found);
      }
    } catch (err) {
      if (showToast) showToast('Failed to load archive telemetry', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchiveData();
  }, []);

  const handleSelectYear = (yr) => {
    setSelectedYear(yr.year);
    setYearData(yr);
  };

  const handleGenerateArchive = async () => {
    setGeneratingPdf(true);
    try {
      const res = await api.generateAnnualArchive({
        year: selectedYear,
        emailTo: emailListStr.split(',').map(e => e.trim()).filter(Boolean)
      });
      if (res.success) {
        if (showToast) showToast(`Archive PDF generated successfully for FY ${selectedYear}`);
        fetchArchiveData();
      } else {
        if (showToast) showToast(res.error || 'Failed to generate archive report', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Error generating archive report', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSaveEmailSettings = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const res = await api.updateArchiveSettings({ emailListStr });
      if (res.success) {
        if (showToast) showToast('Archive distribution email list saved');
      } else {
        if (showToast) showToast(res.error || 'Failed to save email settings', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Error saving email settings', 'error');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleExecutePurge = async () => {
    const requiredConfirmation = `PURGE ${selectedYear}`;
    if (purgeInputText.trim() !== requiredConfirmation) {
      setPurgeError(`Please type exactly "${requiredConfirmation}" to confirm.`);
      return;
    }

    setPurging(true);
    setPurgeError('');
    try {
      const res = await api.purgeAnnualData({
        year: selectedYear,
        confirmation: purgeInputText.trim()
      });
      if (res.success) {
        if (showToast) showToast(`Successfully purged ${res.purgedBookingsCount || 0} historical records for FY ${selectedYear}`);
        setShowPurgeModal(false);
        setPurgeInputText('');
        fetchArchiveData();
      } else {
        setPurgeError(res.error || 'Purge operation rejected by server.');
      }
    } catch (err) {
      setPurgeError(err.message || 'Error executing database purge');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">COMPLIANCE LEDGER</span>
          <h2 className="admin-page-title">Operational Archives</h2>
          <p className="admin-page-subtitle">Annual financial ledgers, PDF manifest generation & storage cleanup</p>
        </div>
        <button 
          className="admin-btn secondary" 
          onClick={fetchArchiveData} 
          disabled={loading}
          aria-label="Refresh Archives"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Fiscal Year Selector */}
      <div className="admin-feed-section" style={{ marginBottom: '16px' }}>
        <span className="admin-detail-label" style={{ marginBottom: '8px', display: 'block' }}>
          ARCHIVE FISCAL YEAR SELECTOR
        </span>
        <div className="admin-filter-pills">
          {archiveYears.map((yr) => {
            const isSelected = yr.year === selectedYear;
            return (
              <button
                key={yr.year}
                className={`admin-filter-pill ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectYear(yr)}
              >
                <span>{yr.year}</span>
                <span className="pill-sub">({yr.isArchived ? 'Archived' : 'Active'})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Annual Ledger Manifest Card */}
      {yearData && (
        <div className="admin-card admin-manifest-card" style={{ marginBottom: '20px' }}>
          <div className="admin-manifest-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="admin-role-icon-box">
                <FileText size={20} color="#0F3D2E" />
              </div>
              <div>
                <span className="admin-eyebrow">ANNUAL LEDGER MANIFEST</span>
                <h3 className="admin-manifest-title">FY {yearData.year} Ledger</h3>
              </div>
            </div>

            <span className={`admin-status-badge ${yearData.isArchived ? 'confirmed' : 'pending'}`}>
              {yearData.isArchived ? 'Status: Archived & Verified' : 'Status: Unarchived Active'}
            </span>
          </div>

          <div className="admin-metrics-grid" style={{ margin: '16px 0' }}>
            <div className="admin-metric-card">
              <span className="admin-metric-label">Archived Bookings</span>
              <span className="admin-metric-value">{yearData.bookingsCount || 0}</span>
              <span className="admin-metric-sub green">100% Retained</span>
            </div>
            <div className="admin-metric-card">
              <span className="admin-metric-label">Total Revenue</span>
              <span className="admin-metric-value">₹{(yearData.revenue || 0).toLocaleString('en-IN')}</span>
              <span className="admin-metric-sub">Financial Ledger Balance</span>
            </div>
          </div>

          <div className="admin-manifest-actions">
            {yearData.archiveDetails?.id ? (
              <a
                href={`/api/archives/${yearData.archiveDetails.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn primary"
                style={{ textDecoration: 'none', justifyContent: 'center' }}
              >
                <Download size={14} />
                <span>Download Sealed PDF Ledger</span>
              </a>
            ) : (
              <button
                className="admin-btn primary"
                onClick={handleGenerateArchive}
                disabled={generatingPdf}
              >
                <FileText size={14} />
                <span>{generatingPdf ? 'Generating PDF...' : `Generate FY ${yearData.year} Archive PDF`}</span>
              </button>
            )}

            {!yearData.isPurged && yearData.isArchived && (
              <button
                className="admin-btn danger"
                onClick={() => {
                  setPurgeInputText('');
                  setPurgeError('');
                  setShowPurgeModal(true);
                }}
              >
                <Trash2 size={14} />
                <span>Purge Year from DB</span>
              </button>
            )}

            {yearData.isPurged && (
              <div className="admin-info-box" style={{ marginTop: '8px' }}>
                <CheckCircle size={14} color="#15803D" style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                <span>Operational records purged from DB. Sealed PDF preserved in permanent vault.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Distribution List Settings */}
      <div className="admin-card" style={{ marginBottom: '20px' }}>
        <div className="admin-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={16} color="#0F3D2E" />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
              Archive Email Distribution List
            </h4>
          </div>
        </div>

        <form onSubmit={handleSaveEmailSettings} style={{ marginTop: '12px' }}>
          <p className="admin-form-sub">
            Comma-separated recipient emails to automatically receive generated fiscal year reports.
          </p>
          <input
            id="admin-archive-email-input"
            type="text"
            className="admin-form-input"
            placeholder="admin@turfandtaste.com, accounts@turfandtaste.com"
            value={emailListStr}
            onChange={(e) => setEmailListStr(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button 
              type="submit" 
              className="admin-btn secondary compact"
              disabled={savingEmail}
            >
              <CheckCircle size={13} />
              <span>{savingEmail ? 'Saving...' : 'Save Distribution List'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* System Infrastructure Telemetry */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={16} color="#0F3D2E" />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
              Infrastructure Telemetry
            </h4>
          </div>
          <span className="admin-status-badge confirmed">All Systems Operational</span>
        </div>

        <div className="admin-telemetry-list" style={{ marginTop: '14px' }}>
          <div className="admin-telemetry-item">
            <span className="telemetry-label">Property Campus</span>
            <span className="telemetry-value">Patan, Gujarat (Single Campus)</span>
          </div>
          <div className="admin-telemetry-item">
            <span className="telemetry-label">Timezone Boundary</span>
            <span className="telemetry-value">Asia/Kolkata (UTC +05:30)</span>
          </div>
          <div className="admin-telemetry-item">
            <span className="telemetry-label">Sports Operating Window</span>
            <span className="telemetry-value">24 Hours / 7 Days Conceptual</span>
          </div>
          <div className="admin-telemetry-item">
            <span className="telemetry-label">Cancellation Refund Tariff</span>
            <span className="telemetry-value">0% Refund Non-Destructive</span>
          </div>
          <div className="admin-telemetry-item">
            <span className="telemetry-label">Booking Durations</span>
            <span className="telemetry-value">1h, 2h quick • Whole-hour on :00, :15, :30, :45</span>
          </div>
        </div>
      </div>

      {/* In-App Purge Confirmation Modal */}
      {showPurgeModal && (
        <div className="admin-modal-overlay" onClick={() => setShowPurgeModal(false)}>
          <div className="admin-modal-sheet dialog" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header danger">
              <div>
                <span className="admin-eyebrow red">DESTRUCTIVE OPERATION</span>
                <h3 className="admin-modal-title">Purge FY {selectedYear} Database Rows?</h3>
              </div>
              <button className="admin-modal-close" onClick={() => setShowPurgeModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body">
              <p style={{ color: '#BA1A1A', fontWeight: 600, fontSize: '0.88rem' }}>
                WARNING: This will permanently delete operational booking records and associated payment logs for calendar year {selectedYear} from the live database.
              </p>
              <p style={{ fontSize: '0.82rem', color: '#5F6662' }}>
                Ensure you have downloaded and backed up the sealed PDF ledger before executing this purge.
              </p>

              {purgeError && (
                <div className="admin-form-error-banner" style={{ marginTop: '10px' }}>
                  {purgeError}
                </div>
              )}

              <div className="admin-form-group" style={{ marginTop: '12px' }}>
                <label className="admin-form-label required" htmlFor="admin-purge-confirm-input">
                  Type <strong>PURGE {selectedYear}</strong> to confirm:
                </label>
                <input
                  id="admin-purge-confirm-input"
                  type="text"
                  className="admin-form-input"
                  placeholder={`PURGE ${selectedYear}`}
                  value={purgeInputText}
                  onChange={(e) => setPurgeInputText(e.target.value)}
                />
              </div>
            </div>

            <div className="admin-modal-footer">
              <button 
                className="admin-btn secondary"
                onClick={() => setShowPurgeModal(false)}
                disabled={purging}
              >
                Cancel
              </button>
              <button 
                className="admin-btn danger"
                onClick={handleExecutePurge}
                disabled={purging || purgeInputText.trim() !== `PURGE ${selectedYear}`}
              >
                <Trash2 size={14} />
                <span>{purging ? 'Purging Data...' : 'Permanently Purge'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { adminStore } from '../services/adminStore';
import SectionHeading from '../components/SectionHeading';
import CourtBackground from '../components/CourtBackground';
import { 
  Shield, 
  Lock, 
  Unlock, 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Trash2, 
  Phone, 
  Mail, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Settings, 
  ChevronRight,
  TrendingUp,
  Activity
} from 'lucide-react';

export default function Admin() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('tt_admin_authenticated') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Active Tab: 'overview' | 'bookings' | 'pricing' | 'timings'
  const [activeTab, setActiveTab] = useState('bookings');

  // Core Data
  const [bookings, setBookings] = useState([]);
  const [pricingList, setPricingList] = useState([]);
  const [timings, setTimings] = useState({
    arenaOpen: '06:00 AM',
    arenaClose: '11:30 PM',
    floodlightStart: '04:00 PM',
    slotIntervalMins: 60,
    notes: ''
  });

  // Filter & Search State for Bookings
  const [searchQuery, setSearchQuery] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Feedback
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [notification, setNotification] = useState(null);

  // Walk-in form state
  const [walkIn, setWalkIn] = useState({
    facilityId: 'box-cricket',
    facilityName: 'Box Cricket Arena',
    customerName: '',
    customerPhone: '',
    date: new Date().toISOString().split('T')[0],
    time: '06:00 PM – 07:00 PM',
    paymentType: 'full',
    amount: '₹1200'
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const fetchedBookings = await adminStore.fetchBookingsAsync();
    const fetchedPricing = await adminStore.fetchPricingAsync();
    const fetchedTimings = await adminStore.fetchTimingsAsync();
    setBookings(fetchedBookings || []);
    setPricingList(fetchedPricing || []);
    setTimings(fetchedTimings || {});
  };

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    const result = await adminStore.loginAdmin('admin', passwordInput.trim());
    if (result.success) {
      setIsAuthenticated(true);
      sessionStorage.setItem('tt_admin_authenticated', 'true');
      setPasswordError('');
      setPasswordInput('');
      showToast('Welcome to Turf & Taste Management Portal!');
      loadData();
    } else {
      setPasswordError(result.error || 'Incorrect password. Please verify and try again.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('tt_admin_authenticated');
    sessionStorage.removeItem('tt_admin_jwt');
    showToast('Logged out of Admin Portal.', 'info');
  };

  // Status Change Handler
  const handleStatusChange = async (bookingId, newStatus) => {
    const updated = await adminStore.updateBookingStatus(bookingId, newStatus);
    setBookings(updated);
    showToast(`Booking ${bookingId} marked as "${newStatus}"`);
  };

  // Delete Booking
  const handleDeleteBooking = async (bookingId) => {
    if (window.confirm(`Are you sure you want to remove booking record ${bookingId}?`)) {
      const updated = await adminStore.deleteBooking(bookingId);
      setBookings(updated);
      showToast(`Booking ${bookingId} removed.`, 'info');
    }
  };

  // Walk-in submit
  const handleCreateWalkIn = async (e) => {
    e.preventDefault();
    if (!walkIn.customerName || !walkIn.customerPhone) {
      alert('Please provide customer name and phone number.');
      return;
    }

    const newBooking = {
      id: `TT-W${Math.floor(10000 + Math.random() * 90000)}`,
      facilityId: walkIn.facilityId,
      facilityName: walkIn.facilityName,
      date: walkIn.date,
      time: walkIn.time,
      customerName: walkIn.customerName,
      customerPhone: walkIn.customerPhone,
      customerEmail: 'walkin@turfandtaste.in',
      teamName: 'Counter Walk-in',
      duration: 1,
      paymentType: walkIn.paymentType,
      amount: walkIn.amount,
      status: 'Checked-in',
      createdAt: new Date().toISOString()
    };

    await adminStore.saveBooking(newBooking);
    await loadData();
    setShowWalkInModal(false);
    setWalkIn({
      facilityId: 'box-cricket',
      facilityName: 'Box Cricket Arena',
      customerName: '',
      customerPhone: '',
      date: new Date().toISOString().split('T')[0],
      time: '06:00 PM – 07:00 PM',
      paymentType: 'full',
      amount: '₹1200'
    });
    showToast(`Walk-in reservation ${newBooking.id} created successfully!`);
  };

  // Pricing Change Handlers
  const handlePriceFieldChange = (facilityId, field, value) => {
    setPricingList(prev => prev.map(item => {
      if (item.facilityId === facilityId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSaveAllPricing = () => {
    adminStore.savePricing(pricingList);
    showToast('All facility rates and deposits saved to live site!');
  };

  // Timings Change Handlers
  const handleSaveTimings = (e) => {
    e.preventDefault();
    adminStore.saveTimings(timings);
    showToast('Operating schedule & floodlight hours updated!');
  };

  // Reset all data
  const handleResetDefaults = () => {
    if (window.confirm('Reset all pricing and timings to original factory defaults?')) {
      adminStore.resetAll();
      loadData();
      showToast('Reset completed to default configurations.', 'info');
    }
  };

  // Export Bookings to CSV
  const handleExportCSV = () => {
    if (bookings.length === 0) {
      alert('No bookings available to export.');
      return;
    }

    const headers = ['Booking ID', 'Facility', 'Date', 'Time Slot', 'Customer Name', 'Phone', 'Payment Mode', 'Status', 'Created At'];
    const rows = bookings.map(b => [
      `"${b.id}"`,
      `"${b.facilityName || b.facilityId}"`,
      `"${b.date}"`,
      `"${b.time}"`,
      `"${b.customerName}"`,
      `"${b.customerPhone}"`,
      `"${b.paymentType === 'full' ? 'Full Paid' : 'Token Deposit'}"`,
      `"${b.status}"`,
      `"${new Date(b.createdAt).toLocaleString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TurfAndTaste_Bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV report downloaded successfully!');
  };

  // Filtered Bookings calculation
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchSearch = 
        (b.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.customerPhone || '').includes(searchQuery) ||
        (b.id || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchFacility = facilityFilter === 'all' || b.facilityId === facilityFilter;
      const matchStatus = statusFilter === 'all' || b.status.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchFacility && matchStatus;
    });
  }, [bookings, searchQuery, facilityFilter, statusFilter]);

  // Statistics for Overview
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(b => b.date === todayStr);
    const confirmedCount = bookings.filter(b => b.status === 'Confirmed' || b.status === 'Checked-in').length;
    return {
      total: bookings.length,
      today: todayBookings.length,
      confirmed: confirmedCount,
      facilitiesActive: 6
    };
  }, [bookings]);

  // If Not Authenticated, show Password entry modal
  if (!isAuthenticated) {
    return (
      <div className="page-admin-auth section" style={{ 
        minHeight: 'calc(100vh - 120px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <CourtBackground />
        
        {/* Subtle radial glow behind card */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '580px',
          height: '580px',
          background: 'radial-gradient(circle, rgba(107, 143, 73, 0.12) 0%, rgba(232, 103, 38, 0.04) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 2, maxWidth: '440px', width: '100%', margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(165deg, rgba(22, 28, 22, 0.95) 0%, rgba(10, 14, 10, 0.98) 100%)',
            border: '1px solid rgba(107, 143, 73, 0.35)',
            borderRadius: '24px',
            padding: '2.5rem 2rem',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(107, 143, 73, 0.18)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            textAlign: 'center'
          }}>
            {/* Top Shield Icon */}
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(107, 143, 73, 0.28), rgba(232, 103, 38, 0.15))',
              border: '1.5px solid var(--brand-olive)',
              color: 'var(--brand-olive-bright)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: 'var(--glow-olive)'
            }}>
              <Shield size={36} className="text-olive" />
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <span className="badge badge-olive" style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Management Portal
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>• Patan HQ</span>
            </div>

            <h1 style={{ fontSize: '2rem', marginBottom: '0.45rem', color: 'var(--brand-cream)', letterSpacing: '0.02em' }}>
              Arena <span className="text-olive">Control Panel</span>
            </h1>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.75rem' }}>
              Enter management password to access bookings, slot schedules, and pricing rates.
            </p>

            <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-cream)' }}>
                    <KeyRound size={16} className="text-olive" />
                    Management Password
                  </span>
                </label>

                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter management password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (passwordError) setPasswordError('');
                    }}
                    className={`form-input ${passwordError ? 'error' : ''}`}
                    style={{ 
                      paddingRight: '3.2rem', 
                      height: '50px',
                      fontSize: '1rem',
                      color: 'var(--text-primary)',
                      letterSpacing: showPassword ? 'normal' : '0.15em'
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      width: '34px',
                      height: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: showPassword ? 'var(--brand-orange)' : 'var(--brand-olive-bright)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {passwordError && (
                  <div className="form-error" style={{ marginTop: '0.5rem', background: 'rgba(255, 82, 82, 0.1)', padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-md)' }}>
                    <AlertCircle size={15} />
                    <span>{passwordError}</span>
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                className="btn btn-primary btn-block btn-lg" 
                style={{ 
                  height: '50px', 
                  fontSize: '1rem', 
                  fontWeight: 700,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.6rem',
                  boxShadow: 'var(--glow-orange)',
                  marginBottom: '1.5rem'
                }}
              >
                <Unlock size={18} /> Unlock Control Panel
              </button>
            </form>

            {/* Quick default credential info */}
            <div style={{
              marginTop: '1.5rem',
              paddingTop: '1.15rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem'
            }}>
              <div>
                Default setup password: <code style={{ 
                  background: 'rgba(107, 143, 73, 0.2)', 
                  color: 'var(--brand-olive-bright)', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }} onClick={() => setPasswordInput('Turfandtaste2026')}>Turfandtaste2026</code>
              </div>
              <span style={{ fontSize: '0.73rem', opacity: 0.75 }}>Click to autofill or type above</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-admin">
      {/* Admin Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '90px',
          right: '24px',
          background: notification.type === 'info' ? 'var(--bg-surface-elevated)' : 'var(--brand-olive)',
          color: '#fff',
          padding: '0.9rem 1.4rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontWeight: 600,
          fontSize: '0.92rem'
        }}>
          <CheckCircle size={18} />
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Admin Header Bar */}
      <div style={{
        background: 'var(--bg-surface-elevated)',
        borderBottom: '1px solid var(--border-strong)',
        padding: '1.25rem 0'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="badge badge-olive">Patan Arena HQ</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Live Control Portal</span>
            </div>
            <h1 style={{ fontSize: '1.7rem', margin: '0.25rem 0 0' }}>
              Turf &amp; Taste <span className="text-olive">Arena Management</span>
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              onClick={handleResetDefaults} 
              className="btn btn-outline" 
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
              title="Reset to default mock settings"
            >
              <RefreshCw size={14} /> Reset Defaults
            </button>
            <button 
              onClick={handleLogout} 
              className="btn btn-outline" 
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem', color: 'var(--brand-orange)', borderColor: 'var(--brand-orange)' }}
            >
              <Lock size={14} /> Lock Portal
            </button>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 0' }}>
            <button
              className={`tab-btn ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookings')}
            >
              <Calendar size={16} /> Bookings Roster ({bookings.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'pricing' ? 'active' : ''}`}
              onClick={() => setActiveTab('pricing')}
            >
              <DollarSign size={16} /> Rates &amp; Pricing
            </button>
            <button
              className={`tab-btn ${activeTab === 'timings' ? 'active' : ''}`}
              onClick={() => setActiveTab('timings')}
            >
              <Clock size={16} /> Operating Timings
            </button>
            <button
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Activity size={16} /> Performance Overview
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <section className="section" style={{ paddingTop: '2rem', minHeight: '70vh' }}>
        <div className="container">

          {/* TAB 1: BOOKINGS ROSTER */}
          {activeTab === 'bookings' && (
            <div>
              {/* Controls bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1.25rem',
                background: 'var(--bg-surface)',
                padding: '0.85rem 1.1rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)'
              }}>
                {/* Search & Filters */}
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                  <div style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search player, phone, or TT-#..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '2.2rem', paddingRight: '0.6rem', height: '38px', fontSize: '0.84rem', background: 'var(--bg-surface-elevated)' }}
                    />
                  </div>

                  <select
                    value={facilityFilter}
                    onChange={(e) => setFacilityFilter(e.target.value)}
                    className="form-select"
                    style={{ width: '150px', height: '38px', paddingLeft: '0.6rem', paddingRight: '1.2rem', fontSize: '0.84rem', background: 'var(--bg-surface-elevated)' }}
                  >
                    <option value="all">All Facilities</option>
                    <option value="box-cricket">Box Cricket</option>
                    <option value="pickleball">Pickleball</option>
                    <option value="skating">Skating Rink</option>
                    <option value="ball-machine">Ball Machine</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="form-select"
                    style={{ width: '130px', height: '38px', paddingLeft: '0.6rem', paddingRight: '1.2rem', fontSize: '0.84rem', background: 'var(--bg-surface-elevated)' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked-in">Checked-in</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <button onClick={handleExportCSV} className="btn btn-outline btn-sm" style={{ height: '38px', fontSize: '0.84rem', padding: '0 0.85rem' }}>
                    <Download size={14} /> Export CSV
                  </button>
                  <button onClick={() => setShowWalkInModal(true)} className="btn btn-primary btn-sm" style={{ height: '38px', fontSize: '0.84rem', padding: '0 0.95rem' }}>
                    <Plus size={14} /> New Walk-In
                  </button>
                </div>
              </div>

              {/* Bookings Table */}
              <div className="table-responsive" style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                overflowX: 'auto'
              }}>
                <table className="admin-table" style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-strong)', color: 'var(--brand-cream-muted)' }}>
                      <th style={{ padding: '1rem' }}>Booking ID</th>
                      <th style={{ padding: '1rem' }}>Sport / Court</th>
                      <th style={{ padding: '1rem' }}>Date &amp; Slot</th>
                      <th style={{ padding: '1rem' }}>Customer</th>
                      <th style={{ padding: '1rem' }}>Payment</th>
                      <th style={{ padding: '1rem' }}>Status</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No bookings found matching your search and filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((b) => (
                        <tr key={b.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '1rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--brand-cream)' }}>
                            {b.id}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: 600 }}>{b.facilityName || b.facilityId}</div>
                            {b.teamName && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Squad: {b.teamName}</div>}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ color: 'var(--brand-cream)' }}>{b.date}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--brand-olive-bright)' }}>{b.time}</div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: 600 }}>{b.customerName}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{b.customerPhone}</div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span className={`badge ${b.paymentType === 'full' ? 'badge-olive' : 'badge-orange'}`} style={{ fontSize: '0.75rem' }}>
                              {b.paymentType === 'full' ? 'Full Paid' : 'Deposit Paid'}
                            </span>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <select
                              value={b.status}
                              onChange={(e) => handleStatusChange(b.id, e.target.value)}
                              style={{
                                background: 'var(--bg-surface-elevated)',
                                color: b.status === 'Confirmed' ? 'var(--brand-olive-bright)' : b.status === 'Checked-in' ? '#58A6FF' : b.status === 'Cancelled' ? '#FF6B6B' : 'var(--text-muted)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <option value="Confirmed" style={{ background: '#121812', color: 'var(--text-primary)' }}>Confirmed</option>
                              <option value="Checked-in" style={{ background: '#121812', color: 'var(--text-primary)' }}>Checked-in</option>
                              <option value="Completed" style={{ background: '#121812', color: 'var(--text-primary)' }}>Completed</option>
                              <option value="Cancelled" style={{ background: '#121812', color: 'var(--text-primary)' }}>Cancelled</option>
                            </select>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteBooking(b.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '0.4rem',
                                borderRadius: 'var(--radius-sm)'
                              }}
                              title="Delete record"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PRICING & RATES */}
          {activeTab === 'pricing' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Facility Pricing &amp; Token Deposits</h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Edit the public hourly rates and reservation booking amounts. Changes immediately update the live Pricing and Booking pages.
                  </p>
                </div>
                <button onClick={handleSaveAllPricing} className="btn btn-primary btn-lg">
                  <Save size={18} /> Save All Pricing Changes
                </button>
              </div>

              <div className="grid grid-2" style={{ gap: '1.5rem' }}>
                {pricingList.map((tier) => {
                  const cleanDayRate = String(tier.dayRate || '').replace(/^₹\s*/, '');
                  const cleanNightRate = String(tier.nightRate || '').replace(/^₹\s*/, '');
                  const cleanDeposit = String(tier.bookingDeposit || tier.depositPct || '').replace(/^₹\s*/, '');

                  return (
                    <div key={tier.facilityId} className="card-arena" style={{ padding: '1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                        <h3 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--brand-cream)' }}>{tier.facilityName}</h3>
                        <span className="badge badge-olive" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>{tier.facilityId}</span>
                      </div>

                      {/* Rates Section */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--brand-cream-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                          Hourly Rates
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                              Day Rate (per hour):
                            </label>
                            <div className="input-prefix-wrapper">
                              <span className="input-prefix-badge">₹</span>
                              <input
                                type="text"
                                value={cleanDayRate}
                                onChange={(e) => handlePriceFieldChange(tier.facilityId, 'dayRate', e.target.value)}
                                className="form-input"
                                placeholder="800"
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                              Night / Floodlight Rate:
                            </label>
                            <div className="input-prefix-wrapper">
                              <span className="input-prefix-badge">₹</span>
                              <input
                                type="text"
                                value={cleanNightRate}
                                onChange={(e) => handlePriceFieldChange(tier.facilityId, 'nightRate', e.target.value)}
                                className="form-input"
                                placeholder="1200"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Deposit Section */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                          Token Booking Amount (Deposit):
                        </label>
                        <div className="input-prefix-wrapper">
                          <span className="input-prefix-badge">₹</span>
                          <input
                            type="text"
                            value={cleanDeposit}
                            onChange={(e) => handlePriceFieldChange(tier.facilityId, 'bookingDeposit', e.target.value)}
                            className="form-input"
                            placeholder="400"
                          />
                        </div>
                      </div>

                      {/* Schedule Labels Section */}
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--brand-cream-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                          Schedule Window Labels
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                              Day Hours Label:
                            </label>
                            <input
                              type="text"
                              value={tier.dayHours || ''}
                              onChange={(e) => handlePriceFieldChange(tier.facilityId, 'dayHours', e.target.value)}
                              className="form-input"
                              style={{ fontSize: '0.85rem' }}
                              placeholder="e.g. 6:00 AM – 4:00 PM"
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                              Night Hours Label:
                            </label>
                            <input
                              type="text"
                              value={tier.nightHours || ''}
                              onChange={(e) => handlePriceFieldChange(tier.facilityId, 'nightHours', e.target.value)}
                              className="form-input"
                              style={{ fontSize: '0.85rem' }}
                              placeholder="e.g. 4:00 PM – 11:30 PM"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ textAlign: 'right', marginTop: '2rem' }}>
                <button onClick={handleSaveAllPricing} className="btn btn-primary btn-lg">
                  <Save size={18} /> Save All Pricing Changes
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: OPERATING TIMINGS */}
          {activeTab === 'timings' && (
            <div style={{ maxWidth: '820px', margin: '0 auto' }}>
              <div className="card-arena highlight" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(107, 143, 73, 0.15)', color: 'var(--brand-olive-bright)' }}>
                    <Clock size={28} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Arena Operating Schedule</h2>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      Set Patan arena gates open/close timings, slot durations, and floodlight transitions.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveTimings}>
                  <div className="grid grid-2" style={{ gap: '1.25rem', marginBottom: '1.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--brand-cream-muted)' }}>
                        Arena Gates Open Time:
                      </label>
                      <input
                        type="text"
                        value={timings.arenaOpen || ''}
                        onChange={(e) => setTimings({ ...timings, arenaOpen: e.target.value })}
                        className="form-input"
                        placeholder="e.g. 06:00 AM"
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>First bookable slot of the morning</span>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--brand-cream-muted)' }}>
                        Arena Gates Close Time:
                      </label>
                      <input
                        type="text"
                        value={timings.arenaClose || ''}
                        onChange={(e) => setTimings({ ...timings, arenaClose: e.target.value })}
                        className="form-input"
                        placeholder="e.g. 11:30 PM"
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>Final slot conclude hour</span>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--brand-cream-muted)' }}>
                        Floodlight Peak Start:
                      </label>
                      <input
                        type="text"
                        value={timings.floodlightStart || ''}
                        onChange={(e) => setTimings({ ...timings, floodlightStart: e.target.value })}
                        className="form-input"
                        placeholder="e.g. 04:00 PM"
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>When evening floodlight rates take effect</span>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--brand-cream-muted)' }}>
                        Slot Interval Duration (Minutes):
                      </label>
                      <select
                        value={timings.slotIntervalMins || 60}
                        onChange={(e) => setTimings({ ...timings, slotIntervalMins: Number(e.target.value) })}
                        className="form-select"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={60}>60 Minutes (Standard 1 Hour)</option>
                        <option value={90}>90 Minutes</option>
                        <option value={120}>120 Minutes (2 Hours)</option>
                      </select>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>Default bookable block duration</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: 'var(--brand-cream-muted)' }}>
                      Operational Notice / Schedule Notes:
                    </label>
                    <textarea
                      rows={3}
                      value={timings.notes || ''}
                      onChange={(e) => setTimings({ ...timings, notes: e.target.value })}
                      className="form-textarea"
                      placeholder="Special announcements (e.g., Sunday morning tournament maintenance)..."
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg">
                    <Save size={18} /> Update Operating Schedule
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: OVERVIEW & STATS */}
          {activeTab === 'overview' && (
            <div>
              <div className="grid grid-4" style={{ gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    Total Bookings
                  </div>
                  <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', color: 'var(--brand-cream)' }}>
                    {stats.total}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--brand-olive-bright)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <TrendingUp size={14} /> Active reservations
                  </div>
                </div>

                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    Today's Matches
                  </div>
                  <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', color: 'var(--brand-olive-bright)' }}>
                    {stats.today}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Scheduled for today
                  </div>
                </div>

                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    Confirmed / Checked-In
                  </div>
                  <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', color: '#58A6FF' }}>
                    {stats.confirmed}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Guaranteed attendance
                  </div>
                </div>

                <div className="card-arena" style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                    Active Courts
                  </div>
                  <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', color: 'var(--brand-orange)' }}>
                    {stats.facilitiesActive}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Box, Nets, Rink, Pickle, Café
                  </div>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="card-arena" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Ground Reception Quick Actions</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={() => setShowWalkInModal(true)} className="btn btn-primary">
                    <Plus size={16} /> Enter Walk-In Customer
                  </button>
                  <button onClick={handleExportCSV} className="btn btn-outline">
                    <Download size={16} /> Download Daily Roster
                  </button>
                  <button onClick={() => setActiveTab('pricing')} className="btn btn-outline">
                    <DollarSign size={16} /> Adjust Weekend Surcharges
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* WALK-IN BOOKING MODAL */}
      {showWalkInModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="card-arena highlight" style={{ maxWidth: '520px', width: '100%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.4rem', margin: 0 }}>Register Walk-In Player</h3>
              <button
                onClick={() => setShowWalkInModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <XCircle size={22} />
              </button>
            </div>

            <form onSubmit={handleCreateWalkIn}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', color: 'var(--brand-cream-muted)' }}>Sport / Court:</label>
                <select
                  value={walkIn.facilityId}
                  onChange={(e) => {
                    const sel = e.target.value;
                    const name = sel === 'box-cricket' ? 'Box Cricket Arena' : sel === 'pickleball' ? 'Pickleball Courts' : sel === 'skating' ? 'Skating Rink' : sel === 'cricket-nets' ? 'Practice Nets' : 'Ball Machine';
                    setWalkIn({ ...walkIn, facilityId: sel, facilityName: name });
                  }}
                  className="form-select"
                >
                  <option value="box-cricket">Box Cricket Arena</option>
                  <option value="pickleball">Pickleball Courts</option>
                  <option value="skating">Skating Rink</option>
                  <option value="cricket-nets">Cricket Practice Nets</option>
                  <option value="ball-machine">Ball-Shooting Machine Lane</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', color: 'var(--brand-cream-muted)' }}>Customer Name:</label>
                <input
                  type="text"
                  required
                  placeholder="Player full name"
                  value={walkIn.customerName}
                  onChange={(e) => setWalkIn({ ...walkIn, customerName: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', color: 'var(--brand-cream-muted)' }}>Phone Number:</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98XXX XXXXX"
                  value={walkIn.customerPhone}
                  onChange={(e) => setWalkIn({ ...walkIn, customerPhone: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', color: 'var(--brand-cream-muted)' }}>Date:</label>
                  <input
                    type="date"
                    value={walkIn.date}
                    onChange={(e) => setWalkIn({ ...walkIn, date: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', color: 'var(--brand-cream-muted)' }}>Slot Time:</label>
                  <select
                    value={walkIn.time}
                    onChange={(e) => setWalkIn({ ...walkIn, time: e.target.value })}
                    className="form-select"
                  >
                    <option value="06:00 AM – 07:00 AM">06:00 AM – 07:00 AM</option>
                    <option value="07:00 AM – 08:00 AM">07:00 AM – 08:00 AM</option>
                    <option value="08:00 AM – 09:00 AM">08:00 AM – 09:00 AM</option>
                    <option value="04:00 PM – 05:00 PM">04:00 PM – 05:00 PM</option>
                    <option value="05:00 PM – 06:00 PM">05:00 PM – 06:00 PM</option>
                    <option value="06:00 PM – 07:00 PM">06:00 PM – 07:00 PM (Prime)</option>
                    <option value="07:00 PM – 08:00 PM">07:00 PM – 08:00 PM (Prime)</option>
                    <option value="08:00 PM – 09:00 PM">08:00 PM – 09:00 PM (Prime)</option>
                    <option value="09:00 PM – 10:00 PM">09:00 PM – 10:00 PM</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', color: 'var(--brand-cream-muted)' }}>Payment Status:</label>
                  <select
                    value={walkIn.paymentType}
                    onChange={(e) => setWalkIn({ ...walkIn, paymentType: e.target.value })}
                    className="form-select"
                  >
                    <option value="full">100% Full Paid</option>
                    <option value="deposit">Token Deposit Paid</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', color: 'var(--brand-cream-muted)' }}>Amount Collected:</label>
                  <div className="input-prefix-wrapper">
                    <span className="input-prefix-badge">₹</span>
                    <input
                      type="text"
                      value={String(walkIn.amount || '').replace(/^₹\s*/, '')}
                      onChange={(e) => setWalkIn({ ...walkIn, amount: e.target.value })}
                      className="form-input"
                      placeholder="1200"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowWalkInModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm &amp; Check In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminNav from './components/AdminNav';
import AdminLogin from './pages/AdminLogin';
import DashboardView from './pages/DashboardView';
import BookingsView from './pages/BookingsView';
import WalkInView from './pages/WalkInView';
import FacilitiesView from './pages/FacilitiesView';
import BlocksView from './pages/BlocksView';
import PricingView from './pages/PricingView';
import SessionsView from './pages/SessionsView';
import './styles/admin.css';
import { Shield, LogOut, User } from 'lucide-react';

function AdminShell() {
  const { admin, isAuthenticated, isAuthChecking, logout } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState(null); // { message, type }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  if (isAuthChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050807', color: '#94A3B8' }}>
        Verifying administrator authorization...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return (
    <div className="admin-platform-shell">
      {/* Toast Alert */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Top Operations Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-brand-badge">
            <span className="admin-logo-pill">Ops</span>
            <div className="admin-title-wrap">
              <h1>Turf & Taste Desk</h1>
              <span>Patan Campus • 24/7</span>
            </div>
          </div>

          <div className="admin-user-menu">
            <div className="admin-user-pill">
              <User size={13} color="var(--brand-green, #4ADE80)" />
              <span><strong>{admin?.username || 'Staff'}</strong> ({admin?.role})</span>
            </div>

            <button
              id="admin-btn-logout"
              className="admin-logout-btn"
              onClick={logout}
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Operational Views */}
      <main className="admin-main-container">
        {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} showToast={showToast} />}
        {activeTab === 'bookings' && <BookingsView showToast={showToast} />}
        {activeTab === 'walkin' && <WalkInView onNavigate={setActiveTab} showToast={showToast} />}
        {activeTab === 'facilities' && <FacilitiesView showToast={showToast} />}
        {activeTab === 'blocks' && <BlocksView showToast={showToast} />}
        {activeTab === 'pricing' && <PricingView showToast={showToast} />}
        {activeTab === 'sessions' && <SessionsView showToast={showToast} />}
      </main>

      {/* Fixed Bottom Operational Navigation */}
      <AdminNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminShell />
    </AdminAuthProvider>
  );
}

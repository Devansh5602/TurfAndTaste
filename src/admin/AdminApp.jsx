import React, { useState, useEffect, useCallback } from 'react';
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
import PaymentsView from './pages/PaymentsView';
import CustomersView from './pages/CustomersView';
import InquiriesView from './pages/InquiriesView';
import ReviewsView from './pages/ReviewsView';
import EventsView from './pages/EventsView';
import NoticesView from './pages/NoticesView';
import DiningView from './pages/DiningView';
import RolesView from './pages/RolesView';
import MaintenanceView from './pages/MaintenanceView';
import './styles/admin.css';
import {
  Building2,
  LogOut,
  User,
  Bell,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';

function AdminShell() {
  const { admin, isAuthenticated, isAuthChecking, logout } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toastQueue, setToastQueue] = useState([]);
  const [activeToast, setActiveToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToastQueue(prev => [...prev, { id, message, type }]);
  }, []);

  useEffect(() => {
    if (!activeToast && toastQueue.length > 0) {
      setActiveToast(toastQueue[0]);
      setToastQueue(prev => prev.slice(1));
    }
  }, [toastQueue, activeToast]);

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  if (isAuthChecking) {
    return (
      <div className="admin-loading-screen">
        <div className="admin-avatar-circle large" style={{ margin: '0 auto 16px' }}>
          T&T
        </div>
        <p>Verifying clubhouse credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  const isSubView = activeTab !== 'dashboard';

  return (
    <div className="admin-platform-shell">
      {/* Toast Alert */}
      {activeToast && (
        <div className={`admin-toast ${activeToast.type}`}>
          {activeToast.message}
        </div>
      )}

      {/* Authoritative Top Clubhouse Operations Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-left">
            {isSubView ? (
              <button
                className="admin-header-back-btn"
                onClick={() => setActiveTab('dashboard')}
                aria-label="Back to Dashboard"
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}

            <div className="admin-location-pill">
              <Building2 size={13} color="#0F3D2E" />
              <span>PATAN CAMPUS · HQ</span>
            </div>

            <div className="admin-status-pill-live">
              <span className="live-dot" />
              <span>LIVE</span>
            </div>
          </div>

          <div className="admin-header-right">
            <button
              className="admin-header-icon-btn"
              onClick={() => setActiveTab('notices')}
              title="Notices Broadcast"
              aria-label="Notices"
            >
              <Bell size={16} />
            </button>

            <div className="admin-user-pill">
              <div className="admin-avatar-tiny">
                {(admin?.username || 'S')[0].toUpperCase()}
              </div>
              <span className="admin-user-name">
                {admin?.username || 'Staff'}
              </span>
            </div>

            <button
              id="admin-btn-logout"
              className="admin-header-icon-btn logout"
              onClick={logout}
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Operational Container */}
      <main className="admin-main-container">
        {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} showToast={showToast} />}
        {activeTab === 'bookings' && <BookingsView onNavigate={setActiveTab} showToast={showToast} />}
        {activeTab === 'walkin' && <WalkInView onNavigate={setActiveTab} showToast={showToast} />}
        {activeTab === 'facilities' && <FacilitiesView onNavigate={setActiveTab} showToast={showToast} />}
        {activeTab === 'blocks' && <BlocksView showToast={showToast} />}
        {activeTab === 'pricing' && <PricingView showToast={showToast} />}
        {activeTab === 'sessions' && <SessionsView onNavigate={setActiveTab} showToast={showToast} />}
        {activeTab === 'payments' && <PaymentsView showToast={showToast} />}
        {activeTab === 'customers' && <CustomersView showToast={showToast} />}
        {activeTab === 'inquiries' && <InquiriesView showToast={showToast} />}
        {activeTab === 'reviews' && <ReviewsView showToast={showToast} />}
        {activeTab === 'events' && <EventsView showToast={showToast} />}
        {activeTab === 'notices' && <NoticesView showToast={showToast} />}
        {activeTab === 'dining' && <DiningView showToast={showToast} />}
        {activeTab === 'roles' && <RolesView showToast={showToast} />}
        {activeTab === 'maintenance' && <MaintenanceView showToast={showToast} />}
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

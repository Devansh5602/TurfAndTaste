import React, { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  LayoutDashboard,
  CalendarCheck,
  Building2,
  SlidersHorizontal,
  UserPlus,
  QrCode,
  Ban,
  DollarSign,
  CreditCard,
  Users,
  HelpCircle,
  Star,
  Trophy,
  Bell,
  Utensils,
  Shield,
  Archive,
  X
} from 'lucide-react';

export default function AdminNav({ activeTab, setActiveTab }) {
  const { can, admin } = useAdminAuth();
  const [showOpsDrawer, setShowOpsDrawer] = useState(false);

  const mainTabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: true
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: CalendarCheck,
      show: can('booking.read')
    },
    {
      id: 'facilities',
      label: 'Facilities',
      icon: Building2,
      show: can('facility.read')
    },
    {
      id: 'operations',
      label: 'Operations',
      icon: SlidersHorizontal,
      show: true,
      isDrawerOpener: true
    }
  ];

  const opsModules = [
    {
      id: 'walkin',
      label: 'Walk-In Desk',
      sub: 'On-site court reservation',
      icon: UserPlus,
      show: can('booking.walkin') || can('booking.create_walkin')
    },
    {
      id: 'sessions',
      label: 'Sessions & QR',
      sub: 'Check-in, start & extend',
      icon: QrCode,
      show: can('booking.read') || can('booking.checkin')
    },
    {
      id: 'blocks',
      label: 'Facility Blocks',
      sub: 'Maintenance & closures',
      icon: Ban,
      show: can('facility.read') || can('facility.block')
    },
    {
      id: 'pricing',
      label: 'Pricing Engine',
      sub: 'Tariffs, night surge & packages',
      icon: DollarSign,
      show: can('pricing.read') || can('pricing.manage')
    },
    {
      id: 'payments',
      label: 'Payments Ledger',
      sub: 'Verified settlements & snapshots',
      icon: CreditCard,
      show: can('payment.read') || can('booking.read')
    },
    {
      id: 'customers',
      label: 'Customer CRM',
      sub: 'Patron profiles & notes',
      icon: Users,
      show: can('booking.read')
    },
    {
      id: 'inquiries',
      label: 'Inquiries Triage',
      sub: 'Concierge questions & queue',
      icon: HelpCircle,
      show: can('booking.read') || can('admin.manage')
    },
    {
      id: 'reviews',
      label: 'Reviews Queue',
      sub: 'Feedback moderation & replies',
      icon: Star,
      show: can('review.moderate') || can('admin.manage')
    },
    {
      id: 'events',
      label: 'Events CMS',
      sub: 'Tournaments & member clinics',
      icon: Trophy,
      show: can('event.manage') || can('admin.manage')
    },
    {
      id: 'notices',
      label: 'Notices Broadcast',
      sub: 'Clubhouse member bulletins',
      icon: Bell,
      show: can('notice.manage') || can('admin.manage')
    },
    {
      id: 'dining',
      label: 'Dining CMS',
      sub: 'Outlets, menus & availability',
      icon: Utensils,
      show: can('dining.stall.read') || can('dining.stall.manage')
    },
    {
      id: 'roles',
      label: 'Roles & Staff',
      sub: 'RBAC permissions matrix',
      icon: Shield,
      show: can('role.manage')
    },
    {
      id: 'maintenance',
      label: 'Archives & System',
      sub: 'Annual ledger & telemetry',
      icon: Archive,
      show: can('booking.read') || can('admin.manage')
    }
  ];

  const isOpsActive = [
    'walkin', 'sessions', 'blocks', 'pricing', 'payments',
    'customers', 'inquiries', 'reviews', 'events', 'notices',
    'dining', 'roles', 'maintenance'
  ].includes(activeTab);

  const handleTabClick = (tab) => {
    if (tab.isDrawerOpener) {
      setShowOpsDrawer(prev => !prev);
    } else {
      setShowOpsDrawer(false);
      setActiveTab(tab.id);
    }
  };

  const handleModuleSelect = (moduleId) => {
    setShowOpsDrawer(false);
    setActiveTab(moduleId);
  };

  return (
    <>
      {/* Stable 4-Tab Bottom Navigation Bar */}
      <nav className="admin-bottom-nav" aria-label="Admin Operational Navigation">
        {mainTabs.filter(t => t.show).map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.isDrawerOpener ? isOpsActive || showOpsDrawer : activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`admin-nav-${tab.id}`}
              className={`admin-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(tab)}
              aria-selected={isActive}
              role="tab"
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Operations Launcher Hub Drawer */}
      {showOpsDrawer && (
        <div className="admin-modal-overlay" onClick={() => setShowOpsDrawer(false)}>
          <div className="admin-modal-sheet ops-hub" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <span className="admin-eyebrow">OPERATIONS LAUNCHPAD</span>
                <h3 className="admin-modal-title">Clubhouse Modules</h3>
              </div>
              <button
                className="admin-modal-close"
                onClick={() => setShowOpsDrawer(false)}
                aria-label="Close Operations Launcher"
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-ops-grid">
              {opsModules.filter(m => m.show).map((mod) => {
                const Icon = mod.icon;
                const isSelected = activeTab === mod.id;

                return (
                  <button
                    key={mod.id}
                    id={`admin-ops-item-${mod.id}`}
                    className={`admin-ops-tile ${isSelected ? 'active' : ''}`}
                    onClick={() => handleModuleSelect(mod.id)}
                  >
                    <div className="admin-ops-tile-icon">
                      <Icon size={20} />
                    </div>
                    <div className="admin-ops-tile-info">
                      <span className="admin-ops-tile-title">{mod.label}</span>
                      <span className="admin-ops-tile-sub">{mod.sub}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

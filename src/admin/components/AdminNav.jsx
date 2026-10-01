import React from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  LayoutDashboard, 
  CalendarCheck, 
  UserPlus, 
  Building2, 
  Ban, 
  DollarSign, 
  QrCode 
} from 'lucide-react';

export default function AdminNav({ activeTab, setActiveTab }) {
  const { can } = useAdminAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: can('booking.read') || can('facility.read')
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: CalendarCheck,
      show: can('booking.read')
    },
    {
      id: 'walkin',
      label: 'Walk-In',
      icon: UserPlus,
      show: can('booking.walkin') || can('booking.create_walkin')
    },
    {
      id: 'sessions',
      label: 'Sessions',
      icon: QrCode,
      show: can('booking.read') || can('booking.checkin')
    },
    {
      id: 'facilities',
      label: 'Facilities',
      icon: Building2,
      show: can('facility.read')
    },
    {
      id: 'blocks',
      label: 'Blocks',
      icon: Ban,
      show: can('facility.read') || can('facility.block')
    },
    {
      id: 'pricing',
      label: 'Pricing',
      icon: DollarSign,
      show: can('pricing.read') || can('pricing.manage')
    }
  ];

  return (
    <nav className="admin-bottom-nav" aria-label="Admin Operational Navigation">
      {navItems.filter(item => item.show).map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            id={`admin-nav-${item.id}`}
            className={`admin-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            aria-selected={isActive}
            role="tab"
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

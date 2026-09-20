import React from 'react';
import { Link, useRouter } from '../context/RouterContext';
import { Home, Layers, Calendar, BookmarkCheck, User } from 'lucide-react';

const TABS = [
  { path: '/',            label: 'Home',       Icon: Home,          id: 'home' },
  { path: '/facilities',  label: 'Venues',     Icon: Layers,        id: 'facilities' },
  { path: '/booking',     label: 'Book',       Icon: Calendar,      id: 'book', special: true },
  { path: '/my-bookings', label: 'Bookings',   Icon: BookmarkCheck, id: 'my-bookings' },
  { path: '/profile',     label: 'Profile',    Icon: User,          id: 'profile' },
];

export default function BottomTabBar() {
  const { currentPath } = useRouter();

  const isActive = (tab) => {
    if (tab.path === '/') return currentPath === '/';
    return currentPath === tab.path || currentPath.startsWith(tab.path + '/');
  };

  return (
    <nav className="bottom-tab-bar" aria-label="Mobile Navigation">
      <div className="tab-bar-inner">
        {TABS.map((tab) => {
          const active = isActive(tab);
          const { Icon } = tab;
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={`tab-item${tab.special ? ' tab-book' : ''}${active ? ' active' : ''}`}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              id={`tab-${tab.id}`}
            >
              <span className="tab-item-icon">
                <Icon size={tab.special ? 22 : 20} strokeWidth={active ? 2.5 : 1.8} />
              </span>
              <span className="tab-item-label">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

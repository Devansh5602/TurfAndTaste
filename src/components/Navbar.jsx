import React, { useState, useEffect } from 'react';
import { Link, useRouter } from '../context/RouterContext';
import { navLinks } from '../data/navigationData';
import ThemeToggle from './ThemeToggle';
import { Menu, X, Calendar, ChevronRight, ShieldCheck, User } from 'lucide-react';

export default function Navbar() {
  const { currentPath } = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [currentPath]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      {/* ── App Top Header ── */}
      <header className={`app-header${isScrolled ? ' scrolled' : ''}`}>
        <div className="app-header-inner">
          {/* Brand */}
          <Link to="/" className="header-brand" aria-label="Turf & Taste — Home">
            <img src="/logo.jpg" alt="Turf & Taste" className="header-logo" />
            <div className="header-brand-text">
              <span className="header-brand-name">
                TURF <span className="ampersand">&</span> TASTE
              </span>
              <span className="header-brand-sub">PATAN • GUJARAT</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="header-nav" aria-label="Primary Navigation">
            {navLinks.map((link) => {
              const active = currentPath === link.path ||
                (link.path !== '/' && currentPath.startsWith(link.path));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-link${active ? ' active' : ''}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="header-actions">
            <ThemeToggle />
            <Link
              to="/profile"
              className={`btn btn-outline btn-sm${currentPath === '/profile' ? ' active' : ''}`}
              title="Player Profile"
            >
              <User size={15} /> Profile
            </Link>
            <Link
              to="/admin"
              className={`btn btn-outline btn-sm${currentPath === '/admin' ? ' active' : ''}`}
              title="Admin Portal"
            >
              <ShieldCheck size={15} className="text-green" /> Admin
            </Link>
            <Link to="/booking" className="btn btn-primary btn-sm">
              <Calendar size={15} /> Book a Slot
            </Link>
          </div>

          {/* Mobile Controls */}
          <div className="header-mobile-controls">
            <ThemeToggle />
            <Link
              to="/profile"
              className={`header-profile-btn${currentPath === '/profile' ? ' active' : ''}`}
              aria-label="Player Profile"
              title="Player Profile"
            >
              <User size={19} />
            </Link>
            <button
              className="header-menu-btn"
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label={drawerOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={drawerOpen}
              id="mobile-menu-toggle"
            >
              {drawerOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Drawer Overlay ── */}
      {drawerOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Side Drawer ── */}
      <aside
        className={`mobile-drawer${drawerOpen ? ' open' : ''}`}
        aria-label="Mobile Navigation"
        aria-hidden={!drawerOpen}
      >
        <div className="mobile-drawer-header">
          <div className="navbar-brand">
            <img src="/logo.jpg" alt="Turf & Taste" className="navbar-logo-img-small" />
            <div className="navbar-brand-text">
              <span className="navbar-brand-title">
                TURF <span className="ampersand">&</span> TASTE
              </span>
            </div>
          </div>
          <button
            className="mobile-menu-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close Menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mobile-drawer-nav">
          {navLinks.map((link) => {
            const active = currentPath === link.path ||
              (link.path !== '/' && currentPath.startsWith(link.path));
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`mobile-nav-link${active ? ' active' : ''}`}
                onClick={() => setDrawerOpen(false)}
              >
                <span>{link.label}</span>
                <ChevronRight size={16} className="mobile-nav-arrow" />
              </Link>
            );
          })}

          <Link
            to="/admin"
            className={`mobile-nav-link${currentPath === '/admin' ? ' active' : ''}`}
            onClick={() => setDrawerOpen(false)}
            style={{ borderTop: '1px solid var(--border-hairline)', marginTop: '0.5rem', paddingTop: '1rem' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-green)', fontWeight: 600 }}>
              <ShieldCheck size={16} /> Admin Portal
            </span>
            <ChevronRight size={16} className="mobile-nav-arrow" />
          </Link>

          <Link
            to="/profile"
            className={`mobile-nav-link${currentPath === '/profile' ? ' active' : ''}`}
            onClick={() => setDrawerOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              <User size={16} /> Player Profile & Settings
            </span>
            <ChevronRight size={16} className="mobile-nav-arrow" />
          </Link>
        </nav>

        <div className="mobile-drawer-footer">
          <Link to="/booking" className="btn btn-primary btn-block" onClick={() => setDrawerOpen(false)}>
            <Calendar size={17} /> Book a Slot Now
          </Link>
          <p className="mobile-drawer-tagline">Play Hard • Eat Well • Repeat</p>
        </div>
      </aside>
    </>
  );
}

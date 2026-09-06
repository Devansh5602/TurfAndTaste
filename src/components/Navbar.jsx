import React, { useState, useEffect } from 'react';
import { Link, useRouter } from '../context/RouterContext';
import { navLinks } from '../data/navigationData';
import ThemeToggle from './ThemeToggle';
import { Menu, X, Calendar, ChevronRight } from 'lucide-react';

export default function Navbar() {
  const { currentPath } = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath]);

  return (
    <>
      <header className={`navbar-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container navbar-container">
          {/* Brand Logo & Name */}
          <Link to="/" className="navbar-brand" aria-label="Turf & Taste Home">
            <img 
              src="/logo.jpg" 
              alt="Turf & Taste Logo" 
              className="navbar-logo-img" 
            />
            <div className="navbar-brand-text">
              <span className="navbar-brand-title">
                TURF <span className="ampersand">&amp;</span> TASTE
              </span>
              <span className="navbar-brand-tagline">PATAN • GUJARAT</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="navbar-nav desktop-nav" aria-label="Primary Navigation">
            {navLinks.map((link) => {
              const isActive = currentPath === link.path || 
                (link.path !== '/' && currentPath.startsWith(link.path));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Actions: Theme switch & Book a Slot CTA */}
          <div className="navbar-actions desktop-actions">
            <ThemeToggle />
            <Link to="/booking" className="btn btn-primary btn-sm btn-nav-cta">
              <Calendar size={15} /> Book a Slot
            </Link>
          </div>

          {/* Mobile Menu Hamburger Button */}
          <div className="mobile-actions">
            <ThemeToggle />
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={mobileMenuOpen}
              id="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="mobile-drawer-overlay" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* Mobile Drawer */}
      <aside className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-header">
          <div className="navbar-brand">
            <img src="/logo.jpg" alt="Turf & Taste Logo" className="navbar-logo-img-small" />
            <div className="navbar-brand-text">
              <span className="navbar-brand-title" style={{ fontSize: '1.4rem' }}>
                TURF <span className="ampersand">&amp;</span> TASTE
              </span>
            </div>
          </div>
          <button 
            className="mobile-menu-close" 
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Menu"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="mobile-drawer-nav" aria-label="Mobile Navigation">
          {navLinks.map((link) => {
            const isActive = currentPath === link.path || 
              (link.path !== '/' && currentPath.startsWith(link.path));
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`mobile-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>{link.label}</span>
                <ChevronRight size={18} className="mobile-nav-arrow" />
              </Link>
            );
          })}
        </nav>

        <div className="mobile-drawer-footer">
          <Link 
            to="/booking" 
            className="btn btn-primary btn-block btn-lg"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Calendar size={18} /> Book a Slot Now
          </Link>
          <p className="mobile-drawer-tagline">
            Play Hard. Eat Well. Repeat.
          </p>
        </div>
      </aside>
    </>
  );
}

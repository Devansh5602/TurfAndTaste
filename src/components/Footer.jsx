import React from 'react';
import { Link } from '../context/RouterContext';
import { footerLinks } from '../data/navigationData';
import { contactData } from '../data/contactData';
import { MapPin, Phone, Mail, Clock, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Info & Mission */}
          <div className="footer-brand-col">
            <Link to="/" className="navbar-brand footer-logo" aria-label="Turf & Taste Home">
              <img src="/logo.jpg" alt="Turf & Taste Logo" className="footer-logo-img" />
              <div className="navbar-brand-text">
                <span className="navbar-brand-title" style={{ fontSize: '1.65rem' }}>
                  TURF <span className="ampersand">&amp;</span> TASTE
                </span>
                <span className="navbar-brand-tagline">PATAN • GUJARAT</span>
              </div>
            </Link>

            <p className="footer-brand-desc">
              Patan’s premier destination where high-performance sports and vibrant dining converge. Built for competitive players, passionate learners, and food lovers.
            </p>

            <div className="footer-tagline-badge">
              <span>PLAY HARD</span> • <span>EAT WELL</span> • <span className="text-orange">REPEAT</span>
            </div>

            {/* Social Channels */}
            <div className="footer-socials">
              {contactData.socials.map((social) => (
                <a
                  key={social.platform}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-pill"
                  aria-label={social.platform}
                >
                  {social.platform}
                  <ArrowUpRight size={13} />
                </a>
              ))}
            </div>
          </div>

          {/* Facilities Column */}
          <div className="footer-col">
            <h4 className="footer-col-title">Our Facilities</h4>
            <ul className="footer-links-list">
              {footerLinks.destinations.map((item) => (
                <li key={item.label}>
                  <Link to={item.path} className="footer-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Explore Column */}
          <div className="footer-col">
            <h4 className="footer-col-title">Explore &amp; Reserve</h4>
            <ul className="footer-links-list">
              {footerLinks.explore.map((item) => (
                <li key={item.label}>
                  <Link to={item.path} className="footer-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Hours */}
          <div className="footer-col">
            <h4 className="footer-col-title">Visit Us in Patan</h4>
            <div className="footer-contact-items">
              <div className="footer-contact-item">
                <MapPin size={18} className="text-olive" style={{ flexShrink: 0, marginTop: '3px' }} />
                <span>{contactData.address}</span>
              </div>
              <div className="footer-contact-item">
                <Clock size={18} className="text-olive" style={{ flexShrink: 0, marginTop: '3px' }} />
                <div>
                  <strong>Sports:</strong> {contactData.hours.sportsArenas}<br />
                  <strong>Café:</strong> {contactData.hours.cafeAndDining}
                </div>
              </div>
              <div className="footer-contact-item">
                <Phone size={18} className="text-olive" style={{ flexShrink: 0 }} />
                <span>{contactData.phone}</span>
              </div>
              <div className="footer-contact-item">
                <Mail size={18} className="text-olive" style={{ flexShrink: 0 }} />
                <span>{contactData.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom Line */}
        <div className="footer-bottom">
          <div className="footer-copyright">
            &copy; {currentYear} Turf &amp; Taste. All Rights Reserved. Designed for Patan, Gujarat.
          </div>
          <div className="footer-legal">
            {footerLinks.legal.map((item) => (
              <a key={item.label} href={item.path} className="footer-legal-link">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

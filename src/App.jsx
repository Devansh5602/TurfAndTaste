import React, { useEffect, useRef, useState } from 'react';
import { RouterProvider, useRouter, Link } from './context/RouterContext';
import { ThemeProvider } from './theme';
import { CustomerAuthProvider } from './auth';
import './theme/tokens.css';
import './theme/light.css';
import './theme/dark.css';
import './styles/globals.css';
import './styles/utilities.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Codex Curated Comparison Screens (Preferred Visual Implementation)
import Home from './comparison/Home';
import Facilities from './comparison/Facilities';
import FacilityDetail from './comparison/FacilityDetail';
import './comparison/comparison.css';

// Broader Customer Mobile Prototype Components
import CustomerMobilePrototype from './prototype/customerMobile/CustomerMobilePrototype';

// Web Pages
import About from './pages/About';
import Pricing from './pages/Pricing';
import Contact from './pages/Contact';
import Inquiry from './pages/Inquiry';
import Admin from './pages/Admin';

function NotFound() {
  return (
    <div className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div className="container">
        <span className="badge badge-orange" style={{ marginBottom: '1rem' }}>404 • Out of Bounds</span>
        <h1 style={{ marginBottom: '1rem', fontSize: '3rem' }}>Page Not Found</h1>
        <p style={{ maxWidth: '460px', margin: '0 auto 2rem' }}>This page doesn't exist on the Turf & Taste grounds.</p>
        <Link to="/" className="btn btn-primary btn-lg">Back to Home</Link>
      </div>
    </div>
  );
}

function CuratedMobileShell() {
  const { currentPath } = useRouter();
  const [notice, setNotice] = useState(false);
  const timeout = useRef();
  const path = currentPath.toLowerCase().replace(/\/$/, '') || '/';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setNotice(false);
  }, [path]);

  useEffect(() => () => clearTimeout(timeout.current), []);

  const onNotice = () => {
    setNotice(true);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setNotice(false), 4000);
  };

  const isHome = path === '' || path === '/';
  const isFacilities = path === '/facilities' || path === '/venues';
  const isFacilityDetail = path.startsWith('/facilities/');

  return (
    <div className="comparison-app">
      {isHome && <Home onNotice={onNotice} />}
      {isFacilities && <Facilities onNotice={onNotice} />}
      {isFacilityDetail && <FacilityDetail onNotice={onNotice} />}
      {notice && (
        <div className="scope-notice" role="status">
          Outside this three-screen comparison.
          <button aria-label="Dismiss message" onClick={() => setNotice(false)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function RouteRenderer() {
  const { currentPath } = useRouter();
  const path = currentPath.toLowerCase().replace(/\/$/, '') || '/';

  // Curated 3-screen mobile experience (Codex fidelity implementation)
  if (path === '' || path === '/' || path === '/facilities' || path === '/venues' || path.startsWith('/facilities/')) {
    return <CuratedMobileShell />;
  }

  // Curated customer-mobile screens beyond the approved discovery baseline.
  // The visual fixture layer is deliberately isolated from the production web
  // routes while the curated mobile experience is completed screen by screen.
  const customerMobileRoutes = {
    '/booking': 'booking-step-1',
    '/booking/step-1': 'booking-step-1',
    // Deep links without the prerequisite local reservation context restart
    // safely at step one instead of exposing an invalid later step.
    '/booking/step-2': 'booking-step-1',
    '/booking/step-3': 'booking-step-1',
    '/booking/review': 'booking-step-1',
    '/payment/processing': 'processing',
    '/payment/failure': 'payment-failure',
    '/booking/success': 'success',
    '/booking/pass': 'pass',
    '/my-bookings': 'bookings',
    '/sign-in': 'auth',
    '/create-account': 'auth-create',
    '/forgot-password': 'auth-forgot',
    '/reset-password': 'auth-reset',
    '/session-expired': 'auth-expired',
    '/profile': 'profile',
    '/profile/edit': 'edit-profile',
    '/settings': 'settings',
    '/appearance': 'appearance',
    '/reviews': 'reviews',
    '/events': 'events',
    '/events/loading': 'events-loading',
    '/events/empty': 'events-empty',
    '/events/detail': 'event',
    '/dining': 'dining',
    '/dining/loading': 'dining-loading',
    '/dining/unavailable': 'dining-unavailable',
    '/dining/outlet': 'outlet',
    '/dining/menu': 'menu',
    '/updates': 'notices',
    '/contact-support': 'contact',
    '/ground-rules': 'rules',
    '/about-clubhouse': 'about',
    '/terms': 'terms',
    '/privacy': 'privacy',
    '/offline': 'offline',
    '/system-error': 'system-error',
  };
  if (customerMobileRoutes[path]) {
    return <CustomerMobilePrototype key={path} initialScreen={customerMobileRoutes[path]} />;
  }

  // Legacy prototype deep links remain available for existing saved previews.
  if (path === '/prototype' || path.startsWith('/prototype/')) {
    const screenParam = path.replace('/prototype/', '').replace('/prototype', '') || 'home';
    return <CustomerMobilePrototype initialScreen={screenParam} />;
  }

  // Web routes
  switch (path) {
    case '/about':       return <About />;
    case '/pricing':     return <Pricing />;
    case '/contact':     return <Contact />;
    case '/inquiry':     return <Inquiry />;
    case '/admin':       return <Admin />;
    default:
      return <NotFound />;
  }
}

function AppLayout() {
  const { currentPath } = useRouter();
  const path = currentPath.toLowerCase().replace(/\/$/, '') || '/';
  const isCustomerMobile = [
    '/booking', '/payment', '/my-bookings', '/sign-in', '/create-account',
    '/forgot-password', '/reset-password', '/session-expired', '/profile',
    '/settings', '/appearance', '/reviews', '/events', '/dining', '/updates', '/contact-support',
    '/ground-rules', '/about-clubhouse', '/terms', '/privacy', '/offline', '/system-error',
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const isCuratedOrPrototype = path === '' || path === '/' || path === '/facilities' || path === '/venues' || path.startsWith('/facilities/') || path.startsWith('/prototype') || isCustomerMobile || isAdmin;

  if (isCuratedOrPrototype) {
    return (
      <main>
        <RouteRenderer />
      </main>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <RouteRenderer />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <CustomerAuthProvider>
        <RouterProvider>
          <AppLayout />
        </RouterProvider>
      </CustomerAuthProvider>
    </ThemeProvider>
  );
}

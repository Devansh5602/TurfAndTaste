import React, { useEffect, useRef, useState } from 'react';
import { RouterProvider, useRouter, Link } from './context/RouterContext';
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

  // Broader customer mobile prototype routes
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
  const isCuratedOrPrototype = path === '' || path === '/' || path === '/facilities' || path === '/venues' || path.startsWith('/facilities/') || path.startsWith('/prototype');

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
    <RouterProvider>
      <AppLayout />
    </RouterProvider>
  );
}

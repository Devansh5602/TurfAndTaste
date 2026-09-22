import React from 'react';
import { RouterProvider, useRouter, Link } from './context/RouterContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import BottomTabBar from './components/BottomTabBar';

// Pages
import Home from './pages/Home';
import About from './pages/About';
import Facilities from './pages/Facilities';
import FacilityDetail from './pages/FacilityDetail';
import Pricing from './pages/Pricing';
import Booking from './pages/Booking';
import Contact from './pages/Contact';
import Inquiry from './pages/Inquiry';
import Admin from './pages/Admin';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';

function NotFound() {
  return (
    <div className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div className="container">
        <span className="badge badge-orange" style={{ marginBottom: '1rem' }}>404 • Out of Bounds</span>
        <h1 style={{ marginBottom: '1rem', fontSize: '3rem' }}>Court Not Found</h1>
        <p style={{ maxWidth: '460px', margin: '0 auto 2rem' }}>This page doesn't exist on the Turf & Taste grounds.</p>
        <Link to="/" className="btn btn-primary btn-lg">Back to Home</Link>
      </div>
    </div>
  );
}

function RouteRenderer() {
  const { currentPath } = useRouter();
  const path = currentPath.toLowerCase().replace(/\/$/, '') || '/';

  if (path.startsWith('/facilities/')) {
    const slug = path.replace('/facilities/', '');
    return <FacilityDetail slug={slug} />;
  }

  switch (path) {
    case '/':            return <Home />;
    case '/about':       return <About />;
    case '/facilities':  return <Facilities />;
    case '/pricing':     return <Pricing />;
    case '/booking':     return <Booking />;
    case '/my-bookings': return <MyBookings />;
    case '/profile':     return <Profile />;
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
  const isAppFlowRoute = ['/booking', '/my-bookings', '/profile', '/admin'].includes(path);

  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <RouteRenderer />
      </main>
      {/* Suppress website footer on transactional/app flow routes */}
      {!isAppFlowRoute && <Footer />}
      {/* Bottom Tab Bar — mobile only, rendered via CSS display:none on desktop */}
      <BottomTabBar />
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

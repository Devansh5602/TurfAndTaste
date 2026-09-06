import React from 'react';
import { RouterProvider, useRouter, Link } from './context/RouterContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

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

function RouteRenderer() {
  const { currentPath } = useRouter();

  // Normalize path
  const path = currentPath.toLowerCase().replace(/\/$/, '') || '/';

  // Dynamic route for facilities: /facilities/:slug
  if (path.startsWith('/facilities/')) {
    const slug = path.replace('/facilities/', '');
    return <FacilityDetail slug={slug} />;
  }

  switch (path) {
    case '/':
      return <Home />;
    case '/about':
      return <About />;
    case '/facilities':
      return <Facilities />;
    case '/pricing':
      return <Pricing />;
    case '/booking':
      return <Booking />;
    case '/contact':
      return <Contact />;
    case '/inquiry':
      return <Inquiry />;
    case '/admin':
      return <Admin />;
    default:
      return (
        <div className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div className="container">
            <span className="badge badge-orange" style={{ marginBottom: '1rem' }}>404 • Out of Bounds</span>
            <h1 style={{ marginBottom: '1rem', fontSize: '3rem' }}>Court Not Found</h1>
            <p style={{ maxWidth: '480px', margin: '0 auto 2rem' }}>
              The page you are looking for has moved or does not exist on the Turf &amp; Taste grounds.
            </p>
            <Link to="/" className="btn btn-primary btn-lg">
              Return to Arena Home
            </Link>
          </div>
        </div>
      );
  }
}

export default function App() {
  return (
    <RouterProvider>
      <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          <RouteRenderer />
        </main>
        <Footer />
      </div>
    </RouterProvider>
  );
}

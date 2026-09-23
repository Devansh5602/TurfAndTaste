import React, { useEffect, useState } from 'react';
import { facilitiesData, facilityCategories } from '../data/facilitiesData';
import { api } from '../services/api';
import { mergePublicFoodIntoFacilities } from '../utils/foodPresentation';
import FacilityCard from '../components/FacilityCard';
import SectionHeading from '../components/SectionHeading';
import CourtBackground from '../components/CourtBackground';
import { Search, Sparkles, ChevronDown, ChevronUp, Shield, Activity, Clock, CheckCircle2 } from 'lucide-react';

export default function Facilities() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSpecId, setExpandedSpecId] = useState(null);
  const [managedFacilities, setManagedFacilities] = useState(facilitiesData);
  const [publicFoodStalls, setPublicFoodStalls] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getFacilities().then((result) => {
      if (!result?.success || !Array.isArray(result.facilities) || cancelled) return;
      const merged = result.facilities.map((record) => {
        const fallback = facilitiesData.find((facility) => facility.id === record.id || facility.slug === record.slug) || {};
        const metadata = record.metadata || {};
        return {
          ...fallback,
          id: record.id,
          slug: record.slug,
          name: record.name,
          category: record.type === 'sport' ? (fallback.category || 'sports') : (record.type || fallback.category || 'sports'),
          image: record.coverImageUrl || fallback.image,
          shortDesc: record.shortDescription || fallback.shortDesc || '',
          fullDesc: record.description || fallback.fullDesc || record.shortDescription || '',
          highlights: record.amenities?.length ? record.amenities : (metadata.highlights || fallback.highlights || []),
          rules: record.rules?.length ? record.rules : (fallback.rules || []),
          specs: metadata.specs || fallback.specs || {},
          suitableFor: metadata.suitableFor || fallback.suitableFor || [],
          pricing: metadata.legacyPricing || fallback.pricing || {},
          tag: metadata.tag || fallback.tag || record.type,
          badge: metadata.badge || fallback.badge,
          bookingEnabled: record.bookingEnabled,
        };
      });
      if (merged.length > 0) setManagedFacilities(merged);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.getFoodStalls().then((result) => {
      if (!cancelled && result?.success && Array.isArray(result?.data?.stalls)) setPublicFoodStalls(result.data.stalls);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const discoveryFacilities = mergePublicFoodIntoFacilities(managedFacilities, publicFoodStalls);

  const filteredFacilities = discoveryFacilities.filter(facility => {
    const matchesCategory = selectedCategory === 'all' || facility.category === selectedCategory;
    const matchesSearch = facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      facility.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      facility.tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const sportsFacilities = discoveryFacilities.filter(facility => facility.category === 'sports');
  const practiceFacilities = discoveryFacilities.filter(facility => facility.category === 'practice');
  const diningFacilities = discoveryFacilities.filter(facility => facility.category === 'dining');

  const toggleSpec = (id) => {
    setExpandedSpecId(prev => prev === id ? null : id);
  };

  return (
    <div className="page-facilities">
      {/* Header Bar */}
      <section className="facilities-hero-section">
        <CourtBackground />
        <div className="container" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <span className="badge badge-green" style={{ marginBottom: '0.75rem' }}>
            Sports & Dining Portfolio
          </span>
          <h1 className="facilities-main-title">
            Our <span className="text-green">Facilities</span>
          </h1>
          <p className="facilities-main-sub">
            Built to international athletic standards in Patan. Explore tournament turfs, high-speed practice lanes, skating track, and signature café.
          </p>

          {/* Quick Search & Filter Controls */}
          <div className="facilities-filter-controls">
            {/* Search Input */}
            <div className="facilities-search-box">
              <Search size={16} className="text-muted facilities-search-icon" />
              <input
                type="text"
                placeholder="Search courts, turfs, nets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input facilities-search-input"
              />
            </div>

            {/* Category Scroll Strip */}
            <div className="facilities-category-strip">
              {facilityCategories.map(cat => (
                <button
                  key={cat.id}
                  className={`cat-pill-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Facilities Cards Section */}
      <section className="section-sm" style={{ paddingTop: '1.25rem' }}>
        <div className="container">
          {selectedCategory === 'all' && !searchQuery.trim() ? (
            /* Structured Activity Category Groups for First-Time Discoverability */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {/* Group 1: Tournament Sports Arenas */}
              <div>
                <div className="facility-group-header" style={{ marginTop: 0 }}>
                  <div>
                    <h2 className="facility-group-title">
                      <span>🏆</span> Competitive Sports Arenas
                    </h2>
                    <p className="facility-group-desc">Tournament synthetic turfs, cushioned pickleball, and smooth speed skating</p>
                  </div>
                  <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>{sportsFacilities.length} Venue{sportsFacilities.length === 1 ? '' : 's'}</span>
                </div>
                <div className="grid grid-3">
                  {sportsFacilities.map(facility => (
                    <FacilityCard key={facility.id} facility={facility} />
                  ))}
                </div>
              </div>

              {/* Group 2: Athletic Performance & Training */}
              <div>
                <div className="facility-group-header">
                  <div>
                    <h2 className="facility-group-title">
                      <span>🎯</span> Performance Training &amp; Practice Lanes
                    </h2>
                    <p className="facility-group-desc">Full bowler run-up nets and 150 km/h programmable bowling machine</p>
                  </div>
                  <span className="badge badge-orange" style={{ fontSize: '0.72rem' }}>{practiceFacilities.length} Lane{practiceFacilities.length === 1 ? '' : 's'}</span>
                </div>
                <div className="grid grid-2">
                  {practiceFacilities.map(facility => (
                    <FacilityCard key={facility.id} facility={facility} />
                  ))}
                </div>
              </div>

              {/* Group 3: Café, Dugouts & Nutrition */}
              <div>
                <div className="facility-group-header">
                  <div>
                    <h2 className="facility-group-title">
                      <span>☕</span> Café, Dugouts &amp; Player Fuel
                    </h2>
                    <p className="facility-group-desc">Espresso bar, protein smoothies, woodfired pizzas, and pavilion seating</p>
                  </div>
                  <span className="badge badge-surface" style={{ fontSize: '0.72rem' }}>{diningFacilities.length} Space{diningFacilities.length === 1 ? '' : 's'}</span>
                </div>
                <div className="grid grid-2">
                  {diningFacilities.map(facility => (
                    <FacilityCard key={facility.id} facility={facility} />
                  ))}
                </div>
              </div>
            </div>
          ) : filteredFacilities.length > 0 ? (
            <div>
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  Found <strong>{filteredFacilities.length}</strong> matching venue{filteredFacilities.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                >
                  Show All Activities
                </button>
              </div>
              <div className="grid grid-3">
                {filteredFacilities.map(facility => (
                  <FacilityCard key={facility.id} facility={facility} />
                ))}
              </div>
            </div>
          ) : (
            <div className="facility-not-found-card">
              <p style={{ fontSize: '1.1rem', color: 'var(--brand-cream)', margin: 0, fontWeight: 700 }}>
                No venues matched "{searchQuery}".
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.4rem 0 1rem' }}>
                Try exploring one of our popular sports or reset your search:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => { setSelectedCategory('sports'); setSearchQuery(''); }}
                  className="btn btn-outline btn-sm"
                >
                  🏏 Competitive Sports
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedCategory('practice'); setSearchQuery(''); }}
                  className="btn btn-outline btn-sm"
                >
                  🎯 Performance Training
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedCategory('dining'); setSearchQuery(''); }}
                  className="btn btn-outline btn-sm"
                >
                  ☕ Café &amp; Dining
                </button>
              </div>
              <button
                onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                className="btn btn-primary btn-sm"
              >
                Reset Filters &amp; View All Sports
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Facility Specs Comparison: Mobile-First Accordion Cards */}
      <section className="section-sm facilities-specs-section" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <SectionHeading
            badge="Engineering Standards"
            title="The Turf &amp; Taste"
            highlight="Specification Guide"
            subtitle="Engineered for athletes, beginners, and spectators alike."
            center
          />

          <div className="specs-accordion-list" style={{ marginTop: '1.5rem' }}>
            {discoveryFacilities.map((item) => {
              const isOpen = expandedSpecId === item.id;
              return (
                <div key={item.id} className={`spec-card ${isOpen ? 'open' : ''}`}>
                  <button
                    className="spec-card-header"
                    onClick={() => toggleSpec(item.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="spec-card-title-group">
                      <span className="spec-card-name">{item.name}</span>
                      <span className="badge badge-surface" style={{ fontSize: '0.68rem' }}>
                        {item.category === 'dining' ? 'Café' : 'Court Specs'}
                      </span>
                    </div>
                    <div className="spec-chevron">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="spec-card-body">
                      <div className="spec-item-row">
                        <span className="spec-item-label">Surface / Ambience:</span>
                        <span className="spec-item-val text-green">
                          {item.specs.surface || item.specs.speedRange || item.specs.menuPillars || item.specs.beverages || 'Standard'}
                        </span>
                      </div>
                      <div className="spec-item-row">
                        <span className="spec-item-label">Regulations:</span>
                        <span className="spec-item-val">
                          {item.specs.regulations || 'Compliant with Indian Athletic Facility Standards'}
                        </span>
                      </div>
                      <div className="spec-item-row">
                        <span className="spec-item-label">Dimensions / Area:</span>
                        <span className="spec-item-val">
                          {item.specs.dimensions || item.specs.seating || item.specs.location || 'Standard Dimension'}
                        </span>
                      </div>
                      <div className="spec-item-row">
                        <span className="spec-item-label">Lighting & Setup:</span>
                        <span className="spec-item-val">
                          {item.specs.lighting || item.specs.ambience || item.specs.speed || 'Full Lighting Setup'}
                        </span>
                      </div>
                      <div className="spec-item-row">
                        <span className="spec-item-label">Ideal For:</span>
                        <span className="spec-item-val" style={{ color: 'var(--brand-cream)' }}>
                          {item.suitableFor ? item.suitableFor.join(', ') : 'All Players'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

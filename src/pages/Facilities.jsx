import React, { useState } from 'react';
import { facilitiesData, facilityCategories } from '../data/facilitiesData';
import FacilityCard from '../components/FacilityCard';
import SectionHeading from '../components/SectionHeading';
import CourtBackground from '../components/CourtBackground';
import { Search, Sparkles } from 'lucide-react';

export default function Facilities() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFacilities = facilitiesData.filter(facility => {
    const matchesCategory = selectedCategory === 'all' || facility.category === selectedCategory;
    const matchesSearch = facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      facility.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      facility.tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="page-facilities">
      {/* Header */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden', paddingBottom: '2.5rem' }}>
        <CourtBackground />
        <div className="container" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <span className="badge badge-olive" style={{ marginBottom: '1rem' }}>
            Destination Portfolio
          </span>
          <h1 style={{ marginBottom: '1rem' }}>
            Our <span className="text-olive">Facilities</span>
          </h1>
          <p style={{ maxWidth: '720px', margin: '0 auto', fontSize: '1.2rem', lineHeight: '1.6' }}>
            Built to international athletic standards. Explore our tournament turfs, high-speed practice lanes, skating track, and signature dining lounge.
          </p>

          {/* Filter & Search Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginTop: '2.5rem'
          }}>
            {/* Category Tabs */}
            <div className="tabs-container">
              {facilityCategories.map(cat => (
                <button
                  key={cat.id}
                  className={`tab-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Quick Search */}
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Search amenities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem', height: '42px', borderRadius: 'var(--radius-full)' }}
              />
              <Search 
                size={16} 
                className="text-muted" 
                style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} 
              />
            </div>
          </div>
        </div>
      </section>

      {/* Facilities Cards Grid */}
      <section className="section" style={{ paddingTop: '1rem' }}>
        <div className="container">
          {filteredFacilities.length > 0 ? (
            <div className="grid grid-3">
              {filteredFacilities.map(facility => (
                <FacilityCard key={facility.id} facility={facility} />
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)'
            }}>
              <p style={{ fontSize: '1.2rem', color: 'var(--brand-cream)' }}>
                No facilities matched your search criteria.
              </p>
              <button 
                onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                className="btn btn-outline btn-sm"
                style={{ marginTop: '1rem' }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Facility Specs Comparison Summary */}
      <section className="section" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <SectionHeading
            badge="Engineering Standards"
            title="The Turf &amp; Taste"
            highlight="Specification Guide"
            subtitle="Engineered for athletes, beginners, and spectators alike."
            center
          />

          <div style={{ overflowX: 'auto', marginTop: '2.5rem' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '1px solid var(--border-strong)',
              fontSize: '0.94rem'
            }}>
              <thead>
                <tr style={{ background: 'var(--brand-olive-dim)', borderBottom: '1px solid var(--border-strong)', textAlign: 'left' }}>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--brand-cream)' }}>Facility</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--brand-cream)' }}>Surface / Atmosphere</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--brand-cream)' }}>Indian Standards &amp; Regulations</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--brand-cream)' }}>Dimensions / Capacity</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--brand-cream)' }}>Lighting &amp; Features</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--brand-cream)' }}>Ideal For</th>
                </tr>
              </thead>
              <tbody>
                {facilitiesData.map((item, idx) => (
                  <tr 
                    key={item.id} 
                    style={{ 
                      borderBottom: idx === facilitiesData.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <td style={{ padding: '1.1rem 1.25rem', fontWeight: 600, color: 'var(--brand-cream)' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-secondary)' }}>
                      {item.specs.surface || item.specs.speedRange || item.specs.menuPillars || item.specs.beverages}
                    </td>
                    <td style={{ padding: '1.1rem 1.25rem', color: 'var(--brand-olive-bright)', fontWeight: 500 }}>
                      {item.specs.regulations || 'Compliant with Indian Athletic Facility Standards'}
                    </td>
                    <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-secondary)' }}>
                      {item.specs.dimensions || item.specs.seating || item.specs.location}
                    </td>
                    <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-secondary)' }}>
                      {item.specs.lighting || item.specs.ambience || item.specs.speed}
                    </td>
                    <td style={{ padding: '1.1rem 1.25rem', color: 'var(--brand-cream)' }}>
                      {item.suitableFor[0]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

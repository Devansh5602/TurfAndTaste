import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  DollarSign, 
  Sun, 
  Moon, 
  TrendingUp, 
  Save, 
  RefreshCw, 
  CheckCircle,
  Percent,
  Clock,
  Zap,
  Shield
} from 'lucide-react';

export default function PricingView({ showToast }) {
  const { can } = useAdminAuth();
  const [pricingList, setPricingList] = useState([]);
  const [timings, setTimings] = useState({
    arenaOpen: '06:00 AM',
    arenaClose: '06:00 AM',
    floodlightStart: '06:00 PM',
    slotIntervalMins: 60
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    setLoading(true);
    try {
      const [pricingRes, timingsRes] = await Promise.all([
        api.getPricing().catch(() => ({ pricing: [] })),
        api.getTimings().catch(() => ({ timings: {} }))
      ]);

      setPricingList(pricingRes?.pricing || []);
      if (timingsRes?.timings) {
        setTimings(timingsRes.timings);
      }
    } catch (err) {
      console.error('Failed to load pricing:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceFieldChange = (facilityId, field, value) => {
    setPricingList(prev => prev.map(item => {
      if (item.facilityId === facilityId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const res = await api.savePricing(pricingList);
      if (res?.success) {
        if (showToast) showToast('Pricing rates and tariffs published successfully!');
        await loadPricingData();
      } else {
        if (showToast) showToast(res?.error || 'Failed to save pricing.', 'error');
      }
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to save pricing.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
            Pricing & Tariffs Engine
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Dynamic multi-tier rates, floodlights & weekend surge
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={loadPricingData}
            className="admin-btn secondary"
            style={{ minHeight: '36px', padding: '6px 12px', fontSize: '0.78rem' }}
            disabled={loading || isSaving}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>

          {can('pricing.manage') && (
            <button
              id="btn-save-pricing"
              className="admin-btn"
              style={{ minHeight: '36px', padding: '6px 16px', fontSize: '0.82rem' }}
              onClick={handleSaveAll}
              disabled={isSaving}
            >
              <Save size={15} />
              <span>{isSaving ? 'Publishing...' : 'Save & Publish Rates'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Tariff Rules Banner */}
      <div className="admin-card" style={{ background: 'rgba(74, 222, 128, 0.05)', borderColor: 'rgba(74, 222, 128, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--brand-green, #4ADE80)', fontWeight: 700, fontSize: '0.9rem' }}>
          <Clock size={16} />
          <span>Floodlight Transition & Operations</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#CBD5E1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          <div>Floodlights Active: <strong>{timings.floodlightStart || '06:00 PM'} onwards</strong></div>
          <div>Sports Availability: <strong style={{ color: 'var(--brand-green, #4ADE80)' }}>24/7 Continuous</strong></div>
          <div>Extension Rate: <strong>Pro-rated 15m increments</strong></div>
        </div>
      </div>

      {/* Facility Pricing Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {pricingList.map((tier) => (
          <div key={tier.facilityId} className="admin-card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
                  {tier.facilityName || tier.facilityId}
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                  Resource ID: {tier.facilityId}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '4px' }}>
                  <Sun size={13} color="#FBBF24" />
                  <span>Day Rate / Hour</span>
                </label>
                <input
                  id={`pricing-day-${tier.facilityId}`}
                  type="text"
                  className="admin-input"
                  value={tier.dayRate}
                  onChange={(e) => handlePriceFieldChange(tier.facilityId, 'dayRate', e.target.value)}
                  disabled={!can('pricing.manage')}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '4px' }}>
                  <Moon size={13} color="#818CF8" />
                  <span>Night / Floodlit Rate</span>
                </label>
                <input
                  id={`pricing-night-${tier.facilityId}`}
                  type="text"
                  className="admin-input"
                  value={tier.nightRate}
                  onChange={(e) => handlePriceFieldChange(tier.facilityId, 'nightRate', e.target.value)}
                  disabled={!can('pricing.manage')}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '4px' }}>
                  <Percent size={13} color="var(--brand-orange, #F97316)" />
                  <span>Weekend Surge (%)</span>
                </label>
                <input
                  id={`pricing-surge-${tier.facilityId}`}
                  type="number"
                  className="admin-input"
                  min="0"
                  max="100"
                  value={tier.weekendSurge || 15}
                  onChange={(e) => handlePriceFieldChange(tier.facilityId, 'weekendSurge', Number(e.target.value))}
                  disabled={!can('pricing.manage')}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '4px' }}>
                  <DollarSign size={13} color="var(--brand-green, #4ADE80)" />
                  <span>Token Deposit Amount</span>
                </label>
                <input
                  id={`pricing-deposit-${tier.facilityId}`}
                  type="text"
                  className="admin-input"
                  value={tier.bookingDeposit}
                  onChange={(e) => handlePriceFieldChange(tier.facilityId, 'bookingDeposit', e.target.value)}
                  disabled={!can('pricing.manage')}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

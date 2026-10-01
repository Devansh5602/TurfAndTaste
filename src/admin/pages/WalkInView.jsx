import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { 
  UserPlus, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export default function WalkInView({ onNavigate, showToast }) {
  const { admin } = useAdminAuth();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [serverQuote, setServerQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [successBooking, setSuccessBooking] = useState(null);

  // Walk-In Form State
  const todayStr = new Date().toISOString().slice(0, 10);
  const [formData, setFormData] = useState({
    facilityId: 'fac_box_cricket_1',
    date: todayStr,
    bookingMode: 'quick', // 'quick' | 'custom'
    quickDuration: 1, // 1 | 2
    customStartHour: '18',
    customStartMinute: '00',
    customPeriod: 'PM',
    customDurationHours: 1,
    shootingMachine: false,
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    teamName: '',
    paymentType: 'full', // 'full' | 'deposit'
    errorMessage: ''
  });

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const res = await api.getPhysicalFacilities();
        if (res?.success && res.facilities?.length > 0) {
          setFacilities(res.facilities);
        }
      } catch (err) {
        console.error('Failed to load facilities:', err);
      }
    };
    fetchFacilities();
  }, []);


  // Helper to format 12-hour time string
  const getSelectedSlot = () => {
    if (formData.bookingMode === 'quick') {
      const now = new Date();
      const currentHour = now.getHours();
      const startH = (currentHour + 1) % 24;
      const endH = (startH + formData.quickDuration) % 24;

      const formatH = (h) => {
        const p = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return `${String(displayH).padStart(2, '0')}:00 ${p}`;
      };

      return `${formatH(startH)} – ${formatH(endH)}`;
    }

    // Custom whole-hour slot
    let h = parseInt(formData.customStartHour, 10);
    if (formData.customPeriod === 'PM' && h < 12) h += 12;
    if (formData.customPeriod === 'AM' && h === 12) h = 0;

    const startMins = h * 60 + parseInt(formData.customStartMinute, 10);
    const endMins = startMins + formData.customDurationHours * 60;

    const formatMins = (m) => {
      const norm = m % 1440;
      const hour = Math.floor(norm / 60);
      const mins = norm % 60;
      const p = hour >= 12 ? 'PM' : 'AM';
      const displayH = hour % 12 || 12;
      return `${String(displayH).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${p}`;
    };

    return `${formatMins(startMins)} – ${formatMins(endMins)}`;
  };

  // Check if booking is within 1-hour lead time (requires full payment)
  const isWithinOneHour = () => {
    try {
      const slot = getSelectedSlot();
      const firstPart = slot.split(/[–—-]/)[0].trim();
      const match = firstPart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!match) return false;
      let h = Number(match[1]);
      const m = Number(match[2]);
      if (match[3].toUpperCase() === 'PM' && h < 12) h += 12;
      if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;

      const slotDate = new Date(`${formData.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      const diffMinutes = (slotDate.getTime() - Date.now()) / 60000;
      return diffMinutes <= 60;
    } catch {
      return false;
    }
  };

  // Auto-fetch server-authoritative pricing quote when booking details change
  useEffect(() => {
    const slot = getSelectedSlot();
    const duration = formData.bookingMode === 'quick' ? formData.quickDuration : formData.customDurationHours;
    if (!formData.facilityId || !formData.date || !slot) return;

    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);

    api.getAdminWalkInQuote({
      facilityId: formData.facilityId,
      date: formData.date,
      timeSlot: slot,
      durationHours: duration,
      paymentType: within1h ? 'full' : formData.paymentType,
    }).then((res) => {
      if (cancelled) return;
      if (res?.success && res.quote) {
        setServerQuote(res.quote);
      } else {
        setQuoteError(res?.error || 'Unable to resolve pricing.');
      }
    }).catch((err) => {
      if (!cancelled) setQuoteError(err.message);
    }).finally(() => {
      if (!cancelled) setQuoteLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.facilityId, formData.date, formData.bookingMode, formData.quickDuration,
      formData.customStartHour, formData.customStartMinute, formData.customPeriod,
      formData.customDurationHours, formData.paymentType]);

  const within1h = isWithinOneHour();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      errorMessage: ''
    }));
  };

  const handleCreateWalkIn = async (e) => {
    e.preventDefault();
    if (!formData.customerName.trim() || formData.customerName.trim().length < 2) {
      setFormData(prev => ({ ...prev, errorMessage: 'Customer name is required (minimum 2 characters).' }));
      return;
    }

    const cleanPhone = formData.customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormData(prev => ({ ...prev, errorMessage: 'A valid 10-digit mobile number is required.' }));
      return;
    }

    const selectedSlot = getSelectedSlot();
    const duration = formData.bookingMode === 'quick' ? formData.quickDuration : formData.customDurationHours;
    const addOnIds = (formData.facilityId === 'fac_green_net_1' && formData.shootingMachine) ? ['addon_shooting_machine'] : [];

    // Payment type policy enforcement: inside 1 hour requires full payment
    const effectivePaymentType = within1h ? 'full' : formData.paymentType;

    const payload = {
      facilityId: formData.facilityId,
      physicalFacilityId: formData.facilityId,
      date: formData.date,
      time: selectedSlot,
      timeSlot: selectedSlot,
      duration,
      bookingType: formData.bookingMode === 'quick' ? 'STANDARD_QUICK' : 'CUSTOM_HOURLY',
      customerName: formData.customerName.trim(),
      customerPhone: cleanPhone,
      customerEmail: formData.customerEmail.trim() || 'walkin@turfandtaste.in',
      teamName: formData.teamName.trim() || 'Counter Walk-In',
      addOnIds,
      paymentType: effectivePaymentType,
      // Server resolves the authoritative amount — do NOT send client-calculated amounts
      paymentStatus: 'Paid',
      paymentId: 'counter-cash-upi'
    };

    setLoading(true);
    try {
      const res = await api.createBooking(payload);
      if (res?.success) {
        setSuccessBooking(res.booking || { id: res.bookingReference, ...payload });
        if (showToast) showToast(`Walk-in reservation ${res.bookingReference || res.booking?.id} created successfully!`);
      } else {
        setFormData(prev => ({ ...prev, errorMessage: res?.error || 'Walk-in creation failed.' }));
      }
    } catch (err) {
      setFormData(prev => ({ ...prev, errorMessage: err.message || 'Unable to complete walk-in reservation.' }));
    } finally {
      setLoading(false);
    }
  };

  if (successBooking) {
    return (
      <div className="admin-card" style={{ maxWidth: '500px', margin: '20px auto', textAlign: 'center', padding: '28px 20px' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(74, 222, 128, 0.15)',
          border: '2px solid var(--brand-green, #4ADE80)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--admin-forest, #0F3D2E)',
          marginBottom: '14px'
        }}>
          <CheckCircle size={32} />
        </div>

        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--admin-text-main, #1A1C1A)' }}>
          Walk-In Confirmed!
        </h2>
        <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '16px' }}>
          Counter reservation created on canonical booking engine.
        </div>

        <div style={{ background: 'var(--admin-surface-subtle, #F3F1ED)', border: '1px solid var(--admin-border, #EAE8E4)', borderRadius: '12px', padding: '14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted, #5A645E)' }}>Booking Reference</span>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--admin-forest, #0F3D2E)', fontSize: '1.1rem' }}>
              {successBooking.id}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.82rem' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted, #5A645E)' }}>Player Name</span>
              <div style={{ color: 'var(--admin-text-main, #1A1C1A)', fontWeight: 600 }}>{successBooking.customerName}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted, #5A645E)' }}>Phone</span>
              <div style={{ color: 'var(--admin-text-main, #1A1C1A)' }}>{successBooking.customerPhone}</div>
            </div>
          </div>
          <div style={{ fontSize: '0.82rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted, #5A645E)' }}>Time & Facility</span>
            <div style={{ color: 'var(--admin-text-main, #1A1C1A)' }}>{successBooking.facilityName || successBooking.facilityId} • {successBooking.date} • {successBooking.time}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            id="btn-goto-sessions"
            className="admin-btn"
            onClick={() => onNavigate('sessions')}
          >
            <span>Proceed to Ground Check-In</span>
            <ArrowRight size={16} />
          </button>
          <button
            className="admin-btn secondary"
            onClick={() => {
              setSuccessBooking(null);
              setFormData(prev => ({
                ...prev,
                customerName: '',
                customerPhone: '',
                customerEmail: '',
                teamName: '',
                errorMessage: ''
              }));
            }}
          >
            Create Another Walk-In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--admin-text-main, #1A1C1A)' }}>
          Walk-In Counter Booking
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)' }}>
          Instant reservation for counter players in Patan
        </span>
      </div>

      {formData.errorMessage && (
        <div style={{
          background: 'var(--admin-danger-bg, #FCE8E6)',
          border: '1px solid rgba(186, 26, 26, 0.25)',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '16px',
          color: 'var(--admin-danger, #BA1A1A)',
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{formData.errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleCreateWalkIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Step 1: Select Facility */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>1. Select Physical Resource</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
            {[
              { id: 'fac_box_cricket_1', label: 'Turf 1', type: 'Box Cricket' },
              { id: 'fac_box_cricket_2', label: 'Turf 2', type: 'Box Cricket' },
              { id: 'fac_pickleball_1', label: 'Court 1', type: 'Pickleball' },
              { id: 'fac_pickleball_2', label: 'Court 2', type: 'Pickleball' },
              { id: 'fac_skating_1', label: 'Skating Rink', type: 'Skating' },
              { id: 'fac_green_net_1', label: 'Green Net', type: 'Cricket Net' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                id={`walkin-select-${f.id}`}
                className={`admin-chip ${formData.facilityId === f.id ? 'active' : ''}`}
                style={{ borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: 'auto' }}
                onClick={() => handleInputChange('facilityId', f.id)}
              >
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{f.label}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{f.type}</span>
              </button>
            ))}
          </div>

          {/* Add-On checkbox on Cricket Green Net */}
          {formData.facilityId === 'fac_green_net_1' && (
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              background: 'rgba(217, 119, 6, 0.08)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              color: 'var(--admin-text-main, #1A1C1A)'
            }}>
              <input
                id="walkin-shooting-machine-toggle"
                type="checkbox"
                checked={formData.shootingMachine}
                onChange={(e) => handleInputChange('shootingMachine', e.target.checked)}
              />
              <div>
                <strong>Attach Ball-Shooting Machine Add-On</strong>
                <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted, #5A645E)' }}>
                  Occupies the same Green Net resource with automated bowling machine active
                </div>
              </div>
            </label>
          )}
        </div>

        {/* Step 2: Date and Duration */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>2. Scheduled Date & Duration</h2>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px' }}>Date</label>
              <input
                id="walkin-date"
                type="date"
                className="admin-input"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
              />
            </div>

            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px' }}>Duration Mode</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  id="walkin-mode-quick"
                  className={`admin-chip ${formData.bookingMode === 'quick' ? 'active' : ''}`}
                  onClick={() => handleInputChange('bookingMode', 'quick')}
                >
                  Quick Slot
                </button>
                <button
                  type="button"
                  id="walkin-mode-custom"
                  className={`admin-chip ${formData.bookingMode === 'custom' ? 'active' : ''}`}
                  onClick={() => handleInputChange('bookingMode', 'custom')}
                >
                  Custom Start
                </button>
              </div>
            </div>
          </div>

          {formData.bookingMode === 'quick' ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '6px' }}>
                Quick Duration (Strictly 1h or 2h)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2].map(hours => (
                  <button
                    key={hours}
                    type="button"
                    id={`walkin-quick-dur-${hours}`}
                    className={`admin-chip ${formData.quickDuration === hours ? 'active' : ''}`}
                    style={{ flex: 1, padding: '10px', textAlign: 'center' }}
                    onClick={() => handleInputChange('quickDuration', hours)}
                  >
                    {hours} Hour{hours > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)' }}>
                Custom Start Time (:00, :15, :30, :45) & Whole-Hour Duration
              </label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select
                  id="walkin-custom-hour"
                  className="admin-select"
                  value={formData.customStartHour}
                  onChange={(e) => handleInputChange('customStartHour', e.target.value)}
                >
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span style={{ fontWeight: 800 }}>:</span>
                <select
                  id="walkin-custom-minute"
                  className="admin-select"
                  value={formData.customStartMinute}
                  onChange={(e) => handleInputChange('customStartMinute', e.target.value)}
                >
                  {['00', '15', '30', '45'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  id="walkin-custom-period"
                  className="admin-select"
                  value={formData.customPeriod}
                  onChange={(e) => handleInputChange('customPeriod', e.target.value)}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
                <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted, #5A645E)', margin: '0 4px' }}>for</span>
                <select
                  id="walkin-custom-duration"
                  className="admin-select"
                  value={formData.customDurationHours}
                  onChange={(e) => handleInputChange('customDurationHours', Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map(dh => (
                    <option key={dh} value={dh}>{dh} Hour{dh > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div style={{ marginTop: '12px', padding: '10px', background: 'var(--admin-surface-subtle, #F3F1ED)', border: '1px solid var(--admin-border, #EAE8E4)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--admin-text-main, #1A1C1A)' }}>
            <span style={{ color: 'var(--admin-text-muted, #5A645E)' }}>Calculated Interval:</span> <strong>{getSelectedSlot()}</strong>
          </div>
        </div>

        {/* Step 3: Customer Details */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>3. Customer Details</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px', fontWeight: 600 }}>
                Player Full Name *
              </label>
              <input
                id="walkin-customer-name"
                type="text"
                className="admin-input"
                placeholder="e.g. Rahul Patel"
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px', fontWeight: 600 }}>
                  Mobile Number (10 digits) *
                </label>
                <input
                  id="walkin-customer-phone"
                  type="tel"
                  className="admin-input"
                  placeholder="9876543210"
                  value={formData.customerPhone}
                  onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '4px' }}>
                  Team / Group Name
                </label>
                <input
                  id="walkin-team-name"
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Patan Strikers"
                  value={formData.teamName}
                  onChange={(e) => handleInputChange('teamName', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Payment Policy Calculation */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>4. Payment Policy & Collection</h2>
          </div>

          {within1h ? (
            <div style={{ background: 'var(--admin-warning-bg, #FEF3C7)', border: '1px solid rgba(180, 83, 9, 0.25)', borderRadius: '8px', padding: '10px', fontSize: '0.82rem', color: 'var(--admin-warning, #B45309)', marginBottom: '12px' }}>
              <strong>Immediate / Within 1-Hour Start:</strong> Under platform policy, bookings scheduled inside the 1-hour threshold require <strong>FULL PAYMENT</strong> at counter.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                id="walkin-pay-full"
                className={`admin-chip ${formData.paymentType === 'full' ? 'active' : ''}`}
                style={{ flex: 1, padding: '8px', textAlign: 'center' }}
                onClick={() => handleInputChange('paymentType', 'full')}
              >
                Full Payment
              </button>
              <button
                type="button"
                id="walkin-pay-deposit"
                className={`admin-chip ${formData.paymentType === 'deposit' ? 'active' : ''}`}
                style={{ flex: 1, padding: '8px', textAlign: 'center' }}
                onClick={() => handleInputChange('paymentType', 'deposit')}
              >
                Token Deposit
              </button>
            </div>
          )}

          {quoteLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)', padding: '4px 0' }}>
              <RefreshCw size={12} className="spin" />
              <span>Recalculating server pricing…</span>
            </div>
          )}
          {quoteError && !quoteLoading && (
            <div style={{ fontSize: '0.82rem', color: 'var(--admin-danger, #BA1A1A)', padding: '6px 10px', background: 'var(--admin-danger-bg, #FCE8E6)', borderRadius: '6px', marginBottom: '8px' }}>
              Pricing error: {quoteError}
            </div>
          )}
          {serverQuote && (() => {
            const effectivePaymentType = within1h ? 'full' : formData.paymentType;
            const charged = effectivePaymentType === 'full' ? serverQuote.totalAmountPaise : serverQuote.depositAmountPaise;
            return (
              <div style={{ position: 'relative', background: 'rgba(15, 61, 46, 0.06)', border: '1px solid rgba(15, 61, 46, 0.18)', borderRadius: '8px', padding: '12px', fontSize: '0.82rem', marginBottom: '8px', opacity: quoteLoading ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
                {quoteLoading && (
                  <div style={{ position: 'absolute', top: '6px', right: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--admin-text-muted, #5A645E)' }}>
                    <RefreshCw size={10} className="spin" />
                    <span>Updating</span>
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted, #5A645E)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Server-Resolved Quote</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                  <div>
                    <span style={{ color: 'var(--admin-text-muted, #5A645E)', fontSize: '0.72rem' }}>Session Type</span>
                    <div style={{ fontWeight: 600, color: 'var(--admin-text-main, #1A1C1A)' }}>{serverQuote.isNight ? 'Floodlit (Night)' : 'Day Session'}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--admin-text-muted, #5A645E)', fontSize: '0.72rem' }}>Rate / Hour</span>
                    <div style={{ fontWeight: 600, color: 'var(--admin-text-main, #1A1C1A)' }}>&#8377;{serverQuote.surgedRatePer1h}</div>
                  </div>
                  {serverQuote.isWeekend && (
                    <div>
                      <span style={{ color: 'var(--admin-text-muted, #5A645E)', fontSize: '0.72rem' }}>Weekend Surge</span>
                      <div style={{ fontWeight: 600, color: 'var(--admin-warning, #B45309)' }}>+{serverQuote.weekendSurgePercent}%</div>
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--admin-text-muted, #5A645E)', fontSize: '0.72rem' }}>Duration</span>
                    <div style={{ fontWeight: 600, color: 'var(--admin-text-main, #1A1C1A)' }}>{serverQuote.durationHours}h</div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--admin-border, #EAE8E4)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted, #5A645E)' }}>
                    {effectivePaymentType === 'full' ? 'Total to Collect' : 'Deposit to Collect'}
                  </span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--admin-forest, #0F3D2E)' }}>&#8377;{(charged / 100).toFixed(0)}</strong>
                </div>
              </div>
            );
          })()}

          <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-main, #1A1C1A)', display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--admin-border, #EAE8E4)' }}>
            <span>Counter Collection Mode:</span>
            <strong>Cash / Ground UPI Scanner</strong>
          </div>
        </div>

        <button
          id="btn-submit-walkin"
          type="submit"
          className="admin-btn"
          disabled={loading || quoteLoading}
          style={{ height: '50px', fontSize: '0.95rem' }}
        >
          <Sparkles size={18} />
          <span>{loading ? 'Submitting to Booking Engine...' : quoteLoading ? 'Confirming Pricing...' : 'Confirm Walk-In Reservation'}</span>
        </button>
      </form>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../context/RouterContext';
import { facilitiesData } from '../data/facilitiesData';
import { generateTimeSlots, submitBookingReservation } from '../services/bookingService';
import CourtBackground from '../components/CourtBackground';
import SectionHeading from '../components/SectionHeading';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  CreditCard, 
  Sparkles, 
  X, 
  Printer, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';

export default function Booking() {
  const { queryParams } = useRouter();
  const preselectedFacility = queryParams.get('facility');

  // Booking State
  const [selectedFacility, setSelectedFacility] = useState(
    preselectedFacility || 'box-cricket'
  );

  // Next 14 days generation
  const today = new Date();
  const datesList = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() + i);
    return {
      iso: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNum: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' })
    };
  });

  const [selectedDate, setSelectedDate] = useState(datesList[0].iso);
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [paymentType, setPaymentType] = useState('deposit'); // 'deposit' or 'full'

  // Customer Details Form
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    teamName: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);

  const dateScrollRef = useRef(null);

  const scrollDates = (direction) => {
    if (dateScrollRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      dateScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Time slots generated based on facility and date
  const slots = generateTimeSlots(selectedFacility, selectedDate);

  // Reset selected slot if facility or date changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedFacility, selectedDate]);

  // Sync with URL query parameter
  useEffect(() => {
    if (preselectedFacility) {
      setSelectedFacility(preselectedFacility);
    }
  }, [preselectedFacility]);

  const currentFacilityData = facilitiesData.find(f => f.slug === selectedFacility) || facilitiesData[0];

  const validateForm = () => {
    const errs = {};
    if (!selectedSlot) errs.slot = 'Please select an available time slot.';
    if (!customer.name.trim()) errs.name = 'Full name is required.';
    if (!customer.phone.trim()) {
      errs.phone = 'Mobile phone number is required.';
    } else if (!/^[6-9]\d{9}$/.test(customer.phone.replace(/\s+/g, ''))) {
      errs.phone = 'Please enter a valid 10-digit Indian phone number.';
    }
    if (!customer.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(customer.email)) {
      errs.email = 'Please enter a valid email address.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        facility: currentFacilityData.name,
        facilitySlug: selectedFacility,
        date: selectedDate,
        duration: `${selectedDuration} Hour(s)`,
        slot: selectedSlot.time,
        paymentType,
        customer
      };

      const result = await submitBookingReservation(payload);
      setConfirmationData(result);
    } catch (err) {
      alert('Booking reservation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-booking">
      {/* Header */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden', paddingBottom: '2.5rem' }}>
        <CourtBackground />
        <div className="container" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <span className="badge badge-orange" style={{ marginBottom: '1rem' }}>
            Phase 1 Engine Preview
          </span>
          <h1 style={{ marginBottom: '1rem' }}>
            Book Your <span className="text-olive">Slot</span>
          </h1>
          <p style={{ maxWidth: '680px', margin: '0 auto', fontSize: '1.2rem', lineHeight: '1.6' }}>
            Select your sport, choose an available session, and test our streamlined reservation engine.
          </p>

          {/* Phase 1 Notice Banner */}
          <div style={{
            maxWidth: '680px',
            margin: '1.5rem auto 0',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.88rem',
            color: 'var(--brand-cream-muted)',
            textAlign: 'left'
          }}>
            <Info size={18} className="text-orange" style={{ flexShrink: 0 }} />
            <span>
              <strong>Grand Opening Preview:</strong> Live payments and real-time slot locks are currently running in interactive test mode. Your preview reservation gives you priority notification upon venue launch.
            </span>
          </div>
        </div>
      </section>

      {/* Interactive Booking Wizard */}
      <section className="section" style={{ paddingTop: '1rem' }}>
        <div className="container">
          <form onSubmit={handleBookingSubmit}>
            <div className="booking-wizard-layout">
              {/* Left Column: Step Controls */}
              <div className="booking-steps-column">
                {/* STEP 1: Select Facility */}
                <div className="card-arena">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                    <div className="step-circle" style={{ width: '32px', height: '32px', fontSize: '1.1rem', margin: 0 }}>1</div>
                    <h3 style={{ fontSize: '1.4rem', margin: 0 }}>Select Facility</h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.85rem' }}>
                    {facilitiesData.filter(f => f.category !== 'dining').map(f => (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => setSelectedFacility(f.slug)}
                        style={{
                          background: selectedFacility === f.slug ? 'var(--brand-olive-dim)' : 'var(--bg-surface-elevated)',
                          border: `1px solid ${selectedFacility === f.slug ? 'var(--brand-olive)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <div style={{ fontWeight: 600, color: selectedFacility === f.slug ? 'var(--brand-cream)' : 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                          {f.name}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--brand-olive-bright)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {f.tag}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* STEP 2: Select Date */}
                <div className="card-arena">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div className="step-circle" style={{ width: '32px', height: '32px', fontSize: '1.1rem', margin: 0 }}>2</div>
                      <h3 style={{ fontSize: '1.4rem', margin: 0 }}>Select Date (Next 14 Days)</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => scrollDates('left')}
                        className="date-nav-btn"
                        title="Scroll dates left"
                        aria-label="Scroll dates left"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollDates('right')}
                        className="date-nav-btn"
                        title="Scroll dates right"
                        aria-label="Scroll dates right"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="date-picker-container">
                    <div ref={dateScrollRef} className="date-picker-scroll">
                      {datesList.map((item) => (
                        <button
                          type="button"
                          key={item.iso}
                          className="date-pill-btn"
                          onClick={() => setSelectedDate(item.iso)}
                          style={{
                            flexShrink: 0,
                            padding: '0.85rem 0.75rem',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${selectedDate === item.iso ? 'var(--brand-olive-bright)' : 'var(--border-subtle)'}`,
                            background: selectedDate === item.iso ? 'var(--brand-olive)' : 'var(--bg-surface-elevated)',
                            color: selectedDate === item.iso ? '#ffffff' : 'var(--text-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer',
                            boxShadow: selectedDate === item.iso ? 'var(--glow-olive)' : 'none',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', opacity: 0.85 }}>{item.dayName}</span>
                          <span style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0.2rem 0' }}>{item.dateNum}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{item.month}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* STEP 3: Select Duration & Time Slot */}
                <div className="card-arena">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div className="step-circle" style={{ width: '32px', height: '32px', fontSize: '1.1rem', margin: 0 }}>3</div>
                      <h3 style={{ fontSize: '1.4rem', margin: 0 }}>Select Duration &amp; Time Slot</h3>
                    </div>

                    {/* Duration Pills */}
                    <div className="tabs-container" style={{ padding: '0.2rem' }}>
                      {[1, 2, 3].map(hrs => (
                        <button
                          type="button"
                          key={hrs}
                          className={`tab-btn ${selectedDuration === hrs ? 'active' : ''}`}
                          onClick={() => setSelectedDuration(hrs)}
                          style={{ padding: '0.35rem 0.9rem', fontSize: '0.82rem' }}
                        >
                          {hrs} Hour{hrs > 1 ? 's' : ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  {errors.slot && (
                    <div className="form-error" style={{ marginBottom: '1rem' }}>
                      <AlertCircle size={15} /> {errors.slot}
                    </div>
                  )}

                  {/* Slots Grid */}
                  <div className="slots-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    {slots.map((slot, idx) => {
                      const isSelected = selectedSlot?.time === slot.time;
                      const isBooked = slot.status === 'booked';
                      const isFast = slot.status === 'fast-filling';

                      return (
                        <button
                          type="button"
                          key={idx}
                          disabled={isBooked}
                          className={`slot-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedSlot(slot);
                            setErrors(prev => ({ ...prev, slot: null }));
                          }}
                          style={{
                            padding: '0.85rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${isSelected ? 'var(--brand-olive-bright)' : isBooked ? 'var(--border-subtle)' : 'var(--border-subtle)'}`,
                            background: isSelected 
                              ? 'var(--brand-olive-dim)' 
                              : isBooked 
                              ? 'rgba(0,0,0,0.2)' 
                              : 'var(--bg-surface-elevated)',
                            opacity: isBooked ? 0.45 : 1,
                            cursor: isBooked ? 'not-allowed' : 'pointer',
                            textAlign: 'left',
                            position: 'relative',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.72rem', color: slot.peak ? 'var(--brand-orange)' : 'var(--brand-olive-bright)', fontWeight: 600, textTransform: 'uppercase' }}>
                              {slot.category}
                            </span>
                            <span style={{ 
                              fontSize: '0.68rem', 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              background: isBooked ? '#ff525222' : isFast ? '#ff980022' : '#4caf5022',
                              color: isBooked ? '#ff5252' : isFast ? 'var(--brand-orange)' : '#4caf50',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}>
                              {slot.status}
                            </span>
                          </div>

                          <div className="slot-time" style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--brand-cream)' : 'var(--text-primary)' }}>
                            {slot.time}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 4: Customer Details Form */}
                <div className="card-arena">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                    <div className="step-circle" style={{ width: '32px', height: '32px', fontSize: '1.1rem', margin: 0 }}>4</div>
                    <h3 style={{ fontSize: '1.4rem', margin: 0 }}>Player &amp; Squad Details</h3>
                  </div>

                  <div className="grid grid-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">
                        Full Name <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={customer.name}
                        onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                        className={`form-input ${errors.name ? 'error' : ''}`}
                      />
                      {errors.name && <span className="form-error"><AlertCircle size={14} />{errors.name}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Phone Number (WhatsApp) <span className="required">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="10-digit mobile (e.g. 9876543210)"
                        value={customer.phone}
                        onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                        className={`form-input ${errors.phone ? 'error' : ''}`}
                      />
                      {errors.phone && <span className="form-error"><AlertCircle size={14} />{errors.phone}</span>}
                    </div>
                  </div>

                  <div className="grid grid-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">
                        Email Address <span className="required">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. rahul@example.com"
                        value={customer.email}
                        onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                        className={`form-input ${errors.email ? 'error' : ''}`}
                      />
                      {errors.email && <span className="form-error"><AlertCircle size={14} />{errors.email}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Team / Group Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Patan Super Kings"
                        value={customer.teamName}
                        onChange={(e) => setCustomer({ ...customer, teamName: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      Special Requests / Gear Rental Notes
                    </label>
                    <textarea
                      rows="2"
                      placeholder="Any specific bats, balls, or arrival requests..."
                      value={customer.notes}
                      onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                      className="form-textarea"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Booking Summary & Payment Choice */}
              <div className="booking-summary-column">
                <div className="card-arena highlight booking-summary-sticky">
                  <h3 style={{ fontSize: '1.45rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                    Booking Summary
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.92rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Facility:</span>
                      <strong style={{ color: 'var(--brand-cream)' }}>{currentFacilityData.name}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Date:</span>
                      <strong style={{ color: 'var(--brand-cream)' }}>{selectedDate}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Duration:</span>
                      <strong style={{ color: 'var(--brand-cream)' }}>{selectedDuration} Hour(s)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Slot Time:</span>
                      <strong style={{ color: selectedSlot ? 'var(--brand-olive-bright)' : 'var(--brand-orange)' }}>
                        {selectedSlot ? selectedSlot.time : 'Not Selected Yet'}
                      </strong>
                    </div>
                  </div>

                  {/* Payment Choice Selection */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--brand-cream-muted)', display: 'block', marginBottom: '0.75rem' }}>
                      Payment Preference:
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <label 
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          background: paymentType === 'deposit' ? 'var(--brand-olive-dim)' : 'var(--bg-surface-elevated)',
                          border: `1px solid ${paymentType === 'deposit' ? 'var(--brand-olive)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-md)',
                          padding: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="radio"
                          name="paymentType"
                          value="deposit"
                          checked={paymentType === 'deposit'}
                          onChange={() => setPaymentType('deposit')}
                          style={{ marginTop: '3px' }}
                        />
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--brand-cream)' }}>
                            Token Booking Amount
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Pay token amount now; settle balance at reception.
                          </span>
                        </div>
                      </label>

                      <label 
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          background: paymentType === 'full' ? 'var(--brand-olive-dim)' : 'var(--bg-surface-elevated)',
                          border: `1px solid ${paymentType === 'full' ? 'var(--brand-olive)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-md)',
                          padding: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="radio"
                          name="paymentType"
                          value="full"
                          checked={paymentType === 'full'}
                          onChange={() => setPaymentType('full')}
                          style={{ marginTop: '3px' }}
                        />
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--brand-cream)' }}>
                            100% Full Payment
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Complete payment for express game-day entry pass.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Price breakdown */}
                  <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Hourly Rate:</span>
                      <span>{currentFacilityData.pricing.standardRate.split('(')[0]}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.6rem', fontWeight: 700 }}>
                      <span style={{ color: 'var(--brand-cream)' }}>Payable Now ({paymentType === 'deposit' ? 'Token Deposit' : 'Full Amount'}):</span>
                      <span style={{ color: 'var(--brand-orange)', fontSize: '1.1rem' }}>₹___</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary btn-block btn-lg"
                  >
                    {isSubmitting ? (
                      'Processing Preview...'
                    ) : (
                      <>
                        <CreditCard size={18} /> Confirm Demo Reservation
                      </>
                    )}
                  </button>

                  <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <ShieldCheck size={16} className="text-olive" />
                    <span>Instant priority reservation recorded for grand opening.</span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Confirmation Modal */}
      {confirmationData && (
        <div className="modal-overlay" onClick={() => setConfirmationData(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close-btn" 
              onClick={() => setConfirmationData(null)}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--brand-olive-dim)',
                border: '2px solid var(--brand-olive)',
                color: 'var(--brand-olive-bright)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <CheckCircle2 size={36} />
              </div>
              <span className="badge badge-orange" style={{ marginBottom: '0.5rem' }}>
                Preview Reservation Saved
              </span>
              <h2 style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>
                See You on the Field!
              </h2>
              <p style={{ fontSize: '0.95rem' }}>
                Your priority booking preview code: <strong style={{ color: 'var(--brand-cream)' }}>{confirmationData.bookingReference}</strong>
              </p>
            </div>

            {/* Ticket Card */}
            <div style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px dashed var(--brand-olive-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              fontSize: '0.92rem'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>FACILITY</span>
                  <div style={{ fontWeight: 600, color: 'var(--brand-cream)' }}>{confirmationData.details.facility}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>GAME DATE</span>
                  <div style={{ fontWeight: 600, color: 'var(--brand-cream)' }}>{confirmationData.details.date}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SLOT TIME</span>
                  <div style={{ fontWeight: 600, color: 'var(--brand-olive-bright)' }}>{confirmationData.details.slot}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>PAYMENT MODE</span>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{confirmationData.details.paymentType} Option</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>PLAYER NAME &amp; PHONE</span>
                <div style={{ fontWeight: 600, color: 'var(--brand-cream)' }}>
                  {confirmationData.details.customer.name} ({confirmationData.details.customer.phone})
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(232, 103, 38, 0.1)',
              border: '1px solid rgba(232, 103, 38, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              fontSize: '0.82rem',
              color: 'var(--brand-cream-muted)',
              marginBottom: '1.5rem',
              display: 'flex',
              gap: '0.5rem'
            }}>
              <Info size={16} className="text-orange" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Grand Opening Notice:</strong> This is an interactive Phase 1 demonstration. No payment has been debited. When our doors officially open, your registration guarantees priority slot notification.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.85rem' }}>
              <button 
                onClick={() => window.print()} 
                className="btn btn-outline btn-block"
              >
                <Printer size={16} /> Print Voucher
              </button>
              <button 
                onClick={() => setConfirmationData(null)} 
                className="btn btn-primary btn-block"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

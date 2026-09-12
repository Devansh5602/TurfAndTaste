import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../context/RouterContext';
import { facilitiesData } from '../data/facilitiesData';
import { generateTimeSlots, submitBookingReservation } from '../services/bookingService';
import { adminStore } from '../services/adminStore';
import { 
  initializePaymentOrder, 
  openRazorpayCheckout, 
  verifyPaymentSignature,
  confirmDirectUpiPayment
} from '../services/paymentService';
import CourtBackground from '../components/CourtBackground';
import SectionHeading from '../components/SectionHeading';
import ConfirmationModal from '../components/ConfirmationModal';
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
  Info,
  Sun,
  Moon,
  Check,
  Trophy,
  User,
  Edit3,
  Home,
  QrCode,
  Smartphone,
  Copy,
  Zap
} from 'lucide-react';

export default function Booking() {
  const { navigate, queryParams } = useRouter();
  const preselectedFacility = queryParams.get('facility');

  // Multi-step Stepper state (1: Arena, 2: Date & Slot, 3: Squad Details, 4: Summary & Pay)
  const [currentStep, setCurrentStep] = useState(1);
  const wizardRef = useRef(null);

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
      dayNum: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' })
    };
  });

  const [selectedDate, setSelectedDate] = useState(datesList[0].iso);
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [paymentType, setPaymentType] = useState('deposit'); // 'deposit' or 'full'
  const [activeSessionTab, setActiveSessionTab] = useState('all'); // 'all', 'day', or 'night'

  // Customer Details Form
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    teamName: '',
    notes: '',
    gearRental: false,
    whatsappUpdates: true,
    agreedRules: true
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreConfirmModal, setShowPreConfirmModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [bookingErrorMessage, setBookingErrorMessage] = useState('');

  // Payment Gateway Selection: 'upi' or 'razorpay'
  const [selectedPaymentGateway, setSelectedPaymentGateway] = useState('upi');
  const [upiUtrInput, setUpiUtrInput] = useState('');
  const [isCopiedUpi, setIsCopiedUpi] = useState(false);

  const handleCopyUpi = () => {
    navigator.clipboard?.writeText('turfandtaste@okaxis');
    setIsCopiedUpi(true);
    setTimeout(() => setIsCopiedUpi(false), 2500);
  };

  const handleReturnHome = () => {
    if (confirmationData) {
      sessionStorage.setItem('tt_booking_success', JSON.stringify({
        id: confirmationData.id || confirmationData.bookingReference,
        facility: confirmationData.facility,
        date: confirmationData.date,
        time: confirmationData.slot?.time || confirmationData.time,
        customerName: confirmationData.customer?.name,
        amount: confirmationData.amount
      }));
    }
    setConfirmationData(null);
    navigate('/');
  };

  const handleBookAnother = () => {
    setConfirmationData(null);
    goToStep(1);
    setSelectedSlot(null);
    setUpiUtrInput('');
    setCustomer({
      name: '',
      phone: '',
      email: '',
      teamName: '',
      notes: '',
      gearRental: false,
      whatsappUpdates: true,
      agreedRules: true
    });
  };

  const dateScrollRef = useRef(null);

  const scrollDates = (direction) => {
    if (dateScrollRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      dateScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const [pricingUpdateTick, setPricingUpdateTick] = useState(0);

  useEffect(() => {
    adminStore.fetchPricingAsync().then(() => setPricingUpdateTick(t => t + 1));
    adminStore.fetchTimingsAsync().then(() => setPricingUpdateTick(t => t + 1));
    const handleUpdate = () => setPricingUpdateTick(t => t + 1);
    window.addEventListener('tt_pricing_updated', handleUpdate);
    window.addEventListener('tt_timings_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('tt_pricing_updated', handleUpdate);
      window.removeEventListener('tt_timings_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Time slots generated based on facility, date, selected duration, and live pricing/timings
  const slots = generateTimeSlots(selectedFacility, selectedDate, selectedDuration);
  const daySlots = slots.filter(s => !s.peak);
  const nightSlots = slots.filter(s => s.peak);

  // Dynamic pricing calculations for current facility and selected slot
  const facilityPricing = adminStore.getFacilityPricing(selectedFacility);
  const isPeakSlot = selectedSlot ? !!selectedSlot.peak : false;
  const currentHourlyRateStr = (isPeakSlot ? facilityPricing?.nightRate : facilityPricing?.dayRate) || (isPeakSlot ? '₹800/hr' : '₹600/hr');
  const hourlyRateNum = adminStore.parsePrice(currentHourlyRateStr) || (isPeakSlot ? (facilityPricing?.hourlyRateNightNum || 800) : (facilityPricing?.hourlyRateDayNum || 600));
  const totalAmount = selectedSlot?.totalPriceNum != null ? selectedSlot.totalPriceNum : (hourlyRateNum * selectedDuration);
  const depositAmount = adminStore.parsePrice(facilityPricing.bookingDeposit) || Math.round(totalAmount * 0.35);
  const payableNow = paymentType === 'deposit' ? depositAmount : totalAmount;
  const balanceDueAtDesk = Math.max(0, totalAmount - payableNow);

  // Reset selected slot if facility, date, or duration changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedFacility, selectedDate, selectedDuration]);

  // Sync with URL query parameter
  useEffect(() => {
    if (preselectedFacility) {
      setSelectedFacility(preselectedFacility);
    }
  }, [preselectedFacility]);

  const currentFacilityData = facilitiesData.find(f => f.slug === selectedFacility) || facilitiesData[0];

  // Stepper Step Navigation
  const goToStep = (stepNum) => {
    setCurrentStep(stepNum);
    if (wizardRef.current) {
      wizardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleStep1Next = () => {
    goToStep(2);
  };

  const handleStep2Next = () => {
    if (!selectedSlot) {
      setErrors({ slot: 'Please select an available time slot before proceeding to player details.' });
      return;
    }
    setErrors({});
    goToStep(3);
  };

  const handleStep3Next = () => {
    const errs = {};
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
    if (!customer.agreedRules) {
      errs.agreedRules = 'Please accept the arena fair play policy to continue.';
    }
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      goToStep(4);
    }
  };

  const handleStepClick = (targetStep) => {
    if (targetStep < currentStep) {
      goToStep(targetStep);
      return;
    }
    if (targetStep === 2) {
      goToStep(2);
      return;
    }
    if (targetStep === 3) {
      if (!selectedSlot) {
        setErrors({ slot: 'Please select an available time slot first.' });
        return;
      }
      goToStep(3);
      return;
    }
    if (targetStep === 4) {
      if (!selectedSlot) {
        goToStep(2);
        return;
      }
      if (!customer.name.trim() || !customer.phone.trim() || !customer.email.trim()) {
        goToStep(3);
        return;
      }
      goToStep(4);
    }
  };

  const handleBookingSubmit = (e) => {
    if (e) e.preventDefault();
    if (!selectedSlot) {
      setErrors({ slot: 'Please select an available time slot before finalizing your reservation.' });
      goToStep(2);
      return;
    }
    const errs = {};
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
    if (!customer.agreedRules) {
      errs.agreedRules = 'Please accept the arena rules and fair play policy to continue.';
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      goToStep(3);
      return;
    }
    setShowPreConfirmModal(true);
  };

  const executeBooking = async () => {
    setShowPreConfirmModal(false);
    setIsSubmitting(true);
    setBookingErrorMessage('');

    const targetRef = `TT-${Math.floor(100000 + Math.random() * 900000)}`;
    const payload = {
      id: targetRef,
      facility: currentFacilityData.name,
      facilitySlug: selectedFacility,
      facilityId: selectedFacility,
      date: selectedDate,
      duration: selectedDuration,
      slot: selectedSlot,
      paymentType,
      amount: paymentType === 'full' ? `₹${payableNow} (Full Paid)` : `₹${payableNow} (Token Deposit)`,
      customer
    };

    // Path A: Instant UPI & QR Code Payment
    if (selectedPaymentGateway === 'upi') {
      try {
        const verifyRes = await confirmDirectUpiPayment({
          bookingId: targetRef,
          bookingPayload: payload,
          amount: payableNow,
          paymentType,
          upiRef: upiUtrInput.trim() || `upi_${Date.now()}`
        });

        setConfirmationData({
          id: targetRef,
          bookingReference: targetRef,
          facility: currentFacilityData.name,
          facilitySlug: selectedFacility,
          facilityId: selectedFacility,
          date: selectedDate,
          duration: selectedDuration,
          slot: selectedSlot,
          paymentType,
          amount: payload.amount,
          paymentId: verifyRes.paymentId,
          orderId: `order_upi_${Date.now()}`,
          customer,
          status: 'Confirmed'
        });
      } catch (err) {
        console.error('[UPI Payment Error]:', err);
        setBookingErrorMessage('UPI reservation confirmation failed: ' + (err.message || 'Please retry.'));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Path B: Razorpay Online Gateway
    try {
      // 1. Initialize Order on Backend API with Razorpay Test Keys
      const order = await initializePaymentOrder({
        amount: payableNow,
        type: paymentType,
        bookingReference: targetRef,
        customer
      });

      // 2. Open Official Razorpay Checkout Modal Popup
      openRazorpayCheckout({
        orderId: order.orderId,
        amount: payableNow,
        keyId: order.keyId,
        customer,
        facilityName: currentFacilityData.name,
        onSuccess: async (razorpayResponse) => {
          try {
            // 3. Cryptographic Signature Verification & DB Persistence
            const verifyRes = await verifyPaymentSignature({
              ...razorpayResponse,
              bookingId: targetRef,
              bookingPayload: payload,
              amount: payableNow,
              paymentType
            });

            // 4. Update UI to show confirmed booking pass
            setConfirmationData({
              id: targetRef,
              bookingReference: targetRef,
              facility: currentFacilityData.name,
              facilitySlug: selectedFacility,
              facilityId: selectedFacility,
              date: selectedDate,
              duration: selectedDuration,
              slot: selectedSlot,
              paymentType,
              amount: payload.amount,
              paymentId: razorpayResponse.razorpay_payment_id || verifyRes.paymentId,
              orderId: razorpayResponse.razorpay_order_id,
              customer,
              status: 'Confirmed'
            });
          } catch (verifyErr) {
            console.error('[Payment Verification Error]:', verifyErr);
            setBookingErrorMessage(
              'Payment was captured by Razorpay, but verification check encountered an issue: ' + (verifyErr.message || 'Please contact arena management.')
            );
          } finally {
            setIsSubmitting(false);
          }
        },
        onDismiss: () => {
          setIsSubmitting(false);
          setBookingErrorMessage('Payment was cancelled or closed. Your booking was NOT confirmed and no money was debited.');
        },
        onError: (paymentErr) => {
          setIsSubmitting(false);
          setBookingErrorMessage(paymentErr?.description || paymentErr?.message || 'Payment transaction failed. Please retry.');
        }
      });
    } catch (orderErr) {
      setIsSubmitting(false);
      setBookingErrorMessage(orderErr?.message || 'Could not initialize payment gateway order. Please check connection and retry.');
    }
  };

  return (
    <div className="page-booking">
      {/* Background Ambience */}
      <CourtBackground />

      {/* Main Screen-Fitting Booking Section */}
      <section className="section" ref={wizardRef} style={{ position: 'relative', zIndex: 2, paddingTop: '0.75rem', paddingBottom: '1.75rem' }}>
        <div className="container" style={{ maxWidth: '1060px' }}>
          
          {/* Compact Header Bar (Zero screen-height waste) */}
          <div className="booking-top-header">
            <h1 className="booking-title">
              Book Your <span className="text-olive">Arena Slot</span>
            </h1>
            <div className="booking-header-badges">
              <span className="badge badge-olive" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>Instant WhatsApp Pass</span>
              <span className="badge badge-orange" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>24/7 Operations</span>
            </div>
          </div>

          {/* Stepper Progress Bar (Segmented with ZERO overhang) */}
          <div className="booking-stepper">
            {/* Step 1 */}
            <button
              type="button"
              className={`stepper-node ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
              onClick={() => handleStepClick(1)}
              aria-label="Step 1: Select Arena"
            >
              <div className="stepper-node-circle">
                {currentStep > 1 ? <Check size={14} strokeWidth={3} /> : 1}
              </div>
              <span className="stepper-node-label">1. Arena</span>
            </button>

            {/* Connector 1-2 */}
            <div className={`stepper-connector ${currentStep > 1 ? 'filled' : ''}`} />

            {/* Step 2 */}
            <button
              type="button"
              className={`stepper-node ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}
              onClick={() => handleStepClick(2)}
              aria-label="Step 2: Date & Slot"
            >
              <div className="stepper-node-circle">
                {currentStep > 2 ? <Check size={14} strokeWidth={3} /> : 2}
              </div>
              <span className="stepper-node-label">2. Slot</span>
            </button>

            {/* Connector 2-3 */}
            <div className={`stepper-connector ${currentStep > 2 ? 'filled' : ''}`} />

            {/* Step 3 */}
            <button
              type="button"
              className={`stepper-node ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}
              onClick={() => handleStepClick(3)}
              aria-label="Step 3: Player Details"
            >
              <div className="stepper-node-circle">
                {currentStep > 3 ? <Check size={14} strokeWidth={3} /> : 3}
              </div>
              <span className="stepper-node-label">3. Details</span>
            </button>

            {/* Connector 3-4 */}
            <div className={`stepper-connector ${currentStep > 3 ? 'filled' : ''}`} />

            {/* Step 4 */}
            <button
              type="button"
              className={`stepper-node ${currentStep === 4 ? 'active' : ''}`}
              onClick={() => handleStepClick(4)}
              aria-label="Step 4: Summary & Pay"
            >
              <div className="stepper-node-circle">
                4
              </div>
              <span className="stepper-node-label">4. Summary</span>
            </button>
          </div>

          <form onSubmit={handleBookingSubmit}>
            {/* STEP 1: Select Arena & Sport */}
            {currentStep === 1 && (
              <div className="card-arena" style={{ padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--brand-cream)', fontWeight: 700 }}>Select Arena &amp; Sport</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--brand-cream-muted)' }}>24/7 Operations:</span>
                      <span style={{ color: 'var(--brand-olive-bright)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Sun size={13} /> Day (6:00 AM – 6:00 PM)
                      </span>
                      <span style={{ color: 'var(--border-strong)' }}>&bull;</span>
                      <span style={{ color: 'var(--brand-orange)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Moon size={13} /> Night Floodlit (6:00 PM – 6:00 AM)
                      </span>
                    </div>
                  </div>
                  <span className="badge badge-olive" style={{ fontSize: '0.74rem', padding: '0.25rem 0.65rem' }}>Step 1 of 4</span>
                </div>

                <div className="arena-select-grid">
                  {facilitiesData.filter(f => f.category !== 'dining').map(f => {
                    const isSelected = selectedFacility === f.slug;
                    const fPricing = adminStore.getFacilityPricing(f.slug);
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => setSelectedFacility(f.slug)}
                        className={`arena-select-tile ${isSelected ? 'selected' : ''}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '0.66rem', color: isSelected ? 'var(--brand-cream)' : 'var(--brand-olive-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                            {f.tag}
                          </span>
                          {isSelected && (
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--brand-olive-bright)', color: '#090C09', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.94rem', color: 'var(--brand-cream)', display: 'block', lineHeight: 1.25, marginBottom: '0.35rem' }}>
                            {f.name}
                          </strong>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem' }}>
                            <span style={{ color: isSelected ? 'var(--brand-cream)' : 'var(--brand-olive-bright)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                              <Sun size={12} style={{ color: 'var(--brand-olive-bright)', flexShrink: 0 }} /> Day: {fPricing.dayRate}/hr
                            </span>
                            <span style={{ color: isSelected ? '#ffb088' : 'var(--brand-orange)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                              <Moon size={12} style={{ color: 'var(--brand-orange)', flexShrink: 0 }} /> Night: {fPricing.nightRate}/hr
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="stepper-nav-bar">
                  <div style={{ fontSize: '0.85rem', color: 'var(--brand-cream-muted)' }}>
                    Selected: <strong style={{ color: 'var(--brand-cream)' }}>{currentFacilityData.name}</strong>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={handleStep1Next} style={{ padding: '0.55rem 1.45rem' }}>
                    Next: Select Date &amp; Slot <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Choose Date & Time Slot (Compact & Screen Fitting) */}
            {currentStep === 2 && (
              <div className="card-arena" style={{ padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-lg)' }}>
                {/* Header Strip */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.55rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--brand-cream)', fontWeight: 700 }}>Choose Date &amp; Slot</h2>
                    <span className="badge badge-olive" style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}>{currentFacilityData.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Duration:</span>
                    <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
                      {[1, 2, 3].map(hrs => (
                        <button
                          type="button"
                          key={hrs}
                          onClick={() => { setSelectedDuration(hrs); setSelectedSlot(null); }}
                          style={{
                            background: selectedDuration === hrs ? 'var(--brand-olive)' : 'transparent',
                            color: selectedDuration === hrs ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 'var(--radius-full)',
                            padding: '0.2rem 0.7rem',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          {hrs} Hr{hrs > 1 ? 's' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 14-Day Date Carousel */}
                <div style={{ marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <button
                      type="button"
                      onClick={() => scrollDates('left')}
                      className="date-nav-btn"
                      title="Previous dates"
                      aria-label="Previous dates"
                      style={{ width: '26px', height: '26px', flexShrink: 0 }}
                    >
                      <ChevronLeft size={15} />
                    </button>

                    <div ref={dateScrollRef} className="date-picker-scroll" style={{ padding: '0.1rem 0' }}>
                      {datesList.map((item) => (
                        <button
                          type="button"
                          key={item.iso}
                          onClick={() => setSelectedDate(item.iso)}
                          className="date-pill-btn"
                          style={{
                            flexShrink: 0,
                            padding: '0.28rem 0.48rem',
                            borderRadius: 'var(--radius-sm)',
                            border: `1.5px solid ${selectedDate === item.iso ? 'var(--brand-olive-bright)' : 'var(--border-subtle)'}`,
                            background: selectedDate === item.iso ? 'var(--brand-olive)' : 'var(--bg-surface-elevated)',
                            color: selectedDate === item.iso ? '#ffffff' : 'var(--text-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer',
                            minWidth: '50px',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.85 }}>{item.dayName}</span>
                          <span style={{ fontSize: '0.96rem', fontWeight: 700, lineHeight: 1.1 }}>{item.dayNum}</span>
                          <span style={{ fontSize: '0.62rem', opacity: 0.85 }}>{item.month}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => scrollDates('right')}
                      className="date-nav-btn"
                      title="Next dates"
                      aria-label="Next dates"
                      style={{ width: '26px', height: '26px', flexShrink: 0 }}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>

                {/* Day / Night / All Schedule Toggle Tabs */}
                <div className="session-toggle-container">
                  <button
                    type="button"
                    className={`session-toggle-btn ${activeSessionTab === 'all' ? 'active-all' : ''}`}
                    onClick={() => setActiveSessionTab('all')}
                  >
                    <Clock size={13} />
                    <span>All 24 Hours ({slots.length})</span>
                  </button>
                  <button
                    type="button"
                    className={`session-toggle-btn ${activeSessionTab === 'day' ? 'active-day' : ''}`}
                    onClick={() => setActiveSessionTab('day')}
                  >
                    <Sun size={13} className="text-olive" />
                    <span>☀️ Day ({daySlots.length})</span>
                    <span className="session-rate-badge text-olive">{facilityPricing.dayRate}/hr</span>
                  </button>
                  <button
                    type="button"
                    className={`session-toggle-btn ${activeSessionTab === 'night' ? 'active-night' : ''}`}
                    onClick={() => setActiveSessionTab('night')}
                  >
                    <Moon size={13} style={{ color: 'var(--brand-orange)' }} />
                    <span>🌙 Night ({nightSlots.length})</span>
                    <span className="session-rate-badge text-orange">{facilityPricing.nightRate}/hr</span>
                  </button>
                </div>

                {/* Slot Error Warning */}
                {errors.slot && (
                  <div className="form-error" style={{ marginBottom: '0.5rem', padding: '0.4rem 0.65rem', background: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertCircle size={13} /> {errors.slot}
                  </div>
                )}

                {/* Compact Slot Chips Grid (Screen-Fitting with 24-Hour Day + Night) */}
                <div className="compact-slots-scroll">
                  {activeSessionTab === 'all' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Day Sessions Section */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', paddingBottom: '0.2rem', borderBottom: '1px solid rgba(107, 143, 73, 0.25)' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--brand-olive-bright)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Sun size={12} /> Day Sessions ({facilityPricing.dayHours})
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--brand-olive-bright)', fontWeight: 600 }}>{facilityPricing.dayRate}/hr</span>
                        </div>
                        <div className="compact-slots-grid">
                          {daySlots.map((slot, idx) => {
                            const isSelected = selectedSlot?.time === slot.time;
                            const isBooked = slot.status === 'booked';
                            const isFast = slot.status === 'fast-filling';
                            return (
                              <button
                                type="button"
                                key={`day-slot-${idx}`}
                                disabled={isBooked}
                                className={`slot-chip ${isSelected ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedSlot(slot);
                                  setErrors(prev => ({ ...prev, slot: null }));
                                }}
                              >
                                <span className="slot-chip-time">{slot.time}</span>
                                <div className="slot-chip-meta">
                                  <span style={{ fontWeight: 700, color: 'var(--brand-olive-bright)' }}>
                                    {slot.price}
                                  </span>
                                  <span style={{
                                    fontSize: '0.62rem',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    background: isBooked ? '#ff525222' : isFast ? '#ff980022' : '#4caf5022',
                                    color: isBooked ? '#ff5252' : isFast ? 'var(--brand-orange)' : '#4caf50',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                  }}>
                                    {slot.status}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Night Floodlit Sessions Section */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', paddingBottom: '0.2rem', borderBottom: '1px solid rgba(232, 103, 38, 0.25)' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--brand-orange)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Moon size={12} /> Night Floodlit Sessions ({facilityPricing.nightHours})
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--brand-orange)', fontWeight: 600 }}>{facilityPricing.nightRate}/hr</span>
                        </div>
                        <div className="compact-slots-grid">
                          {nightSlots.map((slot, idx) => {
                            const isSelected = selectedSlot?.time === slot.time;
                            const isBooked = slot.status === 'booked';
                            const isFast = slot.status === 'fast-filling';
                            return (
                              <button
                                type="button"
                                key={`night-slot-${idx}`}
                                disabled={isBooked}
                                className={`slot-chip ${isSelected ? 'selected night-selected' : ''}`}
                                onClick={() => {
                                  setSelectedSlot(slot);
                                  setErrors(prev => ({ ...prev, slot: null }));
                                }}
                              >
                                <span className="slot-chip-time">{slot.time}</span>
                                <div className="slot-chip-meta">
                                  <span style={{ fontWeight: 700, color: 'var(--brand-orange)' }}>
                                    {slot.price}
                                  </span>
                                  <span style={{
                                    fontSize: '0.62rem',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    background: isBooked ? '#ff525222' : isFast ? '#ff980022' : '#4caf5022',
                                    color: isBooked ? '#ff5252' : isFast ? 'var(--brand-orange)' : '#4caf50',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                  }}>
                                    {slot.status}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="compact-slots-grid">
                      {(activeSessionTab === 'day' ? daySlots : nightSlots).map((slot, idx) => {
                        const isSelected = selectedSlot?.time === slot.time;
                        const isBooked = slot.status === 'booked';
                        const isFast = slot.status === 'fast-filling';

                        return (
                          <button
                            type="button"
                            key={`slot-${idx}`}
                            disabled={isBooked}
                            className={`slot-chip ${isSelected ? (slot.peak ? 'selected night-selected' : 'selected') : ''}`}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setErrors(prev => ({ ...prev, slot: null }));
                            }}
                          >
                            <span className="slot-chip-time">{slot.time}</span>
                            <div className="slot-chip-meta">
                              <span style={{ fontWeight: 700, color: slot.peak ? 'var(--brand-orange)' : 'var(--brand-olive-bright)' }}>
                                {slot.price}
                              </span>
                              <span style={{
                                fontSize: '0.62rem',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: isBooked ? '#ff525222' : isFast ? '#ff980022' : '#4caf5022',
                                color: isBooked ? '#ff5252' : isFast ? 'var(--brand-orange)' : '#4caf50',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                              }}>
                                {slot.status}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected Slot Feedback Strip */}
                {selectedSlot && (
                  <div style={{
                    marginTop: '0.55rem',
                    background: selectedSlot.peak ? 'rgba(232, 103, 38, 0.12)' : 'var(--brand-olive-dim)',
                    border: `1px solid ${selectedSlot.peak ? 'var(--brand-orange)' : 'var(--brand-olive)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.35rem 0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    color: 'var(--brand-cream)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <CheckCircle2 size={14} className={selectedSlot.peak ? 'text-orange' : 'text-olive'} />
                      <span>{selectedDate} &bull; <strong>{selectedSlot.time}</strong> ({selectedDuration} hr session)</span>
                    </div>
                    <strong style={{ color: selectedSlot.peak ? 'var(--brand-orange)' : 'var(--brand-olive-bright)' }}>
                      {selectedSlot.price || `₹${totalAmount}`}
                    </strong>
                  </div>
                )}

                {/* Stepper Nav Bar */}
                <div className="stepper-nav-bar">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => goToStep(1)}>
                    <ChevronLeft size={15} /> Back: Arena
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleStep2Next} style={{ padding: '0.55rem 1.35rem' }}>
                    Next: Squad Details <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Player & Squad Details */}
            {currentStep === 3 && (
              <div className="card-arena" style={{ padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.45rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Player &amp; Squad Details</h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--brand-cream-muted)' }}>Entry pass will be sent directly to your WhatsApp</span>
                  </div>
                  <span className="badge badge-olive" style={{ fontSize: '0.7rem' }}>
                    {currentFacilityData.name} &bull; {selectedSlot?.time}
                  </span>
                </div>

                <div className="grid grid-2" style={{ gap: '0.65rem', marginBottom: '0.65rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                      Full Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      minLength={2}
                      placeholder="e.g. Rahul Sharma"
                      value={customer.name}
                      onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                      className="form-input"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '16px' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                      Phone (WhatsApp) <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      pattern="[6-9][0-9]{9}"
                      title="Please enter a valid 10-digit mobile number starting with 6-9"
                      placeholder="10-digit mobile"
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      className="form-input"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '16px' }}
                    />
                  </div>
                </div>

                <div className="grid grid-2" style={{ gap: '0.65rem', marginBottom: '0.65rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                      Email Address <span className="required">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="e.g. rahul@example.com"
                      value={customer.email}
                      onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                      className="form-input"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '16px' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                      Team Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Patan Super Kings"
                      value={customer.teamName}
                      onChange={(e) => setCustomer({ ...customer, teamName: e.target.value })}
                      className="form-input"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '16px' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0.65rem' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                    Special Requests (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Specific balls, bats, or arrival notes..."
                    value={customer.notes}
                    onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                    className="form-input"
                    style={{ padding: '0.45rem 0.65rem', fontSize: '16px' }}
                  />
                </div>

                {/* Preferences */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.65rem' }}>
                  <label className="checkbox-label" style={{ fontSize: '0.78rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={customer.gearRental}
                      onChange={(e) => setCustomer({ ...customer, gearRental: e.target.checked })}
                    />
                    <span>Request Sports Gear Kit Rental at reception</span>
                  </label>

                  <label className="checkbox-label" style={{ fontSize: '0.78rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={customer.whatsappUpdates}
                      onChange={(e) => setCustomer({ ...customer, whatsappUpdates: e.target.checked })}
                    />
                    <span>Send digital QR entry pass directly to WhatsApp</span>
                  </label>

                  <label className="checkbox-label" style={{ fontSize: '0.78rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={customer.agreedRules}
                      onChange={(e) => {
                        setCustomer({ ...customer, agreedRules: e.target.checked });
                        if (e.target.checked) setErrors(prev => ({ ...prev, agreedRules: null }));
                      }}
                    />
                    <span>I agree to Arena Rules, Non-Marking Shoe Policy &amp; Fair Play Standards <span className="required">*</span></span>
                  </label>
                  {errors.agreedRules && (
                    <div className="form-error" style={{ fontSize: '0.72rem' }}>
                      <AlertCircle size={11} /> {errors.agreedRules}
                    </div>
                  )}
                </div>

                {/* Stepper Nav Bar */}
                <div className="stepper-nav-bar">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => goToStep(2)}>
                    <ChevronLeft size={15} /> Back: Slot
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleStep3Next} style={{ padding: '0.55rem 1.35rem' }}>
                    Next: Review Summary &amp; Pay <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Review Summary & Finalize (At the End to Finalize Booking) */}
            {currentStep === 4 && (
              <div className="card-arena highlight" style={{ padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.45rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Review Summary &amp; Finalize</h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--brand-cream-muted)' }}>Confirm your session details and select payment mode</span>
                  </div>
                  <span className="badge badge-orange" style={{ fontSize: '0.7rem' }}>Final Step 4 of 4</span>
                </div>

                {/* Match Voucher Card */}
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ARENA / SPORT</span>
                        <button type="button" onClick={() => goToStep(1)} style={{ background: 'none', border: 'none', color: 'var(--brand-olive-bright)', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}>
                          <Edit3 size={11} /> Edit
                        </button>
                      </div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--brand-cream)', display: 'block' }}>
                        {currentFacilityData.name}
                      </strong>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>DATE &amp; TIME SLOT</span>
                        <button type="button" onClick={() => goToStep(2)} style={{ background: 'none', border: 'none', color: 'var(--brand-olive-bright)', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}>
                          <Edit3 size={11} /> Edit
                        </button>
                      </div>
                      <strong style={{ fontSize: '0.9rem', color: isPeakSlot ? 'var(--brand-orange)' : 'var(--brand-olive-bright)', display: 'block' }}>
                        {selectedSlot?.time}
                      </strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--brand-cream-muted)' }}>
                        {selectedDate} &bull; {selectedDuration} hr{selectedDuration > 1 ? 's' : ''} ({isPeakSlot ? 'Night Floodlit' : 'Day Session'})
                      </span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CAPTAIN CONTACT</span>
                        <button type="button" onClick={() => goToStep(3)} style={{ background: 'none', border: 'none', color: 'var(--brand-olive-bright)', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}>
                          <Edit3 size={11} /> Edit
                        </button>
                      </div>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--brand-cream)', display: 'block' }}>
                        {customer.name}
                      </strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {customer.phone}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Preference Selector */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.35rem', fontWeight: 700 }}>
                    Select Payment Preference:
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                    <label
                      className="selection-card"
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'flex-start'
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentType"
                        value="deposit"
                        checked={paymentType === 'deposit'}
                        onChange={() => setPaymentType('deposit')}
                        style={{ marginTop: '2px' }}
                      />
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--brand-cream)' }}>Token Deposit</strong>
                          <span className="badge badge-olive" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>₹{depositAmount}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                          Balance ₹{balanceDueAtDesk} payable at venue desk.
                        </span>
                      </div>
                    </label>

                    <label
                      className="selection-card"
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'flex-start'
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentType"
                        value="full"
                        checked={paymentType === 'full'}
                        onChange={() => setPaymentType('full')}
                        style={{ marginTop: '2px' }}
                      />
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--brand-cream)' }}>100% Full Payment</strong>
                          <span className="badge badge-orange" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>₹{totalAmount}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                          Direct contactless pitch entry; zero desk wait.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Price Ledger Strip */}
                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.6rem 0.85rem',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.4rem'
                }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Total Match Value: <strong style={{ color: 'var(--brand-cream)' }}>₹{totalAmount}</strong> ({selectedDuration} hr @ {currentHourlyRateStr})
                    {paymentType === 'deposit' && (
                      <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        Balance at desk: ₹{balanceDueAtDesk}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--brand-cream)', fontWeight: 600 }}>Payable Now:</span>
                    <span style={{ color: 'var(--brand-orange)', fontSize: '1.35rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                      ₹{payableNow}
                    </span>
                  </div>
                </div>

                {/* Payment Gateway & Method Selector */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.35rem', fontWeight: 700 }}>
                    Select Payment Gateway / Method:
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                    <div
                      onClick={() => setSelectedPaymentGateway('upi')}
                      className={`selection-card ${selectedPaymentGateway === 'upi' ? 'active' : ''}`}
                      style={{
                        background: selectedPaymentGateway === 'upi' ? 'rgba(107, 143, 73, 0.15)' : 'var(--bg-surface-elevated)',
                        border: `1.5px solid ${selectedPaymentGateway === 'upi' ? 'var(--brand-olive-bright)' : 'var(--border-subtle)'}`,
                        padding: '0.65rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '0.6rem',
                        alignItems: 'center',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(107, 143, 73, 0.25)',
                        color: 'var(--brand-olive-bright)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <QrCode size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.86rem', color: 'var(--brand-cream)' }}>Instant UPI &amp; QR Code</strong>
                          <span className="badge badge-olive" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>Popular</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>
                          GPay, PhonePe, Paytm, BHIM, QR
                        </span>
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedPaymentGateway('razorpay')}
                      className={`selection-card ${selectedPaymentGateway === 'razorpay' ? 'active' : ''}`}
                      style={{
                        background: selectedPaymentGateway === 'razorpay' ? 'rgba(232, 103, 38, 0.15)' : 'var(--bg-surface-elevated)',
                        border: `1.5px solid ${selectedPaymentGateway === 'razorpay' ? 'var(--brand-orange)' : 'var(--border-subtle)'}`,
                        padding: '0.65rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '0.6rem',
                        alignItems: 'center',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(232, 103, 38, 0.25)',
                        color: 'var(--brand-orange)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <CreditCard size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.86rem', color: 'var(--brand-cream)' }}>Razorpay Gateway</strong>
                          <span className="badge badge-orange" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>Cards/NetBanking</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>
                          Debit/Credit Card, NetBanking, Wallets
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instant UPI & QR Section */}
                {selectedPaymentGateway === 'upi' && (
                  <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid rgba(107, 143, 73, 0.35)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    marginBottom: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Dynamic QR Code */}
                      <div style={{
                        background: '#ffffff',
                        padding: '6px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.35)',
                        flexShrink: 0
                      }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=turfandtaste@okaxis&pn=Turf%20And%20Taste&am=${payableNow}&cu=INR&tn=Turf%20Booking%20${customer.name || 'Player'}`)}`}
                          alt="Turf & Taste UPI QR Code"
                          style={{ width: '105px', height: '105px', display: 'block' }}
                        />
                      </div>

                      {/* UPI Details & Intent */}
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--brand-olive-bright)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '2px' }}>
                          SCAN WITH ANY UPI APP &bull; ₹{payableNow}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--brand-cream)', marginBottom: '0.35rem' }}>
                          Google Pay &bull; PhonePe &bull; Paytm &bull; BHIM &bull; CRED
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.45rem' }}>
                          <code style={{
                            background: 'var(--bg-surface-elevated)',
                            border: '1px solid var(--border-subtle)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            color: 'var(--brand-cream)',
                            fontSize: '0.82rem',
                            fontFamily: 'monospace'
                          }}>
                            turfandtaste@okaxis
                          </code>
                          <button
                            type="button"
                            onClick={handleCopyUpi}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '0.18rem 0.5rem', fontSize: '0.72rem', height: '26px' }}
                          >
                            {isCopiedUpi ? <><Check size={11} className="text-olive" /> Copied</> : <><Copy size={11} /> Copy</>}
                          </button>
                        </div>

                        {/* Direct UPI App Intent Link */}
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <a
                            href={`upi://pay?pa=turfandtaste@okaxis&pn=Turf%20And%20Taste&am=${payableNow}&cu=INR&tn=Arena%20Slot%20Booking`}
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', height: '28px', color: 'var(--brand-olive-bright)', borderColor: 'var(--brand-olive)' }}
                          >
                            <Smartphone size={12} /> Open in UPI App
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Optional UTR input */}
                    <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-subtle)' }}>
                      <input
                        type="text"
                        placeholder="12-digit UPI Transaction / UTR Number (optional)"
                        value={upiUtrInput}
                        onChange={(e) => setUpiUtrInput(e.target.value)}
                        className="form-input"
                        style={{ height: '34px', fontSize: '0.8rem', background: 'var(--bg-surface-elevated)' }}
                      />
                    </div>
                  </div>
                )}

                {/* Razorpay Trust note */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--brand-cream-muted)', marginBottom: '0.75rem' }}>
                  <ShieldCheck size={14} className="text-olive" style={{ flexShrink: 0 }} />
                  <span>
                    {selectedPaymentGateway === 'upi' 
                      ? 'Direct 0% gateway surcharge UPI confirmation with instant WhatsApp receipt.' 
                      : '256-bit SSL encrypted checkout powered by Razorpay. Cards, NetBanking, Wallets supported.'}
                  </span>
                </div>

                {/* Stepper Nav Bar & Pay CTA */}
                <div className="stepper-nav-bar" style={{ marginTop: '0.35rem', paddingTop: '0.65rem' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => goToStep(3)}>
                    <ChevronLeft size={15} /> Back: Details
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary btn-lg"
                    style={{ minWidth: '240px', padding: '0.65rem 1.4rem', fontSize: '0.95rem', fontWeight: 700 }}
                  >
                    {isSubmitting ? (
                      'Processing Reservation...'
                    ) : selectedPaymentGateway === 'upi' ? (
                      <>
                        <Zap size={17} /> Confirm &amp; Pay ₹{payableNow} via UPI
                      </>
                    ) : (
                      <>
                        <CreditCard size={17} /> Proceed to Pay ₹{payableNow} with Razorpay
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Confirmation Modal */}
      {confirmationData && (
        <div className="modal-overlay" onClick={handleReturnHome}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <button 
              className="modal-close-btn" 
              onClick={handleReturnHome}
              aria-label="Close modal and return to home"
            >
              <X size={18} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--brand-olive-dim)',
                border: '2px solid var(--brand-olive)',
                color: 'var(--brand-olive-bright)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.75rem'
              }}>
                <CheckCircle2 size={34} />
              </div>
              <span className="badge badge-olive" style={{ marginBottom: '0.4rem' }}>
                Payment Verified &bull; Slot Confirmed
              </span>
              <h2 style={{ fontSize: '1.8rem', margin: '0.2rem 0 0.3rem', color: 'var(--brand-cream)' }}>
                Booking &amp; Payment Confirmed!
              </h2>
              <p style={{ fontSize: '0.92rem', margin: 0, color: 'var(--text-secondary)' }}>
                Booking Reference: <strong style={{ color: 'var(--brand-cream)', fontFamily: 'monospace' }}>{confirmationData.id || confirmationData.bookingReference}</strong>
              </p>
            </div>

            {/* Ticket Card */}
            <div style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px dashed var(--brand-olive-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              marginBottom: '1.25rem',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem', marginBottom: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>FACILITY</span>
                  <div style={{ fontWeight: 600, color: 'var(--brand-cream)' }}>
                    {confirmationData.facility || confirmationData.details?.facility}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>MATCH DATE</span>
                  <div style={{ fontWeight: 600, color: 'var(--brand-cream)' }}>
                    {confirmationData.date || confirmationData.details?.date}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>SLOT TIME</span>
                  <div style={{ fontWeight: 600, color: 'var(--brand-olive-bright)' }}>
                    {confirmationData.slot?.time || confirmationData.details?.slot || confirmationData.time}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>PAYMENT STATUS</span>
                  <div style={{ fontWeight: 600, color: 'var(--brand-olive-bright)', textTransform: 'capitalize' }}>
                    {confirmationData.paymentType || confirmationData.details?.paymentType} &bull; Paid
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>AMOUNT PAID</span>
                  <div style={{ fontWeight: 700, color: 'var(--brand-orange)', fontSize: '1.1rem' }}>
                    {confirmationData.amount || confirmationData.details?.amount}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>TRANSACTION / PAYMENT ID</span>
                  <div style={{ fontWeight: 600, color: 'var(--brand-cream)', fontSize: '0.8rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {confirmationData.paymentId || 'pay_captured'}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>PLAYER SQUAD CONTACT</span>
                <div style={{ fontWeight: 600, color: 'var(--brand-cream)' }}>
                  {confirmationData.customer?.name || confirmationData.details?.customer?.name} ({confirmationData.customer?.phone || confirmationData.details?.customer?.phone})
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(107, 143, 73, 0.12)',
              border: '1px solid rgba(107, 143, 73, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              fontSize: '0.8rem',
              color: 'var(--brand-cream)',
              marginBottom: '1.25rem',
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'center'
            }}>
              <ShieldCheck size={18} className="text-olive" style={{ flexShrink: 0 }} />
              <span>
                <strong>Reservation Confirmed:</strong> Your slot has been locked in the arena database. A confirmation pass has been dispatched to WhatsApp.
              </span>
            </div>

            {/* Action Buttons: Return Home is PRIMARY */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button 
                onClick={handleReturnHome} 
                className="btn btn-primary btn-block btn-lg"
                style={{ fontWeight: 700, fontSize: '0.98rem' }}
              >
                <Home size={18} /> Return to Home Screen
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <button 
                  onClick={() => window.print()} 
                  className="btn btn-outline btn-block"
                  style={{ fontSize: '0.86rem' }}
                >
                  <Printer size={15} /> Print Voucher
                </button>
                <button 
                  onClick={handleBookAnother} 
                  className="btn btn-secondary btn-block"
                  style={{ fontSize: '0.86rem' }}
                >
                  <CalendarIcon size={15} /> Book Another Slot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRE-SUBMISSION CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={showPreConfirmModal}
        onClose={() => setShowPreConfirmModal(false)}
        onConfirm={executeBooking}
        title="Review & Confirm Reservation"
        type="info"
        message="Please verify your match session and player squad details before locking in your reservation."
        details={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Arena Sport:</span>
              <strong style={{ color: 'var(--brand-cream)' }}>{currentFacilityData.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Game Date:</span>
              <strong style={{ color: 'var(--brand-cream)' }}>{selectedDate}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Reserved Slot:</span>
              <strong style={{ color: 'var(--brand-olive-bright)' }}>{selectedSlot?.time} ({selectedDuration} Hour{selectedDuration > 1 ? 's' : ''})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Contact Player:</span>
              <strong style={{ color: 'var(--brand-cream)' }}>{customer.name} ({customer.phone})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Payment Mode:</span>
              <span style={{ fontWeight: 700, color: paymentType === 'full' ? 'var(--brand-olive-bright)' : 'var(--brand-orange)' }}>
                {paymentType === 'full' ? '100% Full Payment' : 'Token Booking Deposit'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '0.25rem' }}>
              <span style={{ color: 'var(--brand-cream)', fontWeight: 600 }}>Amount Due Now:</span>
              <span style={{ color: 'var(--brand-orange)', fontSize: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                ₹{payableNow}
              </span>
            </div>
            {paymentType === 'deposit' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Balance due at venue desk:</span>
                <span style={{ color: 'var(--brand-cream-muted)' }}>₹{balanceDueAtDesk}</span>
              </div>
            )}
          </div>
        }
        confirmText={selectedPaymentGateway === 'upi' ? `Confirm & Pay ₹${payableNow} via UPI` : `Pay ₹${payableNow} with Razorpay`}
        cancelText="Edit Details"
        isLoading={isSubmitting}
      />

      {/* IN-APP ERROR MODAL */}
      <ConfirmationModal
        isOpen={!!bookingErrorMessage}
        onClose={() => setBookingErrorMessage('')}
        onConfirm={() => setBookingErrorMessage('')}
        title="Reservation Notice"
        type="danger"
        message={bookingErrorMessage}
        confirmText="Understood"
        cancelText="Close"
      />
    </div>
  );
}

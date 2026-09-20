import React, { useState, useEffect, useRef } from 'react';
import { useRouter, Link } from '../context/RouterContext';
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

const BOOKABLE_ACTIVITIES = [
  { slug: 'all', label: 'All Activities', icon: '🏆', count: 5 },
  { slug: 'box-cricket', label: 'Box Cricket', icon: '🏏', count: 1 },
  { slug: 'pickleball', label: 'Pickleball', icon: '🎾', count: 1 },
  { slug: 'skating', label: 'Skating Rink', icon: '⛸️', count: 1 },
  { slug: 'cricket-nets', label: 'Cricket Nets', icon: '🏏', count: 1 },
  { slug: 'ball-machine', label: 'Bowling Machine', icon: '🎯', count: 1 }
];

export default function Booking() {
  const { navigate, queryParams } = useRouter();
  const preselectedFacility = queryParams.get('facility');

  // Multi-step Stepper state (1: Arena, 2: Date & Slot, 3: Squad Details, 4: Summary & Pay)
  const [currentStep, setCurrentStep] = useState(1);
  const wizardRef = useRef(null);

  // Booking State & Activity Discovery Filter
  const [activityFilter, setActivityFilter] = useState('all');
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

  const handleSelectFacility = (slug) => {
    if (selectedFacility !== slug) {
      setSelectedFacility(slug);
      setSelectedSlot(null); // only reset slot when facility actually changes
    }
    setErrors(prev => ({ ...prev, facility: null }));
  };

  const handleSelectDate = (iso) => {
    if (selectedDate !== iso) {
      setSelectedDate(iso);
      setSelectedSlot(null); // only reset slot when date actually changes
    }
  };

  const handleSelectDuration = (hrs) => {
    if (selectedDuration !== hrs) {
      setSelectedDuration(hrs);
      setSelectedSlot(null); // only reset slot when duration actually changes
    }
  };

  // Sync with URL query parameter
  useEffect(() => {
    if (preselectedFacility && preselectedFacility !== selectedFacility) {
      setSelectedFacility(preselectedFacility);
      setSelectedSlot(null);
    }
  }, [preselectedFacility]);

  const currentFacilityData = facilitiesData.find(f => f.slug === selectedFacility) || facilitiesData[0];

  // Stepper Step Navigation
  const goToStep = (stepNum) => {
    setErrors({});
    setCurrentStep(stepNum);
    if (wizardRef.current) {
      wizardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleStep1Next = () => {
    if (!selectedFacility) {
      setErrors({ facility: 'Please select an arena to continue.' });
      return;
    }
    setErrors({});
    goToStep(2);
  };

  const handleStep2Next = () => {
    if (!selectedSlot) {
      setErrors({ slot: 'Please select an available time slot.' });
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
    // When returning to previous step, preserve all selected data!
    if (targetStep < currentStep) {
      goToStep(targetStep);
      return;
    }
    if (targetStep === currentStep) return;

    // Jumping forward: validate prerequisites
    if (targetStep === 2) {
      if (!selectedFacility) {
        setErrors({ facility: 'Please select an arena to continue.' });
        return;
      }
      goToStep(2);
      return;
    }
    if (targetStep === 3) {
      if (!selectedSlot) {
        setErrors({ slot: 'Please select an available time slot.' });
        return;
      }
      goToStep(3);
      return;
    }
    if (targetStep === 4) {
      if (!selectedSlot) {
        setErrors({ slot: 'Please select an available time slot.' });
        return;
      }
      if (!customer.name.trim() || !customer.phone.trim() || !customer.email.trim() || !customer.agreedRules) {
        setErrors({ form: 'Please complete all required details first.' });
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
          
          {/* Mobile-First Step Progress Header */}
          <div className="booking-step-progress-header">
            <div className="booking-step-progress-meta">
              <span className="booking-step-number-tag">
                STEP {currentStep} OF 4
              </span>
              <span className="booking-step-venue-tag">
                {currentFacilityData.name}
              </span>
            </div>
            <div className="booking-step-title-row">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="booking-step-header-back-btn"
                  onClick={() => goToStep(currentStep - 1)}
                  aria-label="Previous step"
                  title="Go back"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <h1 className="booking-step-main-title">
                {currentStep === 1 && 'Select Arena'}
                {currentStep === 2 && 'Select Date & Time'}
                {currentStep === 3 && 'Your Details'}
                {currentStep === 4 && 'Review & Confirm'}
              </h1>
            </div>
          </div>

          {/* Stepper Progress Bar: [✓ Arena] — [2 Slot] — [3 Details] — [4 Summary] */}
          <nav className="booking-stepper" aria-label="Booking steps progress">
            {/* Step 1 */}
            <button
              type="button"
              className={`stepper-pill ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
              onClick={() => handleStepClick(1)}
              aria-label="Step 1: Arena"
              aria-current={currentStep === 1 ? 'step' : undefined}
            >
              <span className="stepper-pill-icon">
                {currentStep > 1 ? <Check size={12} strokeWidth={3} /> : '1'}
              </span>
              <span className="stepper-pill-label">Arena</span>
            </button>

            <div className={`stepper-divider ${currentStep > 1 ? 'filled' : ''}`} />

            {/* Step 2 */}
            <button
              type="button"
              className={`stepper-pill ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : currentStep < 2 ? 'future' : ''}`}
              onClick={() => handleStepClick(2)}
              aria-label="Step 2: Slot"
              aria-current={currentStep === 2 ? 'step' : undefined}
            >
              <span className="stepper-pill-icon">
                {currentStep > 2 ? <Check size={12} strokeWidth={3} /> : '2'}
              </span>
              <span className="stepper-pill-label">Slot</span>
            </button>

            <div className={`stepper-divider ${currentStep > 2 ? 'filled' : ''}`} />

            {/* Step 3 */}
            <button
              type="button"
              className={`stepper-pill ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : currentStep < 3 ? 'future' : ''}`}
              onClick={() => handleStepClick(3)}
              aria-label="Step 3: Details"
              aria-current={currentStep === 3 ? 'step' : undefined}
            >
              <span className="stepper-pill-icon">
                {currentStep > 3 ? <Check size={12} strokeWidth={3} /> : '3'}
              </span>
              <span className="stepper-pill-label">Details</span>
            </button>

            <div className={`stepper-divider ${currentStep > 3 ? 'filled' : ''}`} />

            {/* Step 4 */}
            <button
              type="button"
              className={`stepper-pill ${currentStep === 4 ? 'active' : ''} ${currentStep < 4 ? 'future' : ''}`}
              onClick={() => handleStepClick(4)}
              aria-label="Step 4: Summary"
              aria-current={currentStep === 4 ? 'step' : undefined}
            >
              <span className="stepper-pill-icon">
                4
              </span>
              <span className="stepper-pill-label">Summary</span>
            </button>
          </nav>

          <form onSubmit={handleBookingSubmit}>
            {/* STEP 1: Select Arena & Sport */}
            {currentStep === 1 && (
              <div className="card-arena" style={{ padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-lg)' }}>
                {errors.facility && (
                  <div className="booking-validation-banner">
                    <AlertCircle size={15} />
                    <span>{errors.facility}</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--brand-cream-muted)' }}>24/7 Operations:</span>
                    <span style={{ color: 'var(--brand-green)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Sun size={13} /> Day (6:00 AM – 6:00 PM)
                    </span>
                    <span style={{ color: 'var(--border-strong)' }}>&bull;</span>
                    <span style={{ color: 'var(--brand-orange)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Moon size={13} /> Night Floodlit (6:00 PM – 6:00 AM)
                    </span>
                  </div>
                  <span className="badge badge-surface" style={{ fontSize: '0.72rem' }}>
                    Tap an Arena below
                  </span>
                </div>

                {/* Activity Inventory Summary Banner */}
                <div className="activity-summary-banner">
                  <div className="activity-summary-left">
                    <div className="activity-summary-icon">
                      <Trophy size={18} />
                    </div>
                    <div>
                      <h2 className="activity-summary-title">5 Sports &amp; Practice Grounds in Patan</h2>
                      <p className="activity-summary-sub">Filter by activity below to view available arenas and hourly rates</p>
                    </div>
                  </div>
                  <span className="badge badge-green" style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                    Multi-Sport Hub
                  </span>
                </div>

                {/* Activity Discovery Bar (Horizontal Sport Filter Pills) */}
                <div className="activity-discovery-bar" role="tablist" aria-label="Filter by Sport">
                  {BOOKABLE_ACTIVITIES.map(act => (
                    <button
                      key={act.slug}
                      type="button"
                      className={`activity-pill-btn ${activityFilter === act.slug ? 'active' : ''}`}
                      onClick={() => {
                        setActivityFilter(act.slug);
                        if (act.slug !== 'all') {
                          handleSelectFacility(act.slug);
                        }
                      }}
                      role="tab"
                      aria-selected={activityFilter === act.slug}
                    >
                      <span>{act.icon}</span>
                      <span>{act.label}</span>
                      <span className="activity-pill-count">{act.count}</span>
                    </button>
                  ))}
                </div>

                {activityFilter !== 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.35rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Showing venue for <strong>{BOOKABLE_ACTIVITIES.find(a => a.slug === activityFilter)?.label}</strong></span>
                    <button
                      type="button"
                      onClick={() => setActivityFilter('all')}
                      style={{ background: 'none', border: 'none', color: 'var(--brand-green)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', padding: 0 }}
                    >
                      Show All 5 Sports
                    </button>
                  </div>
                )}

                <div className="arena-card-list">
                  {facilitiesData
                    .filter(f => f.category !== 'dining')
                    .filter(f => activityFilter === 'all' || f.slug === activityFilter)
                    .map(f => {
                    const isSelected = selectedFacility === f.slug;
                    const fPricing = adminStore.getFacilityPricing(f.slug);
                    return (
                      <div
                        key={f.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectFacility(f.slug)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectFacility(f.slug); }}
                        className={`arena-card-row ${isSelected ? 'selected' : ''}`}
                        aria-pressed={isSelected}
                      >
                        {/* Facility Photo Header */}
                        <div className="arena-card-row-top">
                          <img
                            src={f.image}
                            alt={f.name}
                            className="arena-card-row-image"
                            loading="lazy"
                          />
                          <div className="arena-card-row-gradient" />
                          <div className="arena-card-row-tags">
                            <span className="arena-card-tag">{f.tag}</span>
                            {isSelected && (
                              <span className="arena-card-selected-badge">
                                <Check size={12} strokeWidth={3} /> Selected
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Body & Details */}
                        <div className="arena-card-row-body">
                          <div className="arena-card-row-header">
                            <h3 className="arena-card-row-title">{f.name}</h3>
                            <p className="arena-card-row-desc">{f.shortDesc}</p>
                          </div>

                          {/* Pricing Comparison Strip */}
                          <div className="arena-card-pricing-strip">
                            <div className="arena-card-price-item">
                              <span className="arena-card-price-label">
                                <Sun size={12} style={{ color: 'var(--brand-green)' }} /> Day Session
                              </span>
                              <span className="arena-card-price-val day">
                                {fPricing.dayRate}/hr
                              </span>
                            </div>
                            <div className="arena-card-price-item">
                              <span className="arena-card-price-label">
                                <Moon size={12} style={{ color: 'var(--brand-orange)' }} /> Night Lights
                              </span>
                              <span className="arena-card-price-val night">
                                {fPricing.nightRate}/hr
                              </span>
                            </div>
                          </div>

                          {/* Explicit Action Button */}
                          <button
                            type="button"
                            className="arena-card-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectFacility(f.slug);
                            }}
                          >
                            {isSelected ? (
                              <>
                                <Check size={16} strokeWidth={3} /> Arena Selected
                              </>
                            ) : (
                              'Select This Arena'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="stepper-nav-bar">
                  <Link to="/facilities" className="btn btn-outline btn-sm">
                    <ChevronLeft size={15} /> Back to Venues
                  </Link>
                  <button type="button" className="btn btn-primary" onClick={handleStep1Next} style={{ padding: '0.55rem 1.45rem' }}>
                    Select Date &amp; Slot <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Choose Date & Time Slot (Compact & Screen Fitting) */}
            {currentStep === 2 && (
              <div className="card-arena" style={{ padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-lg)' }}>
                {errors.slot && (
                  <div className="booking-validation-banner">
                    <AlertCircle size={15} />
                    <span>{errors.slot}</span>
                  </div>
                )}

                {/* Header Strip */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.55rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="badge badge-green" style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}>{currentFacilityData.name}</span>
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      style={{
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-full)',
                        padding: '0.2rem 0.65rem',
                        fontSize: '0.74rem',
                        color: 'var(--brand-green)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      Switch Sport <ChevronRight size={12} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Duration:</span>
                    <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
                      {[1, 2, 3].map(hrs => (
                        <button
                          type="button"
                          key={hrs}
                          onClick={() => handleSelectDuration(hrs)}
                          style={{
                            background: selectedDuration === hrs ? 'var(--brand-green)' : 'transparent',
                            color: selectedDuration === hrs ? '#000' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 'var(--radius-full)',
                            padding: '0.2rem 0.7rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
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
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <div ref={dateScrollRef} className="date-picker-scroll" style={{ padding: '0.1rem 0' }}>
                      {datesList.map((item) => (
                        <button
                          type="button"
                          key={item.iso}
                          onClick={() => handleSelectDate(item.iso)}
                          className="date-pill-btn"
                          style={{
                            flexShrink: 0,
                            padding: '0.35rem 0.55rem',
                            borderRadius: 'var(--radius-sm)',
                            border: `1.5px solid ${selectedDate === item.iso ? 'var(--brand-green)' : 'var(--border-subtle)'}`,
                            background: selectedDate === item.iso ? 'var(--brand-green)' : 'var(--bg-surface-elevated)',
                            color: selectedDate === item.iso ? '#000000' : 'var(--text-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer',
                            minWidth: '52px',
                            minHeight: '48px',
                            justifyContent: 'center',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.85, fontWeight: selectedDate === item.iso ? 700 : 500 }}>{item.dayName}</span>
                          <span style={{ fontSize: '0.96rem', fontWeight: 800, lineHeight: 1.1 }}>{item.dayNum}</span>
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
                    >
                      <ChevronRight size={16} />
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

                {/* Cross-Discovery: Explore Alternative Sports */}
                <div className="cross-discovery-section" style={{ marginTop: '1.25rem', paddingTop: '1rem' }}>
                  <div className="cross-discovery-header">
                    <h4 className="cross-discovery-title" style={{ fontSize: '0.88rem' }}>
                      <Sparkles size={14} className="text-green" /> Looking for another sport or training lane?
                    </h4>
                  </div>
                  <div className="cross-discovery-grid">
                    {facilitiesData
                      .filter(f => f.category !== 'dining' && f.slug !== selectedFacility)
                      .slice(0, 3)
                      .map(other => (
                        <button
                          key={other.id}
                          type="button"
                          className="cross-discovery-card"
                          onClick={() => {
                            handleSelectFacility(other.slug);
                            setActivityFilter(other.slug);
                          }}
                        >
                          <img src={other.image} alt={other.name} className="cross-discovery-img" style={{ width: '44px', height: '44px' }} />
                          <div className="cross-discovery-info">
                            <span className="cross-discovery-name" style={{ fontSize: '0.84rem' }}>{other.name}</span>
                            <span className="cross-discovery-meta" style={{ fontSize: '0.74rem' }}>{other.pricing?.standardRate?.split('(')[0] || other.tag}</span>
                          </div>
                          <ChevronRight size={15} className="text-muted" />
                        </button>
                      ))}
                  </div>
                </div>

                {/* Stepper Nav Bar */}
                <div className="stepper-nav-bar">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => goToStep(1)}>
                    <ChevronLeft size={15} /> Change Arena
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleStep2Next} style={{ padding: '0.55rem 1.35rem' }}>
                    Continue to Details <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Player & Squad Details */}
            {currentStep === 3 && (
              <div className="card-arena" style={{ padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)' }}>
                {Object.keys(errors).length > 0 && (
                  <div className="booking-validation-banner">
                    <AlertCircle size={15} />
                    <span>Please complete all required fields below to proceed.</span>
                  </div>
                )}
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
                    <label className="form-label" style={{ marginBottom: '0.35rem' }}>
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
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: '0.35rem' }}>
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
                    />
                  </div>
                </div>

                <div className="grid grid-2" style={{ gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: '0.35rem' }}>
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
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: '0.35rem' }}>
                      Team Name (Optional)
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

                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.35rem' }}>
                    Special Requests (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Specific balls, bats, or arrival notes..."
                    value={customer.notes}
                    onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                    className="form-input"
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
                    <ChevronLeft size={15} /> Change Slot
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleStep3Next} style={{ padding: '0.55rem 1.35rem' }}>
                    Review &amp; Pay <ArrowRight size={15} />
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
                    <ChevronLeft size={15} /> Edit Details
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

              {/* While You're Here: Discover Other Activities */}
              <div className="cross-discovery-section" style={{ marginTop: '1rem', paddingTop: '0.85rem' }}>
                <div className="cross-discovery-header">
                  <h4 className="cross-discovery-title" style={{ fontSize: '0.86rem' }}>
                    <Sparkles size={14} className="text-green" /> While You're Here... Explore More at Turf &amp; Taste
                  </h4>
                </div>
                <div className="cross-discovery-grid">
                  {facilitiesData
                    .filter(f => f.slug !== (confirmationData.facilitySlug || confirmationData.facilityId))
                    .slice(0, 3)
                    .map(other => (
                      <button
                        key={other.id}
                        type="button"
                        className="cross-discovery-card"
                        onClick={() => {
                          handleReturnHome();
                          navigate(`/booking?facility=${other.slug}`);
                        }}
                      >
                        <img src={other.image} alt={other.name} className="cross-discovery-img" style={{ width: '42px', height: '42px' }} />
                        <div className="cross-discovery-info">
                          <span className="cross-discovery-name" style={{ fontSize: '0.82rem' }}>{other.name}</span>
                          <span className="cross-discovery-meta" style={{ fontSize: '0.72rem' }}>{other.pricing?.standardRate?.split('(')[0] || other.tag}</span>
                        </div>
                        <ChevronRight size={14} className="text-muted" />
                      </button>
                    ))}
                </div>
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

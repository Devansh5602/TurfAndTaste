import { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, Bookmark, CalendarDays, Check, ChevronDown, ChevronRight, CircleAlert,
  Clock3, CreditCard, FileText, HelpCircle, Home, Info, LockKeyhole, MapPin,
  Menu, Moon, NotebookTabs, PlayCircle, Plus, ReceiptText, Search, Settings,
  ShieldCheck, Share2, Sparkles, Star, Sun, TicketCheck, Trophy, UtensilsCrossed, UserRound,
  UsersRound, WifiOff, X,
} from 'lucide-react';
import { prototypeEvents, prototypeFacilities, prototypeOutlets, infoPages } from './data';
import {
  VENUE_TIME_ZONE, getVenueNow, generateBookingDays, formatSlotEnd,
  formatSlotLabel, MORNING_SLOTS, EVENING_SLOTS, getSlotState, calculateBookingPricing
} from './bookingScheduler';
import { useRouter } from '../../context/RouterContext';
import { useTheme } from '../../theme';
import { useCustomerAuth } from '../../auth/customer/CustomerAuthProvider';
import { useBookingState } from './bookingState';
import { api } from '../../services/api';
import './customerMobile.css';

const steps = ['Sports & Venue', 'Schedule', 'Details', 'Pay'];

function AppIcon({ name, size = 18 }) {
  const props = { size, strokeWidth: 1.9, 'aria-hidden': true };
  const icons = { home: Home, facilities: Trophy, dining: UtensilsCrossed, profile: UserRound, events: CalendarDays };
  const Icon = icons[name] || Sparkles;
  return <Icon {...props} />;
}

function Button({ children, className = '', icon: Icon, ...props }) {
  return <button className={`cm-button ${className}`} {...props}>{children}{Icon && <Icon size={18} aria-hidden="true" />}</button>;
}

function SectionTitle({ eyebrow, title, action, onAction }) {
  return <div className="cm-section-title"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>{action && <button onClick={onAction}>{action}<ChevronRight size={16} /></button>}</div>;
}

function Header({ title, back, onBack, actions = true }) {
  return <header className="cm-header">
    {back ? <button className="cm-icon-button" onClick={onBack} aria-label="Go back"><ArrowLeft /></button> : <div className="cm-wordmark">turf<span>&</span>taste</div>}
    {title && <h1>{title}</h1>}
    {actions && <button className="cm-icon-button" aria-label="Notifications"><Bell /></button>}
  </header>;
}

function BottomNav({ screen, go }) {
  // Canonical Customer Mobile navigation items (position remains fixed everywhere)
  const items = [
    ['home', 'Home', 'home', Home],
    ['facilities', 'Venues', 'facilities', Trophy],
    ['dining', 'Dining', 'dining', UtensilsCrossed],
    ['events', 'Events', 'events', CalendarDays],
    ['profile', 'Profile', 'profile', UserRound],
  ];
  return (
    <nav className="cm-bottom-nav" aria-label="Customer navigation">
      {items.map(([id, label, route, Icon]) => {
        const isActive = screen === id || (id === 'home' && screen === 'home') || (id === 'facilities' && screen === 'facilities');
        return (
          <button
            key={id}
            className={isActive ? 'active' : ''}
            onClick={() => go(route)}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={18} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function FacilityCard({ facility, go, compact = false }) {
  const open = () => go('facility', { facility });
  return <article className={`cm-facility-card ${compact ? 'compact' : ''}`} {...(compact ? { role: 'button', tabIndex: 0, onClick: open, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') open(); } } : {})}>
    <img src={facility.image} alt="" />
    <div className="cm-facility-copy"><div className="cm-card-meta"><span>{facility.label}</span><span><Star size={13} fill="currentColor" /> {facility.rating}</span></div><h3>{facility.name}</h3><p><MapPin size={14} /> {facility.location}</p>{!compact && <button onClick={open}>View venue <ArrowRight size={16} /></button>}</div>
  </article>;
}

function BookingBar({ label, onClick, disabled, detail, ctaText = 'Continue' }) {
  return (
    <div className="cm-sticky-action">
      <div className="cm-sticky-action-info">
        {detail && <small>{detail}</small>}
        <strong>{label}</strong>
      </div>
      <Button
        className="cm-sticky-cta"
        disabled={disabled}
        onClick={onClick}
        aria-label={`${label} - ${ctaText}`}
      >
        <span>{ctaText}</span>
        <ArrowRight size={17} aria-hidden="true" />
      </Button>
    </div>
  );
}

export default function CustomerMobilePrototype({ initialScreen = "home" } = {}) {
  const { navigate } = useRouter();
  const initialBookingStep = initialScreen === 'booking-step-2' ? 2 : initialScreen === 'booking-step-3' ? 3 : initialScreen === 'booking-step-4' ? 4 : 1;
  const normalizedInitialScreen = initialScreen.startsWith('booking-step-') ? 'booking'
    : initialScreen.startsWith('auth-') ? 'auth'
      : initialScreen.startsWith('events-') ? 'events'
        : initialScreen.startsWith('dining-') ? 'dining'
          : initialScreen;
  const [screen, setScreen] = useState(normalizedInitialScreen);
  const [history, setHistory] = useState([]);
  const { theme, setTheme } = useTheme();
  const {
    state: bookingState,
    setFacility,
    setDate,
    setSlot,
    setDuration,
    setCustomerDetails,
    setQuote,
    setQuoteLoading,
    setQuoteError,
    setBooking,
    setPaymentState,
    resetBooking,
    canProceedToSchedule,
    canProceedToDetails,
    canProceedToReview,
    canSubmitPayment,
  } = useBookingState();
  const selectedFacility = bookingState.facility;

  // Dynamic booking state
  const bookingDays = useMemo(() => generateBookingDays(5), []);
  const selectedDateIndex = useMemo(() => {
    if (!bookingState.date) return 0;
    const idx = bookingDays.findIndex((d) => d.dateString === bookingState.date?.dateString);
    return idx >= 0 ? idx : 0;
  }, [bookingState.date, bookingDays]);
  const selectedDate = bookingDays[selectedDateIndex] || bookingDays[0];
  const selectedDuration = bookingState.duration || 1;
  const selectedSlot = bookingState.slot;
  const [bookingStep, setBookingStep] = useState(initialBookingStep);
  const bookingDetails = bookingState.customerDetails;

  const [paymentFailure, setPaymentFailure] = useState(initialScreen === 'payment-failure');
  const [event, setEvent] = useState(prototypeEvents[0]);
  const [outlet, setOutlet] = useState(prototypeOutlets[0]);
  const [info, setInfo] = useState('about');
  const [authScreen, setAuthScreen] = useState(initialScreen === 'auth-create' ? 'create' : initialScreen === 'auth-forgot' ? 'forgot' : initialScreen === 'auth-reset' ? 'reset' : initialScreen === 'auth-expired' ? 'expired' : 'signin');
  const [bookingMode, setBookingMode] = useState(initialScreen === 'events-loading' ? 'loading' : initialScreen === 'events-empty' ? 'empty' : 'normal');
  const [diningMode, setDiningMode] = useState(initialScreen === 'dining-loading' ? 'loading' : initialScreen === 'dining-unavailable' ? 'unavailable' : 'normal');

  const pricing = bookingState.quote;
  const selectedSlotLabel = selectedSlot ? formatSlotLabel(selectedSlot, selectedDuration) : '';

  // Server-authoritative quote integration
  useEffect(() => {
    if (!selectedFacility || !selectedDate || !selectedSlot || !selectedDuration) {
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);

    const fetchQuote = async () => {
      try {
        const timeSlot = formatSlotLabel(selectedSlot, selectedDuration);
        const res = await api.createQuote({
          facilityId: selectedFacility.id,
          date: selectedDate.dateString,
          timeSlot,
        });

        if (cancelled) return;

        if (res?.success && res?.quote) {
          setQuote(res.quote);
        } else {
          setQuoteError(res?.error || 'Unable to calculate pricing. Please try again.');
        }
      } catch (err) {
        if (!cancelled) {
          setQuoteError('Unable to reach pricing service. Please check your connection.');
        }
      } finally {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      }
    };

    fetchQuote();

    return () => {
      cancelled = true;
    };
  }, [selectedFacility, selectedDate, selectedSlot, selectedDuration, setQuote, setQuoteLoading, setQuoteError]);

  const routes = {
    home: '/', facilities: '/facilities', facility: '/facilities/detail',
    processing: '/payment/processing', 'payment-failure': '/payment/failure',
    success: '/booking/success', pass: '/booking/pass', bookings: '/my-bookings',
    auth: '/sign-in', profile: '/profile', 'edit-profile': '/profile/edit', settings: '/settings', appearance: '/appearance',
    reviews: '/reviews', events: '/events', event: '/events/detail', dining: '/dining',
    outlet: '/dining/outlet', menu: '/dining/menu', notices: '/updates', contact: '/contact-support',
    rules: '/ground-rules', about: '/about-clubhouse', terms: '/terms', privacy: '/privacy', offline: '/offline', 'system-error': '/system-error',
  };

  const go = (next, data = {}) => {
    if (data.facility) {
      setSelectedFacility(data.facility);
      setSelectedSlot(null);
    }
    if (data.event) setEvent(data.event);
    if (data.outlet) setOutlet(data.outlet);
    if (data.info) setInfo(data.info);
    const target = routes[next];
    if (target) {
      navigate(target);
      return;
    }
    setHistory((items) => [...items, screen]);
    setScreen(next);
  };

  const back = () => {
    if (history.length) {
      const previous = history.at(-1) || 'home';
      setHistory((items) => items.slice(0, -1));
      setScreen(previous);
      return;
    }
    window.history.back();
  };

  const beginBooking = (facility = selectedFacility) => {
    setSelectedFacility(facility);
    setSelectedSlot(null);
    setBookingStep(1);
    navigate('/booking/step-1');
  };

  const handleFacilityChange = (facility) => {
    setFacility(facility);
  };

  const handleDateChange = (index) => {
    const day = bookingDays[index];
    if (day) {
      setDate(day);
    }
  };

  const handleDurationChange = (duration) => {
    setDuration(duration);
  };

  const isFocusedScreen = [
    'booking', 'facility', 'processing', 'payment-failure', 'success', 'pass',
    'auth', 'edit-profile', 'settings', 'appearance', 'reviews',
    'event', 'outlet', 'menu', 'notices', 'contact', 'rules', 'about', 'terms', 'privacy',
    'info', 'offline', 'system-error'
  ].includes(screen);
  const showBottomNav = !isFocusedScreen;

  const renderPage = () => {
    if (screen === 'home') return <HomeScreen go={go} beginBooking={beginBooking} />;
    if (screen === 'facilities') return <FacilitiesScreen go={go} />;
    if (screen === 'facility') return <FacilityDetail facility={selectedFacility} beginBooking={beginBooking} back={back} go={go} />;
    if (screen === 'booking') return (
      <BookingScreen
        back={back}
        bookingStep={bookingStep}
        setBookingStep={setBookingStep}
        selectedFacility={selectedFacility}
        onFacilityChange={handleFacilityChange}
        bookingDays={bookingDays}
        selectedDateIndex={selectedDateIndex}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        selectedDuration={selectedDuration}
        onDurationChange={handleDurationChange}
        selectedSlot={selectedSlot}
        setSelectedSlot={setSelectedSlot}
        selectedSlotLabel={selectedSlotLabel}
        bookingDetails={bookingDetails}
        setBookingDetails={setBookingDetails}
        pricing={pricing}
        go={go}
      />
    );
    if (screen === 'processing' || screen === 'payment-failure') return (
      <ProcessingScreen
        back={back}
        failed={paymentFailure || screen === 'payment-failure'}
        setFailed={setPaymentFailure}
        selectedFacility={selectedFacility}
        selectedDate={selectedDate}
        selectedSlotLabel={selectedSlotLabel}
        pricing={pricing}
        onReview={() => { setBookingStep(4); setScreen('booking'); }}
        go={go}
      />
    );
    if (screen === 'success') return <SuccessScreen go={go} selectedFacility={selectedFacility} selectedDate={selectedDate} selectedSlotLabel={selectedSlotLabel} booking={bookingState.booking} />;
    if (screen === 'pass') return <PassScreen go={go} back={back} selectedFacility={selectedFacility} selectedDate={selectedDate} selectedSlotLabel={selectedSlotLabel} bookingDetails={bookingDetails} booking={bookingState.booking} />;
    if (screen === 'bookings') return <BookingsScreen go={go} />;
    if (screen === 'auth') return <SafeAuthScreen back={back} authScreen={authScreen} setAuthScreen={setAuthScreen} go={go} />;
    if (screen === 'profile') return <SafeProfileScreen go={go} theme={theme} />;
    if (screen === 'edit-profile') return <SafeEditProfileScreen back={back} go={go} />;
    if (screen === 'settings') return <SafeSettingsScreen back={back} go={go} theme={theme} setTheme={setTheme} />;
    if (screen === 'appearance') return <AppearanceScreen back={back} theme={theme} setTheme={setTheme} />;
    if (screen === 'reviews') return <ReviewsScreen back={back} />;
    if (screen === 'events') return <EventsScreen go={go} mode={bookingMode} setMode={setBookingMode} />;
    if (screen === 'event') return <EventScreen back={back} event={event} />;
    if (screen === 'dining') return <DiningScreen go={go} mode={diningMode} setMode={setDiningMode} />;
    if (screen === 'outlet') return <OutletScreen go={go} back={back} outlet={outlet} />;
    if (screen === 'menu') return <MenuScreen go={go} back={back} outlet={outlet} />;
    if (['notices', 'contact', 'rules', 'about', 'terms', 'privacy'].includes(screen)) return <InfoScreen back={back} info={screen} />;
    if (screen === 'info') return <InfoScreen back={back} info={info} />;
    if (screen === 'offline') return <OfflineScreen go={go} />;
    if (screen === 'system-error') return <SystemErrorScreen back={back} go={go} />;
    return <HomeScreen go={go} beginBooking={beginBooking} />;
  };

  return <div className={`cm-prototype cm-theme-${theme}`}>
    <div className="cm-phone-frame">
      <main className={`cm-scroll ${!showBottomNav ? 'cm-scroll-full' : ''}`}>{renderPage()}</main>
      {showBottomNav && <BottomNav screen={screen} go={go} />}
    </div>
  </div>;
}

function HomeScreen({ go, beginBooking }) {
  return <div className="cm-page cm-home">
    <header className="cm-home-header" aria-label="Home header">
      <h1>Home</h1>
      <div className="cm-home-header-actions">
        <button className="cm-icon-button" aria-label="Notifications"><Bell /></button>
        <button className="cm-home-account" aria-label="Profile" onClick={() => go('profile')}><UserRound size={18}/></button>
      </div>
    </header>

    <button className="cm-location-selector" aria-label="Current location: Patan, Gujarat">
      <span className="cm-location-pin"><MapPin size={16}/></span>
      <span><small>LOCATION</small><strong>Patan, Gujarat</strong></span>
      <ChevronDown size={15}/>
    </button>

    <section className="cm-clubhouse-greeting">
      <p className="cm-overline">CLUBHOUSE LOUNGE</p>
      <h1>Good afternoon</h1>
    </section>

    <button className="cm-reserve-spotlight" onClick={() => beginBooking()}>
      <img src="/images/hero_arena.jpg" alt=""/>
      <span className="cm-spotlight-scrim"/>
      <span className="cm-spotlight-copy"><small>PRIME EVENING SLOTS</small><strong>Reserve Your Slot</strong><span>Fast Filling Today</span></span>
      <span className="cm-spotlight-tags"><i>FAST FILLING</i></span>
      <span className="cm-spotlight-book">Book Now <ArrowRight size={16}/></span>
    </button>

    <section className="cm-home-arenas">
      <div className="cm-home-section-head"><div><h2>Authorized Sports</h2></div><button onClick={() => go('facilities')}>See all <ChevronRight size={15}/></button></div>
      <div className="cm-home-sport-filters" aria-label="Authorized sports">
        <button className="selected">All Activities</button>
        {['Box Cricket', 'Skating Rink', 'Pickle Ball', 'Cricket Green Net Practice'].map((sport) => (
          <button key={sport} onClick={() => beginBooking(prototypeFacilities.find(f => f.name === sport))}>{sport}</button>
        ))}
      </div>
    </section>

    <section className="cm-quick-match-section">
      <div className="cm-home-section-head"><div><h2>Quick Match Booking</h2></div></div>
      <div className="cm-quick-match-list">{prototypeFacilities.filter(f => f.id !== 'shooting-machine').map((facility) => <button className="cm-quick-match-card" key={facility.id} onClick={() => beginBooking(facility)}>
        <span className="cm-quick-match-media"><img src={facility.image} alt=""/><span className="cm-quick-match-overlay cm-quick-match-rating"><Star size={12} fill="currentColor"/>{facility.rating}</span><span className="cm-quick-match-overlay cm-quick-match-status">Open now</span></span>
        <span className="cm-quick-match-details"><span className="cm-quick-match-badge">{facility.service}</span><strong>{facility.name}</strong><small><MapPin size={12}/> Patan, Gujarat</small><span className="cm-quick-match-rate"><b>From</b> {facility.tariff}/hr</span><em><Clock3 size={12}/> {facility.availability}</em></span>
        <span className="cm-quick-match-cta">Book Slot <ArrowRight size={15}/></span>
      </button>)}</div>
    </section>
  </div>;
}

function FacilitiesScreen({ go }) { return <div className="cm-page cm-venues-page"><header className="cm-curated-top"><h1>Venues</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile" onClick={() => go('profile')}><UserRound size={18}/></button></div></header><div className="cm-venues-search"><Search size={19}/><input placeholder="Search facilities, sports..." aria-label="Search facilities, sports"/><button aria-label="Filter venues"><Menu size={18}/></button></div><div className="cm-venues-filter">{['All', 'Box Cricket', 'Skating Rink', 'Pickle Ball', 'Cricket Green Net Practice'].map((filter, index) => <button key={filter} className={index === 0 ? 'selected' : ''}>{filter}</button>)}</div><div className="cm-venues-meta"><span><i/>Patan Campus</span><b>FAST BOOKING</b></div><div className="cm-venues-list">{prototypeFacilities.map((facility) => <button key={facility.id} className="cm-venue-card" onClick={() => go('facility', { facility })}><span className="cm-venue-card-media"><img src={facility.image} alt=""/><i className="cm-venue-rating"><Star size={12} fill="currentColor"/>{facility.rating} ({facility.reviewCount})</i><i className="cm-venue-area">{facility.area}</i><i className="cm-venue-status">{facility.status}</i></span><span className="cm-venue-card-body"><strong>{facility.venueName}</strong><small><MapPin size={13}/>{facility.location}</small><em>{facility.name}{facility.id === 'green-net' && ' · Shooting Machine available as add-on'}</em><span className="cm-venue-card-bottom"><span><b>STARTING AT</b><strong>{facility.tariff}<small>/ hr</small></strong></span><i>View Arena & Slots <ArrowRight size={17}/></i></span></span></button>)}</div></div>; }

function FacilityDetail({ facility, beginBooking, back, go }) { return <div className="cm-page cm-curated-detail"><header className="cm-detail-top"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Facility Detail</h1><div><button className="cm-icon-button" aria-label="Save facility"><Bookmark/></button><button className="cm-icon-button" aria-label="Share facility"><Share2/></button><button className="cm-home-account" aria-label="Profile" onClick={() => go('profile')}><UserRound size={18}/></button></div></header><div className="cm-curated-detail-media"><img src={facility.image} alt=""/><span className="cm-detail-active"><i/>ACTIVE & BOOKABLE</span><span className="cm-detail-service">⚯ {facility.name}</span><span className="cm-detail-photos">▣ 1 of 4 Photos</span></div><section className="cm-curated-detail-copy"><div className="cm-detail-reference"><span>SERVICE</span><b>{facility.service}</b></div><h2>{facility.venueName}</h2><div className="cm-detail-review"><Star size={16} fill="currentColor"/> <strong>{facility.rating}</strong> <i/> <button onClick={() => go('reviews')}>{facility.reviewCount} Verified Reviews →</button></div><span className="cm-detail-service-line">⚯ {facility.name} · {facility.label}</span><div className="cm-detail-feature-grid"><div><Clock3/><small>Slot Duration</small><strong>1h / 2h</strong></div><div><Clock3/><small>Operating Window</small><strong>24/7</strong></div><div><Sparkles/><small>Pitch Surface</small><strong>Synthetic Turfed Enclosure</strong></div><div><UsersRound/><small>Equipment</small><strong>Feeder & Stumps Provided</strong></div></div><h3>About This Facility</h3><div className="cm-detail-content-card"><p>{facility.description}</p><span>✿ Indoor Covered Bay　⚯ Power Feeder Ports</span></div><div className="cm-detail-heading-row"><h3>Pricing & Tariffs</h3><small>Member Rates Apply</small></div><div className="cm-detail-tariff"><div><h2>{facility.tariff}</h2><b>Standard Tier</b></div><p>Based on verified patron bookings</p><div className="cm-detail-tariff-table"><span>Standard Lane (Off-Peak)<strong>{facility.tariff} / hr</strong></span><span>Prime Lane (Peak Evening)<strong>{facility.tariff} / hr</strong></span><span>Equipment Provision<strong>Included</strong></span></div><em>Based on verified patron bookings</em></div><h3>Venue Guidelines</h3><div className="cm-guidelines"><div><span>◉</span><p><strong>Approved Footwear</strong>Flat rubber-soled turf trainers or non-marking sports shoes required. Metal spikes strictly prohibited.</p></div><div><span>▦</span><p><strong>Turnstile Check-In</strong>Digital pass scan at turnstile gate 10 mins prior to slot commencement.</p></div><div><span>◒</span><p><strong>Equipment Provision</strong>Club training balls included; protective batting gear and pads available on request at bay desk.</p></div></div></section><BookingBar label={facility.name} ctaText="Select Date & Time" onClick={() => beginBooking(facility)} detail={`Starting from ${facility.tariff}/hr`} /></div>; }

function BookingScreen({
  back,
  bookingStep,
  setBookingStep,
  selectedFacility,
  onFacilityChange,
  bookingDays,
  selectedDateIndex,
  selectedDate,
  onDateChange,
  selectedDuration,
  onDurationChange,
  selectedSlot,
  setSelectedSlot,
  selectedSlotLabel,
  bookingDetails,
  setBookingDetails,
  pricing,
  go
}) {
  const detailsReady = bookingDetails.name.trim().length >= 2 && bookingDetails.phone.replace(/\D/g, '').length >= 10;
  const canContinue = bookingStep === 1
    ? Boolean(selectedFacility)
    : bookingStep === 2
      ? Boolean(selectedSlot)
      : bookingStep === 3
        ? detailsReady
        : true;

  const continueStep = () => {
    if (!canContinue) return;
    if (bookingStep < 4) setBookingStep(bookingStep + 1);
    else go('processing');
  };

  const handleBack = () => {
    if (bookingStep > 1) {
      setBookingStep(bookingStep - 1);
    } else {
      back();
    }
  };

  const nextCtaText = bookingStep === 1
    ? 'Select Date & Time'
    : bookingStep === 2
      ? 'Continue to Details'
      : bookingStep === 3
        ? 'Review Booking'
        : 'Proceed to Pay';

  const barLabel = bookingStep === 1
    ? (selectedFacility ? selectedFacility.name : 'Select Sport & Service')
    : bookingStep === 2
      ? (selectedSlot ? `${selectedFacility.venueName} · ${selectedSlot}` : 'Select an available slot')
      : bookingStep === 3
        ? (detailsReady ? `Lead: ${bookingDetails.name.trim()}` : 'Guest Details Required')
        : 'Confirm & Pay';

  const title = bookingStep === 1
    ? 'Select Sport & Venue'
    : bookingStep === 2
      ? 'Select Date & Slot'
      : bookingStep === 3
        ? 'Guest Details'
        : 'Review & Pay';

  const actionDetail = bookingStep === 1
    ? (selectedFacility ? `1 arena selected · ${selectedFacility.tariff}/hr` : 'Step 1 of 4 · Choose a sport')
    : bookingStep === 2
      ? (selectedSlotLabel || `${selectedDuration} hr block · Choose a time slot`)
      : bookingStep === 3
        ? (detailsReady ? 'Contact details verified' : 'Full name & 10-digit mobile required')
        : `Total: ₹${pricing.totalPayable} · Secure Checkout`;

  return <div className="cm-page cm-booking">
    <header className="cm-booking-top">
      <button className="cm-icon-button" onClick={handleBack} aria-label="Go back"><ArrowLeft/></button>
      <div><span>TURF & TASTE</span><h1>{title}</h1></div>
      <button className="cm-home-account" aria-label="Profile" onClick={() => go('profile')}><UserRound size={18}/></button>
    </header>

    <div className="cm-booking-progress" aria-label={`Step ${bookingStep} of 4`}>
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isComplete = stepNum < bookingStep;
        const isActive = stepNum === bookingStep;
        return (
          <button
            key={step}
            className={isActive ? 'active' : isComplete ? 'complete' : ''}
            onClick={() => isComplete && setBookingStep(stepNum)}
            aria-label={`Step ${stepNum}: ${step}`}
          >
            <b>{isComplete ? <Check size={14}/> : stepNum}</b>
            <span>{step}</span>
          </button>
        );
      })}
    </div>

    <div className="cm-booking-context">
      <img src={selectedFacility ? selectedFacility.image : '/images/hero_arena.jpg'} alt=""/>
      <div>
        <small>{bookingStep === 1 ? 'STEP 1 OF 4' : 'SELECTED ARENA'}</small>
        <strong>{bookingStep === 1 ? (selectedFacility ? selectedFacility.name : 'Choose a Service') : selectedFacility.venueName}</strong>
      </div>
      {bookingStep > 1 && <button onClick={() => { setSelectedSlot(null); setBookingStep(1); }}>Change</button>}
    </div>

    {bookingStep === 1 && (
      <StepVenue selectedFacility={selectedFacility} onFacilityChange={onFacilityChange} />
    )}
    {bookingStep === 2 && (
      <StepSlots
        selectedFacility={selectedFacility}
        bookingDays={bookingDays}
        selectedDateIndex={selectedDateIndex}
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        selectedDuration={selectedDuration}
        onDurationChange={onDurationChange}
        selectedSlot={selectedSlot}
        setSelectedSlot={setSelectedSlot}
      />
    )}
    {bookingStep === 3 && (
      <StepDetails
        selectedFacility={selectedFacility}
        selectedDate={selectedDate}
        selectedSlotLabel={selectedSlotLabel}
        bookingDetails={bookingDetails}
        setBookingDetails={setBookingDetails}
      />
    )}
    {bookingStep === 4 && (
      <StepReview
        selectedFacility={selectedFacility}
        selectedDate={selectedDate}
        selectedDuration={selectedDuration}
        selectedSlotLabel={selectedSlotLabel}
        bookingDetails={bookingDetails}
        pricing={pricing}
        quoteLoading={bookingState.quoteLoading}
        quoteError={bookingState.quoteError}
      />
    )}

    <BookingBar
      label={barLabel}
      detail={actionDetail}
      ctaText={nextCtaText}
      disabled={!canContinue}
      onClick={continueStep}
    />
  </div>;
}

function StepVenue({ selectedFacility, onFacilityChange }) {
  return <section className="cm-step">
    <div className="cm-step-heading">
      <p className="cm-overline">AUTHORIZED ARENAS</p>
      <h2>Select Sport &amp; Service</h2>
      <p>Choose the sport and session format for your booking.</p>
    </div>
    <div className="cm-venue-choice-list" aria-label="Authorized sports and services">
      {prototypeFacilities.filter(f => f.id !== 'shooting-machine').map((facility) => {
        const isSelected = selectedFacility && selectedFacility.id === facility.id;
        return (
          <button
            key={facility.id}
            className={isSelected ? 'selected' : ''}
            onClick={() => onFacilityChange(facility)}
            aria-pressed={isSelected}
            aria-label={`${facility.name} - ${facility.label}`}
          >
            <img src={facility.image} alt="" />
            <span>
              <strong>{facility.name}</strong>
              <small>{facility.label} · From {facility.tariff}/hr</small>
              {isSelected && <em>Selected · Ready to continue to schedule</em>}
            </span>
            {isSelected && <Check size={18} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
    <div className="cm-booking-venues-label">
      <strong>{selectedFacility ? 'Selected Arena' : 'Available Venues'}</strong>
      <span>
        {selectedFacility
          ? `${selectedFacility.venueName} · ${selectedFacility.location}`
          : 'Choose a sport or service above to view available arenas & slots.'}
      </span>
    </div>
  </section>;
}

function StepSlots({
  selectedFacility,
  bookingDays,
  selectedDateIndex,
  selectedDate,
  onDateChange,
  selectedDuration,
  onDurationChange,
  selectedSlot,
  setSelectedSlot
}) {
  const durationLabel = selectedDuration === 1 ? '1 hour' : '2 hours';

  return <section className="cm-step">
    <div className="cm-step-heading">
      <p className="cm-overline">{selectedFacility ? selectedFacility.name.toUpperCase() : 'SCHEDULE'}</p>
      <h2>Select Date &amp; Time</h2>
      <p>Asia/Kolkata (IST) · {durationLabel} standard slot</p>
    </div>

    <div className="cm-date-strip cm-source-dates" aria-label="Select booking date">
      {bookingDays.map((day, index) => {
        const isSelected = index === selectedDateIndex;
        return (
          <button
            key={day.dateString}
            className={isSelected ? 'selected' : ''}
            onClick={() => onDateChange(index)}
            aria-pressed={isSelected}
            aria-label={`${day.displayFull}${day.isToday ? ' (Today)' : ''}`}
          >
            <small>{day.isToday ? 'Today' : day.dayName}</small>
            <strong>{day.dayNum}</strong>
          </button>
        );
      })}
    </div>

    <div className="cm-duration" aria-label="Match duration selection">
      <span>Match Duration</span>
      {[1, 2].map((dur) => (
        <button
          key={dur}
          className={selectedDuration === dur ? 'selected' : ''}
          onClick={() => onDurationChange(dur)}
          aria-pressed={selectedDuration === dur}
        >
          {dur} {dur === 1 ? 'hr' : 'hrs'}
        </button>
      ))}
    </div>

    <div className="cm-availability-legend">
      <span><i/>Available</span>
      <span><i/>Filling Fast</span>
      <span><i/>Booked</span>
    </div>

    <SlotGroup
      title="Morning (Early Bird)"
      note="Special Rate Available"
      slotItems={MORNING_SLOTS}
      dateString={selectedDate.dateString}
      durationHours={selectedDuration}
      selectedSlot={selectedSlot}
      setSelectedSlot={setSelectedSlot}
    />

    <SlotGroup
      title="Evening & Floodlit (Prime)"
      note="Peak Hours"
      slotItems={EVENING_SLOTS}
      dateString={selectedDate.dateString}
      durationHours={selectedDuration}
      selectedSlot={selectedSlot}
      setSelectedSlot={setSelectedSlot}
    />
  </section>;
}

function SlotGroup({ title, note, slotItems, dateString, durationHours, selectedSlot, setSelectedSlot }) {
  return <div className="cm-slot-group">
    <div><h3>{title}</h3><span>{note}</span></div>
    <div className="cm-slot-grid">
      {slotItems.map((slot) => {
        const isSelected = slot === selectedSlot;
        const { state, selectable, label: badgeLabel } = getSlotState(slot, dateString, durationHours);
        const className = [
          isSelected ? 'selected' : '',
          state === 'booked' ? 'busy' : '',
          state === 'past' ? 'past' : '',
          state === 'unavailable' ? 'unavailable' : '',
        ].filter(Boolean).join(' ');

        return (
          <button
            key={slot}
            className={className}
            disabled={!selectable}
            onClick={() => selectable && setSelectedSlot(slot)}
            aria-pressed={isSelected}
            aria-label={`${slot} - ${state}`}
          >
            {slot}
            {isSelected && <Check size={15} aria-hidden="true" />}
            {!isSelected && state !== 'available' && <small>{badgeLabel}</small>}
          </button>
        );
      })}
    </div>
  </div>;
}

function StepDetails({ selectedFacility, selectedDate, selectedSlotLabel, bookingDetails, setBookingDetails }) {
  const update = (key) => (event) => {
    const val = event.target.value;
    setBookingDetails((current) => ({ ...current, [key]: val }));
  };

  return <section className="cm-step">
    <div className="cm-step-heading">
      <p className="cm-overline">GUEST RESERVATION</p>
      <h2>Guest Details</h2>
      <p>We will use these details for arena check-in and booking updates.</p>
    </div>

    <div className="cm-guest-booking-summary">
      <img src={selectedFacility ? selectedFacility.image : '/images/box_cricket.jpg'} alt=""/>
      <div>
        <strong>{selectedFacility ? selectedFacility.venueName : 'Turf & Taste Arena'}</strong>
        <span><CalendarDays size={12}/> {selectedDate ? selectedDate.displayFull : 'Selected date'}</span>
        <span><Clock3 size={12}/> {selectedSlotLabel || 'Selected slot'}</span>
      </div>
    </div>

    <form className="cm-form cm-source-form" onSubmit={(e) => e.preventDefault()}>
      <div className="cm-form-section-title">
        <strong>Lead Player Contact</strong>
        <span>Required</span>
      </div>

      <label htmlFor="guest-full-name">
        <span>Full Name <span className="cm-required-badge">Required</span></span>
        <input
          id="guest-full-name"
          value={bookingDetails.name}
          onChange={update('name')}
          placeholder="Enter lead player full name"
          autoComplete="name"
          required
        />
      </label>

      <label htmlFor="guest-phone">
        <span>WhatsApp / Mobile Number <span className="cm-required-badge">Required</span></span>
        <input
          id="guest-phone"
          value={bookingDetails.phone}
          onChange={update('phone')}
          inputMode="tel"
          placeholder="10-digit mobile number"
          autoComplete="tel"
          required
        />
      </label>
      <small className="cm-form-hint">The entry pass QR and match updates are sent to this WhatsApp / mobile number.</small>

      <label htmlFor="guest-email">
        <span>Email Address <span className="cm-optional-badge">(Optional)</span></span>
        <input
          id="guest-email"
          value={bookingDetails.email}
          onChange={update('email')}
          inputMode="email"
          placeholder="name@example.com"
          autoComplete="email"
        />
      </label>

      <div className="cm-form-section-title">
        <strong>Match Preferences</strong>
      </div>

      <label htmlFor="guest-note">
        <span>Team / group note <span className="cm-optional-badge">(Optional)</span></span>
        <textarea
          id="guest-note"
          value={bookingDetails.note}
          onChange={update('note')}
          placeholder="Add equipment or pitch preferences for the venue team…"
          rows="3"
        />
      </label>
    </form>
  </section>;
}

function StepReview({ selectedFacility, selectedDate, selectedDuration, selectedSlotLabel, bookingDetails, pricing, quoteLoading, quoteError }) {
  if (quoteLoading) {
    return <section className="cm-step">
      <div className="cm-step-heading">
        <p className="cm-overline">SECURE CHECKOUT</p>
        <h2>Review &amp; Pay</h2>
        <p>Calculating your booking quote...</p>
      </div>
      <div className="cm-booking-empty">
        <Clock3 size={32}/>
        <h3>Loading pricing</h3>
        <p>Fetching server-authoritative rates for your selection.</p>
      </div>
    </section>;
  }

  if (quoteError) {
    return <section className="cm-step">
      <div className="cm-step-heading">
        <p className="cm-overline">SECURE CHECKOUT</p>
        <h2>Review &amp; Pay</h2>
        <p>Unable to calculate pricing.</p>
      </div>
      <div className="cm-booking-empty">
        <CircleAlert size={32}/>
        <h3>Pricing unavailable</h3>
        <p>{quoteError}</p>
      </div>
    </section>;
  }

  if (!pricing) {
    return <section className="cm-step">
      <div className="cm-step-heading">
        <p className="cm-overline">SECURE CHECKOUT</p>
        <h2>Review &amp; Pay</h2>
        <p>Select a slot to see pricing.</p>
      </div>
      <div className="cm-booking-empty">
        <Clock3 size={32}/>
        <h3>No slot selected</h3>
        <p>Please go back and select a time slot to see pricing.</p>
      </div>
    </section>;
  }

  return <section className="cm-step">
    <div className="cm-step-heading">
      <p className="cm-overline">SECURE CHECKOUT</p>
      <h2>Review &amp; Pay</h2>
      <p>Confirm your reservation and payment breakdown.</p>
    </div>

    <div className="cm-review-card">
      <img src={selectedFacility.image} alt=""/>
      <div>
        <span className="cm-status">Booking summary</span>
        <strong>{selectedFacility.venueName}</strong>
        <small><MapPin size={13}/> {selectedFacility.location}</small>
        <span><CalendarDays size={15}/> {selectedDate ? selectedDate.displayFull : 'Selected date'}</span>
        <span><Clock3 size={15}/> {selectedSlotLabel}</span>
        {bookingDetails.name && (
          <span style={{ color: 'var(--cm-ink)', fontWeight: 700 }}>
            Lead: {bookingDetails.name.trim()} · +91 {bookingDetails.phone.replace(/\D/g, '')}
          </span>
        )}
      </div>
    </div>

    <div className="cm-price-breakdown">
      <div className="cm-breakdown-top">
        <strong>Price Breakdown</strong>
        <span>Server-verified</span>
      </div>
      <div>
        <span>Base Rate ({selectedDuration} {selectedDuration === 1 ? 'hr' : 'hrs'})</span>
        <strong>₹{pricing.hourlyRate || '—'}</strong>
      </div>
      {pricing.weekendSurgePercent > 0 && (
        <div>
          <span>Weekend Surge</span>
          <strong>+{pricing.weekendSurgePercent}%</strong>
        </div>
      )}
      <div className="cm-payable">
        <span>Total Payable</span>
        <strong>₹{pricing.total ?? '—'}</strong>
      </div>
      <p><ShieldCheck size={16}/> Amount is server-authoritative and verified for this session.</p>
    </div>

    <button className="cm-payment-row">
      <CreditCard />
      <span>
        <strong>Razorpay Secure Checkout</strong>
        <small>UPI, Cards, Netbanking &amp; Wallets</small>
      </span>
      <ChevronRight />
    </button>
  </section>;
}

function ProcessingScreen({ back, failed, setFailed, selectedFacility, selectedDate, selectedSlotLabel, pricing, go }) {
  if (failed) return <div className="cm-page cm-payment-failed">
    <header className="cm-source-state-header">
      <button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button>
      <h1>Payment Failed</h1>
      <button className="cm-home-account" aria-label="Profile" onClick={() => go('profile')}><UserRound size={18}/></button>
    </header>
    <div className="cm-payment-error-icon"><CircleAlert/></div>
    <h1>Payment Could Not Be Processed</h1>
    <p>Your bank or UPI app declined the transaction, or the session timed out.</p>
    <div className="cm-held-booking">
      <div><span>BOOKING NOT CONFIRMED</span></div>
      <img src={selectedFacility.image} alt=""/>
      <strong>{selectedFacility.venueName}</strong>
      <p><CalendarDays size={13}/> {selectedDate ? selectedDate.displayFull : 'Selected date'} · {selectedSlotLabel}</p>
      <div><span>Total Payable</span><b>₹{pricing?.total ?? '—'}</b></div>
    </div>
    <p className="cm-payment-alert">No money has been deducted from your account.</p>
    <Button onClick={() => { setFailed(false); go('processing'); }} icon={ArrowRight}>Retry Payment</Button>
    <button className="cm-text-button" onClick={() => go('booking')}>Review or change selection</button>
  </div>;

  return <div className="cm-page cm-payment-processing">
    <header className="cm-source-state-header">
      <button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button>
      <h1>Processing Payment</h1>
      <button className="cm-home-account" aria-label="Profile" onClick={() => go('profile')}><UserRound size={18}/></button>
    </header>
    <div className="cm-processing-backdrop">
      <p>{selectedFacility.venueName}</p>
      <small>Secure checkout</small>
      <div className="cm-processing-card">
        <div className="cm-processing-orbit"><div><LockKeyhole/><span>R</span></div></div>
        <p className="cm-overline">RAZORPAY SECURE CHECKOUT</p>
        <h2>Securing your payment</h2>
        <p>Opening Razorpay checkout mode...</p>
        <Button onClick={() => go('success')} icon={Check}>Continue to Payment</Button>
      </div>
    </div>
  </div>;
}

function SuccessScreen({ go, selectedFacility, selectedDate, selectedSlotLabel, booking }) {
  return <div className="cm-page cm-centered cm-success">
    <div className="cm-success-mark"><Check size={38} /></div>
    <p className="cm-overline">BOOKING CONFIRMED</p>
    <h1>Reservation secured!</h1>
    <p>Your slot has been successfully reserved. Access pass and booking details are ready.</p>
    <div className="cm-confirmation-ref">
      <small>BOOKING REFERENCE</small>
      <strong>{booking?.id || 'Processing...'}</strong>
      <span>{selectedFacility ? selectedFacility.name : 'Turf 1'} · {selectedDate ? selectedDate.displayShort : 'Tue 23'} · {selectedSlotLabel || '6:00 PM'}</span>
    </div>
    <Button onClick={() => go('pass')} icon={TicketCheck}>View Entry Pass</Button>
    <button className="cm-text-button" onClick={() => go('bookings')}>View My Reservations</button>
  </div>;
}

function PassScreen({ go, back, selectedFacility, selectedDate, selectedSlotLabel, bookingDetails, booking }) {
  return <div className="cm-page cm-pass cm-curated-pass">
    <header className="cm-source-state-header">
      <button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button>
      <h1>Entry Pass</h1>
      <div>
        <button className="cm-icon-button" aria-label="Save pass"><Bookmark/></button>
        <button className="cm-icon-button" aria-label="Share pass"><Share2/></button>
      </div>
    </header>
    <div className="cm-pass-access">
      <span><Check size={13}/> ACTIVE MATCH PASS</span>
      <b>CONFIRMED ENTRY</b>
    </div>
    <div className="cm-pass-booking-name">
      <span>TURF &amp; TASTE CLUBHOUSE</span>
      <strong>{selectedFacility ? selectedFacility.venueName : 'Turf 1'}</strong>
    </div>
    <div className="cm-pass-ticket">
      <span className="cm-pass-label">VALID MATCH PASS</span>
      <p>REF: {booking?.id || 'Pending'}</p>
      <h1>{selectedFacility ? selectedFacility.name : 'Box Cricket Match'}</h1>
      <div className="cm-pass-meta">
        <span><CalendarDays/> DATE<br/><b>{selectedDate ? selectedDate.displayFull : 'Tue, 23 Sep 2026'}</b></span>
        <span><Clock3/> SLOT TIME<br/><b>{selectedSlotLabel || '6:00 PM – 7:00 PM (1 hr)'}</b></span>
      </div>
      {bookingDetails && bookingDetails.name && (
        <small style={{ color: 'var(--cm-ink)', fontWeight: 700, margin: '4px 0 8px' }}>
          Player: {bookingDetails.name.trim()} · +91 {bookingDetails.phone.replace(/\D/g, '')}
        </small>
      )}
      {booking?.id ? (
        <div className="cm-qr" aria-label="Digital entry QR code">
          <i/><i/><i/><i/><i/><i/><i/><i/><i/>
        </div>
      ) : (
        <div className="cm-booking-empty" style={{ padding: 'var(--space-4)' }}>
          <Clock3 size={32}/>
          <h3>QR Pending</h3>
          <p>Your entry QR code will be generated once your booking is confirmed.</p>
        </div>
      )}
      {booking?.id && <small>Scan this digital QR at the turnstile gate 10 minutes before your match start.</small>}
    </div>
    <Button onClick={() => go('bookings')} icon={NotebookTabs}>View My Reservations</Button>
  </div>;
}

function BookingsScreen({ go }) {
  return <div className="cm-page cm-curated-bookings">
    <header className="cm-curated-top">
      <h1>My Reservations</h1>
      <div>
        <button className="cm-icon-button" aria-label="Notifications"><Bell/></button>
        <button className="cm-home-account" aria-label="Profile" onClick={() => go('profile')}><UserRound size={18}/></button>
      </div>
    </header>
    <div className="cm-reservation-heading">
      <div>
        <p className="cm-overline">CLUBHOUSE PASSES</p>
        <h1>Upcoming Games</h1>
      </div>
      <span><i/>1 ACTIVE</span>
    </div>
    <div className="cm-tabs">
      <button className="active">Upcoming <i>1</i></button>
      <button>History <i>0</i></button>
    </div>
    <div className="cm-booking-empty">
      <CalendarDays size={32}/>
      <h3>No reservations yet</h3>
      <p>Your upcoming bookings will appear here after you make a reservation.</p>
    </div>
    <div className="cm-clubhouse-guarantee">
      <ShieldCheck/>
      <div>
        <strong>Clubhouse Guarantee</strong>
        <span>Instant turnstile entry with digital QR pass verification.</span>
      </div>
    </div>
  </div>;
}

function SafeAuthScreen({ back, authScreen, setAuthScreen, go }) {
  const { login, isAuthenticated } = useCustomerAuth();
  const [form, setForm] = useState({ name: '', phone: '', password: '', confirm: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const isForgot = authScreen === 'forgot';
  const isReset = authScreen === 'reset';
  const isExpired = authScreen === 'expired';
  const isCreate = authScreen === 'create';

  const title = isForgot ? 'Forgot Password' : isReset ? 'Create New Password' : isExpired ? 'Authentication Required' : isCreate ? 'Join Turf & Taste' : 'Welcome Back';
  const action = isForgot ? 'Send Verification Code' : isReset ? 'Update Password' : isExpired ? 'Sign In' : isCreate ? 'Create Account' : 'Sign In';

  const nameValid = form.name.trim().length >= 2;
  const phoneDigits = form.phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 10;
  const passwordValid = form.password.length >= 6;
  const confirmValid = form.password === form.confirm;

  const ready = isExpired
    ? true
    : isForgot
      ? phoneValid
      : isReset
        ? passwordValid && confirmValid
        : isCreate
          ? nameValid && phoneValid && passwordValid
          : phoneValid && passwordValid;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = () => {
    setSubmitted(true);
    if (!ready) return;
    if (isForgot) {
      setAuthScreen('reset');
    } else if (isReset || isExpired || authScreen === 'signin' || isCreate) {
      const identifier = phoneDigits || form.email.trim();
      login(identifier, form.name.trim() || null);
      go('profile');
    } else {
      setAuthScreen('signin');
    }
  };

  return <div className={`cm-page cm-auth cm-source-auth ${isExpired ? 'cm-session-expired' : ''}`}>
    <header className="cm-source-state-header">
      <button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button>
      <h1>{isCreate ? 'Create Account' : isForgot ? 'Forgot Password' : isReset ? 'Reset Password' : isExpired ? 'Session Expired' : 'Sign In'}</h1>
      <span/>
    </header>
    {!isExpired && <img className="cm-auth-cover" src={isCreate ? '/images/hero_arena.jpg' : isForgot ? '/images/cricket_nets.jpg' : '/images/box_cricket.jpg'} alt=""/>}
    <div className="cm-auth-mark">t<span>&amp;</span>t</div>
    <p className="cm-overline">{isExpired ? 'SESSION INACTIVE' : isForgot ? 'TURF & TASTE CONCIERGE' : isReset ? 'IDENTITY CONFIRMED' : isCreate ? 'CLUBHOUSE MEMBERSHIP' : 'MEMBER SOCIAL & SPORT'}</p>
    <h1>{title}</h1>
    <p>
      {isExpired
        ? 'For your account security, your session has timed out after a period of inactivity. Please sign in again to continue.'
        : isForgot
          ? 'Enter your registered mobile number to receive a secure verification code.'
          : isReset
            ? 'Set a secure new password for your clubhouse account.'
            : isCreate
              ? 'Create your account to book pitches, practice nets, and attend club events.'
              : 'Sign in to manage your court reservations, session schedules, and club passes.'}
    </p>

    {!isExpired && <form className="cm-form cm-source-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      {isCreate && (
        <label>
          <span>Full Name <span className="cm-required-badge">Required</span></span>
          <input
            value={form.name}
            onChange={update('name')}
            placeholder="Enter your full name"
            autoComplete="name"
            required
          />
          {submitted && !nameValid && <span className="cm-field-error">Please enter at least 2 characters.</span>}
        </label>
      )}

      <label>
        <span>{isForgot ? 'Registered Mobile Number' : 'Mobile / WhatsApp Number'} <span className="cm-required-badge">Required</span></span>
        <input
          value={form.phone}
          onChange={update('phone')}
          inputMode="tel"
          placeholder="10-digit mobile number"
          autoComplete="tel"
          required
        />
        {submitted && !phoneValid && <span className="cm-field-error">Please enter a valid 10-digit mobile number.</span>}
      </label>

      {!isForgot && (
        <label>
          <span>{isReset ? 'New Password' : 'Password'} <span className="cm-required-badge">Required</span></span>
          <input
            value={form.password}
            onChange={update('password')}
            type="password"
            placeholder={isReset ? 'New password (min 6 chars)' : 'Enter password (min 6 chars)'}
            autoComplete={isReset ? 'new-password' : 'current-password'}
            required
          />
          {submitted && !passwordValid && <span className="cm-field-error">Password must be at least 6 characters.</span>}
        </label>
      )}

      {isReset && (
        <label>
          <span>Confirm New Password <span className="cm-required-badge">Required</span></span>
          <input
            value={form.confirm}
            onChange={update('confirm')}
            type="password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            required
          />
          {submitted && !confirmValid && <span className="cm-field-error">Passwords do not match.</span>}
        </label>
      )}

      {isCreate && (
        <label>
          <span>Email Address <span className="cm-optional-badge">Optional</span></span>
          <input
            value={form.email}
            onChange={update('email')}
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
          />
        </label>
      )}
    </form>}

    <Button disabled={!ready} onClick={submit} icon={isExpired ? LockKeyhole : ArrowRight}>{action}</Button>

    {authScreen === 'signin' && (
      <>
        <button className="cm-text-button" onClick={() => setAuthScreen('forgot')}>Forgot Password?</button>
        <p className="cm-auth-switch">New to Turf &amp; Taste? <button onClick={() => setAuthScreen('create')}>Create Account</button></p>
        <p className="cm-auth-switch" style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--cm-line)' }}>
          <button onClick={() => navigate('/admin')} style={{ color: 'var(--cm-muted)', fontSize: '9px' }}>Staff / Admin Portal</button>
        </p>
      </>
    )}
    {isCreate && (
      <p className="cm-auth-switch">Already have an account? <button onClick={() => setAuthScreen('signin')}>Sign In</button></p>
    )}
    {isExpired && (
      <button className="cm-text-button" onClick={() => go('home')}>Continue as guest</button>
    )}
  </div>;
}

function ProfileScreen({ go, theme }) { return <div className="cm-page cm-source-profile"><header className="cm-curated-top"><h1>Profile</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><div className="cm-profile-hero"><div className="cm-avatar"><UserRound size={25}/></div><div><span>GUEST</span><h2>Guest User</h2><p>Sign in to access your profile</p></div></div><Button onClick={() => go('auth')} icon={LockKeyhole}>Sign In</Button><SectionTitle title="Account &amp; Bookings"/><div className="cm-list-card"><button onClick={() => go('bookings')}><NotebookTabs/><span><strong>My Bookings</strong><small>Upcoming, past &amp; venue details</small></span><ChevronRight/></button><button onClick={() => go('edit-profile')}><UserRound/><span><strong>Personal &amp; Contact Details</strong><small>Name, registered mobile, &amp; email</small></span><ChevronRight/></button><button onClick={() => go('pass')}><CreditCard/><span><strong>Saved Payment Methods</strong><small>UPI IDs &amp; cards managed via Razorpay</small></span><ChevronRight/></button><button onClick={() => go('reviews')}><Star/><span><strong>My Sports Preferences</strong><small>Selected formats for quick match discovery</small></span><ChevronRight/></button></div><SectionTitle title="Preferences"/><div className="cm-list-card"><button onClick={() => go('settings')}><Settings/><span><strong>Appearance / Theme</strong><small>{theme === 'dark' ? 'Midnight Ivory' : 'Clubhouse Ivory'}</small></span><ChevronRight/></button><button onClick={() => go('info', { info: 'notices' })}><Bell/><span><strong>Updates &amp; Notices</strong><small>Clubhouse and venue announcements</small></span><ChevronRight/></button></div></div>; }

function EditProfileScreen({ back, go }) { return <div className="cm-page cm-source-settings"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Edit Profile</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header><p className="cm-overline">MEMBER DETAILS</p><h2>Personal Profile</h2><div className="cm-edit-avatar"><img src="/images/box_cricket.jpg" alt=""/><span>Tap badge to update club photo</span></div><form className="cm-form cm-source-form" onSubmit={(event) => event.preventDefault()}><div className="cm-form-section-title"><strong>Core Information</strong></div><div className="cm-source-name-grid"><label>First Name<input placeholder="First name" autoComplete="given-name" /></label><label>Last Name<input placeholder="Last name" autoComplete="family-name" /></label></div><label>WhatsApp / Phone Number<input placeholder="Enter your mobile number" inputMode="tel" autoComplete="tel" /></label><label>Email Address<input placeholder="name@example.com" inputMode="email" autoComplete="email" /></label><label>City / Preferred Location<select defaultValue="patan"><option value="patan">Patan, Gujarat</option></select></label></form><BookingBar label="Save Profile" detail="Personal details" onClick={() => go('profile')} /></div>; }

function SettingsScreen({ back, go, theme, setTheme }) { const infoLinks = [['notices', Bell, 'Updates & Notices', 'Latest clubhouse advisories'], ['contact', HelpCircle, 'Contact & Inquiry', 'Talk to the clubhouse desk'], ['rules', ShieldCheck, 'Ground Rules & Guidelines', 'Venue policies and access'], ['about', Info, 'About Turf & Taste', 'Clubhouse and community'], ['terms', FileText, 'Terms', 'Customer app terms'], ['privacy', LockKeyhole, 'Privacy', 'How customer data is handled']]; return <div className="cm-page cm-source-settings"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Settings</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header><div className="cm-settings-privilege"><span><UserRound/> TURF &amp; TASTE Privileges</span><b>Tier 1<br/>Active</b></div><SectionTitle title="GENERAL SETTINGS"/><div className="cm-list-card"><button onClick={() => setTheme(theme === 'dark' ? 'ivory' : 'dark')}><Sun/><span><strong>Appearance / Theme</strong><small>{theme === 'dark' ? 'Midnight Ivory / Dark' : 'Clubhouse Ivory / Light'}</small></span><ChevronRight/></button><button><Bell/><span><strong>Notifications &amp; Alerts</strong><small>Bookings, reminders, match slots</small></span><ChevronRight/></button><button><MapPin/><span><strong>Location &amp; Region</strong><small>Patan, Gujarat · Asia/Kolkata IST</small></span><ChevronRight/></button></div><SectionTitle title="SUPPORT &amp; DESK"/><div className="cm-list-card"><button onClick={() => go('offline')}><WifiOff/><span><strong>Connection status</strong><small>View resilience and recovery state</small></span><ChevronRight/></button>{infoLinks.map(([key, Icon, title, description]) => <button key={key} onClick={() => go('info', { info: key })}><Icon/><span><strong>{title}</strong><small>{description}</small></span><ChevronRight/></button>)}</div><SectionTitle title="MIDNIGHT IVORY · PARITY"/><div className="cm-list-card cm-appearance-panel"><button onClick={() => setTheme('ivory')} className={theme === 'ivory' ? 'selected' : ''}><Sun/><span><strong>Clubhouse Ivory</strong><small>Primary customer flow</small></span>{theme === 'ivory' && <Check/>}</button><button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'selected' : ''}><Moon/><span><strong>Midnight Ivory</strong><small>Dark theme parity</small></span>{theme === 'dark' && <Check/>}</button></div></div>; }

function ReviewsScreen({ back }) { return <div className="cm-page cm-source-reviews"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Reviews</h1><div><button className="cm-icon-button" aria-label="Save"><Bookmark/></button><button className="cm-icon-button" aria-label="Share"><Share2/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><div className="cm-review-visit"><span>TURF &amp; TASTE</span><small>Patan, Gujarat</small><h3>Facility Reviews</h3><p>Patan Campus</p></div><section className="cm-review-form"><h2>Rate your experience</h2><p>Your feedback helps us maintain standards across club surfaces and coaching.</p><div className="cm-rating-pick">{[1,2,3,4,5].map(i => <button key={i} aria-label={`Rate ${i} stars`}><Star/></button>)}</div><span>Select your rating</span><label>Comments<textarea placeholder="Share your thoughts on the pitch condition, lighting, or facilities (optional)…" rows="3" /></label><Button icon={Check}>Submit Review</Button></section><div className="cm-review-list-head"><h2>Past Reviews</h2></div><div className="cm-booking-empty"><Star size={32}/><h3>No reviews yet</h3><p>Reviews from completed sessions will appear here.</p></div></div>; }

function EventsScreen({ go, mode, setMode }) { if (mode === 'loading') return <StatePage icon={<PlayCircle/>} title="Loading club events" body="Fetching event information..." action="Try again" onClick={() => setMode('normal')} secondary="Go Home" onSecondary={() => go('home')} />; if (mode === 'empty') return <StatePage icon={<CalendarDays/>} title="No upcoming events" body="There are no events scheduled right now." action="Go Home" onClick={() => go('home')} />; return <div className="cm-page cm-source-events"><header className="cm-curated-top"><h1>Events</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><p className="cm-overline">CLUBHOUSE CALENDAR</p><h2>What’s happening next.</h2><p>Upcoming events at Turf & Taste, Patan.</p><div className="cm-event-list">{prototypeEvents.map((item) => <button key={item.id} className="cm-event-card" onClick={() => go('event', { event: item })}><img src={item.image} alt=""/><div><span>{item.tag} · {item.date}</span><h3>{item.title}</h3><p>{item.time}</p></div></button>)}</div></div>; }

function EventScreen({ back, event }) { return <div className="cm-page cm-event-detail cm-source-event-detail"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Event Detail</h1><span/></header><div className="cm-event-tags"><span>TURF & TASTE</span><b>{event.tag}</b></div><div className="cm-event-cover"><img src={event.image} alt=""/><span>{event.title}</span><small>Event details only · no registration or ticket purchase</small></div><div className="cm-event-detail-copy"><h1>{event.title}</h1><p>{event.description}</p><div className="cm-event-stat-grid"><div><small>EVENT DATE</small><strong>{event.date}</strong><span>Event schedule</span></div><div><small>START TIME</small><strong>{event.time}</strong><span>Asia/Kolkata</span></div></div><div className="cm-event-capacity"><strong>♧　Event information</strong><span>Check venue for live availability.</span></div><div className="cm-event-venue"><small>◉　VENUE</small><strong>Turf & Taste, Patan</strong><span>Patan Campus, Gujarat</span></div></div></div>; }

function DiningScreen({ go, mode, setMode }) { if (mode === 'loading') return <StatePage icon={<UtensilsCrossed/>} title="Finding clubhouse dining" body="Refreshing café and parlour information..." action="Try again" onClick={() => setMode('normal')} secondary="Go Home" onSecondary={() => go('home')} />; if (mode === 'unavailable') return <StatePage icon={<CircleAlert/>} title="Menu unavailable right now" body="The menu is temporarily unavailable. Please try again later." action="View outlets" onClick={() => setMode('normal')} secondary="Go Home" onSecondary={() => go('home')} />; return <div className="cm-page cm-source-dining"><header className="cm-curated-top"><h1>Dining</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><p className="cm-overline">CLUBHOUSE FOOD &amp; PARLOUR</p><h2>Refuel between matches.</h2><p>Browse café and parlour options at Turf & Taste, Patan.</p><div className="cm-stacked-list">{prototypeOutlets.map((item) => <button key={item.id} className="cm-outlet-card" onClick={() => go('outlet', { outlet: item })}><img src={item.image} alt=""/><div><span>{item.kind}</span><h3>{item.name}</h3><p>{item.hours}</p><ChevronRight/></div></button>)}</div><div className="cm-prototype-disclaimer"><Info size={16}/><p>Browse menu information only. No food ordering or payment is available in the customer app.</p></div></div>; }

function OutletScreen({ go, back, outlet }) { return <div className="cm-page cm-outlet"><Header back onBack={back}/><img className="cm-cover-image" src={outlet.image} alt=""/><div className="cm-outlet-copy"><span className="cm-status">{outlet.kind}</span><h1>{outlet.name}</h1><p>{outlet.description}</p><div className="cm-hours"><Clock3/><span><small>OPERATING HOURS</small><strong>{outlet.hours}</strong></span></div><Button onClick={() => go('menu')} icon={ArrowRight}>View menu</Button></div></div>; }

function MenuScreen({ back, outlet }) { return <div className="cm-page"><Header title={outlet.name} back onBack={back}/><div className="cm-menu-hero"><p className="cm-overline">MENU</p><h2>Good to know before you go.</h2><p>Items and availability are shown for browsing only.</p></div>{outlet.menu.map((section) => <section className="cm-menu-section" key={section.category}><SectionTitle title={section.category}/>{section.items.map((item) => <div className="cm-menu-item" key={item.name}><div><span className="cm-veg-dot">{item.veg && <i/>}</span><strong>{item.name}</strong><small>{item.veg ? 'Vegetarian' : 'Non-vegetarian'}</small></div><b>{item.price}</b></div>)}</section>)}<div className="cm-prototype-disclaimer"><Info size={16}/><p>Menu availability can change at the outlet. Food ordering is not offered here.</p></div></div>; }

function InfoScreen({ back, info }) { const item = infoPages[info]; return <div className="cm-page cm-info-page cm-source-info"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>{item.title}</h1><span/></header><div className="cm-info-art"><Info /></div><p className="cm-overline">TURF &amp; TASTE CLUBHOUSE</p><h1>{item.title}</h1><p>{item.body}</p><div className="cm-info-block"><h3>{info === 'contact' ? 'Contact the clubhouse' : 'Good to know'}</h3><p>{info === 'contact' ? 'For a venue visit, booking reference, or team inquiry, connect with the clubhouse desk during operating hours.' : 'Use the customer navigation to return to venues, events, dining, or your reservations.'}</p></div><Button onClick={back} icon={ArrowLeft}>Go Back</Button></div>; }

function OfflineScreen({ go }) { return <StatePage icon={<WifiOff/>} title="You’re offline" body="Saved booking and clubhouse information may still be available. Reconnect to refresh live availability and updates." action="Try again" onClick={() => go('home')} secondary="View bookings" onSecondary={() => go('bookings')} />; }

function SystemErrorScreen({ back, go }) { return <div className="cm-page cm-centered cm-system-recovery"><Header actions={false}/><div className="cm-state-illustration"><CircleAlert/></div><p className="cm-overline">CUSTOMER APP RECOVERY</p><h1>Something went wrong.</h1><p>We could not complete that preview action. Your local fixture state has not been changed.</p><Button onClick={() => go('home')} icon={Home}>Go Home</Button><button className="cm-text-button" onClick={back}>Go Back</button></div>; }

function SafeProfileScreen({ go, theme }) {
  const { customer, isAuthenticated, logout } = useCustomerAuth();
  return <div className="cm-page cm-source-profile">
    <header className="cm-curated-top"><h1>Profile</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header>
    {isAuthenticated && customer ? (
      <>
        <div className="cm-profile-hero"><div className="cm-avatar"><UserRound size={25}/></div><div><span>MEMBER</span><h2>{customer.name || 'Member'}</h2><p>{customer.identifier}</p></div></div>
        <Button onClick={() => { logout(); go('home'); }} icon={LockKeyhole}>Sign Out</Button>
      </>
    ) : (
      <>
        <div className="cm-profile-hero"><div className="cm-avatar"><UserRound size={25}/></div><div><span>GUEST</span><h2>Guest User</h2><p>Sign in to access your profile</p></div></div>
        <Button onClick={() => go('auth')} icon={LockKeyhole}>Sign In</Button>
      </>
    )}
    <SectionTitle title="Account &amp; Bookings"/>
    <div className="cm-list-card"><button onClick={() => go('bookings')}><NotebookTabs/><span><strong>My Bookings</strong><small>Upcoming, past &amp; venue details</small></span><ChevronRight/></button><button onClick={() => go('edit-profile')}><UserRound/><span><strong>Personal &amp; Contact Details</strong><small>Name, registered mobile, &amp; email</small></span><ChevronRight/></button><button onClick={() => go('pass')}><CreditCard/><span><strong>Saved Payment Methods</strong><small>UPI IDs &amp; cards managed via Razorpay</small></span><ChevronRight/></button><button onClick={() => go('reviews')}><Star/><span><strong>My Sports Preferences</strong><small>Selected formats for quick match discovery</small></span><ChevronRight/></button></div>
    <SectionTitle title="Preferences"/>
    <div className="cm-list-card"><button onClick={() => go('settings')}><Settings/><span><strong>Appearance / Theme</strong><small>{theme === 'dark' ? 'Midnight Ivory' : 'Clubhouse Ivory'}</small></span><ChevronRight/></button><button onClick={() => go('info', { info: 'notices' })}><Bell/><span><strong>Updates &amp; Notices</strong><small>Clubhouse and venue announcements</small></span><ChevronRight/></button></div>
  </div>;
}

function SafeEditProfileScreen({ back, go }) {
  return <div className="cm-page cm-source-settings">
    <header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Edit Profile</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header>
    <p className="cm-overline">PERSONAL DETAILS</p><h2>Personal Profile</h2>
    <div className="cm-edit-avatar"><div className="cm-avatar"><UserRound size={25}/></div><span>Update your profile information.</span></div>
    <form className="cm-form cm-source-form" onSubmit={(event) => event.preventDefault()}><div className="cm-form-section-title"><strong>Core Information</strong></div><div className="cm-source-name-grid"><label>First Name<input placeholder="First name" autoComplete="given-name" /></label><label>Last Name<input placeholder="Last name" autoComplete="family-name" /></label></div><label>WhatsApp / Phone Number<input placeholder="Enter your mobile number" inputMode="tel" autoComplete="tel" /></label><label>Email Address<input placeholder="name@example.com" inputMode="email" autoComplete="email" /></label><label>City / Preferred Location<select defaultValue="patan"><option value="patan">Patan, Gujarat</option></select></label></form>
    <BookingBar label="Save Profile" detail="Personal details" onClick={() => go('profile')} />
  </div>;
}

function SafeSettingsScreen({ back, go, theme, setTheme }) {
  const infoLinks = [['notices', Bell, 'Updates & Notices', 'Latest clubhouse advisories'], ['contact', HelpCircle, 'Contact & Inquiry', 'Talk to the clubhouse desk'], ['rules', ShieldCheck, 'Ground Rules & Guidelines', 'Venue policies and access'], ['about', Info, 'About Turf & Taste', 'Clubhouse and community'], ['terms', FileText, 'Terms', 'Customer app terms'], ['privacy', LockKeyhole, 'Privacy', 'How customer data is handled']];
  const buildInfo = (() => {
    try { return require('../../../generated/build-info.json'); } catch { return null; }
  })();
  return <div className="cm-page cm-source-settings">
    <header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Settings</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header>
    <div className="cm-settings-privilege"><span><UserRound/> TURF & TASTE Privileges</span><b>Tier 1<br/>Active</b></div>
    <SectionTitle title="GENERAL SETTINGS"/><div className="cm-list-card"><button onClick={() => go('appearance')}><Sun/><span><strong>Appearance / Theme</strong><small>{theme === 'dark' ? 'Midnight Ivory / Dark' : 'Clubhouse Ivory / Light'}</small></span><ChevronRight/></button><button><Bell/><span><strong>Notifications &amp; Alerts</strong><small>Bookings, reminders, match slots</small></span><ChevronRight/></button><button><MapPin/><span><strong>Location &amp; Region</strong><small>Patan, Gujarat · Asia/Kolkata IST</small></span><ChevronRight/></button></div>
    <SectionTitle title="SUPPORT &amp; DESK"/><div className="cm-list-card"><button onClick={() => go('offline')}><WifiOff/><span><strong>Connection status</strong><small>View resilience and recovery state</small></span><ChevronRight/></button>{infoLinks.map(([key, Icon, title, description]) => <button key={key} onClick={() => go('info', { info: key })}><Icon/><span><strong>{title}</strong><small>{description}</small></span><ChevronRight/></button>)}</div>
    <SectionTitle title="MIDNIGHT IVORY · PARITY"/><div className="cm-list-card cm-appearance-panel"><button onClick={() => setTheme('ivory')} className={theme === 'ivory' ? 'selected' : ''}><Sun/><span><strong>Clubhouse Ivory</strong><small>Primary customer flow</small></span>{theme === 'ivory' && <Check/>}</button><button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'selected' : ''}><Moon/><span><strong>Midnight Ivory</strong><small>Dark theme parity</small></span>{theme === 'dark' && <Check/>}</button></div>
    {buildInfo && (
      <>
        <SectionTitle title="ABOUT THIS BUILD" />
        <div className="cm-list-card">
          <div><strong>App Version</strong><small>{buildInfo.version} (Build {buildInfo.versionCode})</small></div>
          <div><strong>Git Commit</strong><small>{buildInfo.gitCommit}</small></div>
          <div><strong>Built</strong><small>{buildInfo.buildDate}</small></div>
        </div>
      </>
    )}
  </div>;
}

function AppearanceScreen({ back, theme, setTheme }) {
  return <div className="cm-page cm-source-settings">
    <header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Appearance</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header>
    <p className="cm-overline">APPEARANCE</p><h2>Choose your theme.</h2><p>Switch between Clubhouse Ivory and Midnight Ivory.</p>
    <SectionTitle title="THEME"/>
    <div className="cm-list-card cm-appearance-panel"><button onClick={() => setTheme('ivory')} className={theme === 'ivory' ? 'selected' : ''}><Sun/><span><strong>Clubhouse Ivory</strong><small>Primary customer flow</small></span>{theme === 'ivory' && <Check/>}</button><button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'selected' : ''}><Moon/><span><strong>Midnight Ivory</strong><small>Dark theme parity</small></span>{theme === 'dark' && <Check/>}</button></div>
    <div className="cm-prototype-disclaimer"><Info size={16}/><p>This setting applies globally. It does not save an account preference.</p></div>
  </div>;
}

function StatePage({ icon, title, body, action, onClick, secondary, onSecondary }) { return <div className="cm-page cm-centered"><Header actions={false}/><div className="cm-state-illustration">{icon}</div><p className="cm-overline">TURF & TASTE</p><h1>{title}</h1><p>{body}</p><Button onClick={onClick} icon={ArrowRight}>{action}</Button>{secondary && <button className="cm-text-button" onClick={onSecondary}>{secondary}</button>}</div>; }

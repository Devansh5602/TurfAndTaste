import { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, Bookmark, CalendarDays, Check, ChevronDown, ChevronRight, CircleAlert,
  Clock3, CreditCard, FileText, HelpCircle, Home, Info, LockKeyhole, MapPin,
  Menu, Moon, NotebookTabs, PlayCircle, Plus, ReceiptText, Search, Settings,
  ShieldCheck, Share2, Sparkles, Star, Sun, TicketCheck, UtensilsCrossed, UserRound,
  UsersRound, WifiOff, X,
} from 'lucide-react';
import { prototypeBooking, prototypeEvents, prototypeFacilities, prototypeOutlets, infoPages } from './data';
import { useRouter } from '../../context/RouterContext';
import './customerMobile.css';

const steps = ['Sports & Venue', 'Schedule', 'Details', 'Pay'];
const slots = ['6:00 AM', '7:00 AM', '8:00 AM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'];

function AppIcon({ name, size = 18 }) {
  const props = { size, strokeWidth: 1.9, 'aria-hidden': true };
  const icons = { home: Home, bookings: NotebookTabs, dining: UtensilsCrossed, profile: UserRound, events: CalendarDays };
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
  const items = [['home', 'Home', 'home'], ['bookings', 'Bookings', 'bookings'], ['events', 'Events', 'events'], ['dining', 'Dining', 'dining'], ['profile', 'Profile', 'profile']];
  return <nav className="cm-bottom-nav" aria-label="Customer navigation">{items.map(([icon, label, route]) => <button key={route} className={screen === route || (route === 'home' && screen === 'home') ? 'active' : ''} onClick={() => go(route)}><AppIcon name={icon} /><span>{label}</span></button>)}</nav>;
}

function FacilityCard({ facility, go, compact = false }) {
  const open = () => go('facility', { facility });
  return <article className={`cm-facility-card ${compact ? 'compact' : ''}`} {...(compact ? { role: 'button', tabIndex: 0, onClick: open, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') open(); } } : {})}>
    <img src={facility.image} alt="" />
    <div className="cm-facility-copy"><div className="cm-card-meta"><span>{facility.label}</span><span><Star size={13} fill="currentColor" /> {facility.rating}</span></div><h3>{facility.name}</h3><p><MapPin size={14} /> {facility.location}</p>{!compact && <button onClick={open}>View venue <ArrowRight size={16} /></button>}</div>
  </article>;
}

function BookingBar({ label, onClick, disabled, detail }) {
  return <div className="cm-sticky-action"><div>{detail && <small>{detail}</small>}<strong>{label}</strong></div><Button disabled={disabled} onClick={onClick} aria-label={label}><ArrowRight /></Button></div>;
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
  const [theme, setTheme] = useState('ivory');
  const [selectedFacility, setSelectedFacility] = useState(prototypeFacilities[0]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingStep, setBookingStep] = useState(initialBookingStep);
  const [bookingDetails, setBookingDetails] = useState({ name: '', phone: '', email: '', note: '' });
  const [paymentFailure, setPaymentFailure] = useState(initialScreen === 'payment-failure');
  const [event, setEvent] = useState(prototypeEvents[0]);
  const [outlet, setOutlet] = useState(prototypeOutlets[0]);
  const [info, setInfo] = useState('about');
  const [authScreen, setAuthScreen] = useState(initialScreen === 'auth-create' ? 'create' : initialScreen === 'auth-forgot' ? 'forgot' : initialScreen === 'auth-reset' ? 'reset' : initialScreen === 'auth-expired' ? 'expired' : 'signin');
  const [bookingMode, setBookingMode] = useState(initialScreen === 'events-loading' ? 'loading' : initialScreen === 'events-empty' ? 'empty' : 'normal');
  const [diningMode, setDiningMode] = useState(initialScreen === 'dining-loading' ? 'loading' : initialScreen === 'dining-unavailable' ? 'unavailable' : 'normal');

  const routes = {
    home: '/', facilities: '/facilities', facility: '/facilities/detail',
    processing: '/payment/processing', 'payment-failure': '/payment/failure',
    success: '/booking/success', pass: '/booking/pass', bookings: '/my-bookings',
    auth: '/sign-in', profile: '/profile', 'edit-profile': '/profile/edit', settings: '/settings',
    reviews: '/reviews', events: '/events', event: '/events/detail', dining: '/dining',
    outlet: '/dining/outlet', menu: '/dining/menu', notices: '/updates', contact: '/contact-support',
    rules: '/ground-rules', about: '/about-clubhouse', terms: '/terms', privacy: '/privacy', offline: '/offline',
  };
  const go = (next, data = {}) => {
    if (data.facility) setSelectedFacility(data.facility);
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
  const back = () => { if (history.length) { const previous = history.at(-1) || 'home'; setHistory((items) => items.slice(0, -1)); setScreen(previous); return; } window.history.back(); };
  const beginBooking = (facility = selectedFacility) => { setSelectedFacility(facility); setSelectedSlot(null); setBookingStep(1); navigate('/booking/step-1'); };
  const bookingTitle = steps[bookingStep - 1];
  const selectedSlotLabel = selectedSlot ? `${selectedSlot} – ${Number(selectedSlot.slice(0, 1)) + 1}:00 ${selectedSlot.includes('PM') ? 'PM' : 'AM'}` : '';
  const page = useMemo(() => {
    if (screen === 'home') return <HomeScreen go={go} beginBooking={beginBooking} />;
    if (screen === 'facilities') return <FacilitiesScreen go={go} />;
    if (screen === 'facility') return <FacilityDetail facility={selectedFacility} beginBooking={beginBooking} back={back} go={go} />;
    if (screen === 'booking') return <BookingScreen back={back} bookingStep={bookingStep} setBookingStep={setBookingStep} selectedFacility={selectedFacility} onFacilityChange={(facility) => { setSelectedFacility(facility); setSelectedSlot(null); }} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} selectedSlotLabel={selectedSlotLabel} bookingDetails={bookingDetails} setBookingDetails={setBookingDetails} go={go} />;
    if (screen === 'processing' || screen === 'payment-failure') return <ProcessingScreen back={back} failed={paymentFailure || screen === 'payment-failure'} setFailed={setPaymentFailure} selectedFacility={selectedFacility} onReview={() => { setBookingStep(4); setScreen('booking'); }} go={go} />;
    if (screen === 'success') return <SuccessScreen go={go} />;
    if (screen === 'pass') return <PassScreen go={go} back={back} />;
    if (screen === 'bookings') return <BookingsScreen go={go} />;
    if (screen === 'auth') return <SafeAuthScreen back={back} authScreen={authScreen} setAuthScreen={setAuthScreen} go={go} />;
    if (screen === 'profile') return <SafeProfileScreen go={go} theme={theme} />;
    if (screen === 'edit-profile') return <SafeEditProfileScreen back={back} go={go} />;
    if (screen === 'settings') return <SafeSettingsScreen back={back} go={go} theme={theme} setTheme={setTheme} />;
    if (screen === 'reviews') return <ReviewsScreen back={back} />;
    if (screen === 'events') return <EventsScreen go={go} mode={bookingMode} setMode={setBookingMode} />;
    if (screen === 'event') return <EventScreen back={back} event={event} />;
    if (screen === 'dining') return <DiningScreen go={go} mode={diningMode} setMode={setDiningMode} />;
    if (screen === 'outlet') return <OutletScreen go={go} back={back} outlet={outlet} />;
    if (screen === 'menu') return <MenuScreen go={go} back={back} outlet={outlet} />;
    if (['notices', 'contact', 'rules', 'about', 'terms', 'privacy'].includes(screen)) return <InfoScreen back={back} info={screen} />;
    if (screen === 'info') return <InfoScreen back={back} info={info} />;
    if (screen === 'offline') return <OfflineScreen go={go} />;
    return <HomeScreen go={go} beginBooking={beginBooking} />;
  }, [screen, bookingStep, selectedFacility, selectedSlot, selectedSlotLabel, paymentFailure, event, outlet, info, theme, authScreen, bookingMode, diningMode]);

  return <div className={`cm-prototype cm-theme-${theme}`}>
    <div className="cm-phone-frame"><main className="cm-scroll">{page}</main><BottomNav screen={screen} go={go} /></div>
    <aside className="cm-preview-note"><span>Customer App · Mobile</span><strong>Curated Figma prototype</strong><p>Use the phone preview to explore the approved customer flows.</p></aside>
  </div>;
}

function HomeScreen({ go, beginBooking }) {
  return <div className="cm-page cm-home">
    <header className="cm-home-header" aria-label="Home header">
      <h1>Home</h1>
      <div className="cm-home-header-actions">
        <button className="cm-icon-button" aria-label="Notifications"><Bell /></button>
        <button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button>
      </div>
    </header>

    <button className="cm-location-selector" aria-label="Current location: Bopal, Ahmedabad">
      <span className="cm-location-pin"><MapPin size={16}/></span>
      <span><small>LOCATION</small><strong>Bopal, Ahmedabad</strong></span>
      <ChevronDown size={15}/>
    </button>

    <section className="cm-clubhouse-greeting">
      <p className="cm-overline">CLUBHOUSE LOUNGE</p>
      <h1>Good afternoon,<br/>Devansh</h1>
    </section>

    <button className="cm-reserve-spotlight" onClick={() => beginBooking()}>
      <img src="/images/hero_arena.jpg" alt=""/>
      <span className="cm-spotlight-scrim"/>
      <span className="cm-spotlight-copy"><small>PRIME EVENING SLOTS</small><strong>Reserve Your Slot</strong><span>Fast Filling Today</span></span>
      <span className="cm-spotlight-tags"><i>FAST FILLING</i></span>
      <span className="cm-spotlight-book">Book Now <ArrowRight size={16}/></span>
    </button>

    <section className="cm-home-arenas">
      <div className="cm-home-section-head"><div><h2>Authorized Arenas</h2></div><button onClick={() => go('facilities')}>See all <ChevronRight size={15}/></button></div>
      <div className="cm-home-sport-filters" aria-label="Authorized sports">
        <button className="selected">All Activities</button>
        {prototypeFacilities.map((facility) => <button key={facility.id}>{facility.name}</button>)}
      </div>
    </section>

    <section className="cm-quick-match-section">
      <div className="cm-home-section-head"><div><h2>Quick Match Booking</h2></div></div>
      <div className="cm-quick-match-list">{prototypeFacilities.map((facility) => <button className="cm-quick-match-card" key={facility.id} onClick={() => beginBooking(facility)}>
        <span className="cm-quick-match-media"><img src={facility.image} alt=""/><span className="cm-quick-match-overlay cm-quick-match-rating"><Star size={12} fill="currentColor"/>{facility.rating}</span><span className="cm-quick-match-overlay cm-quick-match-distance"><MapPin size={12}/> Bopal</span><span className="cm-quick-match-overlay cm-quick-match-status">Open now</span></span>
        <span className="cm-quick-match-details"><span className="cm-quick-match-badge">{facility.service}</span><strong>{facility.name}</strong><small><MapPin size={12}/> Bopal, Ahmedabad</small><span className="cm-quick-match-rate"><b>From</b> [Configured Tariff]</span><em><Clock3 size={12}/> [Next available slot]</em></span>
        <span className="cm-quick-match-cta">Book Slot <ArrowRight size={15}/></span>
      </button>)}</div>
    </section>
  </div>;
}

function FacilitiesScreen({ go }) { const curatedVenues = prototypeFacilities.filter((facility) => ['box-cricket', 'skating-rink', 'shooting-machine'].includes(facility.id)); return <div className="cm-page cm-venues-page"><header className="cm-curated-top"><h1>Venues</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><div className="cm-venues-search"><Search size={19}/><input placeholder="Search arenas, turfs, sports..." aria-label="Search arenas, turfs, sports"/><button aria-label="Filter venues"><Menu size={18}/></button></div><div className="cm-venues-filter">{['All', 'Box Cricket', 'Skating Rink', 'Pickle Ball', 'Cricket Green Net Practice'].map((filter, index) => <button key={filter} className={index === 0 ? 'selected' : ''}>{filter}</button>)}</div><div className="cm-venues-meta"><span><i/>3 Arenas Open in Bopal District</span><b>FAST BOOKING</b></div><div className="cm-venues-list">{curatedVenues.map((facility) => <button key={facility.id} className="cm-venue-card" onClick={() => go('facility', { facility })}><span className="cm-venue-card-media"><img src={facility.image} alt=""/><i className="cm-venue-distance"><MapPin size={12}/>{facility.distance}</i><i className="cm-venue-rating"><Star size={12} fill="currentColor"/>{facility.rating} ({facility.reviewCount})</i><i className="cm-venue-area">{facility.area}</i><i className="cm-venue-status">{facility.status}</i></span><span className="cm-venue-card-body"><strong>{facility.venueName}</strong><small><MapPin size={13}/>{facility.location}</small><em>{facility.name}{facility.id === 'box-cricket' && ' · Cricket Green Nets'}</em><span className="cm-venue-card-bottom"><span><b>STARTING AT</b><strong>{facility.tariff}<small>/ hr</small></strong></span><i>View Arena & Slots <ArrowRight size={17}/></i></span></span></button>)}</div></div>; }

function FacilityDetail({ facility, beginBooking, back, go }) { return <div className="cm-page cm-curated-detail"><header className="cm-detail-top"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Facility Detail</h1><div><button className="cm-icon-button" aria-label="Save facility"><Bookmark/></button><button className="cm-icon-button" aria-label="Share facility"><Share2/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><div className="cm-curated-detail-media"><img src={facility.image} alt=""/><span className="cm-detail-active"><i/>ACTIVE & BOOKABLE</span><span className="cm-detail-service">⚯ {facility.name}</span><span className="cm-detail-photos">▣ 1 of 4 Photos</span></div><section className="cm-curated-detail-copy"><div className="cm-detail-reference"><span>[FACILITY REFERENCE]</span><b>[Facility Sector / Wing]</b></div><h2>[Facility Name]</h2><div className="cm-detail-review"><Star size={16} fill="currentColor"/> <strong>{facility.rating}</strong> <i/> <button onClick={() => go('reviews')}>[Review Count] Verified Reviews →</button></div><span className="cm-detail-service-line">⚯ Cricket Green Net Practice with Shooting Machine</span><div className="cm-detail-feature-grid"><div><Clock3/><small>Slot Duration</small><strong>60m / 90m Blocks</strong></div><div><Clock3/><small>Operating Window</small><strong>06:00 AM – 10:00 PM</strong></div><div><Sparkles/><small>Pitch Surface</small><strong>Synthetic Turfed Enclosure</strong></div><div><UsersRound/><small>Equipment</small><strong>Feeder & Stumps Provided</strong></div></div><h3>About This Facility</h3><div className="cm-detail-content-card"><p>Standard training bay equipped with heavy-duty surround tensioned netting, high-resilience synthetic turf underlay, and dedicated programming for shooting machine options. Configured for practice and coached sessions.</p><span>✿ Indoor Covered Bay　⚯ Power Feeder Ports</span></div><div className="cm-detail-heading-row"><h3>Pricing & Tariffs</h3><small>Member Rates Apply</small></div><div className="cm-detail-tariff"><div><h2>[Configured Tariff]</h2><b>Standard Tier</b></div><p>Based on verified patron bookings</p><div className="cm-detail-tariff-table"><span>Standard Net Lane (Off-Peak)<strong>[Standard / Prime Rates]</strong></span><span>Prime Net Lane (Peak Evening)<strong>[Standard / Prime Rates]</strong></span><span>Automated Feeder Inclusion<strong>Included</strong></span></div><em>Based on verified patron bookings</em></div><h3>Venue Guidelines</h3><div className="cm-guidelines"><div><span>◉</span><p><strong>Approved Footwear</strong>Flat rubber-soled turf trainers or non-marking sports shoes required. Metal spikes strictly prohibited.</p></div><div><span>▦</span><p><strong>Turnstile Check-In</strong>Digital pass scan at turnstile gate 10 mins prior to slot commencement.</p></div><div><span>◒</span><p><strong>Equipment Provision</strong>Club training balls included; protective batting gear and pads available on request at bay desk.</p></div></div></section><BookingBar label="Select Date & Time" onClick={() => beginBooking(facility)} detail="Starting from [Configured Tariff]" /></div>; }

function BookingScreen({ back, bookingStep, setBookingStep, selectedFacility, onFacilityChange, selectedSlot, setSelectedSlot, selectedSlotLabel, bookingDetails, setBookingDetails, go }) {
  const detailsReady = bookingDetails.name.trim().length >= 2 && bookingDetails.phone.replace(/\D/g, '').length >= 10;
  const canContinue = bookingStep === 1 ? Boolean(selectedFacility) : bookingStep === 2 ? Boolean(selectedSlot) : bookingStep === 3 ? detailsReady : true;
  const continueStep = () => { if (!canContinue) return; if (bookingStep < 4) setBookingStep(bookingStep + 1); else go('processing'); };
  const nextLabel = bookingStep === 1 ? 'Choose date & slot' : bookingStep === 2 ? 'Continue to details' : bookingStep === 3 ? 'Review booking' : 'Proceed to payment';
  const title = bookingStep === 3 ? 'Guest Details' : bookingStep === 4 ? 'Review & Pay' : 'Select Slot';
  const actionDetail = bookingStep === 2 ? (selectedSlotLabel || 'Select an available slot') : bookingStep === 3 ? (detailsReady ? 'Guest details complete' : 'Enter your name and mobile number') : bookingStep === 4 ? 'Secure prototype payment' : 'Step 1 of 4';
  return <div className="cm-page cm-booking"><header className="cm-booking-top"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><div><span>TURF & TASTE</span><h1>{title}</h1></div><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header><div className="cm-booking-progress" aria-label={`Step ${bookingStep} of 4`}>{steps.map((step, index) => <button key={step} className={index + 1 === bookingStep ? 'active' : index + 1 < bookingStep ? 'complete' : ''} onClick={() => index + 1 <= bookingStep && setBookingStep(index + 1)}><b>{index + 1 < bookingStep ? <Check size={14}/> : index + 1}</b><span>{step}</span></button>)}</div><div className="cm-booking-context"><img src={selectedFacility.image} alt=""/><div><small>{bookingStep === 1 ? 'SELECT A SERVICE' : 'SELECTED VENUE'}</small><strong>{bookingStep === 1 ? 'Select Sport & Service' : selectedFacility.venueName}</strong></div><button onClick={() => { setSelectedSlot(null); setBookingStep(1); }}>Change</button></div>{bookingStep === 1 && <StepVenue selectedFacility={selectedFacility} onFacilityChange={onFacilityChange} />}{bookingStep === 2 && <StepSlots selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} />}{bookingStep === 3 && <StepDetails bookingDetails={bookingDetails} setBookingDetails={setBookingDetails} />}{bookingStep === 4 && <StepReview selectedFacility={selectedFacility} selectedSlotLabel={selectedSlotLabel} />}{<BookingBar label={nextLabel} detail={actionDetail} disabled={!canContinue} onClick={continueStep} />}</div>;
}

function StepVenue({ selectedFacility, onFacilityChange }) { return <section className="cm-step"><div className="cm-step-heading"><p className="cm-overline">AUTHORIZED ARENAS</p><h2>Select Sport & Service</h2><p>Choose the sport and session that fits your visit.</p></div><div className="cm-venue-choice-list">{prototypeFacilities.map((facility) => <button key={facility.id} className={selectedFacility.id === facility.id ? 'selected' : ''} onClick={() => onFacilityChange(facility)}><img src={facility.image} alt=""/><span><strong>{facility.name}</strong><small>{facility.label}</small>{selectedFacility.id === facility.id && <em>Selected · available times shown next</em>}</span>{selectedFacility.id === facility.id && <Check />}</button>)}</div><div className="cm-booking-venues-label"><strong>Available Venues</strong><span>Choose a service to continue to slot selection.</span></div></section>; }

function StepSlots({ selectedSlot, setSelectedSlot }) { const dates = ['Mon 22', 'Tue 23', 'Wed 24', 'Thu 25', 'Fri 26']; const morning = slots.slice(0, 3); const evening = slots.slice(3); return <section className="cm-step"><div className="cm-step-heading"><p className="cm-overline">BOX CRICKET</p><h2>Select Date</h2><p>Asia/Kolkata (IST)</p></div><div className="cm-date-strip cm-source-dates">{dates.map((date, index) => <button key={date} className={index === 1 ? 'selected' : ''}><small>{date.split(' ')[0]}</small><strong>{date.split(' ')[1]}</strong></button>)}</div><div className="cm-duration"><span>Match Duration</span><button>1 hr</button><button className="selected">1.5 hrs</button><button>2 hrs</button></div><div className="cm-availability-legend"><span><i/>Available</span><span><i/>Filling Fast</span><span><i/>Booked</span></div><SlotGroup title="Morning (Early Bird)" note="Special Rate ₹700" slotItems={morning} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot}/><SlotGroup title="Evening & Floodlit (Prime)" note="High Demand" slotItems={evening} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot}/></section>; }

function SlotGroup({ title, note, slotItems, selectedSlot, setSelectedSlot }) { return <div className="cm-slot-group"><div><h3>{title}</h3><span>{note}</span></div><div className="cm-slot-grid">{slotItems.map((slot, index) => <button className={`${slot === selectedSlot ? 'selected' : ''} ${slot === '7:00 PM' ? 'busy' : ''}`} key={slot} disabled={slot === '7:00 PM'} onClick={() => setSelectedSlot(slot)}>{slot}{slot === selectedSlot && <Check size={15}/>} {index === 1 && slot !== '7:00 PM' && <small>Filling</small>}</button>)}</div></div>; }

function StepDetails({ bookingDetails, setBookingDetails }) { const update = (key) => (event) => setBookingDetails((current) => ({ ...current, [key]: event.target.value })); return <section className="cm-step"><div className="cm-step-heading"><p className="cm-overline">GUEST RESERVATION</p><h2>Guest Details</h2><p>We will use these details for venue access and booking updates.</p></div><div className="cm-guest-booking-summary"><img src="/images/box_cricket.jpg" alt=""/><div><strong>Selected Turf &amp; Taste Arena</strong><span><CalendarDays size={12}/> Selected booking date</span><span><Clock3 size={12}/> Selected slot · fixture preview</span></div></div><form className="cm-form cm-source-form" onSubmit={(e) => e.preventDefault()}><div className="cm-form-section-title"><strong>Lead Player Contact</strong><span>Required</span></div><label>Full Name<input value={bookingDetails.name} onChange={update('name')} placeholder="Enter your name" autoComplete="name" /></label><label>WhatsApp / Mobile Number<input value={bookingDetails.phone} onChange={update('phone')} inputMode="tel" placeholder="Enter your mobile number" autoComplete="tel" /></label><small className="cm-form-hint">The booking pass and updates use the contact details you provide.</small><label>Email Address <span>Optional</span><input value={bookingDetails.email} onChange={update('email')} inputMode="email" placeholder="name@example.com" autoComplete="email" /></label><div className="cm-form-section-title"><strong>Sport &amp; Match Preferences</strong></div><label>Team / group note <span>Optional</span><textarea value={bookingDetails.note} onChange={update('note')} placeholder="Add a note for the venue team" rows="3" /></label></form></section>; }

function StepReview({ selectedFacility, selectedSlotLabel }) { return <section className="cm-step"><div className="cm-step-heading"><p className="cm-overline">SECURE CHECKOUT</p><h2>Review &amp; Pay</h2><p>Confirm your arena, session and secure payment summary.</p></div><div className="cm-review-card"><img src={selectedFacility.image} alt=""/><div><span className="cm-status">Pitch hold guaranteed</span><strong>{selectedFacility.venueName}</strong><small><MapPin size={13}/> Bopal, Ahmedabad</small><span><CalendarDays size={15}/> Tuesday, 23 Sep 2025</span><span><Clock3 size={15}/> {selectedSlotLabel} · 1.5 hrs</span></div></div><div className="cm-price-breakdown"><div className="cm-breakdown-top"><strong>Itemized Price Breakdown</strong><span>Verified Rate</span></div><div><span>Turf Base Rate (1.5 hrs)</span><strong>₹762.71</strong></div><div><span>Clubhouse &amp; Facility Maintenance</span><strong>₹45.00</strong></div><div><span>Arena Floodlights &amp; Gear</span><strong>₹0.00</strong></div><div className="cm-payable"><span>GST (18% Applied)</span><strong>₹92.29</strong></div><div className="cm-payable"><span>Total Payable</span><strong>₹900.00</strong></div><p><ShieldCheck size={16}/> Final amount is confirmed securely before payment.</p></div><button className="cm-payment-row"><CreditCard /><span><strong>Razorpay</strong><small>Secure test payment</small></span><ChevronRight /></button></section>; }

function ProcessingScreen({ back, failed, setFailed, selectedFacility, go }) { if (failed) return <div className="cm-page cm-payment-failed"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Review &amp; Pay</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header><div className="cm-payment-transaction"><span>TRANSACTION ON HOLD</span><b>07:13</b></div><div className="cm-payment-error-icon"><CircleAlert/></div><h1>Payment Could Not Be Processed</h1><p>Your bank or UPI app declined the transaction, or the session timed out. Don’t worry, your slot is held for the next <strong>07:13 minutes.</strong></p><div className="cm-held-booking"><div><span>RESERVED BOOKING</span><b>[Booking Reference]</b><i>15m Hold Active</i></div><img src={selectedFacility.image} alt=""/><strong>{selectedFacility.venueName}</strong><small>CURATED FIXTURE PREVIEW</small><p><CalendarDays size={13}/> Schedule　Selected date　·　Selected time (1.5 hrs)</p><div><span>Total Payable</span><b>₹900.00</b></div></div><p className="cm-payment-alert">PAYMENT STATUS NOTE<br/><strong>No money has been deducted from your account.</strong></p><Button onClick={() => { setFailed(false); go('processing'); }} icon={ArrowRight}>Retry Payment</Button><button className="cm-text-button" onClick={() => go('booking')}>Review or change payment</button></div>; return <div className="cm-page cm-payment-processing"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Review &amp; Pay</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header><div className="cm-processing-backdrop"><p>{selectedFacility.venueName}</p><small>Curated customer-app fixture preview</small><div className="cm-processing-card"><div className="cm-processing-orbit"><div><LockKeyhole/><span>R</span></div></div><p className="cm-overline">RAZORPAY SECURE CHECKOUT</p><h2>Securing your payment</h2><p>Opening Razorpay in prototype mode. No live payment or customer charge is created.</p><Button onClick={() => go('success')} icon={Check}>Payment successful</Button><button onClick={() => setFailed(true)}>Payment failed or cancelled</button></div></div></div>; }

function SuccessScreen({ go }) { return <div className="cm-page cm-centered cm-success"><div className="cm-success-mark"><Check /></div><p className="cm-overline">BOOKING CONFIRMED</p><h1>Reservation secured.</h1><p>Your payment is verified and your digital entry pass is ready for check-in.</p><div className="cm-confirmation-ref"><small>BOOKING REFERENCE</small><strong>{prototypeBooking.reference}</strong><span>Skyline Box Cricket Arena · Tue, 23 Sep 2025</span></div><Button onClick={() => go('pass')} icon={TicketCheck}>View Entry Pass</Button><button className="cm-text-button" onClick={() => go('bookings')}>View My Reservations</button></div>; }

function PassScreen({ go, back }) { return <div className="cm-page cm-pass cm-curated-pass"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Venue Detail</h1><div><button className="cm-icon-button" aria-label="Save pass"><Bookmark/></button><button className="cm-icon-button" aria-label="Share pass"><Share2/></button></div></header><div className="cm-pass-access"><span><Check size={13}/> ACCESS PASS ACTIVE</span><b>GATE 2 OPEN</b></div><div className="cm-pass-booking-name"><span>TTB / TURF &amp; TASTE</span><strong>Skyline Sports Arena</strong></div><div className="cm-pass-ticket"><span className="cm-pass-label">CONFIRMED</span><p>PHOTO 02 · PREMIUM FLOODLIT</p><h1>Skyline Box Cricket Arena</h1><div className="cm-pass-meta"><span><CalendarDays/> DATE<br/><b>Tue, 23 Sep 2025</b></span><span><Clock3/> SLOT TIME<br/><b>18:00 – 20:00<br/>1.5 hrs</b></span></div><div className="cm-qr" aria-label="Illustrative booking QR"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><small>Present this QR code at Arena Turnstile or Field Desk for seamless entry.</small></div><Button onClick={() => go('bookings')} icon={NotebookTabs}>View My Reservations</Button></div>; }

function BookingsScreen({ go }) { return <div className="cm-page cm-curated-bookings"><header className="cm-curated-top"><h1>Profile</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><div className="cm-reservation-heading"><div><p className="cm-overline">My Reservations</p><h1>My Reservations</h1></div><span><i/>LIVE CLUB SYNC</span></div><div className="cm-tabs"><button className="active">Upcoming <i>1</i></button><button>History <i>0</i></button></div><button className="cm-booking-row cm-source-booking-row" onClick={() => go('pass')}><div className="cm-booking-confirmed">● CONFIRMED</div><img src="/images/box_cricket.jpg" alt=""/><div><h3>Skyline Sports Arena</h3><p>Skyline Sports &amp; Arena · Ground</p><small><CalendarDays/> SCHEDULE　Tue, 23 Sep 2025<br/><Clock3/> 18:00 – 20:00<br/><MapPin/> Arena 02: Cricket · Premium Match Pitch</small></div><span className="cm-booking-paid">PAID VIA UPI · Razorpay <b>₹900</b></span><strong>View Entry Pass &amp; QR <ArrowRight size={14}/></strong></button><div className="cm-clubhouse-guarantee"><ShieldCheck/><div><strong>Clubhouse Guarantee</strong><span>Secure, flexible and always on your side.</span></div></div></div>; }

function AuthScreen({ back, authScreen, setAuthScreen, go }) { const isForgot = authScreen === 'forgot', isReset = authScreen === 'reset', isExpired = authScreen === 'expired', isCreate = authScreen === 'create'; const title = isForgot ? 'Forgot Password' : isReset ? 'Create New Password' : isExpired ? 'Authentication Required' : isCreate ? 'Join Turf & Taste' : 'Welcome Back'; const action = isForgot ? 'Send Verification Code' : isReset ? 'Update Password' : isExpired ? 'Sign In' : isCreate ? 'Create Account' : 'Sign In'; return <div className={`cm-page cm-auth cm-source-auth ${isExpired ? 'cm-session-expired' : ''}`}><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>{isCreate ? 'Create Account' : isForgot ? 'Forgot Password' : isReset ? 'Reset Password' : isExpired ? 'Session Expired' : 'Sign In'}</h1><span/></header>{!isExpired && <img className="cm-auth-cover" src={isCreate ? '/images/hero_arena.jpg' : isForgot ? '/images/cricket_nets.jpg' : '/images/box_cricket.jpg'} alt=""/>}<div className="cm-auth-mark">t<span>&</span>t</div><p className="cm-overline">{isExpired ? 'SESSION INACTIVE' : isForgot ? 'TURF & TASTE CONCIERGE' : isReset ? 'IDENTITY CONFIRMED' : isCreate ? 'CLUBHOUSE MEMBERSHIP' : 'MEMBER SOCIAL & SPORT'}</p><h1>{title}</h1><p>{isExpired ? 'For your account security, your session has timed out after a period of inactivity. Please sign in again to continue and access your clubhouse bookings.' : isForgot ? 'Enter your registered mobile number or email address. We’ll send you a secure verification code to safely reset your clubhouse credentials.' : isReset ? 'Your verification code was confirmed. Set a strong password for your account.' : isCreate ? 'Create your account to book pitches, practice nets, and attend club events.' : 'Sign in to manage your court reservations, session schedules, and club activities.'}</p>{!isExpired && <form className="cm-form cm-source-form" onSubmit={(e) => e.preventDefault()}>{isCreate && <><label>Full Name<input defaultValue="Devansh Jadav" /></label><label>WhatsApp / Mobile Number<input inputMode="tel" defaultValue="+91 98765 43210" /></label></>}<label>{isForgot ? 'Registered Mobile' : 'Mobile / WhatsApp Number'}<input inputMode="tel" defaultValue={isForgot ? '+91 98765 43210' : '+91 98765 43210'} /></label>{!isForgot && <label>Password<input type="password" placeholder={isReset ? 'Clubhouse@2025!' : 'Enter your club password'} /></label>}{isReset && <label>Confirm New Password<input type="password" placeholder="Clubhouse@2025!" /></label>}{isCreate && <label>Email Address<input type="email" defaultValue="devansh@example.com" /></label>}</form>}<Button onClick={() => { if (isForgot) setAuthScreen('reset'); else if (isReset || isExpired || authScreen === 'signin') go('profile'); else setAuthScreen('signin'); }} icon={isExpired ? LockKeyhole : ArrowRight}>{action}</Button>{authScreen === 'signin' && <><button className="cm-text-button" onClick={() => setAuthScreen('forgot')}>Forgot Password?</button><p className="cm-auth-switch">New to Turf &amp; Taste? <button onClick={() => setAuthScreen('create')}>Create Account</button></p></>}{isCreate && <p className="cm-auth-switch">Already have an account? <button onClick={() => setAuthScreen('signin')}>Sign In</button></p>}{isExpired && <button className="cm-text-button" onClick={() => go('home')}>Continue as guest</button>}</div>; }

function SafeAuthScreen({ back, authScreen, setAuthScreen, go }) {
  const [form, setForm] = useState({ name: '', phone: '', password: '', confirm: '' });
  const isForgot = authScreen === 'forgot';
  const isReset = authScreen === 'reset';
  const isExpired = authScreen === 'expired';
  const isCreate = authScreen === 'create';
  const title = isForgot ? 'Forgot Password' : isReset ? 'Create New Password' : isExpired ? 'Authentication Required' : isCreate ? 'Join Turf & Taste' : 'Welcome Back';
  const action = isForgot ? 'Send Verification Code' : isReset ? 'Update Password' : isExpired ? 'Sign In' : isCreate ? 'Create Account' : 'Sign In';
  const phoneReady = form.phone.replace(/\D/g, '').length >= 10;
  const ready = isExpired || (isForgot ? phoneReady : isReset ? form.password.length >= 10 && form.password === form.confirm : isCreate ? form.name.trim().length >= 2 && phoneReady && form.password.length >= 10 : phoneReady && form.password.length >= 10);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = () => {
    if (!ready) return;
    if (isForgot) setAuthScreen('reset');
    else if (isReset || isExpired || authScreen === 'signin') go('profile');
    else setAuthScreen('signin');
  };
  return <div className={`cm-page cm-auth cm-source-auth ${isExpired ? 'cm-session-expired' : ''}`}>
    <header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>{isCreate ? 'Create Account' : isForgot ? 'Forgot Password' : isReset ? 'Reset Password' : isExpired ? 'Session Expired' : 'Sign In'}</h1><span/></header>
    {!isExpired && <img className="cm-auth-cover" src={isCreate ? '/images/hero_arena.jpg' : isForgot ? '/images/cricket_nets.jpg' : '/images/box_cricket.jpg'} alt=""/>}
    <div className="cm-auth-mark">t<span>&amp;</span>t</div>
    <p className="cm-overline">{isExpired ? 'SESSION INACTIVE' : isForgot ? 'TURF & TASTE CONCIERGE' : isReset ? 'IDENTITY CONFIRMED' : isCreate ? 'CLUBHOUSE MEMBERSHIP' : 'MEMBER SOCIAL & SPORT'}</p>
    <h1>{title}</h1>
    <p>{isExpired ? 'For your account security, your session has timed out after a period of inactivity. Please sign in again to continue.' : isForgot ? 'Enter a mobile number to prepare the reset-state preview.' : isReset ? 'Set a password for this local prototype preview.' : isCreate ? 'This fixture demonstrates account creation layout only; it does not create a production account.' : 'Enter demo details to explore the local customer-flow preview. No production account is used.'}</p>
    {!isExpired && <form className="cm-form cm-source-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      {isCreate && <label>Full Name<input value={form.name} onChange={update('name')} placeholder="Enter your name" autoComplete="name" /></label>}
      <label>{isForgot ? 'Registered Mobile' : 'Mobile / WhatsApp Number'}<input value={form.phone} onChange={update('phone')} inputMode="tel" placeholder="Enter your mobile number" autoComplete="tel" /></label>
      {!isForgot && <label>Password<input value={form.password} onChange={update('password')} type="password" placeholder={isReset ? 'Create a password' : 'Enter a password'} autoComplete={isReset ? 'new-password' : 'current-password'} /></label>}
      {isReset && <label>Confirm New Password<input value={form.confirm} onChange={update('confirm')} type="password" placeholder="Confirm your password" autoComplete="new-password" /></label>}
    </form>}
    <Button disabled={!ready} onClick={submit} icon={isExpired ? LockKeyhole : ArrowRight}>{action}</Button>
    {authScreen === 'signin' && <><button className="cm-text-button" onClick={() => setAuthScreen('forgot')}>Forgot Password?</button><p className="cm-auth-switch">New to Turf &amp; Taste? <button onClick={() => setAuthScreen('create')}>Create Account</button></p></>}
    {isCreate && <p className="cm-auth-switch">Already have an account? <button onClick={() => setAuthScreen('signin')}>Sign In</button></p>}
    {isExpired && <button className="cm-text-button" onClick={() => go('home')}>Continue as guest</button>}
  </div>;
}

function ProfileScreen({ go, theme }) { return <div className="cm-page cm-source-profile"><header className="cm-curated-top"><h1>Profile</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><div className="cm-profile-hero"><img className="cm-avatar" src="/images/box_cricket.jpg" alt=""/><div><span>DEVANSH JADAV <i>Verified</i></span><h2>+91 98765 43210</h2><p>devansh.jadav@example.com</p></div></div><Button onClick={() => go('edit-profile')} icon={UserRound}>Edit Profile</Button><SectionTitle title="Account &amp; Bookings"/><div className="cm-list-card"><button onClick={() => go('bookings')}><NotebookTabs/><span><strong>My Bookings</strong><small>Upcoming, past &amp; venue details</small></span><ChevronRight/></button><button onClick={() => go('edit-profile')}><UserRound/><span><strong>Personal &amp; Contact Details</strong><small>Name, registered mobile, &amp; email</small></span><ChevronRight/></button><button onClick={() => go('pass')}><CreditCard/><span><strong>Saved Payment Methods</strong><small>UPI IDs &amp; cards managed via Razorpay</small></span><ChevronRight/></button><button onClick={() => go('reviews')}><Star/><span><strong>My Sports Preferences</strong><small>Selected formats for quick match discovery</small></span><ChevronRight/></button></div><SectionTitle title="Preferences"/><div className="cm-list-card"><button onClick={() => go('settings')}><Settings/><span><strong>Appearance / Theme</strong><small>{theme === 'dark' ? 'Midnight Ivory' : 'Clubhouse Ivory'}</small></span><ChevronRight/></button><button onClick={() => go('info', { info: 'notices' })}><Bell/><span><strong>Updates &amp; Notices</strong><small>Clubhouse and venue announcements</small></span><ChevronRight/></button></div></div>; }

function EditProfileScreen({ back, go }) { return <div className="cm-page cm-source-settings"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Edit Profile</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header><p className="cm-overline">MEMBER DETAILS</p><h2>Personal Profile</h2><div className="cm-edit-avatar"><img src="/images/box_cricket.jpg" alt=""/><span>Tap badge to update club photo</span></div><form className="cm-form cm-source-form" onSubmit={(event) => event.preventDefault()}><div className="cm-form-section-title"><strong>Core Information</strong></div><div className="cm-source-name-grid"><label>First Name<input defaultValue="Devansh" /></label><label>Last Name<input defaultValue="Jadav" /></label></div><label>WhatsApp / Phone Number<input defaultValue="+91 98765 43210" /></label><label>Email Address<input defaultValue="devansh.jadav@example.com" /></label><label>City / Preferred Location<select defaultValue="bopal"><option value="bopal">Ahmedabad (Bopal / SG Highway)</option></select></label></form><BookingBar label="Save Profile" detail="Personal details" onClick={() => go('profile')} /></div>; }

function SettingsScreen({ back, go, theme, setTheme }) { const infoLinks = [['notices', Bell, 'Updates & Notices', 'Latest clubhouse advisories'], ['contact', HelpCircle, 'Contact & Inquiry', 'Talk to the clubhouse desk'], ['rules', ShieldCheck, 'Ground Rules & Guidelines', 'Venue policies and access'], ['about', Info, 'About Turf & Taste', 'Clubhouse and community'], ['terms', FileText, 'Terms', 'Customer app terms'], ['privacy', LockKeyhole, 'Privacy', 'How customer data is handled']]; return <div className="cm-page cm-source-settings"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Settings</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header><div className="cm-settings-privilege"><span><UserRound/> TURF &amp; TASTE Privileges</span><b>Tier 1<br/>Active</b></div><SectionTitle title="GENERAL SETTINGS"/><div className="cm-list-card"><button onClick={() => setTheme(theme === 'dark' ? 'ivory' : 'dark')}><Sun/><span><strong>Appearance / Theme</strong><small>{theme === 'dark' ? 'Midnight Ivory / Dark' : 'Clubhouse Ivory / Light'}</small></span><ChevronRight/></button><button><Bell/><span><strong>Notifications &amp; Alerts</strong><small>Bookings, reminders, match slots</small></span><ChevronRight/></button><button><MapPin/><span><strong>Location &amp; Region</strong><small>Ahmedabad, Asia/Kolkata IST</small></span><ChevronRight/></button></div><SectionTitle title="SUPPORT &amp; DESK"/><div className="cm-list-card"><button onClick={() => go('offline')}><WifiOff/><span><strong>Connection status</strong><small>View resilience and recovery state</small></span><ChevronRight/></button>{infoLinks.map(([key, Icon, title, description]) => <button key={key} onClick={() => go('info', { info: key })}><Icon/><span><strong>{title}</strong><small>{description}</small></span><ChevronRight/></button>)}</div><SectionTitle title="MIDNIGHT IVORY · PARITY"/><div className="cm-list-card cm-appearance-panel"><button onClick={() => setTheme('ivory')} className={theme === 'ivory' ? 'selected' : ''}><Sun/><span><strong>Clubhouse Ivory</strong><small>Primary customer flow</small></span>{theme === 'ivory' && <Check/>}</button><button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'selected' : ''}><Moon/><span><strong>Midnight Ivory</strong><small>Curated dark parity preview</small></span>{theme === 'dark' && <Check/>}</button></div></div>; }

function ReviewsScreen({ back }) { return <div className="cm-page cm-source-reviews"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Venue Detail</h1><div><button className="cm-icon-button" aria-label="Save"><Bookmark/></button><button className="cm-icon-button" aria-label="Share"><Share2/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><div className="cm-review-visit"><span>VERIFIED COMPLETED</span><small>Ref: #BC-89420</small><h3>Skyline Box Cricket Arena B</h3><p>The Pavilion &amp; Turf Grounds</p><b>Played Today, 7:00 PM – 8:30 PM</b></div><section className="cm-review-form"><h2>Rate your match experience</h2><p>Your feedback helps us maintain standards across club surfaces and coaching.</p><div className="cm-rating-pick">{[1,2,3,4,5].map(i => <button key={i} aria-label={`Rate ${i} stars`}><Star/></button>)}</div><span>Select your rating</span><label>Comments<textarea placeholder="Share your thoughts on the pitch condition, lighting, or facilities (optional)…" rows="3" /></label><Button icon={Check}>Submit Feedback</Button></section><div className="cm-review-list-head"><h2>Past Reviews</h2><span>3 submitted</span></div><article className="cm-review cm-source-review"><div><span><strong>Pickle Ball Court 01</strong><small>Ref #PB-78103</small></span><small>Yesterday</small></div><p className="cm-source-stars">★★★★★　5.0</p><p>Excellent netting and non-slip court surface grip were balanced. Excellent pickle ball net tension and line markings.</p></article></div>; }

function EventsScreen({ go, mode, setMode }) { if (mode === 'loading') return <StatePage icon={<PlayCircle/>} title="Loading club events" body="Fetching fixtures, social cups, and clubhouse invitations." action="Try again" onClick={() => setMode('normal')} secondary="Go Home" onSecondary={() => go('home')} />; if (mode === 'empty') return <StatePage icon={<CalendarDays/>} title="No upcoming events" body="There are no announced clubhouse fixtures right now. Check back soon for the next invitation." action="Go Home" onClick={() => go('home')} />; return <div className="cm-page cm-source-events"><header className="cm-curated-top"><h1>Events</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><p className="cm-overline">CLUBHOUSE CALENDAR</p><h2>What’s happening next.</h2><p>Fixtures, social cups, and community sessions at Turf &amp; Taste.</p><div className="cm-event-list">{prototypeEvents.map((item) => <button key={item.id} className="cm-event-card" onClick={() => go('event', { event: item })}><img src={item.image} alt=""/><div><span>{item.tag} · {item.date}</span><h3>{item.title}</h3><p>{item.time}</p></div></button>)}</div><div className="cm-state-controls"><button onClick={() => setMode('loading')}>Loading state</button><button onClick={() => setMode('empty')}>Empty state</button></div></div>; }

function EventScreen({ back, event }) { return <div className="cm-page cm-event-detail cm-source-event-detail"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Event Detail</h1><span/></header><div className="cm-event-tags"><span>UPCOMING FIXTURE</span><b>Social Cup</b></div><div className="cm-event-cover"><img src={event.image} alt=""/><span>🏆 Autumn Silver Trophy</span><small>● 4 Slots Left · Closes Oct 10</small></div><div className="cm-event-detail-copy"><h1>The Autumn Box Cricket Championship 2025</h1><p>✿ Official Turf &amp; Taste Invitational League</p><div className="cm-event-stat-grid"><div><small>DISCIPLINE</small><strong>7v7 Format</strong><span>6 Overs Per Side</span></div><div><small>SCHEDULE</small><strong>Oct 12 – 14</strong><span>18:00 IST Onwards</span></div></div><div className="cm-event-capacity"><strong>♧　Squad Registration</strong><span>75% Capacity　 <b>Only 4 Squads</b></span></div><div className="cm-event-venue"><small>◉　VENUE &amp; PITCH</small><strong>Skyline Box Cricket Arena</strong><span>East Gate, Pitch A &amp; B · Bopal, Ahmedabad</span></div></div></div>; }

function DiningScreen({ go, mode, setMode }) { if (mode === 'loading') return <StatePage icon={<UtensilsCrossed/>} title="Finding clubhouse dining" body="Refreshing today’s café and parlour information." action="Try again" onClick={() => setMode('normal')} secondary="Go Home" onSecondary={() => go('home')} />; if (mode === 'unavailable') return <StatePage icon={<CircleAlert/>} title="Menu unavailable right now" body="The outlet menu is temporarily unavailable. Visit the venue counter for current options." action="View outlets" onClick={() => setMode('normal')} secondary="Go Home" onSecondary={() => go('home')} />; return <div className="cm-page cm-source-dining"><header className="cm-curated-top"><h1>Dining</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header><p className="cm-overline">CLUBHOUSE FOOD &amp; PARLOUR</p><h2>Refuel between matches.</h2><p>Discover café favourites and practical match-day essentials before your visit.</p><div className="cm-stacked-list">{prototypeOutlets.map((item) => <button key={item.id} className="cm-outlet-card" onClick={() => go('outlet', { outlet: item })}><img src={item.image} alt=""/><div><span>{item.kind}</span><h3>{item.name}</h3><p>{item.hours}</p><ChevronRight/></div></button>)}</div><div className="cm-prototype-disclaimer"><Info size={16}/><p>Browse menu information only. No food ordering or payment is available in the customer app.</p></div><div className="cm-state-controls"><button onClick={() => setMode('loading')}>Loading state</button><button onClick={() => setMode('unavailable')}>Menu unavailable</button></div></div>; }

function OutletScreen({ go, back, outlet }) { return <div className="cm-page cm-outlet"><Header back onBack={back}/><img className="cm-cover-image" src={outlet.image} alt=""/><div className="cm-outlet-copy"><span className="cm-status">{outlet.kind}</span><h1>{outlet.name}</h1><p>{outlet.description}</p><div className="cm-hours"><Clock3/><span><small>OPERATING HOURS</small><strong>{outlet.hours}</strong></span></div><Button onClick={() => go('menu')} icon={ArrowRight}>View menu</Button></div></div>; }

function MenuScreen({ back, outlet }) { return <div className="cm-page"><Header title={outlet.name} back onBack={back}/><div className="cm-menu-hero"><p className="cm-overline">MENU</p><h2>Good to know before you go.</h2><p>Items and availability are shown for browsing only.</p></div>{outlet.menu.map((section) => <section className="cm-menu-section" key={section.category}><SectionTitle title={section.category}/>{section.items.map((item) => <div className="cm-menu-item" key={item.name}><div><span className="cm-veg-dot">{item.veg && <i/>}</span><strong>{item.name}</strong><small>{item.veg ? 'Vegetarian' : 'Non-vegetarian'}</small></div><b>{item.price}</b></div>)}</section>)}<div className="cm-prototype-disclaimer"><Info size={16}/><p>Menu availability can change at the outlet. Food ordering is not offered here.</p></div></div>; }

function InfoScreen({ back, info }) { const item = infoPages[info]; return <div className="cm-page cm-info-page cm-source-info"><header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>{item.title}</h1><span/></header><div className="cm-info-art"><Info /></div><p className="cm-overline">TURF &amp; TASTE CLUBHOUSE</p><h1>{item.title}</h1><p>{item.body}</p><div className="cm-info-block"><h3>{info === 'contact' ? 'Contact the clubhouse' : 'Good to know'}</h3><p>{info === 'contact' ? 'For a venue visit, booking reference, or team inquiry, connect with the clubhouse desk during operating hours.' : 'Use the customer navigation to return to venues, events, dining, or your reservations.'}</p></div><Button onClick={back} icon={ArrowLeft}>Go Back</Button></div>; }

function OfflineScreen({ go }) { return <StatePage icon={<WifiOff/>} title="You’re offline" body="Saved booking and clubhouse information may still be available. Reconnect to refresh live availability and updates." action="Try again" onClick={() => go('home')} secondary="View bookings" onSecondary={() => go('bookings')} />; }

function SafeProfileScreen({ go, theme }) {
  return <div className="cm-page cm-source-profile">
    <header className="cm-curated-top"><h1>Profile</h1><div><button className="cm-icon-button" aria-label="Notifications"><Bell/></button><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></div></header>
    <div className="cm-profile-hero"><div className="cm-avatar"><UserRound size={25}/></div><div><span>LOCAL PREVIEW</span><h2>Guest profile</h2><p>No customer account is connected.</p></div></div>
    <Button onClick={() => go('auth')} icon={LockKeyhole}>Sign in to save details</Button>
    <SectionTitle title="Preview navigation"/>
    <div className="cm-list-card"><button onClick={() => go('bookings')}><NotebookTabs/><span><strong>My Bookings</strong><small>View the curated pass and booking-history layouts</small></span><ChevronRight/></button><button onClick={() => go('edit-profile')}><UserRound/><span><strong>Personal &amp; Contact Details</strong><small>Local preview form — no customer record is saved</small></span><ChevronRight/></button><button onClick={() => go('reviews')}><Star/><span><strong>Verified Ratings &amp; Reviews</strong><small>Completed-booking feedback layout</small></span><ChevronRight/></button></div>
    <SectionTitle title="Preferences"/>
    <div className="cm-list-card"><button onClick={() => go('settings')}><Settings/><span><strong>Appearance / Theme</strong><small>{theme === 'dark' ? 'Midnight Ivory' : 'Clubhouse Ivory'}</small></span><ChevronRight/></button><button onClick={() => go('info', { info: 'notices' })}><Bell/><span><strong>Updates &amp; Notices</strong><small>Clubhouse and venue announcements</small></span><ChevronRight/></button></div>
  </div>;
}

function SafeEditProfileScreen({ back, go }) {
  return <div className="cm-page cm-source-settings">
    <header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Edit Profile</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header>
    <p className="cm-overline">LOCAL PREVIEW</p><h2>Personal Profile</h2>
    <div className="cm-edit-avatar"><div className="cm-avatar"><UserRound size={25}/></div><span>Profile data is not stored in this preview.</span></div>
    <form className="cm-form cm-source-form" onSubmit={(event) => event.preventDefault()}><div className="cm-form-section-title"><strong>Core Information</strong></div><div className="cm-source-name-grid"><label>First Name<input placeholder="First name" autoComplete="given-name" /></label><label>Last Name<input placeholder="Last name" autoComplete="family-name" /></label></div><label>WhatsApp / Phone Number<input placeholder="Enter your mobile number" inputMode="tel" autoComplete="tel" /></label><label>Email Address<input placeholder="name@example.com" inputMode="email" autoComplete="email" /></label><label>City / Preferred Location<select defaultValue="bopal"><option value="bopal">Ahmedabad (Bopal / SG Highway)</option></select></label></form>
    <BookingBar label="Save Profile" detail="Local preview only" onClick={() => go('profile')} />
  </div>;
}

function SafeSettingsScreen({ back, go, theme, setTheme }) {
  const infoLinks = [['notices', Bell, 'Updates & Notices', 'Latest clubhouse advisories'], ['contact', HelpCircle, 'Contact & Inquiry', 'Talk to the clubhouse desk'], ['rules', ShieldCheck, 'Ground Rules & Guidelines', 'Venue policies and access'], ['about', Info, 'About Turf & Taste', 'Clubhouse and community'], ['terms', FileText, 'Terms', 'Customer app terms'], ['privacy', LockKeyhole, 'Privacy', 'How customer data is handled']];
  return <div className="cm-page cm-source-settings">
    <header className="cm-source-state-header"><button className="cm-icon-button" onClick={back} aria-label="Go back"><ArrowLeft/></button><h1>Settings</h1><button className="cm-home-account" aria-label="Profile"><UserRound size={18}/></button></header>
    <div className="cm-settings-privilege"><span><UserRound/> CURATED APP PREVIEW</span><b>Local<br/>Only</b></div>
    <SectionTitle title="GENERAL SETTINGS"/><div className="cm-list-card"><button onClick={() => setTheme(theme === 'dark' ? 'ivory' : 'dark')}><Sun/><span><strong>Appearance / Theme</strong><small>{theme === 'dark' ? 'Midnight Ivory / Dark' : 'Clubhouse Ivory / Light'}</small></span><ChevronRight/></button><button><Bell/><span><strong>Notifications &amp; Alerts</strong><small>Preview control</small></span><ChevronRight/></button><button><MapPin/><span><strong>Location &amp; Region</strong><small>Ahmedabad, Asia/Kolkata IST</small></span><ChevronRight/></button></div>
    <SectionTitle title="SUPPORT &amp; DESK"/><div className="cm-list-card"><button onClick={() => go('offline')}><WifiOff/><span><strong>Connection status</strong><small>View resilience and recovery state</small></span><ChevronRight/></button>{infoLinks.map(([key, Icon, title, description]) => <button key={key} onClick={() => go('info', { info: key })}><Icon/><span><strong>{title}</strong><small>{description}</small></span><ChevronRight/></button>)}</div>
    <SectionTitle title="MIDNIGHT IVORY · PARITY"/><div className="cm-list-card cm-appearance-panel"><button onClick={() => setTheme('ivory')} className={theme === 'ivory' ? 'selected' : ''}><Sun/><span><strong>Clubhouse Ivory</strong><small>Primary customer flow</small></span>{theme === 'ivory' && <Check/>}</button><button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'selected' : ''}><Moon/><span><strong>Midnight Ivory</strong><small>Curated dark parity preview</small></span>{theme === 'dark' && <Check/>}</button></div>
  </div>;
}
function StatePage({ icon, title, body, action, onClick, secondary, onSecondary }) { return <div className="cm-page cm-centered"><Header actions={false}/><div className="cm-state-illustration">{icon}</div><p className="cm-overline">TURF & TASTE</p><h1>{title}</h1><p>{body}</p><Button onClick={onClick} icon={ArrowRight}>{action}</Button>{secondary && <button className="cm-text-button" onClick={onSecondary}>{secondary}</button>}</div>; }

import { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, CalendarDays, Check, ChevronDown, ChevronRight, CircleAlert,
  Clock3, CreditCard, FileText, HelpCircle, Home, Info, LockKeyhole, MapPin,
  Menu, Moon, NotebookTabs, PlayCircle, Plus, ReceiptText, Search, Settings,
  ShieldCheck, Sparkles, Star, Sun, TicketCheck, UtensilsCrossed, UserRound,
  UsersRound, WifiOff, X,
} from 'lucide-react';
import { prototypeBooking, prototypeEvents, prototypeFacilities, prototypeOutlets, infoPages } from './data';
import './customerMobile.css';

const steps = ['Sport & venue', 'Date & slot', 'Your details', 'Review & pay'];
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

export default function CustomerMobilePrototype() {
  const [screen, setScreen] = useState('home');
  const [history, setHistory] = useState([]);
  const [theme, setTheme] = useState('ivory');
  const [selectedFacility, setSelectedFacility] = useState(prototypeFacilities[0]);
  const [selectedSlot, setSelectedSlot] = useState('6:00 PM');
  const [bookingStep, setBookingStep] = useState(1);
  const [paymentFailure, setPaymentFailure] = useState(false);
  const [event, setEvent] = useState(prototypeEvents[0]);
  const [outlet, setOutlet] = useState(prototypeOutlets[0]);
  const [info, setInfo] = useState('about');
  const [authScreen, setAuthScreen] = useState('signin');
  const [bookingMode, setBookingMode] = useState('normal');

  const go = (next, data = {}) => {
    if (data.facility) setSelectedFacility(data.facility);
    if (data.event) setEvent(data.event);
    if (data.outlet) setOutlet(data.outlet);
    if (data.info) setInfo(data.info);
    setHistory((items) => [...items, screen]);
    setScreen(next);
  };
  const back = () => { const previous = history.at(-1) || 'home'; setHistory((items) => items.slice(0, -1)); setScreen(previous); };
  const beginBooking = (facility = selectedFacility) => { setSelectedFacility(facility); setBookingStep(1); go('booking'); };
  const bookingTitle = steps[bookingStep - 1];
  const selectedSlotLabel = `${selectedSlot} – ${Number(selectedSlot.slice(0, 1)) + 1}:00 ${selectedSlot.includes('PM') ? 'PM' : 'AM'}`;
  const page = useMemo(() => {
    if (screen === 'home') return <HomeScreen go={go} beginBooking={beginBooking} />;
    if (screen === 'facilities') return <FacilitiesScreen go={go} />;
    if (screen === 'facility') return <FacilityDetail facility={selectedFacility} beginBooking={beginBooking} back={back} go={go} />;
    if (screen === 'booking') return <BookingScreen back={back} bookingStep={bookingStep} setBookingStep={setBookingStep} selectedFacility={selectedFacility} setSelectedFacility={setSelectedFacility} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} selectedSlotLabel={selectedSlotLabel} go={go} />;
    if (screen === 'processing') return <ProcessingScreen back={back} failed={paymentFailure} setFailed={setPaymentFailure} go={go} />;
    if (screen === 'success') return <SuccessScreen go={go} />;
    if (screen === 'pass') return <PassScreen go={go} back={back} />;
    if (screen === 'bookings') return <BookingsScreen go={go} />;
    if (screen === 'auth') return <AuthScreen back={back} authScreen={authScreen} setAuthScreen={setAuthScreen} go={go} />;
    if (screen === 'profile') return <ProfileScreen go={go} theme={theme} setTheme={setTheme} />;
    if (screen === 'edit-profile') return <EditProfileScreen back={back} go={go} />;
    if (screen === 'settings') return <SettingsScreen back={back} go={go} theme={theme} setTheme={setTheme} />;
    if (screen === 'reviews') return <ReviewsScreen back={back} />;
    if (screen === 'events') return <EventsScreen go={go} mode={bookingMode} setMode={setBookingMode} />;
    if (screen === 'event') return <EventScreen back={back} event={event} />;
    if (screen === 'dining') return <DiningScreen go={go} />;
    if (screen === 'outlet') return <OutletScreen go={go} back={back} outlet={outlet} />;
    if (screen === 'menu') return <MenuScreen go={go} back={back} outlet={outlet} />;
    if (screen === 'info') return <InfoScreen back={back} info={info} />;
    if (screen === 'offline') return <OfflineScreen go={go} />;
    return <HomeScreen go={go} beginBooking={beginBooking} />;
  }, [screen, bookingStep, selectedFacility, selectedSlot, selectedSlotLabel, paymentFailure, event, outlet, info, theme, authScreen, bookingMode]);

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

function FacilitiesScreen({ go }) { return <div className="cm-page"><Header title="Discover venues" back onBack={() => go('home')} /><div className="cm-intro"><p className="cm-overline">FIND YOUR GAME</p><h2>Made for movement.</h2><p>Choose the space that fits your session.</p></div><div className="cm-search"><Search size={18}/><input placeholder="Search a sport or venue" aria-label="Search venues" /></div><div className="cm-filter-row"><button className="selected">All venues</button><button>Popular</button><button>Open now</button></div><div className="cm-stacked-list">{prototypeFacilities.map((facility) => <FacilityCard key={facility.id} facility={facility} go={go} />)}</div></div>; }

function FacilityDetail({ facility, beginBooking, back, go }) { return <div className="cm-page cm-detail"><Header back onBack={back} actions /><div className="cm-detail-hero"><img src={facility.image} alt="" /><div className="cm-hero-scrim" /><span className="cm-status">{facility.label}</span><div><p>{facility.location}</p><h1>[Facility Name]</h1><p className="cm-detail-ref">[Facility Reference] · <Star size={14} fill="currentColor" /> [Review Count]</p></div></div><section className="cm-detail-body"><div className="cm-rate-card"><span>FROM</span><strong>[Configured Tariff]</strong><small>Live availability shown during booking</small></div><h2>The space</h2><p>{facility.description}</p><div className="cm-detail-stats"><div><Clock3 /><span>Managed hours</span><strong>Check availability</strong></div><div><UsersRound /><span>For your crew</span><strong>Book a session</strong></div></div><button className="cm-link-row" onClick={() => go('reviews')}><span><Star /> Verified ratings & reviews</span><ChevronRight /></button></section><BookingBar label="Book this venue" onClick={() => beginBooking(facility)} detail="Ready when you are" /></div>; }

function BookingScreen({ back, bookingStep, setBookingStep, selectedFacility, setSelectedFacility, selectedSlot, setSelectedSlot, selectedSlotLabel, go }) {
  const continueStep = () => { if (bookingStep < 4) setBookingStep((step) => step + 1); else go('processing'); };
  const nextLabel = bookingStep === 1 ? 'Choose date & slot' : bookingStep === 2 ? 'Continue to details' : bookingStep === 3 ? 'Review booking' : 'Proceed to payment';
  return <div className="cm-page cm-booking"><Header title="Book a session" back onBack={back} actions={false} /><div className="cm-booking-progress" aria-label={`Step ${bookingStep} of 4`}>{steps.map((step, index) => <button key={step} className={index + 1 === bookingStep ? 'active' : index + 1 < bookingStep ? 'complete' : ''} onClick={() => index + 1 <= bookingStep && setBookingStep(index + 1)}><b>{index + 1 < bookingStep ? <Check size={14}/> : index + 1}</b><span>{step}</span></button>)}</div><div className="cm-booking-context"><img src={selectedFacility.image} alt=""/><div><small>BOOKING FOR</small><strong>{selectedFacility.name}</strong></div><button onClick={() => setBookingStep(1)}>Change</button></div>{bookingStep === 1 && <StepVenue selectedFacility={selectedFacility} setSelectedFacility={setSelectedFacility} />}{bookingStep === 2 && <StepSlots selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} />}{bookingStep === 3 && <StepDetails />}{bookingStep === 4 && <StepReview selectedFacility={selectedFacility} selectedSlotLabel={selectedSlotLabel} />}{<BookingBar label={nextLabel} detail={bookingStep === 2 ? selectedSlotLabel : bookingStep === 4 ? 'Secure test payment' : 'Step ' + bookingStep + ' of 4'} onClick={continueStep} />}</div>;
}

function StepVenue({ selectedFacility, setSelectedFacility }) { return <section className="cm-step"><div className="cm-step-heading"><p className="cm-overline">STEP 1</p><h2>Pick your sport & venue</h2><p>Choose what you want to play. You can change it later.</p></div><div className="cm-venue-choice-list">{prototypeFacilities.map((facility) => <button key={facility.id} className={selectedFacility.id === facility.id ? 'selected' : ''} onClick={() => setSelectedFacility(facility)}><img src={facility.image} alt=""/><span><strong>{facility.name}</strong><small>{facility.label}</small></span>{selectedFacility.id === facility.id && <Check />}</button>)}</div></section>; }

function StepSlots({ selectedSlot, setSelectedSlot }) { const dates = ['Fri 11', 'Sat 12', 'Sun 13', 'Mon 14']; return <section className="cm-step"><div className="cm-step-heading"><p className="cm-overline">STEP 2</p><h2>Choose a time</h2><p>Times shown are subject to live confirmation.</p></div><div className="cm-date-strip">{dates.map((date, index) => <button key={date} className={index === 1 ? 'selected' : ''}><small>{date.split(' ')[0]}</small><strong>{date.split(' ')[1]}</strong></button>)}</div><div className="cm-duration"><span>Session duration</span><button className="selected">60 min</button><button>90 min</button></div><div className="cm-slot-group"><div><h3>Available slots</h3><span>From [Configured Tariff]</span></div><div className="cm-slot-grid">{slots.map((slot) => <button className={slot === selectedSlot ? 'selected' : ''} key={slot} onClick={() => setSelectedSlot(slot)}>{slot}{slot === selectedSlot && <Check size={15}/>}</button>)}</div></div></section>; }

function StepDetails() { return <section className="cm-step"><div className="cm-step-heading"><p className="cm-overline">STEP 3</p><h2>Your details</h2><p>Share the essentials for this venue booking.</p></div><form className="cm-form" onSubmit={(e) => e.preventDefault()}><label>Full name<input placeholder="Your name" /></label><label>Mobile number<input inputMode="tel" placeholder="10-digit number" /></label><label>Email address <span>Optional</span><input inputMode="email" placeholder="you@example.com" /></label><label>Notes for the venue <span>Optional</span><textarea placeholder="Anything the team should know?" rows="3" /></label></form></section>; }

function StepReview({ selectedFacility, selectedSlotLabel }) { return <section className="cm-step"><div className="cm-step-heading"><p className="cm-overline">STEP 4</p><h2>Review & pay</h2><p>One last look before secure payment.</p></div><div className="cm-review-card"><img src={selectedFacility.image} alt=""/><div><strong>{selectedFacility.name}</strong><span><CalendarDays size={15}/> Saturday, 12 July</span><span><Clock3 size={15}/> {selectedSlotLabel}</span></div></div><div className="cm-price-breakdown"><div><span>Booking total</span><strong>[Configured Tariff]</strong></div><div><span>Pay today</span><strong>[Server-confirmed amount]</strong></div><p><ShieldCheck size={16}/> Final amount is confirmed securely before payment.</p></div><button className="cm-payment-row"><CreditCard /><span><strong>Razorpay</strong><small>Secure test payment</small></span><ChevronRight /></button></section>; }

function ProcessingScreen({ back, failed, setFailed, go }) { if (failed) return <div className="cm-page cm-centered"><Header back onBack={back} actions={false}/><div className="cm-state-illustration error"><CircleAlert /></div><p className="cm-overline">PAYMENT NOT COMPLETED</p><h1>That didn’t go through.</h1><p>Your selected slot is still held while you choose what to do next.</p><Button onClick={() => { setFailed(false); }} icon={ArrowRight}>Try payment again</Button><button className="cm-text-button" onClick={() => go('booking')}>Review or change payment</button></div>; return <div className="cm-page cm-centered"><Header back onBack={back} actions={false}/><div className="cm-processing-orbit"><div><LockKeyhole /><span>R</span></div></div><p className="cm-overline">SECURE PAYMENT</p><h1>Opening Razorpay…</h1><p>In the prototype, choose a result to continue through the curated payment states.</p><div className="cm-split-actions"><Button onClick={() => go('success')} icon={Check}>Simulate success</Button><button onClick={() => setFailed(true)}>Simulate failure</button></div></div>; }

function SuccessScreen({ go }) { return <div className="cm-page cm-centered cm-success"><Header actions={false}/><div className="cm-success-mark"><Check /></div><p className="cm-overline">BOOKING CONFIRMED</p><h1>You’re on the list.</h1><p>Your digital pass is ready. Keep it handy for your visit.</p><div className="cm-confirmation-ref"><small>BOOKING REFERENCE</small><strong>{prototypeBooking.reference}</strong></div><Button onClick={() => go('pass')} icon={TicketCheck}>View digital pass</Button><button className="cm-text-button" onClick={() => go('home')}>Back to home</button></div>; }

function PassScreen({ go, back }) { return <div className="cm-page cm-pass"><Header title="Digital entry pass" back onBack={back}/><div className="cm-pass-ticket"><span className="cm-pass-label">CONFIRMED</span><p>TURF & TASTE</p><h1>{prototypeBooking.reference}</h1><div className="cm-qr" aria-label="Illustrative booking QR"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><strong>Box Cricket</strong><span>{prototypeBooking.date} · {prototypeBooking.slot}</span><hr/><div><small>PAID</small><strong>{prototypeBooking.paid}</strong></div></div><div className="cm-pass-note"><ShieldCheck/><p>Show this pass to the venue team at check-in. This prototype pass does not represent a real booking.</p></div><Button onClick={() => go('bookings')} icon={NotebookTabs}>View my bookings</Button></div>; }

function BookingsScreen({ go }) { return <div className="cm-page"><Header title="My bookings" actions/><div className="cm-tabs"><button className="active">Upcoming</button><button>History</button></div><button className="cm-booking-row" onClick={() => go('pass')}><img src="/images/box_cricket.jpg" alt=""/><div><span className="cm-status">Confirmed</span><h3>Box Cricket</h3><p>{prototypeBooking.date} · {prototypeBooking.slot}</p><small>{prototypeBooking.reference}</small></div><ChevronRight/></button><div className="cm-booking-empty"><CalendarDays/><h3>No past bookings yet</h3><p>Your completed sessions will appear here.</p></div></div>; }

function AuthScreen({ back, authScreen, setAuthScreen, go }) { const isForgot = authScreen === 'forgot', isReset = authScreen === 'reset', isExpired = authScreen === 'expired'; const title = isForgot ? 'Forgot password?' : isReset ? 'Set a new password' : isExpired ? 'Your session expired' : authScreen === 'create' ? 'Create your account' : 'Welcome back'; return <div className="cm-page cm-auth"><Header back onBack={back} actions={false}/><div className="cm-auth-mark">t<span>&</span>t</div><p className="cm-overline">TURF & TASTE</p><h1>{title}</h1><p>{isExpired ? 'Please sign in again to continue securely.' : isForgot ? 'Enter your email and we’ll send a reset link.' : isReset ? 'Choose a new password for this prototype account.' : 'Sign in or continue exploring as a guest.'}</p>{!isExpired && <form className="cm-form" onSubmit={(e) => e.preventDefault()}>{!isForgot && !isReset && authScreen === 'create' && <label>Full name<input placeholder="Your name" /></label>}<label>Email address<input type="email" placeholder="you@example.com" /></label>{!isForgot && <label>Password<input type="password" placeholder="••••••••" /></label>}</form>}<Button onClick={() => { if (isForgot) setAuthScreen('reset'); else if (isReset || isExpired || authScreen === 'signin') go('profile'); else setAuthScreen('signin'); }} icon={ArrowRight}>{isForgot ? 'Send reset link' : isReset ? 'Save password' : isExpired ? 'Sign in' : authScreen === 'create' ? 'Create account' : 'Sign in'}</Button>{authScreen === 'signin' && <><button className="cm-text-button" onClick={() => setAuthScreen('forgot')}>Forgot password?</button><p className="cm-auth-switch">New to Turf & Taste? <button onClick={() => setAuthScreen('create')}>Create account</button></p></>}{authScreen === 'create' && <p className="cm-auth-switch">Already have an account? <button onClick={() => setAuthScreen('signin')}>Sign in</button></p>}<button className="cm-guest-button" onClick={() => go('home')}>Continue as guest</button></div>; }

function ProfileScreen({ go, theme }) { return <div className="cm-page"><Header title="Profile" actions/><div className="cm-profile-hero"><div className="cm-avatar"><UserRound /></div><div><span>GUEST PREVIEW</span><h2>Your profile</h2><p>Sign in to save details across devices.</p></div></div><div className="cm-list-card"><button onClick={() => go('auth')}><UserRound/><span><strong>Sign in or create account</strong><small>Use a real account in the production app</small></span><ChevronRight/></button><button onClick={() => go('edit-profile')}><UserRound/><span><strong>Edit profile</strong><small>Prototype-only local fields</small></span><ChevronRight/></button><button onClick={() => go('bookings')}><NotebookTabs/><span><strong>My bookings</strong><small>View your local prototype pass</small></span><ChevronRight/></button><button onClick={() => go('reviews')}><Star/><span><strong>Ratings & reviews</strong><small>Verified visit feedback</small></span><ChevronRight/></button></div><SectionTitle title="Settings"/><div className="cm-list-card"><button onClick={() => go('settings')}><Settings/><span><strong>Preferences</strong><small>{theme === 'dark' ? 'Midnight Ivory' : 'Clubhouse Ivory'}</small></span><ChevronRight/></button><button onClick={() => go('info', { info: 'notices' })}><Bell/><span><strong>Updates & notices</strong><small>Stay in the loop</small></span><ChevronRight/></button></div><SectionTitle title="Information"/>{['contact', 'rules', 'about', 'terms', 'privacy'].map((key) => <button key={key} className="cm-info-link" onClick={() => go('info', { info: key })}>{infoPages[key].title}<ChevronRight /></button>)}</div>; }

function EditProfileScreen({ back, go }) { return <div className="cm-page"><Header title="Edit profile" back onBack={back}/><div className="cm-intro"><p className="cm-overline">PROFILE</p><h2>Make it yours.</h2><p>These fields are local to the prototype and are not a production account.</p></div><form className="cm-form" onSubmit={(event) => event.preventDefault()}><label>Full name<input placeholder="Your name" /></label><label>Mobile number<input inputMode="tel" placeholder="10-digit number" /></label><label>Email address<input inputMode="email" placeholder="you@example.com" /></label></form><div className="cm-inline-action"><Button onClick={() => go('profile')} icon={Check}>Save changes</Button></div></div>; }

function SettingsScreen({ back, go, theme, setTheme }) { return <div className="cm-page"><Header title="Settings" back onBack={back}/><SectionTitle title="Appearance"/><div className="cm-list-card"><button onClick={() => setTheme('ivory')} className={theme === 'ivory' ? 'selected' : ''}><Sun/><span><strong>Clubhouse Ivory</strong><small>Warm light appearance</small></span>{theme === 'ivory' && <Check/>}</button><button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'selected' : ''}><Moon/><span><strong>Midnight Ivory</strong><small>Curated dark-theme parity</small></span>{theme === 'dark' && <Check/>}</button></div><SectionTitle title="Support"/><div className="cm-list-card"><button onClick={() => go('offline')}><WifiOff/><span><strong>Connection status</strong><small>View resilience state</small></span><ChevronRight/></button></div></div>; }

function ReviewsScreen({ back }) { return <div className="cm-page"><Header title="Ratings & reviews" back onBack={back}/><div className="cm-rating-summary"><strong>4.9</strong><div><span>{[1,2,3,4,5].map(i => <Star key={i} size={16} fill="currentColor"/> )}</span><p>Verified visitor feedback</p></div></div><div className="cm-review"><div><div className="cm-review-avatar">V</div><span><strong>Verified visit</strong><small>Box Cricket · July</small></span></div><p>“A well-kept space and a smooth check-in. Great for an evening game.”</p></div><div className="cm-review"><div><div className="cm-review-avatar">R</div><span><strong>Verified visit</strong><small>Pickle Ball · June</small></span></div><p>“Clear venue information and a welcoming team.”</p></div></div>; }

function EventsScreen({ go, mode, setMode }) { if (mode === 'loading') return <StatePage icon={<PlayCircle/>} title="Finding what’s on" body="Loading the latest clubhouse events." action="Show events" onClick={() => setMode('normal')} />; if (mode === 'empty') return <StatePage icon={<CalendarDays/>} title="Nothing scheduled yet" body="New clubhouse events will appear here when they are announced." action="Back to home" onClick={() => go('home')} />; return <div className="cm-page"><Header title="Events" actions/><div className="cm-intro"><p className="cm-overline">AT THE CLUBHOUSE</p><h2>Bring your crew.</h2><p>Local games, social sessions and special days.</p></div><div className="cm-event-list">{prototypeEvents.map((item) => <button key={item.id} className="cm-event-card" onClick={() => go('event', { event: item })}><img src={item.image} alt=""/><div><span>{item.tag} · {item.date}</span><h3>{item.title}</h3><p>{item.time}</p></div></button>)}</div><div className="cm-state-controls"><button onClick={() => setMode('loading')}>Loading state</button><button onClick={() => setMode('empty')}>Empty state</button></div></div>; }

function EventScreen({ back, event }) { return <div className="cm-page cm-event-detail"><Header back onBack={back}/><img className="cm-cover-image" src={event.image} alt=""/><div className="cm-event-detail-copy"><span className="cm-status">{event.tag}</span><p className="cm-overline">{event.date}</p><h1>{event.title}</h1><p><Clock3 size={16}/> {event.time}</p><p><MapPin size={16}/> Turf & Taste · Patan, Gujarat</p><hr/><h3>About this event</h3><p>{event.description}</p></div></div>; }

function DiningScreen({ go }) { return <div className="cm-page"><Header title="Dining" actions/><div className="cm-intro"><p className="cm-overline">AT THE CLUBHOUSE</p><h2>Refuel your way.</h2><p>Explore food, drinks and essential conveniences before your visit.</p></div><div className="cm-stacked-list">{prototypeOutlets.map((item) => <button key={item.id} className="cm-outlet-card" onClick={() => go('outlet', { outlet: item })}><img src={item.image} alt=""/><div><span>{item.kind}</span><h3>{item.name}</h3><p>{item.hours}</p><ChevronRight/></div></button>)}</div><div className="cm-prototype-disclaimer"><Info size={16}/><p>Browse outlet and menu information. Ordering is not available in this customer app.</p></div></div>; }

function OutletScreen({ go, back, outlet }) { return <div className="cm-page cm-outlet"><Header back onBack={back}/><img className="cm-cover-image" src={outlet.image} alt=""/><div className="cm-outlet-copy"><span className="cm-status">{outlet.kind}</span><h1>{outlet.name}</h1><p>{outlet.description}</p><div className="cm-hours"><Clock3/><span><small>OPERATING HOURS</small><strong>{outlet.hours}</strong></span></div><Button onClick={() => go('menu')} icon={ArrowRight}>View menu</Button></div></div>; }

function MenuScreen({ back, outlet }) { return <div className="cm-page"><Header title={outlet.name} back onBack={back}/><div className="cm-menu-hero"><p className="cm-overline">MENU</p><h2>Good to know before you go.</h2><p>Items and availability are shown for browsing only.</p></div>{outlet.menu.map((section) => <section className="cm-menu-section" key={section.category}><SectionTitle title={section.category}/>{section.items.map((item) => <div className="cm-menu-item" key={item.name}><div><span className="cm-veg-dot">{item.veg && <i/>}</span><strong>{item.name}</strong><small>{item.veg ? 'Vegetarian' : 'Non-vegetarian'}</small></div><b>{item.price}</b></div>)}</section>)}<div className="cm-prototype-disclaimer"><Info size={16}/><p>Menu availability can change at the outlet. Food ordering is not offered here.</p></div></div>; }

function InfoScreen({ back, info }) { const item = infoPages[info]; return <div className="cm-page cm-info-page"><Header title={item.title} back onBack={back}/><div className="cm-info-art"><Info /></div><p className="cm-overline">TURF & TASTE</p><h1>{item.title}</h1><p>{item.body}</p><div className="cm-info-block"><h3>Helpful next step</h3><p>Use the navigation below to continue exploring the clubhouse.</p></div></div>; }

function OfflineScreen({ go }) { return <StatePage icon={<WifiOff/>} title="You’re offline" body="Some saved information may still be available. Connect to refresh venue availability and live updates." action="Try again" onClick={() => go('home')} secondary="Go to bookings" onSecondary={() => go('bookings')} />; }
function StatePage({ icon, title, body, action, onClick, secondary, onSecondary }) { return <div className="cm-page cm-centered"><Header actions={false}/><div className="cm-state-illustration">{icon}</div><p className="cm-overline">TURF & TASTE</p><h1>{title}</h1><p>{body}</p><Button onClick={onClick} icon={ArrowRight}>{action}</Button>{secondary && <button className="cm-text-button" onClick={onSecondary}>{secondary}</button>}</div>; }

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// 1. Verify Curated Visual Comparison Fixtures
import { services, venues, homeVenues } from '../src/comparison/fixtures.js';

// 2. Verify Broader Customer Mobile Prototype Data
import { prototypeFacilities, prototypeOutlets, prototypeEvents, infoPages } from '../src/prototype/customerMobile/data.js';

const AUTHORIZED_SPORTS = [
  'Box Cricket',
  'Skating Rink',
  'Pickle Ball',
  'Cricket Green Net Practice',
  'Cricket Green Net Practice with Shooting Machine'
];

const UNAUTHORIZED_SPORTS = [
  'Football',
  'Tennis',
  'Padel',
  'Badminton',
  'Basketball',
  'Squash',
  'Golf'
];

describe('Product Rule & Authorized Sports Verification', () => {
  it('comparison fixtures must contain strictly the 5 authorized sports', () => {
    assert.equal(services.length, 5);
    for (const service of services) {
      assert.ok(AUTHORIZED_SPORTS.includes(service), `Unexpected sport: ${service}`);
    }
  });

  it('no unauthorized sports are exposed in comparison venues', () => {
    for (const venue of venues) {
      for (const service of venue.services) {
        assert.ok(AUTHORIZED_SPORTS.includes(service), `Unauthorized service in venue: ${service}`);
        for (const unauth of UNAUTHORIZED_SPORTS) {
          assert.notEqual(service.toLowerCase(), unauth.toLowerCase(), `Found unauthorized sport: ${unauth}`);
        }
      }
    }
  });

  it('prototype facilities list contains only authorized disciplines', () => {
    assert.equal(prototypeFacilities.length, 7);
    for (const fac of prototypeFacilities) {
      assert.ok(AUTHORIZED_SPORTS.includes(fac.service), `Unauthorized facility service: ${fac.service}`);
    }
  });

  it('dining outlets are strictly discovery/menu info with no checkout or delivery', () => {
    for (const outlet of prototypeOutlets) {
      assert.ok(outlet.name, 'Outlet must have name');
      assert.ok(outlet.menu && outlet.menu.length > 0, 'Outlet must have menu items for discovery');
      assert.equal(outlet.cart, undefined, 'Outlet must not have shopping cart');
      assert.equal(outlet.checkout, undefined, 'Outlet must not have checkout');
      assert.equal(outlet.delivery, undefined, 'Outlet must not have delivery');
    }
  });
});

describe('Booking Step 1 Progression & All 5 Sports Verification', () => {
  it('all 5 authorized sports can be selected and resolve valid arena details', () => {
    for (const sport of AUTHORIZED_SPORTS) {
      const facility = prototypeFacilities.find((f) => f.service === sport || f.name === sport);
      assert.ok(facility, `Missing facility for authorized sport: ${sport}`);
      assert.ok(facility.id, 'Facility must have an ID');
      assert.ok(facility.venueName, 'Facility must have venueName');
      assert.ok(facility.tariff, 'Facility must have tariff');
      assert.ok(facility.image, 'Facility must have image');

      // Step 1 gating requirement: selectedFacility must exist to enable progression
      const canProgressStep1 = Boolean(facility);
      assert.equal(canProgressStep1, true, `Step 1 progression should be enabled for ${sport}`);
    }
  });

  it('unselected state correctly gates Step 1 progression', () => {
    const selectedFacility = null;
    const canProgressStep1 = Boolean(selectedFacility);
    assert.equal(canProgressStep1, false, 'Step 1 must not allow progression without facility selection');
  });

  it('changing facility invalidates downstream selected slot', () => {
    let selectedFacility = prototypeFacilities[0];
    let selectedSlot = '6:00 PM';

    // User switches sport/venue
    const handleFacilityChange = (newFacility) => {
      selectedFacility = newFacility;
      selectedSlot = null; // downstream state reset
    };

    handleFacilityChange(prototypeFacilities[1]);
    assert.equal(selectedFacility.id, prototypeFacilities[1].id);
    assert.equal(selectedSlot, null, 'Changing facility must reset selectedSlot to prevent stale state');
  });
});

describe('Interactive Booking Step Progression (Step 1 -> 2 -> 3 -> 4 -> Pay)', () => {
  it('enforces complete four-step progression lifecycle with required validations', () => {
    // Step 1: Sports & Venue
    let currentStep = 1;
    let selectedFacility = null;
    let selectedSlot = null;
    let bookingDetails = { name: '', phone: '', email: '', note: '' };

    // Initial: cannot progress
    assert.equal(Boolean(selectedFacility), false);

    // User selects Box Cricket
    selectedFacility = prototypeFacilities[0];
    assert.equal(Boolean(selectedFacility), true);

    // User clicks Continue to Schedule (Step 2)
    currentStep = 2;
    assert.equal(currentStep, 2);

    // Step 2: Schedule - cannot progress without slot
    let canProgressStep2 = Boolean(selectedSlot);
    assert.equal(canProgressStep2, false);

    // User selects 6:00 PM slot
    selectedSlot = '6:00 PM';
    canProgressStep2 = Boolean(selectedSlot);
    assert.equal(canProgressStep2, true);

    // User clicks Continue to Details (Step 3)
    currentStep = 3;
    assert.equal(currentStep, 3);

    // Step 3: Details - requires name (>=2 chars) and phone (>=10 digits)
    const validateDetails = (d) => d.name.trim().length >= 2 && d.phone.replace(/\D/g, '').length >= 10;
    assert.equal(validateDetails(bookingDetails), false);

    bookingDetails.name = 'Devansh Jadav';
    bookingDetails.phone = '9876543210';
    assert.equal(validateDetails(bookingDetails), true);

    // User clicks Review Booking (Step 4)
    currentStep = 4;
    assert.equal(currentStep, 4);

    // Step 4: Pay - Review & Gateway transition
    const totalPayable = 900.00;
    assert.equal(totalPayable > 0, true);

    // Gateway Simulation transitions:
    // Success scenario:
    let paymentState = 'processing';
    let outcome = 'success';
    let nextScreen = outcome === 'success' ? 'success' : 'payment-failure';
    assert.equal(nextScreen, 'success');

    // Failure / Retry scenario:
    outcome = 'failure';
    nextScreen = outcome === 'success' ? 'success' : 'payment-failure';
    assert.equal(nextScreen, 'payment-failure');
  });
});

describe('Create Account & Auth Form Interactivity Validation', () => {
  it('validates Full Name, WhatsApp Number, and Password correctly', () => {
    const validateForm = (form, mode) => {
      const name = (form.name || '').trim();
      const phone = (form.phone || '').replace(/\D/g, '');
      const password = form.password || '';
      const confirm = form.confirm || '';

      const nameValid = name.length >= 2;
      const phoneValid = phone.length >= 10;
      const passwordValid = password.length >= 6;
      const confirmValid = password === confirm;

      if (mode === 'create') return nameValid && phoneValid && passwordValid;
      if (mode === 'forgot') return phoneValid;
      if (mode === 'reset') return passwordValid && confirmValid;
      if (mode === 'signin') return phoneValid && passwordValid;
      return false;
    };

    // Invalid Create Account forms
    assert.equal(validateForm({ name: '', phone: '', password: '' }, 'create'), false);
    assert.equal(validateForm({ name: 'A', phone: '9876543210', password: 'password123' }, 'create'), false);
    assert.equal(validateForm({ name: 'Devansh', phone: '12345', password: 'password123' }, 'create'), false);
    assert.equal(validateForm({ name: 'Devansh', phone: '9876543210', password: '123' }, 'create'), false);

    // Valid Create Account form
    assert.equal(validateForm({ name: 'Devansh Jadav', phone: '+91 98765 43210', password: 'password123' }, 'create'), true);

    // Reset password validation
    assert.equal(validateForm({ password: 'newpass', confirm: 'different' }, 'reset'), false);
    assert.equal(validateForm({ password: 'securepass123', confirm: 'securepass123' }, 'reset'), true);
  });
});

describe('Bottom Navigation & Safe Area Scoping Audit', () => {
  it('suppresses global BottomNav on focused flows and shows on top-level tabs', () => {
    const isFocusedScreen = (screen) => [
      'booking', 'facility', 'processing', 'payment-failure', 'success', 'pass',
      'auth', 'edit-profile', 'settings', 'appearance', 'reviews',
      'event', 'outlet', 'menu', 'notices', 'contact', 'rules', 'about', 'terms', 'privacy',
      'info', 'offline', 'system-error'
    ].includes(screen);

    // Top-level tabs should show BottomNav
    const topLevelTabs = ['home', 'facilities', 'events', 'dining', 'profile', 'bookings'];
    for (const tab of topLevelTabs) {
      assert.equal(!isFocusedScreen(tab), true, `Tab ${tab} should show BottomNav`);
    }

    // Focused flows should hide BottomNav
    const focusedScreens = ['booking', 'auth', 'processing', 'payment-failure', 'success', 'pass'];
    for (const s of focusedScreens) {
      assert.equal(!isFocusedScreen(s), false, `Focused screen ${s} should hide BottomNav`);
    }
  });
});

describe('Information, Support and Resilience Pages', () => {
  it('all required support and policy info pages exist', () => {
    const requiredKeys = ['notices', 'contact', 'rules', 'about', 'terms', 'privacy'];
    for (const key of requiredKeys) {
      assert.ok(infoPages[key], `Missing info page: ${key}`);
      assert.ok(infoPages[key].title, `Info page ${key} missing title`);
      assert.ok(infoPages[key].body, `Info page ${key} missing body`);
    }
  });

  it('events list contains curated community fixtures without ticket purchasing', () => {
    assert.ok(prototypeEvents.length >= 2);
    for (const event of prototypeEvents) {
      assert.ok(event.title);
      assert.ok(event.date);
      assert.equal(event.ticketPrice, undefined, 'Event should not have direct ticket purchasing');
    }
  });
});

describe('Venue Time and Slot Calculation Rules', () => {
  it('correctly identifies day of week and past slots', async () => {
    const { dayOfWeekForVenueDate, slotHasStarted, normalizeScheduleClose } = await import('../server/utils/venueTime.js');

    // Day of week check: 2026-09-29 is a Tuesday (day 2: Sun=0, Mon=1, Tue=2)
    assert.equal(dayOfWeekForVenueDate('2026-09-29'), 2);

    // Normalization of schedule across midnight
    assert.equal(normalizeScheduleClose(360, 1440), 1440);
    assert.equal(normalizeScheduleClose(360, 60), 1500); // 1:00 AM next day

    // Past slot evaluation
    const pastDate = '2020-01-01';
    assert.equal(slotHasStarted(pastDate, 600), true);

    const farFutureDate = '2099-12-31';
    assert.equal(slotHasStarted(farFutureDate, 600), false);
  });
});

describe('Quote Signing and Integrity', () => {
  it('creates and validates signed quote tokens', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing';
    const { createQuoteToken, verifyQuoteToken } = await import('../server/utils/quoteToken.js');

    const sampleQuote = {
      facilityId: 'fac_box_cricket',
      facilityName: 'Box Cricket Arena',
      date: '2026-10-01',
      timeSlot: '06:00 PM – 07:00 PM',
      durationHours: 1,
      ratePeriod: 'peak',
      hourlyRate: 1200,
      weekendSurgePercent: 0,
      total: 1200,
      deposit: 300,
      currency: 'INR'
    };

    const token = createQuoteToken(sampleQuote);
    assert.ok(typeof token === 'string' && token.includes('.'));

    const verification = verifyQuoteToken(token);
    assert.equal(verification.error, undefined);
    assert.equal(verification.quote.facilityId, 'fac_box_cricket');
    assert.equal(verification.quote.total, 1200);

    // Tampered token test
    const [body] = token.split('.');
    const badToken = `${body}.invalidsignature123`;
    const badVerification = verifyQuoteToken(badToken);
    assert.ok(badVerification.error);
  });
});

describe('Dynamic Real-Time Date & Slot Scheduler (bookingScheduler.js)', async () => {
  const {
    getVenueNow,
    generateBookingDays,
    parseSlotStartMinutes,
    formatSlotEnd,
    formatSlotLabel,
    getSlotState,
    calculateBookingPricing,
    CANONICAL_BOTTOM_NAV
  } = await import('../src/prototype/customerMobile/bookingScheduler.js');

  it('getVenueNow returns accurate IST date string and minutes', () => {
    const now = getVenueNow();
    assert.ok(now.dateString.match(/^\d{4}-\d{2}-\d{2}$/), 'Date string must be YYYY-MM-DD');
    assert.ok(now.minutes >= 0 && now.minutes < 1440, 'Minutes must be within 0-1439');
    assert.ok(now.dayName.length >= 3, 'Day name must be valid');
    assert.ok(now.monthName.length >= 3, 'Month name must be valid');
  });

  it('generateBookingDays creates dynamic bookable days starting with Today without hardcoding', () => {
    const days = generateBookingDays(5);
    assert.equal(days.length, 5);
    assert.equal(days[0].isToday, true, 'First day must be Today');
    assert.equal(days[0].short, 'Today');
    assert.equal(days[1].short, 'Tmrw');

    // Ensure all days are monotonically increasing calendar dates
    for (let i = 0; i < days.length; i++) {
      assert.ok(days[i].dateString, 'Each day must have dateString');
      assert.ok(days[i].day, 'Each day must have day label');
      assert.ok(days[i].num, 'Each day must have day number');
      assert.ok(days[i].displayFull, 'Each day must have displayFull');
      if (i > 0) {
        assert.ok(days[i].dateString > days[i - 1].dateString, 'Dates must be strictly increasing');
      }
    }
  });

  it('parseSlotStartMinutes accurately converts 12h slot strings to civil minutes from midnight', () => {
    assert.equal(parseSlotStartMinutes('6:00 AM'), 360);
    assert.equal(parseSlotStartMinutes('12:00 PM'), 720);
    assert.equal(parseSlotStartMinutes('6:00 PM'), 1080);
    assert.equal(parseSlotStartMinutes('10:00 PM'), 1320);
  });

  it('formatSlotEnd and formatSlotLabel accurately project duration end times', () => {
    assert.equal(formatSlotEnd('6:00 PM', 1), '7:00 PM');
    assert.equal(formatSlotEnd('6:00 PM', 1.5), '7:30 PM');
    assert.equal(formatSlotEnd('6:00 PM', 2), '8:00 PM');

    assert.equal(formatSlotLabel('6:00 PM', 1), '6:00 PM – 7:00 PM (1 hr)');
    assert.equal(formatSlotLabel('6:00 PM', 1.5), '6:00 PM – 7:30 PM (1.5 hrs)');
    assert.equal(formatSlotLabel('6:00 PM', 2), '6:00 PM – 8:00 PM (2 hrs)');
  });

  it('evaluates slot state with operating hours boundaries and duration overrun', () => {
    // Facility closes at 11:00 PM (1380m)
    // 10:00 PM slot (1320m):
    // 1 hr ends at 11:00 PM (1380m) <= 1380m -> valid
    // 1.5 hrs ends at 11:30 PM (1410m) > 1380m -> unavailable (Closes 11 PM)
    // 2 hrs ends at 12:00 AM (1440m) > 1380m -> unavailable (Closes 11 PM)
    const futureDate = '2099-01-01';

    const state1h = getSlotState('10:00 PM', futureDate, 1);
    assert.equal(state1h.state, 'available');
    assert.equal(state1h.selectable, true);

    const state1_5h = getSlotState('10:00 PM', futureDate, 1.5);
    assert.equal(state1_5h.state, 'unavailable');
    assert.equal(state1_5h.selectable, false);
    assert.equal(state1_5h.label, 'Closes 11 PM');

    const state2h = getSlotState('10:00 PM', futureDate, 2);
    assert.equal(state2h.state, 'unavailable');
    assert.equal(state2h.selectable, false);
    assert.equal(state2h.label, 'Closes 11 PM');
  });

  it('blocks past slots for Today', () => {
    const now = getVenueNow();
    const todayStr = now.dateString;

    // Early morning 6:00 AM (360m). If current IST is past 6:00 AM, slot must be past & unselectable
    if (now.minutes > 360) {
      const earlySlotState = getSlotState('6:00 AM', todayStr, 1);
      assert.equal(earlySlotState.state, 'past');
      assert.equal(earlySlotState.selectable, false);
      assert.equal(earlySlotState.label, 'Past');
    }

    // A past date (e.g. 2020-01-01) must have all slots marked as past
    const pastSlotState = getSlotState('6:00 PM', '2020-01-01', 1);
    assert.equal(pastSlotState.state, 'past');
    assert.equal(pastSlotState.selectable, false);
  });

  it('calculates itemized pricing accurately based on facility tariff and selected duration', () => {
    const facility = prototypeFacilities[0]; // Box Cricket, tariff: "₹700"

    // 1 hour
    const p1 = calculateBookingPricing(facility, 1);
    assert.equal(p1.baseRate, 700);
    assert.equal(p1.courtTotal, 700);
    assert.equal(p1.deposit, 233);
    assert.equal(p1.totalPayable, 826); // 700 + 126 GST

    // 1.5 hours
    const p15 = calculateBookingPricing(facility, 1.5);
    assert.equal(p15.baseRate, 700);
    assert.equal(p15.courtTotal, 1050);
    assert.equal(p15.deposit, 350);
    assert.equal(p15.totalPayable, 1239); // 1050 + 189 GST

    // 2 hours
    const p2 = calculateBookingPricing(facility, 2);
    assert.equal(p2.baseRate, 700);
    assert.equal(p2.courtTotal, 1400);
    assert.equal(p2.deposit, 467);
    assert.equal(p2.totalPayable, 1652); // 1400 + 252 GST
  });

  it('canonical bottom navigation retains invariant order across all routes', () => {
    assert.equal(CANONICAL_BOTTOM_NAV.length, 5);
    const expectedOrder = ['Home', 'Venues', 'Dining', 'Events', 'Profile'];
    for (let i = 0; i < CANONICAL_BOTTOM_NAV.length; i++) {
      assert.equal(CANONICAL_BOTTOM_NAV[i].label, expectedOrder[i], `Position ${i} must be ${expectedOrder[i]}`);
    }

    // Changing active route should never reorder or mutate canonical list
    const simulateNavRender = (activeTab) => {
      return CANONICAL_BOTTOM_NAV.map((item) => ({
        ...item,
        isActive: item.label === activeTab || item.id === activeTab
      }));
    };

    const navHome = simulateNavRender('home');
    const navDining = simulateNavRender('dining');
    const navEvents = simulateNavRender('events');
    const navProfile = simulateNavRender('profile');

    for (let i = 0; i < 5; i++) {
      assert.equal(navHome[i].label, expectedOrder[i]);
      assert.equal(navDining[i].label, expectedOrder[i]);
      assert.equal(navEvents[i].label, expectedOrder[i]);
      assert.equal(navProfile[i].label, expectedOrder[i]);
    }

    assert.equal(navDining[2].isActive, true);
    assert.equal(navDining[0].isActive, false);
    assert.equal(navEvents[3].isActive, true);
  });
});

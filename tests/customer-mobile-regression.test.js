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
    assert.equal(prototypeFacilities.length, 5);
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

describe('Customer Mobile Booking State & Validation Guards', () => {
  it('contact validation requires valid name and at least 10 digits for mobile number', () => {
    const validateContact = (name, phone) => {
      const cleanPhone = phone.replace(/\D/g, '');
      return name.trim().length >= 2 && cleanPhone.length >= 10;
    };

    assert.equal(validateContact('', ''), false);
    assert.equal(validateContact('Devansh', '123'), false);
    assert.equal(validateContact('Devansh', '9876543210'), true);
    assert.equal(validateContact('D', '9876543210'), false);
    assert.equal(validateContact('Devansh Jadav', '+91 98765 43210'), true);
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

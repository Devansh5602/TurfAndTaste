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

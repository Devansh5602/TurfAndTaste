import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readSource = (path) => readFileSync(join(__dirname, '..', path), 'utf-8');

// ── Booking State Architecture Tests ──

test('bookingState.js exists and exports useBookingState', () => {
  const content = readSource('src/prototype/customerMobile/bookingState.js');
  assert.ok(content.includes('useBookingState'), 'Must export useBookingState');
  assert.ok(content.includes('INITIAL_BOOKING_STATE'), 'Must have initial state');
});

test('bookingState tracks canonical booking fields', () => {
  const content = readSource('src/prototype/customerMobile/bookingState.js');
  assert.ok(content.includes('facility'), 'Must track facility');
  assert.ok(content.includes('date'), 'Must track date');
  assert.ok(content.includes('slot'), 'Must track slot');
  assert.ok(content.includes('duration'), 'Must track duration');
  assert.ok(content.includes('customerDetails'), 'Must track customer details');
  assert.ok(content.includes('quote'), 'Must track quote');
  assert.ok(content.includes('booking'), 'Must track booking');
  assert.ok(content.includes('payment'), 'Must track payment');
});

test('bookingState invalidates downstream state on facility change', () => {
  const content = readSource('src/prototype/customerMobile/bookingState.js');
  assert.ok(content.includes('setFacility'), 'Must have setFacility');
  assert.ok(content.includes('setDate'), 'Must have setDate');
  assert.ok(content.includes('setSlot'), 'Must have setSlot');
  assert.ok(content.includes('setDuration'), 'Must have setDuration');
});

test('bookingState has step guards', () => {
  const content = readSource('src/prototype/customerMobile/bookingState.js');
  assert.ok(content.includes('canProceedToSchedule'), 'Must have schedule guard');
  assert.ok(content.includes('canProceedToDetails'), 'Must have details guard');
  assert.ok(content.includes('canProceedToReview'), 'Must have review guard');
  assert.ok(content.includes('canSubmitPayment'), 'Must have payment guard');
});

// ── Duration Rules Tests ──

test('CustomerMobilePrototype uses only 1h and 2h durations', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('[1, 2]'), 'Must use [1, 2] duration options');
  assert.ok(!content.includes('1.5'), 'Must not contain 1.5 duration');
  assert.ok(!content.includes('90-minute'), 'Must not contain 90-minute');
});

test('CustomerMobilePrototype does not contain 60m / 90m Blocks', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('60m / 90m'), 'Must not contain 60m / 90m Blocks');
});

// ── Operating Hours Tests ──

test('CustomerMobilePrototype uses 24/7 operating window', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('24/7'), 'Must use 24/7 operating window');
  assert.ok(!content.includes('06:00 AM – 10:00 PM'), 'Must not contain fake operating hours');
});

// ── Server-Authoritative Quote Tests ──

test('CustomerMobilePrototype integrates server quotes', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('api.createQuote'), 'Must call server quote endpoint');
  assert.ok(content.includes('setQuoteLoading'), 'Must have quote loading state');
  assert.ok(content.includes('setQuoteError'), 'Must have quote error state');
});

test('CustomerMobilePrototype invalidates quote on selection change', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('setQuote(null)'), 'Must invalidate quote on change');
});

test('api.js has createQuote method', () => {
  const content = readSource('src/services/api.js');
  assert.ok(content.includes('createQuote'), 'Must have createQuote method');
  assert.ok(content.includes('/v2/quotes'), 'Must call /v2/quotes endpoint');
});

// ── Pricing Authority Tests ──

test('CustomerMobilePrototype does not contain hardcoded pricing', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('₹700'), 'Must not contain hardcoded ₹700');
  assert.ok(!content.includes('₹900'), 'Must not contain hardcoded ₹900');
  assert.ok(!content.includes('₹1239'), 'Must not contain hardcoded ₹1239');
});

test('CustomerMobilePrototype uses server quote for pricing display', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('pricing.hourlyRate'), 'Must use server hourly rate');
  assert.ok(content.includes('pricing.total'), 'Must use server total');
});

// ── Payment State Tests ──

test('CustomerMobilePrototype has explicit payment states', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('payment'), 'Must track payment state');
  assert.ok(content.includes('setPaymentState'), 'Must have payment state setter');
});

test('CustomerMobilePrototype does not have fake payment controls', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('Payment successful'), 'Must not have fake payment success button');
  assert.ok(!content.includes('Payment failed or cancelled'), 'Must not have fake payment failure button');
});

// ── Booking Step Guard Tests ──

test('CustomerMobilePrototype has booking step guards', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('canProceedToSchedule'), 'Must have schedule guard');
  assert.ok(content.includes('canProceedToDetails'), 'Must have details guard');
  assert.ok(content.includes('canProceedToReview'), 'Must have review guard');
  assert.ok(content.includes('canSubmitPayment'), 'Must have payment guard');
});

// ── Confirmation Tests ──

test('CustomerMobilePrototype does not show fake booking confirmation', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('TTB-2026-9482'), 'Must not have fake booking reference');
  assert.ok(content.includes('booking?.id'), 'Must use real booking ID');
});

// ── Entry Pass / QR Tests ──

test('CustomerMobilePrototype does not show fake QR as valid', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('QR Pending'), 'Must have QR pending state');
  assert.ok(content.includes('booking?.id'), 'Must check booking ID before showing QR');
});

// ── Reservations/History Tests ──

test('CustomerMobilePrototype shows empty state for reservations', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('No reservations yet'), 'Must show empty state');
  assert.ok(!content.includes('Skyline Box Cricket Arena'), 'Must not have fake reservation');
});

// ── Customer/Admin Auth Separation Tests ──

test('Customer and Admin auth separation still intact', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('useCustomerAuth'), 'Must use customer auth');
  assert.ok(content.includes("navigate('/admin')"), 'Must have admin portal entry');
});

// ── Theme Tests ──

test('Theme remains global', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('useTheme'), 'Must use global useTheme');
  assert.ok(!content.includes("useState('ivory')"), 'Must not have local theme state');
});

// ── Dining Tests ──

test('Dining remains informational-only', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('No food ordering or payment is available'), 'Must maintain dining disclaimer');
});

// ── Placeholder Tests ──

test('No unresolved placeholder brackets', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('[Facility Name]'), 'Must not contain [Facility Name]');
  assert.ok(!content.includes('[Configured Tariff]'), 'Must not contain [Configured Tariff]');
  assert.ok(!content.includes('[Booking Reference]'), 'Must not contain [Booking Reference]');
  assert.ok(!content.includes('[Venue location]'), 'Must not contain [Venue location]');
  assert.ok(!content.includes('[Example review content]'), 'Must not contain [Example review content]');
});

// ── Prototype Wording Tests ──

test('No prototype/debug state controls visible', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('CURATED FIXTURE'), 'Must not contain CURATED FIXTURE');
  assert.ok(!content.includes('CURATED REVIEW PREVIEW'), 'Must not contain CURATED REVIEW PREVIEW');
  assert.ok(!content.includes('fixture example'), 'Must not contain fixture example');
  assert.ok(!content.includes('preview feedback'), 'Must not contain preview feedback');
  assert.ok(!content.includes('Loading state'), 'Must not contain Loading state button');
  assert.ok(!content.includes('Empty state'), 'Must not contain Empty state button');
  assert.ok(!content.includes('Menu unavailable'), 'Must not contain Menu unavailable button');
});

// ── Location Tests ──

test('Single Patan property model enforced', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('Patan, Gujarat'), 'Must contain Patan, Gujarat');
  assert.ok(!content.includes('Bopal'), 'Must not contain Bopal');
  assert.ok(!content.includes('Ahmedabad'), 'Must not contain Ahmedabad');
  assert.ok(!content.includes('South Bopal'), 'Must not contain South Bopal');
});

// ── Authorized Sports Tests ──

test('Authorized sports only', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('Box Cricket'), 'Must have Box Cricket');
  assert.ok(content.includes('Skating Rink'), 'Must have Skating Rink');
  assert.ok(content.includes('Pickle Ball'), 'Must have Pickle Ball');
  assert.ok(content.includes('Cricket Green Net Practice'), 'Must have Cricket Green Net Practice');
  assert.ok(!content.includes('Football'), 'Must not have Football');
  assert.ok(!content.includes('Tennis'), 'Must not have Tennis');
  assert.ok(!content.includes('Badminton'), 'Must not have Badminton');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readSource = (path) => readFileSync(join(__dirname, '..', path), 'utf-8');

// ── Product Truth Tests ──

test('data.js does not contain Bopal', () => {
  const content = readSource('src/prototype/customerMobile/data.js');
  assert.ok(!content.includes('Bopal'), 'data.js must not contain Bopal');
});

test('data.js does not contain Ahmedabad', () => {
  const content = readSource('src/prototype/customerMobile/data.js');
  assert.ok(!content.includes('Ahmedabad'), 'data.js must not contain Ahmedabad');
});

test('data.js does not contain South Bopal', () => {
  const content = readSource('src/prototype/customerMobile/data.js');
  assert.ok(!content.includes('South Bopal'), 'data.js must not contain South Bopal');
});

test('data.js does not contain Skyline', () => {
  const content = readSource('src/prototype/customerMobile/data.js');
  assert.ok(!content.includes('Skyline'), 'data.js must not contain Skyline');
});

test('data.js does not contain Masterstroke', () => {
  const content = readSource('src/prototype/customerMobile/data.js');
  assert.ok(!content.includes('Masterstroke'), 'data.js must not contain Masterstroke');
});

test('data.js does not contain The Oval', () => {
  const content = readSource('src/prototype/customerMobile/data.js');
  assert.ok(!content.includes('The Oval'), 'data.js must not contain The Oval');
});

test('data.js contains Patan, Gujarat', () => {
  const content = readSource('src/prototype/customerMobile/data.js');
  assert.ok(content.includes('Patan, Gujarat'), 'data.js must contain Patan, Gujarat');
});

test('data.js contains authorized sports only', () => {
  const content = readSource('src/prototype/customerMobile/data.js');
  assert.ok(content.includes('Box Cricket'), 'Must have Box Cricket');
  assert.ok(content.includes('Skating Rink'), 'Must have Skating Rink');
  assert.ok(content.includes('Pickle Ball'), 'Must have Pickle Ball');
  assert.ok(content.includes('Cricket Green Net Practice'), 'Must have Cricket Green Net Practice');
  assert.ok(!content.includes('Football'), 'Must not have Football');
  assert.ok(!content.includes('Tennis'), 'Must not have Tennis');
  assert.ok(!content.includes('Badminton'), 'Must not have Badminton');
});

test('data.js models shooting machine as Green Net add-on', () => {
  const content = readSource('src/prototype/customerMobile/data.js');
  const shootingMachine = content.match(/shooting-machine.*?'/);
  assert.ok(shootingMachine, 'Shooting machine entry must exist');
  assert.ok(content.includes('Cricket Green Net Practice with Shooting Machine'), 'Must be Green Net with Shooting Machine');
});

test('data.js does not contain marketplace distance concepts', () => {
  const content = readSource('src/prototype/customerMobile/data.js');
  assert.ok(!content.includes('km away'), 'Must not contain distance cards');
  assert.ok(!content.includes('Arenas Open'), 'Must not contain arena count');
});

// ── Booking Duration Tests ──

test('CustomerMobilePrototype does not contain 1.5 duration', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('1.5'), 'Must not contain 1.5 duration');
});

test('CustomerMobilePrototype does not contain 90-minute', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('90-minute'), 'Must not contain 90-minute');
});

test('CustomerMobilePrototype does not contain 60m / 90m Blocks', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('60m / 90m'), 'Must not contain 60m / 90m Blocks');
});

test('CustomerMobilePrototype uses canonical durations [1, 2]', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('[1, 2]'), 'Must use [1, 2] duration options');
});

// ── Placeholder Leakage Tests ──

test('CustomerMobilePrototype does not contain unresolved placeholders', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('[Facility Name]'), 'Must not contain [Facility Name]');
  assert.ok(!content.includes('[Configured Tariff]'), 'Must not contain [Configured Tariff]');
  assert.ok(!content.includes('[Booking Reference]'), 'Must not contain [Booking Reference]');
  assert.ok(!content.includes('[Venue location]'), 'Must not contain [Venue location]');
  assert.ok(!content.includes('[Example review content]'), 'Must not contain [Example review content]');
  assert.ok(!content.includes('[Review Count]'), 'Must not contain [Review Count]');
  assert.ok(!content.includes('[Selected Facility]'), 'Must not contain [Selected Facility]');
});

// ── Prototype Wording Tests ──

test('CustomerMobilePrototype does not contain prototype navigation controls', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('CURATED FIXTURE'), 'Must not contain CURATED FIXTURE');
  assert.ok(!content.includes('CURATED REVIEW PREVIEW'), 'Must not contain CURATED REVIEW PREVIEW');
  assert.ok(!content.includes('fixture example'), 'Must not contain fixture example');
  assert.ok(!content.includes('preview feedback'), 'Must not contain preview feedback');
  assert.ok(!content.includes('Loading state'), 'Must not contain Loading state button');
  assert.ok(!content.includes('Empty state'), 'Must not contain Empty state button');
  assert.ok(!content.includes('Menu unavailable'), 'Must not contain Menu unavailable button');
});

// ── Customer Identity Tests ──

test('CustomerMobilePrototype does not contain hardcoded customer identity', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('Devansh'), 'Must not contain hardcoded customer name');
  assert.ok(!content.includes('devansh.jadav@example.com'), 'Must not contain hardcoded email');
});

// ── Global Theme Tests ──

test('CustomerMobilePrototype uses useTheme from canonical provider', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('useTheme'), 'Must use useTheme');
  assert.ok(content.includes("from '../../theme'"), 'Must import from canonical theme');
});

test('CustomerMobilePrototype does not have local theme state', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes("useState('ivory')"), 'Must not have local theme state');
  assert.ok(!content.includes("useState(() => new URLSearchParams"), 'Must not have URL-based theme init');
});

// ── Admin Portal Entry Tests ──

test('CustomerMobilePrototype has admin portal entry', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes("navigate('/admin')"), 'Must have admin portal entry');
  assert.ok(content.includes('Staff / Admin Portal'), 'Must have Staff / Admin Portal label');
});

// ── Payment Simulation Tests ──

test('CustomerMobilePrototype does not have fake payment controls', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('Payment successful'), 'Must not have fake payment success button');
  assert.ok(!content.includes('Payment failed or cancelled'), 'Must not have fake payment failure button');
});

// ── Booking Reference Tests ──

test('CustomerMobilePrototype does not have fake booking references', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('TTB-2026-9482'), 'Must not have fake booking reference');
});

// ── Dining Tests ──

test('CustomerMobilePrototype maintains dining informational-only', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('No food ordering or payment is available'), 'Must maintain dining disclaimer');
});

// ── Location Tests ──

test('CustomerMobilePrototype does not contain Bopal in JSX', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(!content.includes('Bopal, Ahmedabad'), 'Must not contain Bopal, Ahmedabad');
  assert.ok(!content.includes('Bopal District'), 'Must not contain Bopal District');
});

test('CustomerMobilePrototype contains Patan in JSX', () => {
  const content = readSource('src/prototype/customerMobile/CustomerMobilePrototype.jsx');
  assert.ok(content.includes('Patan, Gujarat'), 'Must contain Patan, Gujarat');
});

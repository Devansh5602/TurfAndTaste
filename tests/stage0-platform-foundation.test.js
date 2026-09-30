import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUSINESS_TIMEZONE,
  formatToISTString,
  intervalsOverlap,
  normalizeBookingInterval,
  parseCivilTimeToInstant
} from '../server/domain/time/bookingInterval.js';

import {
  nextQuickStartAfter,
  validateCustomBooking,
  validateLeadTime,
  validateQuickBooking
} from '../server/domain/booking/bookingRules.js';

import {
  BOOKING_STATES,
  canTransitionBookingStatus,
  isOccupyingStatus
} from '../server/domain/booking/bookingStateMachine.js';

import {
  CANONICAL_ADD_ONS,
  CANONICAL_FACILITIES,
  CANONICAL_PROPERTY,
  CANONICAL_SECTIONS,
  CANONICAL_SERVICES,
  isSamePhysicalResource,
  mapLegacyFacilityToPhysical
} from '../server/domain/facility/inventory.js';

import { checkIntervalConflicts } from '../server/domain/booking/conflictEngine.js';
import { computeSessionMetrics, validateSessionExtension } from '../server/domain/session/sessionOperations.js';
import { DEFAULT_ROLE_PERMISSIONS, hasPermission, STANDARD_PERMISSIONS, SYSTEM_ROLES } from '../server/domain/rbac/rbacEngine.js';
// The production module rejects missing signing configuration. Supply an
// in-memory test secret before importing it; this never becomes a fallback in
// runtime code.
process.env.JWT_SECRET ??= 'stage0-test-only-guest-history-secret';
const {
  canAccessBookingHistory,
  generateGuestHistoryToken,
  resolveBookingHistoryLookup,
  verifyGuestHistoryToken
} = await import('../server/domain/guest/guestPrivacy.js');
import {
  calculateDiningOrderTotals,
  canTransitionDiningOrder,
  DINING_ORDER_STATUSES,
  ORDER_SOURCES,
  validateTableNumber
} from '../server/domain/dining/diningEngine.js';

// ============================================================================
// 1. CANONICAL BOOKING INTERVALS & CROSS-MIDNIGHT SAFETY
// ============================================================================
describe('Canonical Booking Intervals & Cross-Midnight Safety', () => {
  it('enforces Asia/Kolkata timezone context and ISO +05:30 formatting', () => {
    assert.equal(BUSINESS_TIMEZONE, 'Asia/Kolkata');
    const instant = parseCivilTimeToInstant('2026-10-15', '18:00');
    const istString = formatToISTString(instant);
    assert.equal(istString, '2026-10-15T18:00:00+05:30');
  });

  it('permits adjacent bookings with touching boundaries without overlap ([start, end))', () => {
    const slot1 = normalizeBookingInterval({ date: '2026-10-15', timeSlot: '06:00 PM – 07:00 PM' });
    const slot2 = normalizeBookingInterval({ date: '2026-10-15', timeSlot: '07:00 PM – 08:00 PM' });
    assert.equal(intervalsOverlap(slot1, slot2), false, 'Touching boundaries must not overlap');
  });

  it('rejects partial overlap and full containment', () => {
    const slotA = normalizeBookingInterval({ date: '2026-10-15', timeSlot: '06:00 PM – 08:00 PM' });
    const slotB = normalizeBookingInterval({ date: '2026-10-15', timeSlot: '07:00 PM – 09:00 PM' });
    assert.equal(intervalsOverlap(slotA, slotB), true, 'Partial overlap must be detected');

    const slotContained = normalizeBookingInterval({ date: '2026-10-15', timeSlot: '06:30 PM – 07:30 PM' });
    assert.equal(intervalsOverlap(slotA, slotContained), true, 'Contained interval must overlap');
  });

  it('preserves calendar rollover for cross-midnight bookings (23:00 to 01:00 next day)', () => {
    const crossMidnight = normalizeBookingInterval({ date: '2026-10-15', timeSlot: '11:00 PM – 01:00 AM' });
    assert.equal(crossMidnight.isCrossMidnight, true);
    assert.equal(crossMidnight.durationHours, 2);
    assert.equal(crossMidnight.startAtISO, '2026-10-15T23:00:00+05:30');
    assert.equal(crossMidnight.endAtISO, '2026-10-16T01:00:00+05:30');
  });

  it('supports custom quarter-hour cross-midnight intervals (23:45 to 00:45 next day)', () => {
    const cross = normalizeBookingInterval({
      date: '2026-10-15',
      startTime: '23:45',
      durationMinutes: 60
    });
    assert.equal(cross.isCrossMidnight, true);
    assert.equal(cross.startAtISO, '2026-10-15T23:45:00+05:30');
    assert.equal(cross.endAtISO, '2026-10-16T00:45:00+05:30');
  });
});

// ============================================================================
// 2. STANDARD QUICK BOOKING RULES
// ============================================================================
describe('Standard Quick Booking Rules', () => {
  it('accepts whole-hour starts for 1 hour and 2 hours', () => {
    const valid1h = validateQuickBooking({ date: '2026-10-15', startTime: '18:00', durationMinutes: 60 });
    assert.equal(valid1h.valid, true);

    const valid2h = validateQuickBooking({ date: '2026-10-15', startTime: '20:00', durationMinutes: 120 });
    assert.equal(valid2h.valid, true);
  });

  it('strictly rejects non-whole-hour starts for quick bookings', () => {
    const invalidStart = validateQuickBooking({ date: '2026-10-15', startTime: '18:15', durationMinutes: 60 });
    assert.equal(invalidStart.valid, false);
    assert.match(invalidStart.error, /whole hour/);
  });

  it('strictly rejects 1.5-hour (90m) quick duration', () => {
    const invalid90m = validateQuickBooking({ date: '2026-10-15', startTime: '18:00', durationMinutes: 90 });
    assert.equal(invalid90m.valid, false);
    assert.match(invalid90m.error, /1 Hour or 2 Hours/);
  });
});

// ============================================================================
// 3. CUSTOM BOOKING RULES
// ============================================================================
describe('Custom Booking Rules', () => {
  it('accepts quarter-hour starts (:00, :15, :30, :45) with whole-hour duration', () => {
    const custom15 = validateCustomBooking({ date: '2026-10-15', startTime: '12:15', durationMinutes: 60 });
    assert.equal(custom15.valid, true);

    const custom45_2h = validateCustomBooking({ date: '2026-10-15', startTime: '12:45', durationMinutes: 120 });
    assert.equal(custom45_2h.valid, true);
  });

  it('rejects invalid start minutes outside :00, :15, :30, :45', () => {
    const invalid10 = validateCustomBooking({ date: '2026-10-15', startTime: '12:10', durationMinutes: 60 });
    assert.equal(invalid10.valid, false);
    assert.match(invalid10.error, /quarter-hour boundary/);
  });

  it('rejects custom durations under 1 hour or with fractional hours', () => {
    const under1h = validateCustomBooking({ date: '2026-10-15', startTime: '12:15', durationMinutes: 45 });
    assert.equal(under1h.valid, false);
    assert.match(under1h.error, /at least 60 minutes/);

    const fractional90m = validateCustomBooking({ date: '2026-10-15', startTime: '12:15', durationMinutes: 90 });
    assert.equal(fractional90m.valid, false);
    assert.match(fractional90m.error, /whole-hour multiple/);
  });
});

// ============================================================================
// 4. CUSTOMER LEAD TIME RULES
// ============================================================================
describe('Lead Time Rules', () => {
  const baseNow = new Date('2026-10-15T12:00:00.000Z');

  it('rejects customer self-service booking starting in under 60 minutes', () => {
    const slotIn30m = new Date(baseNow.getTime() + 30 * 60000);
    const result = validateLeadTime(slotIn30m, { isStaffWalkIn: false, now: baseNow });
    assert.equal(result.valid, false);
    assert.match(result.error, /minimum of 60 minutes lead time/);
  });

  it('permits customer self-service booking starting in >= 60 minutes', () => {
    const slotIn65m = new Date(baseNow.getTime() + 65 * 60000);
    const result = validateLeadTime(slotIn65m, { isStaffWalkIn: false, now: baseNow });
    assert.equal(result.valid, true);
  });

  it('permits admin/staff immediate walk-in bookings without lead time constraint', () => {
    const immediateSlot = new Date(baseNow.getTime() + 5 * 60000);
    const result = validateLeadTime(immediateSlot, { isStaffWalkIn: true, now: baseNow });
    assert.equal(result.valid, true);
    assert.equal(result.isImmediate, true);
  });
});

// ============================================================================
// 5. BOOKING STATE MACHINE & TERMINAL CANCELLATION
// ============================================================================
describe('Booking State Machine & Terminal Cancellation', () => {
  it('allows valid progression: PENDING_PAYMENT -> CONFIRMED -> CHECKED_IN -> IN_PROGRESS -> COMPLETED', () => {
    assert.equal(canTransitionBookingStatus('PENDING_PAYMENT', 'CONFIRMED').valid, true);
    assert.equal(canTransitionBookingStatus('CONFIRMED', 'CHECKED_IN').valid, true);
    assert.equal(canTransitionBookingStatus('CHECKED_IN', 'IN_PROGRESS').valid, true);
    assert.equal(canTransitionBookingStatus('IN_PROGRESS', 'COMPLETED').valid, true);
  });

  it('allows cancellation from active states', () => {
    assert.equal(canTransitionBookingStatus('CONFIRMED', 'CANCELLED').valid, true);
    assert.equal(canTransitionBookingStatus('CHECKED_IN', 'CANCELLED').valid, true);
  });

  it('STRICTLY PROHIBITS resurrecting a CANCELLED booking (Cancelled is Terminal)', () => {
    const attemptResurrect = canTransitionBookingStatus('CANCELLED', 'CONFIRMED');
    assert.equal(attemptResurrect.valid, false);
    assert.match(attemptResurrect.error, /terminal state/);
  });

  it('correctly reports occupying vs non-occupying statuses', () => {
    assert.equal(isOccupyingStatus('CONFIRMED'), true);
    assert.equal(isOccupyingStatus('CHECKED_IN'), true);
    assert.equal(isOccupyingStatus('IN_PROGRESS'), true);
    assert.equal(isOccupyingStatus('CANCELLED'), false, 'Cancelled booking must NOT occupy inventory');
    assert.equal(isOccupyingStatus('COMPLETED'), false);
    assert.equal(isOccupyingStatus('EXPIRED'), false);
  });
});

// ============================================================================
// 6. PHYSICAL RESOURCE INVENTORY & CONFLICT MODEL
// ============================================================================
describe('Physical Resource Inventory & Conflict Model', () => {
  it('authoritative baseline matches single Patan property and 6 physical facilities', () => {
    assert.equal(CANONICAL_PROPERTY.city, 'Patan');
    assert.equal(CANONICAL_PROPERTY.state, 'Gujarat');
    assert.equal(CANONICAL_SECTIONS.length, 2);
    assert.equal(CANONICAL_FACILITIES.length, 6);
  });

  it('allows two different physical turfs to be booked concurrently', () => {
    const requested = { date: '2026-10-15', timeSlot: '06:00 PM – 07:00 PM' };
    const occupancies = [
      {
        id: 'bk_turf_2',
        facilityId: 'fac_box_cricket_2', // Turf 2 is occupied
        startAt: parseCivilTimeToInstant('2026-10-15', '18:00'),
        endAt: parseCivilTimeToInstant('2026-10-15', '19:00'),
        status: 'CONFIRMED'
      }
    ];

    // Booking Turf 1 while Turf 2 is occupied on the same slot
    const turf1Occupancies = occupancies.filter(o => o.facilityId === 'fac_box_cricket_1');
    const result = checkIntervalConflicts(requested, turf1Occupancies);
    assert.equal(result.hasConflict, false, 'Different physical turfs must not conflict');
  });

  it('rejects overlapping bookings on the SAME physical turf', () => {
    const requested = { date: '2026-10-15', timeSlot: '06:00 PM – 07:00 PM' };
    const occupanciesOnTurf1 = [
      {
        id: 'bk_existing',
        facilityId: 'fac_box_cricket_1',
        startAt: parseCivilTimeToInstant('2026-10-15', '18:00'),
        endAt: parseCivilTimeToInstant('2026-10-15', '19:00'),
        status: 'CONFIRMED'
      }
    ];
    const result = checkIntervalConflicts(requested, occupanciesOnTurf1);
    assert.equal(result.hasConflict, true, 'Same physical turf must conflict');
  });

  it('Cricket Green Net with Shooting Machine conflicts with regular Green Net Practice', () => {
    // Both map to fac_green_net_1
    const netFacility = CANONICAL_FACILITIES.find(f => f.code === 'cricket-green-net-1');
    const shootingMachineAddon = CANONICAL_ADD_ONS.find(a => a.code === 'shooting-machine');

    assert.ok(netFacility, 'Green Net 1 exists');
    assert.ok(shootingMachineAddon.applicableFacilityIds.includes(netFacility.id), 'Shooting machine applies to fac_green_net_1');

    // Simultaneous requests on fac_green_net_1 conflict
    assert.equal(isSamePhysicalResource(netFacility.id, shootingMachineAddon.applicableFacilityIds[0]), true);
  });
});

// ============================================================================
// 7. SESSION EXTENSIONS & ROUNDING LOGIC
// ============================================================================
describe('Session Operations & Extension Rounding', () => {
  it('accepts 15-minute increment extension approved by staff', () => {
    const ext15 = validateSessionExtension({
      currentScheduledEndAt: '2026-10-15T20:00:00+05:30',
      extensionMinutes: 15,
      isApprovedByStaff: true
    });
    assert.equal(ext15.valid, true);
    assert.equal(ext15.proposedEndAt.toISOString(), new Date('2026-10-15T20:15:00+05:30').toISOString());

    // Next quick start after 20:15 rounds up to 21:00
    assert.equal(formatToISTString(ext15.nextStandardQuickStartAt), '2026-10-15T21:00:00+05:30');
  });

  it('rejects non-15-minute extension increments', () => {
    const ext10 = validateSessionExtension({
      currentScheduledEndAt: '2026-10-15T20:00:00+05:30',
      extensionMinutes: 10,
      isApprovedByStaff: true
    });
    assert.equal(ext10.valid, false);
    assert.match(ext10.error, /15-minute increments/);
  });

  it('rejects extension that would collide with next scheduled booking', () => {
    const collision = validateSessionExtension({
      currentScheduledEndAt: '2026-10-15T20:00:00+05:30',
      extensionMinutes: 30, // would end at 20:30
      nextBookingStartAt: '2026-10-15T20:15:00+05:30', // next booking at 20:15
      isApprovedByStaff: true
    });
    assert.equal(collision.valid, false);
    assert.match(collision.error, /conflicts with the next scheduled booking/);
  });

  it('rounds next standard quick start to next whole hour after partial-hour end', () => {
    const end20_30 = new Date('2026-10-15T20:30:00+05:30');
    const nextQuick = nextQuickStartAfter(end20_30);
    assert.equal(formatToISTString(nextQuick), '2026-10-15T21:00:00+05:30');

    const end20_00 = new Date('2026-10-15T20:00:00+05:30');
    const nextQuickExact = nextQuickStartAfter(end20_00);
    assert.equal(formatToISTString(nextQuickExact), '2026-10-15T20:00:00+05:30');
  });
});

// ============================================================================
// 8. RBAC PERMISSIONS ENGINE
// ============================================================================
describe('RBAC Permissions Engine', () => {
  it('provides distinct granular permissions across all system roles', () => {
    assert.ok(STANDARD_PERMISSIONS.length >= 24);

    const superAdminPerms = DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLES.SUPER_ADMIN];
    const staffPerms = DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLES.STAFF];
    const stallPerms = DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLES.STALL_STAFF];
    const customerPerms = DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLES.CUSTOMER];

    assert.equal(hasPermission(superAdminPerms, 'role.manage'), true);
    assert.equal(hasPermission(staffPerms, 'role.manage'), false, 'Staff cannot manage roles');
    assert.equal(hasPermission(staffPerms, 'booking.walkin'), true, 'Staff can create walk-in');
    assert.equal(hasPermission(customerPerms, 'booking.walkin'), false, 'Customer cannot create walk-in');
    assert.equal(hasPermission(stallPerms, 'dining.menu.manage'), true);
    assert.equal(hasPermission(stallPerms, 'booking.checkin'), false);
  });

  it('enforces default-deny posture for undefined permissions', () => {
    assert.equal(hasPermission(['booking.read'], 'facility.create'), false);
    assert.equal(hasPermission([], 'booking.read'), false);
  });
});

// ============================================================================
// 9. GUEST IDENTITY PRIVACY PROTECTION
// ============================================================================
describe('Guest Identity Privacy Protection', () => {
  it('strictly rejects unauthenticated booking history lookups without verification token', () => {
    const unauthReq = {
      headers: {},
      query: { phone: '9876543210' }
    };
    const check = canAccessBookingHistory(unauthReq);
    assert.equal(check.allowed, false);
    assert.match(check.error, /identity verification/i);
  });

  it('permits authenticated staff or requests with verified guest token', () => {
    const staffReq = { admin: { id: 'admin1', role: 'staff' }, query: {} };
    assert.equal(canAccessBookingHistory(staffReq).allowed, true);

    const token = generateGuestHistoryToken('9876543210');
    const guestReq = { headers: { 'x-guest-token': token }, query: {} };
    const check = canAccessBookingHistory(guestReq);
    assert.equal(check.allowed, true);
    assert.equal(check.contact, '9876543210');

    const ownLookup = resolveBookingHistoryLookup(check, { phone: '9876543210' });
    assert.equal(ownLookup.valid, true);
    assert.equal(ownLookup.phone, '9876543210');

    const crossCustomerLookup = resolveBookingHistoryLookup(check, { phone: '9123456789' });
    assert.equal(crossCustomerLookup.valid, false, 'A guest token must not query another contact history.');
  });
});

// ============================================================================
// 10. CAMPUS DINING & TABLE ORDERING FOUNDATION
// ============================================================================
describe('Campus Dining & Table Ordering Foundation', () => {
  it('validates table number identifiers', () => {
    assert.equal(validateTableNumber('T1').valid, true);
    assert.equal(validateTableNumber('TABLE-4').valid, true);
    assert.equal(validateTableNumber('').valid, false);
    assert.equal(validateTableNumber('T 1 invalid spaces!').valid, false);
  });

  it('calculates itemized dining order totals in paise with tax', () => {
    const items = [
      { id: 'item_1', name: 'Cold Coffee', quantity: 2, unitPricePaise: 12000 }, // ₹120 each
      { id: 'item_2', name: 'Veg Sandwich', quantity: 1, unitPricePaise: 15000 }  // ₹150 each
    ];
    const totals = calculateDiningOrderTotals(items, { taxRatePercent: 5 });

    assert.equal(totals.subtotalPaise, 39000); // 24000 + 15000 = 39000 (₹390)
    assert.equal(totals.taxPaise, 1950);       // 5% of 39000 = 1950 (₹19.50)
    assert.equal(totals.totalPaise, 40950);     // ₹409.50
  });

  it('enforces the dining order state machine with terminal cancellation', () => {
    assert.equal(canTransitionDiningOrder(DINING_ORDER_STATUSES.PLACED, DINING_ORDER_STATUSES.ACCEPTED).valid, true);
    assert.equal(canTransitionDiningOrder(DINING_ORDER_STATUSES.ACCEPTED, DINING_ORDER_STATUSES.PREPARING).valid, true);
    assert.equal(canTransitionDiningOrder(DINING_ORDER_STATUSES.PREPARING, DINING_ORDER_STATUSES.READY).valid, true);
    assert.equal(canTransitionDiningOrder(DINING_ORDER_STATUSES.READY, DINING_ORDER_STATUSES.SERVED).valid, true);
    assert.equal(canTransitionDiningOrder(DINING_ORDER_STATUSES.SERVED, DINING_ORDER_STATUSES.COMPLETED).valid, true);

    // Cancelled is terminal
    assert.equal(canTransitionDiningOrder(DINING_ORDER_STATUSES.CANCELLED, DINING_ORDER_STATUSES.ACCEPTED).valid, false);
  });
});

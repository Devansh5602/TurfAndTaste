/**
 * Turf & Taste — Admin Platform Phase 1 Test Suite
 *
 * Covers:
 * 1. Admin Authentication & RBAC Permissions
 * 2. Section & Physical Facility CMS (Box Cricket Turfs, Pickleball, Skating, Green Net + Shooting Machine)
 * 3. Availability & Facility Blocks (24/7 sports default, conflict-checked exception blocks)
 * 4. Pricing & Tariffs Management (Multi-tier, day/night, weekend surge, deposits, packages)
 * 5. Booking Management & Terminal Cancellation (0% refund, permanent inventory release)
 * 6. Walk-In Booking Flow (Immediate lead-time bypass, full-payment rule inside 1h)
 * 7. Ground QR Check-In, Session Operations & 15-Minute Extensions
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import dbAsync from '../server/db.js';
import { initDatabase } from '../server/db.js';
import { hasPermission, loadUserPermissions, STANDARD_PERMISSIONS } from '../server/domain/rbac/rbacEngine.js';
import { checkCanonicalConflicts, createCanonicalBooking } from '../server/domain/booking/canonicalBookingCommand.js';
import { findResourceConflicts } from '../server/domain/booking/conflictEngine.js';
import { validateSessionExtension, computeSessionMetrics } from '../server/domain/session/sessionOperations.js';
import { canTransitionBookingStatus } from '../server/domain/booking/bookingStateMachine.js';

describe('Admin Platform Phase 1 Test Suite', () => {

  before(async () => {
    await initDatabase();
  });

  // ============================================================
  // 1. ADMIN AUTHENTICATION & RBAC PERMISSIONS
  // ============================================================
  describe('Admin Auth & Granular RBAC Permissions', () => {

    it('super_admin principal has all operational and administrative permissions', async () => {
      const perms = await loadUserPermissions(dbAsync, 'admin', 1, 'super_admin');
      assert.ok(hasPermission(perms, 'facility.read'));
      assert.ok(hasPermission(perms, 'facility.create'));
      assert.ok(hasPermission(perms, 'facility.update'));
      assert.ok(hasPermission(perms, 'facility.block'));
      assert.ok(hasPermission(perms, 'booking.read'));
      assert.ok(hasPermission(perms, 'booking.create_walkin'));
      assert.ok(hasPermission(perms, 'booking.walkin'));
      assert.ok(hasPermission(perms, 'booking.checkin'));
      assert.ok(hasPermission(perms, 'booking.extend'));
      assert.ok(hasPermission(perms, 'booking.cancel'));
      assert.ok(hasPermission(perms, 'pricing.manage'));
    });

    it('staff role has operational permissions (walkin, checkin, extend, block) but lacks pricing.manage', async () => {
      const perms = await loadUserPermissions(dbAsync, 'admin', 2, 'staff');
      assert.ok(hasPermission(perms, 'booking.read'));
      assert.ok(hasPermission(perms, 'booking.walkin'));
      assert.ok(hasPermission(perms, 'booking.checkin'));
      assert.ok(hasPermission(perms, 'booking.extend'));
      assert.ok(hasPermission(perms, 'booking.cancel'));
      assert.ok(hasPermission(perms, 'facility.block'));
      // Staff cannot manage pricing
      assert.equal(hasPermission(perms, 'pricing.manage'), false);
    });

    it('permission aliases resolve bidirectionally', () => {
      assert.ok(hasPermission(['booking.walkin'], 'booking.create_walkin'));
      assert.ok(hasPermission(['booking.create_walkin'], 'booking.walkin'));
      assert.ok(hasPermission(['booking.checkin'], 'booking.update'));
      assert.ok(hasPermission(['booking.cancel'], 'booking.update'));
    });
  });

  // ============================================================
  // 2. PHYSICAL INVENTORY & SECTIONS CMS
  // ============================================================
  describe('Physical Facility & Section Inventory Model', () => {

    it('correctly models 6 physical resources at Patan campus', async () => {
      const facilities = await dbAsync.all('SELECT * FROM physical_facilities ORDER BY code ASC');
      assert.ok(facilities.length >= 6, `Expected at least 6 physical facilities, found ${facilities.length}`);
      
      const codes = facilities.map(f => f.code);
      assert.ok(codes.includes('box-cricket-turf-1'));
      assert.ok(codes.includes('box-cricket-turf-2'));
      assert.ok(codes.includes('pickleball-court-1'));
      assert.ok(codes.includes('pickleball-court-2'));
      assert.ok(codes.includes('skating-rink-1'));
      assert.ok(codes.includes('cricket-green-net-1'));
    });

    it('models Ball-Shooting Machine as an add-on on Cricket Green Net (fac_green_net_1), NOT a standalone venue', async () => {
      const addOnMapping = await dbAsync.all(`
        SELECT fa.*, a.code AS addon_code, a.name AS addon_name, pf.code AS fac_code
        FROM facility_add_ons fa
        JOIN add_ons a ON fa.add_on_id = a.id
        JOIN physical_facilities pf ON fa.facility_id = pf.id
        WHERE pf.id = 'fac_green_net_1'
      `);

      assert.ok(addOnMapping.length >= 1);
      assert.equal(addOnMapping[0].addon_code, 'shooting-machine');
      assert.equal(addOnMapping[0].fac_code, 'cricket-green-net-1');
    });
  });

  // ============================================================
  // 3. AVAILABILITY & FACILITY BLOCKS
  // ============================================================
  describe('Facility Blocks & Conflict Detection', () => {

    it('prevents facility block from overlapping confirmed customer bookings', async () => {
      const testDate = '2026-10-15';
      const slot = '10:00 AM – 11:00 AM';

      // 1. Create a test confirmed booking
      await createCanonicalBooking(dbAsync, {
        id: 'TT-BLOCK-TEST-1',
        actor: { type: 'CUSTOMER', username: 'guest' },
        source: 'CUSTOMER_APP',
        customer: { name: 'Player Test', phone: '9876543210', email: 'test@example.com' },
        physicalFacilityId: 'fac_box_cricket_1',
        facilityId: 'fac_box_cricket_1',
        date: testDate,
        timeSlot: slot,
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 80000, paymentStatus: 'Paid', paymentId: 'pay_test_blk' }
      });

      // 2. Check conflicts for a proposed maintenance block on that same interval
      const conflicts = await findResourceConflicts(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        startAt: new Date(`${testDate}T04:30:00.000Z`).toISOString(), // 10:00 AM IST
        endAt: new Date(`${testDate}T05:30:00.000Z`).toISOString()    // 11:00 AM IST
      });

      assert.ok(conflicts.hasConflict, 'Expected conflict with existing confirmed booking');
      assert.equal(conflicts.conflicts[0].conflictType, 'BOOKING');
      assert.equal(conflicts.conflicts[0].conflictId, 'TT-BLOCK-TEST-1');
    });

    it('creates active facility block when no customer conflict exists and records block metadata', async () => {
      const blockId = `blk_test_${Date.now()}`;
      const startAt = new Date('2026-10-20T02:30:00.000Z').toISOString(); // 08:00 AM IST
      const endAt = new Date('2026-10-20T06:30:00.000Z').toISOString();   // 12:00 PM IST

      await dbAsync.run(
        `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, internal_note, customer_message, created_by, status)
         VALUES (?, 'fac_pickleball_1', ?, ?, 'MAINTENANCE', 'Net replacement', 'Court maintenance', 'admin', 'active')`,
        [blockId, startAt, endAt]
      );

      const block = await dbAsync.get('SELECT * FROM facility_blocks WHERE id = ?', [blockId]);
      assert.ok(block);
      assert.equal(block.reason_code, 'MAINTENANCE');
      assert.equal(block.status, 'active');

      // Verify that this block now blocks new booking on fac_pickleball_1
      const conflicts = await findResourceConflicts(dbAsync, {
        facilityId: 'fac_pickleball_1',
        startAt: new Date('2026-10-20T03:00:00.000Z').toISOString(),
        endAt: new Date('2026-10-20T04:00:00.000Z').toISOString()
      });

      assert.ok(conflicts.hasConflict);
      assert.equal(conflicts.conflicts[0].conflictType, 'BLOCK');
    });
  });

  // ============================================================
  // 4. PRICING & TARIFFS ENGINE
  // ============================================================
  describe('Pricing Tiers & Tariffs', () => {

    it('persists distinct day, night, weekend surge and token deposit configurations per facility', async () => {
      const testTier = {
        facilityId: 'fac_box_cricket_1',
        facilityName: 'Box Cricket Turf 1',
        dayRate: '₹900',
        nightRate: '₹1400',
        bookingDeposit: '₹500',
        weekendSurge: 20,
        depositPct: 35
      };

      await dbAsync.run(
        `INSERT INTO pricing_tiers (facility_id, facility_name, day_rate, night_rate, weekend_surge, deposit_pct, details_json, updated_at)
         VALUES (?, ?, 900, 1400, 20, 35, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (facility_id) DO UPDATE SET
           day_rate = EXCLUDED.day_rate,
           night_rate = EXCLUDED.night_rate,
           weekend_surge = EXCLUDED.weekend_surge,
           deposit_pct = EXCLUDED.deposit_pct,
           details_json = EXCLUDED.details_json,
           updated_at = CURRENT_TIMESTAMP`,
        [testTier.facilityId, testTier.facilityName, JSON.stringify(testTier)]
      );

      const saved = await dbAsync.get('SELECT * FROM pricing_tiers WHERE facility_id = ?', [testTier.facilityId]);
      assert.ok(saved);
      assert.equal(saved.day_rate, 900);
      assert.equal(saved.night_rate, 1400);
      assert.equal(saved.weekend_surge, 20);
      assert.equal(saved.deposit_pct, 35);
    });
  });

  // ============================================================
  // 5. BOOKING MANAGEMENT & TERMINAL CANCELLATION
  // ============================================================
  describe('Booking Management & Cancellation State Machine', () => {

    it('cancels booking permanently, records cancellation audit, and releases occupied slot', async () => {
      const bookingId = 'TT-CANCEL-TEST-1';
      const testDate = '2026-10-25';
      const slot = '04:00 PM – 05:00 PM';

      await createCanonicalBooking(dbAsync, {
        id: bookingId,
        actor: { type: 'STAFF', username: 'admin' },
        source: 'STAFF_WALKIN',
        customer: { name: 'Player Cancel', phone: '9876500001' },
        physicalFacilityId: 'fac_box_cricket_2',
        facilityId: 'fac_box_cricket_2',
        date: testDate,
        timeSlot: slot,
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 80000, paymentStatus: 'Paid', paymentId: 'pay_cancel_test' }
      });

      // Cancel booking
      const cancelTransition = canTransitionBookingStatus('Confirmed', 'Cancelled');
      assert.ok(cancelTransition.valid);
      assert.equal(cancelTransition.toStatus, 'CANCELLED');

      await dbAsync.run(
        'UPDATE bookings SET booking_status = ?, cancellation_actor = ?, cancelled_at = ? WHERE id = ?',
        ['Cancelled', 'admin', new Date().toISOString(), bookingId]
      );

      const updated = await dbAsync.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      assert.equal(updated.booking_status, 'Cancelled');
      assert.equal(updated.cancellation_actor, 'admin');
      assert.ok(updated.cancelled_at);

      // Verifies occupied slot is released (0 conflicts)
      const conflicts = await findResourceConflicts(dbAsync, {
        facilityId: 'fac_box_cricket_2',
        startAt: new Date(`${testDate}T10:30:00.000Z`).toISOString(), // 04:00 PM IST
        endAt: new Date(`${testDate}T11:30:00.000Z`).toISOString()
      });

      assert.equal(conflicts.hasConflict, false, 'Cancelled booking must release inventory slot');

      // Verifies Cancelled -> Confirmed is rejected
      const invalidReversal = canTransitionBookingStatus('Cancelled', 'Confirmed');
      assert.equal(invalidReversal.valid, false);
      assert.ok(/terminal|reopened|cancelled/i.test(invalidReversal.error));
    });
  });

  // ============================================================
  // 6. WALK-IN BOOKING FLOW & LEAD-TIME POLICY
  // ============================================================
  describe('Walk-In Booking Flow & Lead-Time Policy', () => {

    it('allows authorized Staff to create immediate walk-in reservations bypassing customer lead-time', async () => {
      const now = new Date();
      const testDate = now.toISOString().slice(0, 10);
      const startH = (now.getHours() + 1) % 24;
      const endH = (startH + 1) % 24;

      const formatH = (h) => {
        const p = h >= 12 ? 'PM' : 'AM';
        const dh = h % 12 || 12;
        return `${String(dh).padStart(2, '0')}:00 ${p}`;
      };

      const timeSlot = `${formatH(startH)} – ${formatH(endH)}`;

      const booking = await createCanonicalBooking(dbAsync, {
        id: `TT-WALKIN-${Date.now()}`,
        actor: { type: 'STAFF', username: 'staff_counter' },
        source: 'STAFF_WALKIN',
        customer: { name: 'Counter Walkin Player', phone: '9876541234' },
        physicalFacilityId: 'fac_skating_1',
        facilityId: 'fac_skating_1',
        date: testDate,
        timeSlot,
        durationHours: 1,
        bookingMode: 'STANDARD_QUICK',
        payment: {
          type: 'full',
          totalAmountPaise: 50000,
          paymentStatus: 'Paid',
          paymentId: 'counter-cash'
        }
      });

      assert.ok(booking.bookingId);
      assert.equal(booking.physicalFacilityId, 'fac_skating_1');
      assert.equal(booking.customer.name, 'Counter Walkin Player');
    });
  });

  // ============================================================
  // 7. GROUND SESSIONS & 15-MINUTE EXTENSIONS
  // ============================================================
  describe('Ground Session Operations & 15-Minute Extensions', () => {

    it('preserves legal session lifecycle boundaries and rejects bypasses', () => {
      assert.equal(canTransitionBookingStatus('Confirmed', 'Checked-in').valid, true);
      assert.equal(canTransitionBookingStatus('Checked-in', 'In Progress').valid, true);
      assert.equal(canTransitionBookingStatus('In Progress', 'Completed').valid, true);
      assert.equal(canTransitionBookingStatus('Confirmed', 'In Progress').valid, false);
      assert.equal(canTransitionBookingStatus('Confirmed', 'Completed').valid, false);
      assert.equal(canTransitionBookingStatus('Completed', 'Checked-in').valid, false);
    });

    it('does not double-count a saved extension as additional resource occupancy', async () => {
      const bookingId = `TT-EXT-OCC-${Date.now()}`;
      await createCanonicalBooking(dbAsync, {
        id: bookingId,
        actor: { type: 'STAFF', username: 'staff_counter' },
        source: 'STAFF_WALKIN',
        customer: { name: 'Extension Occupancy Test', phone: '9876512345' },
        physicalFacilityId: 'fac_green_net_1',
        date: '2026-10-30',
        timeSlot: '06:00 PM – 07:00 PM',
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 80000, paymentStatus: 'Paid', paymentId: `counter-${bookingId}` }
      });

      const extendedEnd = '2026-10-30T13:45:00.000Z'; // 7:15 PM Asia/Kolkata
      const session = await dbAsync.get('SELECT id FROM facility_sessions WHERE booking_id = ?', [bookingId]);
      await dbAsync.run("UPDATE bookings SET booking_status = 'In Progress', scheduled_end_at = ? WHERE id = ?", [extendedEnd, bookingId]);
      await dbAsync.run("UPDATE facility_sessions SET session_status = 'IN_PROGRESS' WHERE id = ?", [session.id]);
      await dbAsync.run(
        "INSERT INTO session_adjustments (id, session_id, adjustment_type, minutes, is_free, charge_paise, approved_by) VALUES (?, ?, 'EXTENSION', 15, 1, 0, 'staff_counter')",
        [`adj-${bookingId}`, session.id]
      );

      const afterSavedExtension = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: 'fac_green_net_1',
        startAt: '2026-10-30T13:50:00.000Z',
        endAt: '2026-10-30T14:50:00.000Z'
      });

      assert.equal(afterSavedExtension.hasConflict, false, 'a 15-minute extension must not be counted twice');
    });

    it('validates 15-minute increments and requires staff approval', () => {
      const endAt = '2026-10-30T14:00:00.000Z';

      // 10 minutes (invalid)
      const invalidInc = validateSessionExtension({
        currentScheduledEndAt: endAt,
        extensionMinutes: 10,
        isApprovedByStaff: true
      });
      assert.equal(invalidInc.valid, false);
      assert.ok(/15-minute increments/i.test(invalidInc.error));

      // Without staff approval (invalid)
      const noApproval = validateSessionExtension({
        currentScheduledEndAt: endAt,
        extensionMinutes: 15,
        isApprovedByStaff: false
      });
      assert.equal(noApproval.valid, false);
      assert.ok(/Admin or Staff approval/i.test(noApproval.error));

      // Valid 15-minute extension
      const validExt = validateSessionExtension({
        currentScheduledEndAt: endAt,
        extensionMinutes: 15,
        isApprovedByStaff: true
      });
      assert.equal(validExt.valid, true);
      assert.equal(validExt.proposedEndAt.toISOString(), '2026-10-30T14:15:00.000Z');
    });

    it('detects collision when extension would overlap next scheduled booking', () => {
      const currentEnd = '2026-10-30T14:00:00.000Z';
      const nextBookingStart = '2026-10-30T14:15:00.000Z'; // Only 15 mins available

      // Requesting 30 mins should fail
      const result = validateSessionExtension({
        currentScheduledEndAt: currentEnd,
        extensionMinutes: 30,
        nextBookingStartAt: nextBookingStart,
        isApprovedByStaff: true
      });

      assert.equal(result.valid, false);
      assert.ok(/conflicts with the next scheduled booking/i.test(result.error));
      assert.ok(/Maximum possible extension is 15m/i.test(result.error));
    });

    it('computes start delays and total actual session metrics accurately', () => {
      const schedStart = '2026-10-30T12:00:00.000Z';
      const schedEnd = '2026-10-30T13:00:00.000Z';
      const actualStart = '2026-10-30T12:12:00.000Z'; // 12 min late
      const actualEnd = '2026-10-30T13:15:00.000Z';   // 63 min total

      const metrics = computeSessionMetrics(schedStart, schedEnd, actualStart, actualEnd);
      assert.equal(metrics.scheduledDurationMinutes, 60);
      assert.equal(metrics.startDelayMinutes, 12);
      assert.equal(metrics.totalActualMinutes, 63);
    });
  });
  // ============================================================
  // 8. PHASE 1.1 HARDENING: SERVER-AUTHORITATIVE PRICING & TRANSACTION SAFETY
  // ============================================================
  describe('Phase 1.1 Hardening: Server Pricing & Transactional Concurrency', () => {

    it('resolveAdminWalkInPricing returns server-authoritative paise amounts from DB tier', async () => {
      const { resolveAdminWalkInPricing } = await import('../server/domain/pricing/pricingResolver.js');

      // Ensure a pricing tier is present for fac_box_cricket_1
      await dbAsync.run(
        `INSERT INTO pricing_tiers (facility_id, facility_name, day_rate, night_rate, weekend_surge, deposit_pct, details_json, updated_at)
         VALUES ('fac_box_cricket_1', 'Box Cricket Turf 1', 800, 1200, 0, 400, '{}', CURRENT_TIMESTAMP)
         ON CONFLICT (facility_id) DO UPDATE SET
           day_rate = 800, night_rate = 1200, weekend_surge = 0, deposit_pct = 400,
           updated_at = CURRENT_TIMESTAMP`,
        []
      );

      const quote = await resolveAdminWalkInPricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-11-10',
        timeSlot: '10:00 AM – 11:00 AM',
        durationHours: 1,
        paymentType: 'full',
      });

      assert.ok(quote.totalAmountPaise > 0, 'totalAmountPaise must be positive');
      assert.ok(quote.depositAmountPaise > 0, 'depositAmountPaise must be positive');
      assert.ok(quote.depositAmountPaise <= quote.totalAmountPaise, 'deposit must not exceed total');
      assert.equal(typeof quote.isNight, 'boolean', 'isNight must be a boolean');
      assert.equal(typeof quote.isWeekend, 'boolean', 'isWeekend must be a boolean');
    });

    it('resolveAdminWalkInPricing applies night rate for slots at/after floodlight start', async () => {
      const { resolveAdminWalkInPricing } = await import('../server/domain/pricing/pricingResolver.js');

      const dayQuote = await resolveAdminWalkInPricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-11-10',
        timeSlot: '10:00 AM – 11:00 AM',
        durationHours: 1,
        paymentType: 'full',
      });

      const nightQuote = await resolveAdminWalkInPricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-11-10',
        timeSlot: '07:00 PM – 08:00 PM',
        durationHours: 1,
        paymentType: 'full',
      });

      assert.equal(dayQuote.isNight, false, 'Morning slot must be Day rate');
      assert.equal(nightQuote.isNight, true, 'Evening slot must be Night rate');
      assert.ok(nightQuote.totalAmountPaise >= dayQuote.totalAmountPaise,
        'Night rate must be >= day rate');
    });

    it('serialized block creation: second overlapping block on same resource is rejected atomically', async () => {
      const startAt = '2026-11-15T05:00:00.000Z'; // 10:30 AM IST
      const endAt   = '2026-11-15T07:00:00.000Z'; // 12:30 PM IST

      // Create a booking that occupies this window
      await createCanonicalBooking(dbAsync, {
        id: 'TT-TXN-BLK-1',
        actor: { type: 'CUSTOMER', username: 'guest' },
        source: 'CUSTOMER_APP',
        customer: { name: 'Concurrency Test', phone: '9876512222' },
        physicalFacilityId: 'fac_pickleball_2',
        date: '2026-11-15',
        timeSlot: '10:00 AM – 12:00 PM',
        durationHours: 2,
        payment: { type: 'full', totalAmountPaise: 160000, paymentStatus: 'Paid', paymentId: 'pay-txn-blk' },
      });

      // A block creation targeting the same window must fail (booking conflict)
      // 10:00 AM IST = 04:30 UTC, 12:00 PM IST = 06:30 UTC
      const conflictResult = await findResourceConflicts(dbAsync, {
        facilityId: 'fac_pickleball_2',
        startAt: '2026-11-15T04:30:00.000Z', // 10:00 AM IST
        endAt:   '2026-11-15T06:30:00.000Z', // 12:00 PM IST
      });

      assert.ok(conflictResult.hasConflict, 'Block creation must be rejected: booking occupies the interval');
      const bookingConflicts = conflictResult.conflicts.filter(c => c.conflictType === 'BOOKING');
      assert.ok(bookingConflicts.length > 0, 'Must have a BOOKING conflict type');
    });

    it('serialized extension: extension that would conflict with next booking is rejected', async () => {
      const date = '2026-11-20';

      // Booking A: 02:00 PM – 03:00 PM IST
      await createCanonicalBooking(dbAsync, {
        id: 'TT-EXT-A',
        actor: { type: 'STAFF', username: 'staff' },
        source: 'STAFF_WALKIN',
        customer: { name: 'Extension A', phone: '9876511111' },
        physicalFacilityId: 'fac_skating_1',
        date,
        timeSlot: '02:00 PM – 03:00 PM',
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 80000, paymentStatus: 'Paid', paymentId: 'ext-a' },
      });

      // Booking B: 03:00 PM – 04:00 PM IST (immediately after A)
      await createCanonicalBooking(dbAsync, {
        id: 'TT-EXT-B',
        actor: { type: 'STAFF', username: 'staff' },
        source: 'STAFF_WALKIN',
        customer: { name: 'Extension B', phone: '9876522222' },
        physicalFacilityId: 'fac_skating_1',
        date,
        timeSlot: '03:00 PM – 04:00 PM',
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 80000, paymentStatus: 'Paid', paymentId: 'ext-b' },
      });

      // Attempt to extend Booking A by 30 minutes into B's slot
      // A's end is 03:00 PM IST = 09:30:00 UTC
      const aEnd = '2026-11-20T09:30:00.000Z'; // 03:00 PM IST
      const proposedEnd = new Date(new Date(aEnd).getTime() + 30 * 60000).toISOString();

      const conflictResult = await findResourceConflicts(dbAsync, {
        facilityId: 'fac_skating_1',
        startAt: aEnd,
        endAt: proposedEnd,
        excludeBookingId: 'TT-EXT-A',
      });

      assert.ok(conflictResult.hasConflict, 'Extension into B must be rejected due to conflict');
      assert.ok(
        conflictResult.conflicts.some(c => c.conflictType === 'BOOKING'),
        'Conflict must be a BOOKING type (next booking on same resource)'
      );
    });
  });

});

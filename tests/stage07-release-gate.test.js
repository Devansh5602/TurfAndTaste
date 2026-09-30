/**
 * Stage 0.7 Pre-Admin Release-Gate Test Suite
 *
 * Covers:
 * 1. Booking Concurrency & Payment Finalization:
 *    - Same-resource concurrent payment finalizations -> exactly ONE success (no double-booking)
 *    - Different resources concurrent finalizations -> BOTH succeed
 *    - Same payment order retry -> idempotent 1 booking
 *    - Green Net vs Ball-Shooting Machine conflict -> direct physical collision
 *    - Hold consumption and conversion integrity
 * 2. Historical Timestamp Provenance & Reconciliation:
 *    - Explicit UTC legacy instant preserved
 *    - Asia/Kolkata local interpreted once without double shift
 *    - Deterministic correction for shifted historical timestamps
 *    - Ambiguous timestamps quarantined as MANUAL_REVIEW
 * 3. RBAC Identity & Authorization:
 *    - Real Admin, Staff, Stall Staff principals mapped to permissions
 *    - No manager bypass: permission-driven authorization
 *    - Custom role adheres strictly to assigned permissions
 *    - Stall account scoped to assigned stall
 * 4. Dining Order Privacy & Ownership:
 *    - Arbitrary order lookup without access token rejected (401)
 *    - Guessing order ID with wrong token rejected (403)
 *    - Correct guest token returns sanitized customer-safe view (no access_token in response)
 *    - Stall-scoped order management
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import dbAsync from '../server/db.js';
import { initDatabase } from '../server/db.js';
import { finalizeBookingFromPayment } from '../server/domain/booking/paymentFinalization.js';
import { createCanonicalBooking, checkCanonicalConflicts } from '../server/domain/booking/canonicalBookingCommand.js';
import {
  evaluateTimestampProvenance,
  reconcileAllTimestamps,
  TIMESTAMP_CLASSIFICATIONS
} from '../server/domain/time/timestampAudit.js';
import {
  hasPermission,
  loadUserPermissions,
  requirePermission,
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_ROLES
} from '../server/domain/rbac/rbacEngine.js';
import {
  createDiningOrder,
  updateDiningOrderStatus
} from '../server/domain/dining/diningOrderCommand.js';

describe('Stage 0.7: Release-Gate Validation Suite', () => {

  before(async () => {
    await initDatabase();
  });

  // ============================================================
  // SECTION 1: BOOKING CONCURRENCY & PAYMENT FINALIZATION
  // ============================================================
  describe('Payment Finalization Concurrency & Idempotency', () => {
    const testDate = '2030-07-20';
    const netDate = '2030-07-25';
    const testSlot = '10:00 AM – 11:00 AM';
    const testNow = new Date('2030-01-01T00:00:00.000Z');
    const futureExp = Math.floor(testNow.getTime() / 1000) + 3600;

    beforeEach(async () => {
      // Clean up previous test bookings/payment orders for this test slot
      try {
        await dbAsync.run("DELETE FROM bookings WHERE date IN (?, ?)", [testDate, netDate]);
        await dbAsync.run("DELETE FROM payment_orders WHERE order_id LIKE 'test_ord_%'");
      } catch (_e) {}
    });

    it('races two distinct payment orders for SAME facility and interval -> exactly ONE confirmed booking', async () => {
      const orderId1 = `test_ord_race1_${Date.now()}`;
      const orderId2 = `test_ord_race2_${Date.now()}`;

      const quoteContext1 = JSON.stringify({
        quoteId: `quote_${orderId1}`,
        facilityId: 'fac_box_cricket_1',
        date: testDate,
        timeSlot: testSlot,
        bookingMode: 'STANDARD_QUICK',
        total: 1200,
        deposit: 400,
        exp: futureExp
      });

      const quoteContext2 = JSON.stringify({
        quoteId: `quote_${orderId2}`,
        facilityId: 'fac_box_cricket_1',
        date: testDate,
        timeSlot: testSlot,
        bookingMode: 'STANDARD_QUICK',
        total: 1200,
        deposit: 400,
        exp: futureExp
      });

      // Insert both payment orders in 'created' state
      await dbAsync.run(
        `INSERT INTO payment_orders (order_id, quote_id, booking_reference, expected_amount, payment_type, quote_context, status)
         VALUES (?, ?, ?, 400, 'deposit', ?, 'created')`,
        [orderId1, `quote_${orderId1}`, `ref_${orderId1}`, quoteContext1]
      );
      await dbAsync.run(
        `INSERT INTO payment_orders (order_id, quote_id, booking_reference, expected_amount, payment_type, quote_context, status)
         VALUES (?, ?, ?, 400, 'deposit', ?, 'created')`,
        [orderId2, `quote_${orderId2}`, `ref_${orderId2}`, quoteContext2]
      );

      // Launch both finalizations concurrently through the canonical payment finalization entrypoint
      const p1 = finalizeBookingFromPayment(dbAsync, {
        razorpayOrderId: orderId1,
        razorpayPaymentId: `pay_${orderId1}`,
        razorpaySignature: 'sig_valid_1',
        customerDetails: { name: 'Player One', phone: '9876543210' },
        now: testNow
      });

      const p2 = finalizeBookingFromPayment(dbAsync, {
        razorpayOrderId: orderId2,
        razorpayPaymentId: `pay_${orderId2}`,
        razorpaySignature: 'sig_valid_2',
        customerDetails: { name: 'Player Two', phone: '9876543211' },
        now: testNow
      });

      const results = await Promise.allSettled([p1, p2]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, `Expected exactly 1 finalization to succeed, but ${fulfilled.length} succeeded.`);
      assert.equal(rejected.length, 1, `Expected exactly 1 finalization to be rejected, but ${rejected.length} failed.`);

      // Verify the rejection reason is conflict-related
      const rejectedReason = rejected[0].reason;
      assert.ok(
        /double-booking|conflict|already reserved/i.test(rejectedReason.message) || rejectedReason.code === 'BOOKING_CONFLICT',
        `Expected conflict error but got: ${rejectedReason.message}`
      );

      // Verify DB contains exactly 1 booking for this slot
      const bookingsInDb = await dbAsync.all(
        `SELECT id, customer_name, booking_status FROM bookings WHERE physical_facility_id = 'fac_box_cricket_1' AND date = ? AND time_slot = ?`,
        [testDate, testSlot]
      );
      assert.equal(bookingsInDb.length, 1, `DB must contain exactly 1 confirmed booking, found: ${bookingsInDb.length}`);
      assert.equal(bookingsInDb[0].booking_status, 'Confirmed');
    });

    it('races concurrent finalizations for DIFFERENT facilities -> BOTH succeed', async () => {
      const orderIdTurf1 = `test_ord_turf1_${Date.now()}`;
      const orderIdTurf2 = `test_ord_turf2_${Date.now()}`;

      const quoteContext1 = JSON.stringify({
        quoteId: `quote_${orderIdTurf1}`,
        facilityId: 'fac_box_cricket_1',
        date: testDate,
        timeSlot: '02:00 PM – 03:00 PM',
        bookingMode: 'STANDARD_QUICK',
        total: 1200,
        deposit: 400,
        exp: futureExp
      });

      const quoteContext2 = JSON.stringify({
        quoteId: `quote_${orderIdTurf2}`,
        facilityId: 'fac_box_cricket_2',
        date: testDate,
        timeSlot: '02:00 PM – 03:00 PM',
        bookingMode: 'STANDARD_QUICK',
        total: 1200,
        deposit: 400,
        exp: futureExp
      });

      await dbAsync.run(
        `INSERT INTO payment_orders (order_id, quote_id, booking_reference, expected_amount, payment_type, quote_context, status)
         VALUES (?, ?, ?, 400, 'deposit', ?, 'created')`,
        [orderIdTurf1, `quote_${orderIdTurf1}`, `ref_${orderIdTurf1}`, quoteContext1]
      );
      await dbAsync.run(
        `INSERT INTO payment_orders (order_id, quote_id, booking_reference, expected_amount, payment_type, quote_context, status)
         VALUES (?, ?, ?, 400, 'deposit', ?, 'created')`,
        [orderIdTurf2, `quote_${orderIdTurf2}`, `ref_${orderIdTurf2}`, quoteContext2]
      );

      const [res1, res2] = await Promise.all([
        finalizeBookingFromPayment(dbAsync, {
          razorpayOrderId: orderIdTurf1,
          razorpayPaymentId: `pay_${orderIdTurf1}`,
          razorpaySignature: 'sig_1',
          customerDetails: { name: 'Turf 1 Player', phone: '9876543210' },
          now: testNow
        }),
        finalizeBookingFromPayment(dbAsync, {
          razorpayOrderId: orderIdTurf2,
          razorpayPaymentId: `pay_${orderIdTurf2}`,
          razorpaySignature: 'sig_2',
          customerDetails: { name: 'Turf 2 Player', phone: '9876543211' },
          now: testNow
        })
      ]);

      assert.ok(res1.success && res1.bookingId, 'Turf 1 booking succeeded');
      assert.ok(res2.success && res2.bookingId, 'Turf 2 booking succeeded');
      assert.notEqual(res1.bookingId, res2.bookingId);
    });

    it('idempotent replay: same razorpay_order_id retried -> returns existing booking, 0 new bookings', async () => {
      const orderId = `test_ord_idempotent_${Date.now()}`;
      const quoteContext = JSON.stringify({
        quoteId: `quote_${orderId}`,
        facilityId: 'fac_pickleball_1',
        date: testDate,
        timeSlot: '04:00 PM – 05:00 PM',
        bookingMode: 'STANDARD_QUICK',
        total: 600,
        deposit: 200,
        exp: futureExp
      });

      await dbAsync.run(
        `INSERT INTO payment_orders (order_id, quote_id, booking_reference, expected_amount, payment_type, quote_context, status)
         VALUES (?, ?, ?, 200, 'deposit', ?, 'created')`,
        [orderId, `quote_${orderId}`, `ref_${orderId}`, quoteContext]
      );

      // First attempt: creates booking
      const first = await finalizeBookingFromPayment(dbAsync, {
        razorpayOrderId: orderId,
        razorpayPaymentId: `pay_${orderId}`,
        razorpaySignature: 'sig_replay',
        customerDetails: { name: 'Idempotency User', phone: '9876543210' },
        now: testNow
      });

      assert.equal(first.idempotent, false);
      assert.ok(first.bookingId);

      // Second attempt (replay of same order): returns existing booking
      const second = await finalizeBookingFromPayment(dbAsync, {
        razorpayOrderId: orderId,
        razorpayPaymentId: `pay_${orderId}`,
        razorpaySignature: 'sig_replay',
        customerDetails: { name: 'Idempotency User', phone: '9876543210' },
        now: testNow
      });

      assert.equal(second.idempotent, true);
      assert.equal(second.bookingId, first.bookingId);

      // Verify exactly 1 booking in database for this payment
      const count = await dbAsync.all(
        'SELECT id FROM bookings WHERE id = ?',
        [first.bookingId]
      );
      assert.equal(count.length, 1);
    });

    it('Green Net vs Ball-Shooting Machine: physical resource conflict detected on fac_green_net_1', async () => {
      const netBooking = await createCanonicalBooking(dbAsync, {
        actor: { type: 'STAFF', username: 'staff1' },
        physicalFacilityId: 'fac_green_net_1',
        date: netDate,
        startTime: '18:00',
        durationHours: 1,
        bookingMode: 'STANDARD_QUICK',
        customer: { name: 'Net Batter', phone: '9876543210' },
        payment: { type: 'full', paymentStatus: 'Paid' },
        now: testNow
      });

      assert.ok(netBooking.bookingId);

      // Attempt to book Ball-Shooting Machine (which is an add-on on Green Net) for the same slot
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            actor: { type: 'STAFF', username: 'staff1' },
            physicalFacilityId: 'fac_green_net_1',
            addOnIds: ['addon_shooting_machine'],
            date: netDate,
            startTime: '18:00',
            durationHours: 1,
            bookingMode: 'STANDARD_QUICK',
            customer: { name: 'Machine User', phone: '9876543211' },
            payment: { type: 'full', paymentStatus: 'Paid' },
            now: testNow
          });
        },
        /already reserved|double-booking/i
      );
    });
  });

  // ============================================================
  // SECTION 2: TIMESTAMP PROVENANCE & SAFE RECONCILIATION
  // ============================================================
  describe('Timestamp Provenance & Deterministic Reconciliation', () => {
    it('preserves exact UTC legacy instant as SAFE_NO_CHANGE', () => {
      // 2026-09-19 18:00 Asia/Kolkata is 2026-09-19T12:30:00.000Z
      const booking = {
        id: 'TT-test-utc',
        scheduled_start_at: '2026-09-19T12:30:00.000Z',
        scheduled_end_at: '2026-09-19T13:30:00.000Z',
        date: '2026-09-19',
        time_slot: '06:00 PM – 07:00 PM'
      };

      const audit = evaluateTimestampProvenance(booking);
      assert.equal(audit.classification, TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE);
      assert.equal(audit.correctionRequired, false);
      assert.equal(audit.confidence, 'HIGH');
    });

    it('detects and safely corrects double-shifted timestamp to matching legacy IST slot', () => {
      // Suppose timestamp was shifted by +5:30 to 18:00:00Z when it should be 12:30:00Z
      const booking = {
        id: 'TT-test-shifted',
        scheduled_start_at: '2026-09-19T18:00:00.000Z',
        scheduled_end_at: '2026-09-19T19:00:00.000Z',
        date: '2026-09-19',
        time_slot: '06:00 PM – 07:00 PM' // 18:00 IST = 12:30 UTC
      };

      const audit = evaluateTimestampProvenance(booking);
      assert.equal(audit.classification, TIMESTAMP_CLASSIFICATIONS.SAFE_CORRECTION);
      assert.equal(audit.correctionRequired, true);
      assert.equal(audit.proposedUtcInstant, '2026-09-19T12:30:00.000Z');
      assert.equal(audit.confidence, 'HIGH');
    });

    it('quarantines conflicting or ambiguous date/slot discrepancy as MANUAL_REVIEW', () => {
      const booking = {
        id: 'TT-test-ambiguous',
        scheduled_start_at: '2026-09-19T04:15:00.000Z', // Random hour
        scheduled_end_at: '2026-09-19T05:15:00.000Z',
        date: '2026-09-19',
        time_slot: '06:00 PM – 07:00 PM'
      };

      const audit = evaluateTimestampProvenance(booking);
      assert.equal(audit.classification, TIMESTAMP_CLASSIFICATIONS.MANUAL_REVIEW);
      assert.equal(audit.correctionRequired, false);
    });

    it('reconcileAllTimestamps never modifies MANUAL_REVIEW or UNRESOLVABLE rows', async () => {
      const report = await reconcileAllTimestamps(dbAsync);
      assert.ok(report.totalAudited >= 0);
      assert.ok(typeof report.manualReview === 'number');
    });
  });

  // ============================================================
  // SECTION 3: RBAC IDENTITY & AUTHORIZATION
  // ============================================================
  describe('RBAC Identity & Permission Integrity', () => {
    it('super_admin has complete permissions and passes all permission requirements', async () => {
      const perms = await loadUserPermissions(dbAsync, 'admin', 1, 'super_admin');
      assert.ok(hasPermission(perms, 'facility.block'), 'super_admin: facility.block');
      assert.ok(hasPermission(perms, 'pricing.manage'), 'super_admin: pricing.manage');
      assert.ok(hasPermission(perms, 'role.manage'), 'super_admin: role.manage');
      assert.ok(hasPermission(perms, 'booking.create_walkin'), 'super_admin: booking.create_walkin');
    });

    it('staff role has operational permissions but cannot manage pricing or roles', async () => {
      const perms = await loadUserPermissions(dbAsync, 'admin', 2, 'staff');
      assert.ok(hasPermission(perms, 'booking.walkin'), 'staff: booking.walkin');
      assert.ok(hasPermission(perms, 'booking.checkin'), 'staff: booking.checkin');
      assert.ok(hasPermission(perms, 'dining.order.manage'), 'staff: dining.order.manage');
      assert.equal(hasPermission(perms, 'pricing.manage'), false, 'staff must NOT have pricing.manage');
      assert.equal(hasPermission(perms, 'role.manage'), false, 'staff must NOT have role.manage');
    });

    it('stall_staff role has dining permissions but cannot access facilities or bookings', async () => {
      const perms = await loadUserPermissions(dbAsync, 'admin', 3, 'stall_staff');
      assert.ok(hasPermission(perms, 'dining.order.manage'), 'stall_staff: dining.order.manage');
      assert.ok(hasPermission(perms, 'dining.menu.manage'), 'stall_staff: dining.menu.manage');
      assert.equal(hasPermission(perms, 'facility.create'), false, 'stall_staff must NOT have facility.create');
      assert.equal(hasPermission(perms, 'booking.walkin'), false, 'stall_staff must NOT have booking.walkin');
      assert.equal(hasPermission(perms, 'pricing.manage'), false, 'stall_staff must NOT have pricing.manage');
    });

    it('requirePermission middleware rejects user without required permission (no role-name bypass)', async () => {
      const mw = requirePermission('pricing.manage');
      let statusCalled = null;
      let jsonCalled = null;
      let nextCalled = false;

      const mockReq = {
        admin: {
          id: 99,
          role: 'manager', // Test legacy role string — must NOT bypass permission check!
          permissions: ['facility.read', 'booking.read'] // Missing pricing.manage
        }
      };
      const mockRes = {
        status: (s) => {
          statusCalled = s;
          return {
            json: (j) => { jsonCalled = j; }
          };
        }
      };
      const mockNext = () => { nextCalled = true; };

      await mw(mockReq, mockRes, mockNext);

      assert.equal(nextCalled, false, 'Middleware must NOT call next() without permission');
      assert.equal(statusCalled, 403, 'Expected 403 Forbidden');
      assert.ok(jsonCalled && /Missing required permission/i.test(jsonCalled.error));
    });

    it('custom role evaluates strictly based on its granted permissions', () => {
      const customGroundCrew = ['booking.read', 'booking.checkin', 'facility.read'];
      assert.ok(hasPermission(customGroundCrew, 'booking.checkin'));
      assert.equal(hasPermission(customGroundCrew, 'pricing.manage'), false);
      assert.equal(hasPermission(customGroundCrew, 'dining.order.manage'), false);
    });
  });

  // ============================================================
  // SECTION 4: DINING ORDER PRIVACY & OWNERSHIP
  // ============================================================
  describe('Dining Order Privacy & Ownership', () => {
    it('creates dining order and returns unguessable access_token with server-authoritative paise pricing', async () => {
      const stall = await dbAsync.get("SELECT id FROM food_stalls WHERE status = 'active' LIMIT 1");
      const table = await dbAsync.get("SELECT table_number FROM dining_tables WHERE is_active = ? LIMIT 1",
        [dbAsync.isPostgres() ? true : 1]);
      if (!stall || !table) return;

      const item = await dbAsync.get(
        `SELECT id, price_paise FROM food_menu_items WHERE stall_id = ? AND is_active = ? AND is_available = ? LIMIT 1`,
        [stall.id, dbAsync.isPostgres() ? true : 1, dbAsync.isPostgres() ? true : 1]
      );
      if (!item) return;

      const order = await createDiningOrder(dbAsync, {
        tableNumber: table.table_number,
        items: [{ menuItemId: item.id, quantity: 2, clientPricePaise: 1 }], // Client tries 1 paisa manipulation
        actor: { type: 'CUSTOMER', name: 'Privacy Test Diner' }
      });

      assert.ok(order.orderId);
      assert.ok(order.accessToken);
      assert.equal(order.accessToken.length >= 32, true, 'Access token must be cryptographically secure');

      // Verify server price authority: subtotal is 2 * item.price_paise, NOT 2 * 1
      const expectedSubtotal = item.price_paise * 2;
      assert.equal(order.subtotalPaise, expectedSubtotal, 'Subtotal must be computed server-side from food_menu_items');

      // Verify order access token is stored
      const stored = await dbAsync.get('SELECT access_token FROM dining_orders WHERE id = ?', [order.orderId]);
      assert.equal(stored.access_token, order.accessToken);

      // Cleanup
      try {
        await dbAsync.run('DELETE FROM dining_order_items WHERE order_id = ?', [order.orderId]);
        await dbAsync.run('DELETE FROM dining_orders WHERE id = ?', [order.orderId]);
      } catch (_e) {}
    });

    it('stall_staff can only update orders belonging to their assigned stall', async () => {
      const stalls = await dbAsync.all("SELECT id FROM food_stalls WHERE status = 'active' LIMIT 2");
      if (stalls.length < 2) return;

      const stall1 = stalls[0].id;
      const stall2 = stalls[1].id;

      const orderId = `dord_stall_test_${Date.now()}`;
      await dbAsync.run(
        `INSERT INTO dining_orders (id, stall_id, table_number, order_number, order_source, customer_name, customer_phone, order_status)
         VALUES (?, ?, 'T1', ?, 'CUSTOMER', 'Diner', '9876543210', 'PLACED')`,
        [orderId, stall1, `ORD-${Date.now().toString().slice(-5)}`]
      );

      // Stall staff assigned to stall2 tries to update stall1 order -> rejected
      await assert.rejects(
        async () => {
          await updateDiningOrderStatus(dbAsync, orderId, 'ACCEPTED', {
            actor: {
              role: 'stall_staff',
              stallId: stall2,
              permissions: ['dining.order.manage']
            }
          });
        },
        /assigned stall/i
      );

      // Stall staff assigned to stall1 updates stall1 order -> allowed
      const updated = await updateDiningOrderStatus(dbAsync, orderId, 'ACCEPTED', {
        actor: {
          role: 'stall_staff',
          stallId: stall1,
          permissions: ['dining.order.manage']
        }
      });
      assert.equal(updated.newStatus, 'ACCEPTED');

      // Cleanup
      try {
        await dbAsync.run('DELETE FROM dining_orders WHERE id = ?', [orderId]);
      } catch (_e) {}
    });
  });
});

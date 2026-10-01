/**
 * Stage 0.9: Final Timestamp Reconciliation & Repository Cleanup Release Gate Test Suite
 *
 * Covers:
 * 1. PostgreSQL Driver TIMESTAMPTZ (JavaScript Date Object) Provenance Safety:
 *    - Matching TIMESTAMPTZ Date instant preserved as SAFE_NO_CHANGE
 *    - Discrepant TIMESTAMPTZ Date instant quarantined as MANUAL_REVIEW (never silently shifted)
 *    - Unambiguous TIMESTAMPTZ Date instant without slot preserved as SAFE_NO_CHANGE
 * 2. Explicit UTC & Offset String Safety:
 *    - Explicit UTC string preserved without shift
 *    - Explicit +05:30 offset preserved as exact canonical UTC instant
 *    - Proven unannotated local string converted once
 *    - Idempotency on repeated reconciliation execution
 * 3. Migration Transaction Isolation & Operational Quarantine:
 *    - Migration adapter executes reconciliation within transaction
 *    - Quarantined intervals excluded from live inventory occupancy
 * 4. Dining, RBAC, and Booking Concurrency Invariants.
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import dbAsync from '../server/db.js';
import { initDatabase } from '../server/db.js';
import {
  evaluateTimestampProvenance,
  reconcileAllTimestamps,
  TIMESTAMP_CLASSIFICATIONS
} from '../server/domain/time/timestampAudit.js';
import { checkCanonicalConflicts } from '../server/domain/booking/canonicalBookingCommand.js';
import { finalizeBookingFromPayment } from '../server/domain/booking/paymentFinalization.js';
import { createDiningOrder, updateDiningOrderStatus } from '../server/domain/dining/diningOrderCommand.js';

describe('Stage 0.9: Final Timestamp Reconciliation & Transaction Safety Gate', () => {

  before(async () => {
    await initDatabase();
  });

  // ============================================================
  // SECTION 1: POSTGRESQL DATE OBJECT PROVENANCE SAFETY
  // ============================================================
  describe('PostgreSQL TIMESTAMPTZ (Date Object) Provenance Safety', () => {

    it('preserves PostgreSQL TIMESTAMPTZ Date object matching legacy slot as SAFE_NO_CHANGE', () => {
      // 12:00:00Z UTC matches 05:30 PM – 06:30 PM IST on 2026-09-30
      const booking = {
        id: 'TT-pg-date-match',
        scheduled_start_at: new Date('2026-09-30T12:00:00.000Z'),
        scheduled_end_at: new Date('2026-09-30T13:00:00.000Z'),
        date: '2026-09-30',
        time_slot: '05:30 PM – 06:30 PM'
      };

      const audit = evaluateTimestampProvenance(booking);
      assert.equal(audit.classification, TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE);
      assert.equal(audit.correctionRequired, false);
      assert.equal(audit.isQuarantined, false);
      assert.equal(audit.canonicalCurrentValue, '2026-09-30T12:00:00.000Z');
      assert.equal(audit.proposedUtcInstant, '2026-09-30T12:00:00.000Z');
    });

    it('quarantines PostgreSQL TIMESTAMPTZ Date object with conflicting slot as MANUAL_REVIEW without automated shift', () => {
      // Stored instant is 18:00:00Z UTC, but legacy slot claims 06:00 PM IST (12:30:00Z UTC).
      // INVARIANT: An existing PostgreSQL TIMESTAMPTZ instant must NEVER be overwritten with a shifted local time!
      const booking = {
        id: 'TT-pg-date-conflict',
        scheduled_start_at: new Date('2026-09-19T18:00:00.000Z'),
        scheduled_end_at: new Date('2026-09-19T19:00:00.000Z'),
        date: '2026-09-19',
        time_slot: '06:00 PM – 07:00 PM'
      };

      const audit = evaluateTimestampProvenance(booking);
      assert.equal(audit.classification, TIMESTAMP_CLASSIFICATIONS.MANUAL_REVIEW);
      assert.equal(audit.correctionRequired, false, 'Discrepant PostgreSQL Date instant must NOT be automatically rewritten');
      assert.equal(audit.isQuarantined, true);
      assert.equal(audit.reconciliationStatus, 'MANUAL_REVIEW');
      assert.equal(audit.canonicalCurrentValue, '2026-09-19T18:00:00.000Z');
      assert.equal(audit.proposedUtcInstant, '2026-09-19T18:00:00.000Z');
    });

    it('preserves valid PostgreSQL TIMESTAMPTZ Date object without legacy slot as SAFE_NO_CHANGE', () => {
      const booking = {
        id: 'TT-pg-date-no-slot',
        scheduled_start_at: new Date('2026-09-30T15:00:00.000Z'),
        scheduled_end_at: new Date('2026-09-30T16:00:00.000Z')
      };

      const audit = evaluateTimestampProvenance(booking);
      assert.equal(audit.classification, TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE);
      assert.equal(audit.correctionRequired, false);
      assert.equal(audit.isQuarantined, false);
      assert.equal(audit.canonicalCurrentValue, '2026-09-30T15:00:00.000Z');
    });
  });

  // ============================================================
  // SECTION 2: EXPLICIT UTC & OFFSET STRING RECONCILIATION
  // ============================================================
  describe('Explicit UTC & Offset String Reconciliation', () => {

    it('preserves explicit ISO UTC string (Z) without reinterpretation', () => {
      const booking = {
        id: 'TT-iso-z',
        scheduled_start_at: '2026-09-30T12:00:00.000Z',
        scheduled_end_at: '2026-09-30T13:00:00.000Z',
        date: '2026-09-30',
        time_slot: '05:30 PM – 06:30 PM'
      };

      const audit = evaluateTimestampProvenance(booking);
      assert.equal(audit.classification, TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE);
      assert.equal(audit.correctionRequired, false);
      assert.equal(audit.isQuarantined, false);
      assert.equal(audit.proposedUtcInstant, '2026-09-30T12:00:00.000Z');
    });

    it('preserves explicit numeric offset string (+05:30) as exact UTC instant', () => {
      const booking = {
        id: 'TT-iso-offset',
        scheduled_start_at: '2026-09-30T17:30:00+05:30',
        scheduled_end_at: '2026-09-30T18:30:00+05:30',
        date: '2026-09-30',
        time_slot: '05:30 PM – 06:30 PM'
      };

      const audit = evaluateTimestampProvenance(booking);
      assert.equal(audit.classification, TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE);
      assert.equal(audit.correctionRequired, false);
      assert.equal(audit.isQuarantined, false);
      assert.equal(audit.proposedUtcInstant, '2026-09-30T12:00:00.000Z');
    });

    it('converts unannotated legacy local string to UTC instant exactly once', () => {
      const booking = {
        id: 'TT-local-str',
        scheduled_start_at: '2026-09-30 17:30:00',
        scheduled_end_at: '2026-09-30 18:30:00',
        date: '2026-09-30',
        time_slot: '05:30 PM – 06:30 PM'
      };

      const audit = evaluateTimestampProvenance(booking);
      assert.equal(audit.classification, TIMESTAMP_CLASSIFICATIONS.SAFE_CORRECTION);
      assert.equal(audit.correctionRequired, true);
      assert.equal(audit.proposedUtcInstant, '2026-09-30T12:00:00.000Z');
    });

    it('reconciliation is idempotent: second execution produces 0 corrections', async () => {
      const isPostgres = typeof dbAsync.isPostgres === 'function' && dbAsync.isPostgres();
      const testId = `TT-s09-idemp-${Date.now()}`;
      await dbAsync.run(
        `INSERT INTO bookings (id, facility_id, facility_name, date, time_slot, customer_name, customer_phone, amount_paid, booking_status)
         VALUES (?, 'fac_box_cricket_1', 'Box Cricket 1', '2032-05-10', '06:00 PM – 07:00 PM', 'Idemp Player', '9876543210', '500', 'Confirmed')`,
        [testId]
      );

      const firstRun = await reconcileAllTimestamps(dbAsync);
      assert.ok(firstRun.totalAudited >= 1);

      const secondRun = await reconcileAllTimestamps(dbAsync);
      assert.equal(secondRun.correctionsApplied, 0, 'Second run must apply 0 corrections');

      await dbAsync.run('DELETE FROM bookings WHERE id = ?', [testId]);
    });

    it('quarantined record is excluded from live conflict checking', async () => {
      const isPostgres = typeof dbAsync.isPostgres === 'function' && dbAsync.isPostgres();
      const qDate = '2032-06-15';
      const qSlot = '06:00 PM – 07:00 PM';
      const qId = `TT-s09-quarantine-${Date.now()}`;

      await dbAsync.run(
        `INSERT INTO bookings (
           id, facility_id, physical_facility_id, facility_name, date, time_slot,
           customer_name, customer_phone, amount_paid, booking_status,
           scheduled_start_at, scheduled_end_at, is_quarantined, reconciliation_status
         ) VALUES (
           ?, 'fac_box_cricket_1', 'fac_box_cricket_1', 'Box Cricket 1', ?, ?,
           'Quarantined Player', '9876543210', '500', 'Confirmed',
           '2032-06-15T12:30:00.000Z', '2032-06-15T13:30:00.000Z',
           ${isPostgres ? 'TRUE' : '1'}, 'MANUAL_REVIEW'
         )`,
        [qId, qDate, qSlot]
      );

      const conflictResult = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: 'fac_box_cricket_1',
        startAt: '2032-06-15T12:30:00.000Z',
        endAt: '2032-06-15T13:30:00.000Z'
      });

      assert.equal(conflictResult.hasConflict, false, 'Quarantined booking must NOT block live inventory');
      assert.equal(conflictResult.conflicts.length, 0);

      await dbAsync.run('DELETE FROM bookings WHERE id = ?', [qId]);
    });
  });

  // ============================================================
  // SECTION 3: CONCURRENCY & DINING PRIVACY REGRESSION
  // ============================================================
  describe('Concurrency & Dining Tenancy Scoping Invariants', () => {
    const testDate = '2032-07-20';
    const testSlot = '10:00 AM – 11:00 AM';
    const testNow = new Date('2032-01-01T00:00:00.000Z');
    const futureExp = Math.floor(testNow.getTime() / 1000) + 3600;

    async function cleanupTestData() {
      try {
        await dbAsync.run("DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE date = ?)", [testDate]);
        await dbAsync.run("DELETE FROM payment_orders WHERE finalized_booking_id IN (SELECT id FROM bookings WHERE date = ?) OR order_id LIKE 'test_s09_%'", [testDate]);
        await dbAsync.run("DELETE FROM bookings WHERE date = ?", [testDate]);
      } catch (_e) {}
    }

    beforeEach(async () => {
      await cleanupTestData();
    });

    it('concurrent payment finalizations for SAME resource -> exactly ONE confirmed booking', async () => {
      const orderId1 = `test_s09_race1_${Date.now()}`;
      const orderId2 = `test_s09_race2_${Date.now()}`;

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

      const results = await Promise.allSettled([
        finalizeBookingFromPayment(dbAsync, {
          razorpayOrderId: orderId1,
          razorpayPaymentId: `pay_${orderId1}`,
          razorpaySignature: 'sig_1',
          customerDetails: { name: 'Player 1', phone: '9876543210' },
          now: testNow
        }),
        finalizeBookingFromPayment(dbAsync, {
          razorpayOrderId: orderId2,
          razorpayPaymentId: `pay_${orderId2}`,
          razorpaySignature: 'sig_2',
          customerDetails: { name: 'Player 2', phone: '9876543211' },
          now: testNow
        })
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, `Expected exactly 1 success, got ${fulfilled.length}`);
      assert.equal(rejected.length, 1, `Expected exactly 1 conflict rejection, got ${rejected.length}`);
    });

    it('stall_staff assigned to Stall A cannot update Stall B order (strict 403 scoping)', async () => {
      const order = await createDiningOrder(dbAsync, {
        stallId: 'cafe',
        tableNumber: 'T1',
        customerName: 'Diner Test',
        customerPhone: '9876543210',
        items: [{ menuItemId: 'cafe-espresso', quantity: 2 }]
      });

      // Attempt update by stall_staff scoped to snack-parlours
      await assert.rejects(
        async () => {
          await updateDiningOrderStatus(dbAsync, order.orderId, 'ACCEPTED', {
            actor: {
              id: 99,
              username: 'other_stall_user',
              role: 'stall_staff',
              stallId: 'snack-parlours',
              permissions: ['dining.order.manage', 'dining.order.update']
            }
          });
        },
        (err) => {
          assert.equal(err.httpStatus, 403);
          assert.match(err.message, /Forbidden: You can only manage orders for your assigned stall/i);
          return true;
        }
      );
    });
  });

});

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import dbAsync from '../server/db.js';
import {
  createCanonicalBooking,
  createCanonicalPaymentHold,
  checkCanonicalConflicts,
  getCanonicalResourceAvailability,
  resolveCanonicalFacility
} from '../server/domain/booking/canonicalBookingCommand.js';
import {
  createDiningOrder,
  updateDiningOrderStatus
} from '../server/domain/dining/diningOrderCommand.js';
import {
  loadUserPermissions,
  hasPermission,
  requirePermission
} from '../server/domain/rbac/rbacEngine.js';
import { runPreflightReport } from '../server/scripts/preflightCheck.js';
import { normalizeBookingInterval } from '../server/domain/time/bookingInterval.js';
import { canTransitionBookingStatus } from '../server/domain/booking/bookingStateMachine.js';

describe('Stage 0.5: Canonical Booking Engine & Operationalization', () => {
  const createdBookingIds = [];
  const createdHoldTokens = [];
  const createdOrderIds = [];

  after(async () => {
    // Cleanup any test data created during runs
    for (const bId of createdBookingIds) {
      try {
        await dbAsync.run('DELETE FROM facility_sessions WHERE booking_id = ?', [bId]);
        await dbAsync.run('DELETE FROM bookings WHERE id = ?', [bId]);
      } catch (e) {}
    }
    for (const hTok of createdHoldTokens) {
      try {
        await dbAsync.run('DELETE FROM payment_holds WHERE hold_token = ?', [hTok]);
      } catch (e) {}
    }
    for (const oId of createdOrderIds) {
      try {
        await dbAsync.run('DELETE FROM dining_order_items WHERE order_id = ?', [oId]);
        await dbAsync.run('DELETE FROM dining_orders WHERE id = ?', [oId]);
      } catch (e) {}
    }
  });

  // ==========================================================================
  // 1. QUICK VS CUSTOM BOOKING VALIDATION
  // ==========================================================================
  describe('Quick vs Custom Booking Validation', () => {
    const futureDate = '2028-11-15';

    it('accepts Quick booking for 1 hour starting on the hour (:00)', async () => {
      const res = await createCanonicalBooking(dbAsync, {
        actor: { type: 'CUSTOMER', username: 'guest' },
        source: 'CUSTOMER_APP',
        customer: { name: 'Pooja Patel', phone: '9876543210' },
        physicalFacilityId: 'fac_box_cricket_1',
        date: futureDate,
        startTime: '10:00',
        durationHours: 1,
        bookingMode: 'STANDARD_QUICK',
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(res.bookingId);
      assert.equal(res.success, true);
      assert.equal(res.physicalFacilityId, 'fac_box_cricket_1');
      assert.equal(res.interval.durationHours, 1);
    });

    it('accepts Quick booking for 2 hours starting on the hour (:00)', async () => {
      const res = await createCanonicalBooking(dbAsync, {
        actor: { type: 'CUSTOMER', username: 'guest' },
        source: 'CUSTOMER_APP',
        customer: { name: 'Rahul Sharma', phone: '9876543211' },
        physicalFacilityId: 'fac_box_cricket_1',
        date: futureDate,
        startTime: '14:00',
        durationHours: 2,
        bookingMode: 'STANDARD_QUICK',
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(res.bookingId);
      assert.equal(res.success, true);
      assert.equal(res.interval.durationHours, 2);
    });

    it('strictly rejects Quick booking with 90-minute (1.5h) duration', async () => {
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            customer: { name: 'Test User', phone: '9876543210' },
            physicalFacilityId: 'fac_box_cricket_1',
            date: futureDate,
            startTime: '10:00',
            durationMinutes: 90,
            bookingMode: 'STANDARD_QUICK',
            now: new Date('2028-11-01T00:00:00.000Z')
          });
        },
        /duration must be 1 Hour or 2 Hours/
      );
    });

    it('strictly rejects Quick booking starting off the hour (e.g. 10:15)', async () => {
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            customer: { name: 'Test User', phone: '9876543210' },
            physicalFacilityId: 'fac_box_cricket_1',
            date: futureDate,
            startTime: '10:15',
            durationHours: 1,
            bookingMode: 'STANDARD_QUICK',
            now: new Date('2028-11-01T00:00:00.000Z')
          });
        },
        /start on a whole hour/
      );
    });


    it('accepts Custom booking on quarter-hour starts (:15, :30, :45) with whole-hour duration', async () => {
      const res = await createCanonicalBooking(dbAsync, {
        customer: { name: 'Vikram Mehta', phone: '9876543212' },
        physicalFacilityId: 'fac_box_cricket_2',
        date: futureDate,
        startTime: '16:45',
        durationHours: 1,
        bookingMode: 'CUSTOM',
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(res.bookingId);
      assert.equal(res.success, true);
      assert.equal(res.interval.durationHours, 1);
    });

    it('strictly rejects Custom booking starting at arbitrary minutes (e.g. 16:10)', async () => {
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            customer: { name: 'Test User', phone: '9876543210' },
            physicalFacilityId: 'fac_box_cricket_2',
            date: futureDate,
            startTime: '16:10',
            durationHours: 1,
            bookingMode: 'CUSTOM',
            now: new Date('2028-11-01T00:00:00.000Z')
          });
        },
        /quarter-hour boundary/
      );
    });


    it('strictly rejects Custom booking with fractional duration (e.g. 12:45 to 13:30 = 45m)', async () => {
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            customer: { name: 'Test User', phone: '9876543210' },
            physicalFacilityId: 'fac_box_cricket_2',
            date: futureDate,
            startTime: '12:45',
            durationMinutes: 45,
            bookingMode: 'CUSTOM',
            now: new Date('2028-11-01T00:00:00.000Z')
          });
        },
        /must be at least 60 minutes|must be a whole number of hours/
      );
    });
  });

  // ==========================================================================
  // 2. LEAD TIME & WALK-IN PAYMENT POLICY
  // ==========================================================================
  describe('Customer Lead Time vs Staff Walk-In & Payment Policy', () => {
    const fixedNow = new Date('2028-12-01T10:00:00.000Z'); // 15:30 IST

    it('strictly rejects customer booking starting in under 60 minutes', async () => {
      // 16:00 IST is only 30 minutes from now (15:30 IST)
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            actor: { type: 'CUSTOMER' },
            source: 'CUSTOMER_APP',
            customer: { name: 'Lead Time Test', phone: '9876543210' },
            physicalFacilityId: 'fac_pickleball_1',
            date: '2028-12-01',
            startTime: '16:00',
            durationHours: 1,
            now: fixedNow
          });
        },
        /minimum of 60 minutes lead time/
      );
    });

    it('permits customer booking starting in >= 60 minutes', async () => {
      // 17:00 IST is 90 minutes from now (15:30 IST)
      const res = await createCanonicalBooking(dbAsync, {
        actor: { type: 'CUSTOMER' },
        source: 'CUSTOMER_APP',
        customer: { name: 'Lead Time Valid', phone: '9876543210' },
        physicalFacilityId: 'fac_pickleball_1',
        date: '2028-12-01',
        startTime: '17:00',
        durationHours: 1,
        now: fixedNow
      });
      createdBookingIds.push(res.bookingId);
      assert.equal(res.success, true);
    });

    it('permits staff immediate walk-in booking starting in < 60 minutes with FULL payment', async () => {
      const res = await createCanonicalBooking(dbAsync, {
        actor: { type: 'STAFF', username: 'counter_operator' },
        source: 'STAFF_WALKIN',
        customer: { name: 'Walk-In Customer', phone: '9876543215' },
        physicalFacilityId: 'fac_pickleball_2',
        date: '2028-12-01',
        startTime: '16:00',
        durationHours: 1,
        payment: { type: 'FULL', totalAmountPaise: 80000, paymentStatus: 'PAID' },
        now: fixedNow
      });
      createdBookingIds.push(res.bookingId);
      assert.equal(res.success, true);
    });

    it('strictly rejects staff walk-in < 1h if configured with token DEPOSIT instead of FULL payment', async () => {
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            actor: { type: 'STAFF', username: 'counter_operator' },
            source: 'STAFF_WALKIN',
            customer: { name: 'Walk-In Customer', phone: '9876543215' },
            physicalFacilityId: 'fac_pickleball_2',
            date: '2028-12-01',
            startTime: '16:00',
            durationHours: 1,
            payment: { type: 'DEPOSIT', totalAmountPaise: 80000, depositAmountPaise: 30000 },
            now: fixedNow
          });
        },
        /Immediate walk-in bookings inside the 1-hour threshold require FULL payment/
      );
    });
  });

  // ==========================================================================
  // 3. PHYSICAL RESOURCE CONFLICTS & CONCURRENCY
  // ==========================================================================
  describe('Physical Resource Conflicts & Concurrency Protection', () => {
    const conflictDate = '2028-12-05';

    it('rejects double-booking on the SAME physical resource (Turf 1 vs Turf 1)', async () => {
      const b1 = await createCanonicalBooking(dbAsync, {
        customer: { name: 'Team Alpha', phone: '9876543210' },
        physicalFacilityId: 'fac_box_cricket_1',
        date: conflictDate,
        startTime: '18:00',
        durationHours: 1,
        status: 'Confirmed',
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(b1.bookingId);

      // Attempt overlapping booking on same Turf 1
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            customer: { name: 'Team Beta', phone: '9876543211' },
            physicalFacilityId: 'fac_box_cricket_1',
            date: conflictDate,
            startTime: '18:00',
            durationHours: 1,
            now: new Date('2028-11-01T00:00:00.000Z')
          });
        },
        /Double-booking prevented: Physical facility is already reserved/
      );
    });

    it('allows concurrent bookings on DIFFERENT physical turfs (Turf 1 vs Turf 2)', async () => {
      const b2 = await createCanonicalBooking(dbAsync, {
        customer: { name: 'Team Gamma', phone: '9876543212' },
        physicalFacilityId: 'fac_box_cricket_2',
        date: conflictDate,
        startTime: '18:00',
        durationHours: 1,
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(b2.bookingId);
      assert.equal(b2.success, true);
      assert.equal(b2.physicalFacilityId, 'fac_box_cricket_2');
    });

    it('Green Net + Shooting Machine conflicts with Green Net Practice (same physical resource)', async () => {
      // 1. Reserve Green Net for standard practice
      const netBooking = await createCanonicalBooking(dbAsync, {
        customer: { name: 'Cricket Player A', phone: '9876543213' },
        physicalFacilityId: 'fac_green_net_1',
        date: conflictDate,
        startTime: '07:00',
        durationHours: 1,
        status: 'Confirmed',
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(netBooking.bookingId);

      // 2. Attempt to book Shooting Machine on same slot
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            customer: { name: 'Cricket Player B', phone: '9876543214' },
            physicalFacilityId: 'fac_green_net_1',
            addOnIds: ['addon_shooting_machine'],
            date: conflictDate,
            startTime: '07:00',
            durationHours: 1,
            now: new Date('2028-11-01T00:00:00.000Z')
          });
        },
        /Double-booking prevented: Physical facility is already reserved/
      );
    });


    it('rejects assigning Shooting Machine to an unauthorized physical facility (e.g. Skating Rink)', async () => {
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            customer: { name: 'Invalid Player', phone: '9876543210' },
            physicalFacilityId: 'fac_skating_1',
            addOnIds: ['addon_shooting_machine'],
            date: conflictDate,
            startTime: '08:00',
            durationHours: 1,
            now: new Date('2028-11-01T00:00:00.000Z')
          });
        },
        /Ball-Shooting Machine is an add-on strictly available only on Cricket Green Net/
      );
    });
  });

  // ==========================================================================
  // 4. CANONICAL PAYMENT HOLDS & AUTOMATIC EXPIRY
  // ==========================================================================
  describe('Canonical Hold Engine & Automatic Expiry', () => {
    const holdDate = '2028-12-10';

    it('creates active payment hold that blocks concurrent booking attempts', async () => {
      const hold = await createCanonicalPaymentHold(dbAsync, {
        physicalFacilityId: 'fac_skating_1',
        date: holdDate,
        timeSlot: '09:00 AM – 10:00 AM',
        ttlMinutes: 10,
        now: new Date('2028-12-01T00:00:00.000Z')
      });
      createdHoldTokens.push(hold.holdToken);
      assert.equal(hold.success, true);

      // Booking without the holdToken should be rejected
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            customer: { name: 'Hold Collision Test', phone: '9876543210' },
            physicalFacilityId: 'fac_skating_1',
            date: holdDate,
            startTime: '09:00',
            durationHours: 1,
            now: new Date('2028-12-01T00:05:00.000Z')
          });
        },
        /temporary reservation hold is currently active/
      );
    });

    it('converts active hold upon successful final booking confirmation', async () => {
      const hold = await createCanonicalPaymentHold(dbAsync, {
        physicalFacilityId: 'fac_skating_1',
        date: holdDate,
        timeSlot: '11:00 AM – 12:00 PM',
        ttlMinutes: 10,
        now: new Date('2028-12-01T00:00:00.000Z')
      });
      createdHoldTokens.push(hold.holdToken);

      // Complete booking supplying the valid hold token
      const booking = await createCanonicalBooking(dbAsync, {
        customer: { name: 'Hold Buyer', phone: '9876543219' },
        physicalFacilityId: 'fac_skating_1',
        date: holdDate,
        startTime: '11:00',
        durationHours: 1,
        holdToken: hold.holdToken,
        now: new Date('2028-12-01T00:02:00.000Z')
      });
      createdBookingIds.push(booking.bookingId);
      assert.equal(booking.success, true);

      // Verify hold status in DB is CONVERTED
      const holdRow = await dbAsync.get('SELECT status FROM payment_holds WHERE hold_token = ?', [hold.holdToken]);
      assert.equal(holdRow.status, 'CONVERTED');
    });

    it('automatically ignores expired holds without manual deletion', async () => {
      // Create hold expired 5 minutes ago
      const expiredHold = await createCanonicalPaymentHold(dbAsync, {
        physicalFacilityId: 'fac_skating_1',
        date: holdDate,
        timeSlot: '14:00 PM – 15:00 PM',
        ttlMinutes: 5,
        now: new Date('2028-12-01T00:00:00.000Z')
      });
      createdHoldTokens.push(expiredHold.holdToken);

      // Current time is 15 minutes after hold was placed -> expired
      const laterNow = new Date('2028-12-01T00:15:00.000Z');

      const conflictCheck = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: 'fac_skating_1',
        startAt: expiredHold.interval.startAt,
        endAt: expiredHold.interval.endAt,
        now: laterNow
      });

      assert.equal(conflictCheck.hasConflict, false, 'Expired hold must not participate in conflicts');
    });
  });

  // ==========================================================================
  // 5. CANCELLATION TERMINALITY & SLOT RELEASE
  // ==========================================================================
  describe('Cancellation Terminality & Slot Release', () => {
    const cancelDate = '2028-12-20';

    it('releasing a cancelled booking immediately reopens slot while preserving historical record', async () => {
      // 1. Create booking
      const b = await createCanonicalBooking(dbAsync, {
        customer: { name: 'Cancel Candidate', phone: '9876543210' },
        physicalFacilityId: 'fac_box_cricket_1',
        date: cancelDate,
        startTime: '12:00',
        durationHours: 1,
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(b.bookingId);

      // 2. Soft-cancel the booking
      await dbAsync.run(
        "UPDATE bookings SET booking_status = 'Cancelled', cancellation_actor = 'test_operator', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?",
        [b.bookingId]
      );

      // 3. Record still exists in database
      const cancelledRow = await dbAsync.get('SELECT id, booking_status, cancellation_actor FROM bookings WHERE id = ?', [b.bookingId]);
      assert.equal(cancelledRow.booking_status, 'Cancelled');
      assert.equal(cancelledRow.cancellation_actor, 'test_operator');

      // 4. New customer can book the exact same slot immediately
      const newBooking = await createCanonicalBooking(dbAsync, {
        customer: { name: 'Reclaimed Candidate', phone: '9876543211' },
        physicalFacilityId: 'fac_box_cricket_1',
        date: cancelDate,
        startTime: '12:00',
        durationHours: 1,
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(newBooking.bookingId);
      assert.equal(newBooking.success, true);
    });

    it('strictly forbids state machine transition from CANCELLED to CONFIRMED (Terminal Invariant)', () => {
      const check = canTransitionBookingStatus('CANCELLED', 'CONFIRMED');
      assert.equal(check.valid, false);
      assert.match(check.error, /terminal state/i);
    });
  });

  // ==========================================================================
  // 6. SESSION EXTENSIONS OCCUPANCY
  // ==========================================================================
  describe('Session Extension Resource Occupancy', () => {
    const extDate = '2028-12-25';

    it('approved session extension extends occupied window and prevents subsequent booking collision', async () => {
      // Scheduled 19:00 to 20:00
      const b = await createCanonicalBooking(dbAsync, {
        customer: { name: 'Session Player', phone: '9876543210' },
        physicalFacilityId: 'fac_box_cricket_2',
        date: extDate,
        startTime: '19:00',
        durationHours: 1,
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(b.bookingId);

      // Find created session and add a 30-minute approved extension
      const session = await dbAsync.get('SELECT id FROM facility_sessions WHERE booking_id = ?', [b.bookingId]);
      assert.ok(session, 'facility_sessions row must exist');

      const adjId = `adj_${Date.now()}`;
      await dbAsync.run(
        `INSERT INTO session_adjustments (id, session_id, adjustment_type, minutes, is_free, approved_by)
         VALUES (?, ?, 'EXTENSION', 30, ?, 'admin_ops')`,
        [adjId, session.id, dbAsync.isPostgres() ? true : 1]
      );

      // Now occupied window is extended through 20:30!
      // Attempting to book custom slot 20:15 - 21:15 must collide
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            customer: { name: 'Extension Colliding Player', phone: '9876543211' },
            physicalFacilityId: 'fac_box_cricket_2',
            date: extDate,
            startTime: '20:15',
            durationHours: 1,
            bookingMode: 'CUSTOM',
            now: new Date('2028-11-01T00:00:00.000Z')
          });
        },
        /occupied by an approved session extension/
      );

      // Attempting to book custom slot 20:30 - 21:30 succeeds!
      const afterExtBooking = await createCanonicalBooking(dbAsync, {
        customer: { name: 'Post-Extension Player', phone: '9876543212' },
        physicalFacilityId: 'fac_box_cricket_2',
        date: extDate,
        startTime: '20:30',
        durationHours: 1,
        bookingMode: 'CUSTOM',
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(afterExtBooking.bookingId);
      assert.equal(afterExtBooking.success, true);

      // Cleanup adjustment
      await dbAsync.run('DELETE FROM session_adjustments WHERE id = ?', [adjId]);
    });
  });

  // ==========================================================================
  // 7. CROSS-MIDNIGHT BOOKINGS
  // ==========================================================================
  describe('Cross-Midnight Booking Invariants', () => {
    it('accurately normalizes and rejects overlapping cross-midnight intervals', async () => {
      const bCross = await createCanonicalBooking(dbAsync, {
        customer: { name: 'Night Owl 1', phone: '9876543210' },
        physicalFacilityId: 'fac_box_cricket_1',
        date: '2028-12-30',
        startTime: '23:00',
        durationHours: 2, // 23:00 -> 01:00 next day
        bookingMode: 'STANDARD_QUICK',
        status: 'Confirmed',
        now: new Date('2028-11-01T00:00:00.000Z')
      });
      createdBookingIds.push(bCross.bookingId);

      // Attempt overlapping custom booking starting 23:45 to 00:45 next day
      await assert.rejects(
        async () => {
          await createCanonicalBooking(dbAsync, {
            customer: { name: 'Night Owl 2', phone: '9876543211' },
            physicalFacilityId: 'fac_box_cricket_1',
            date: '2028-12-30',
            startTime: '23:45',
            durationHours: 1,
            bookingMode: 'CUSTOM',
            now: new Date('2028-11-01T00:00:00.000Z')
          });
        },
        /Physical facility is already reserved/
      );
    });
  });

  // ==========================================================================
  // 8. AUTHORITATIVE DINING ORDER COMMAND
  // ==========================================================================
  describe('Authoritative Campus Dining Order Engine', () => {
    let testTableId = 'tbl_dine_01';
    let testMenuItem;

    before(async () => {
      // Ensure an active dining table exists
      const table = await dbAsync.get("SELECT * FROM dining_tables WHERE is_active = ? LIMIT 1", [dbAsync.isPostgres() ? true : 1]);
      if (table) {
        testTableId = table.id;
      }
      // Get an active menu item with known price
      testMenuItem = await dbAsync.get("SELECT * FROM food_menu_items WHERE is_active = ? LIMIT 1", [dbAsync.isPostgres() ? true : 1]);
    });


    it('derives order price authoritatively from database, strictly ignoring client price manipulation', async () => {
      if (!testMenuItem) return;

      const order = await createDiningOrder(dbAsync, {
        tableId: testTableId,
        customerName: 'Priya Dave',
        customerPhone: '9876543210',
        items: [
          {
            menuItemId: testMenuItem.id,
            quantity: 2,
            pricePaise: 1 // Malicious client attempt: ₹0.01 instead of official price!
          }
        ]
      });
      createdOrderIds.push(order.orderId);

      assert.equal(order.success, true);
      const expectedItemTotal = testMenuItem.price_paise * 2;
      assert.equal(order.subtotalPaise, expectedItemTotal, 'Server must calculate item price from DB');
      assert.notEqual(order.subtotalPaise, 2, 'Client price spoofing must be completely ignored');
    });

    it('strictly rejects orders on invalid or non-existent tables', async () => {
      await assert.rejects(
        async () => {
          await createDiningOrder(dbAsync, {
            tableId: 'tbl_non_existent_999',
            customerName: 'Fraud User',
            customerPhone: '9876543210',
            items: [{ menuItemId: testMenuItem.id, quantity: 1 }]
          });
        },
        /is not a valid active Turf & Taste dining table/
      );
    });

    it('enforces dining order state transitions and protects terminal states', async () => {
      if (!testMenuItem) return;

      const order = await createDiningOrder(dbAsync, {
        tableId: testTableId,
        customerName: 'State Machine Test',
        customerPhone: '9876543210',
        items: [{ menuItemId: testMenuItem.id, quantity: 1 }]
      });
      createdOrderIds.push(order.orderId);

      // Operator updates PLACED -> ACCEPTED
      const s1 = await updateDiningOrderStatus(dbAsync, order.orderId, 'ACCEPTED', { actor: { role: 'staff', username: 'cook' } });
      assert.equal(s1.newStatus, 'ACCEPTED');

      // Operator updates ACCEPTED -> PREPARING
      const s2 = await updateDiningOrderStatus(dbAsync, order.orderId, 'PREPARING', { actor: { role: 'staff', username: 'cook' } });
      assert.equal(s2.newStatus, 'PREPARING');

      // Operator updates PREPARING -> READY
      const s3 = await updateDiningOrderStatus(dbAsync, order.orderId, 'READY', { actor: { role: 'staff', username: 'cook' } });
      assert.equal(s3.newStatus, 'READY');

      // Operator updates READY -> SERVED
      const s3b = await updateDiningOrderStatus(dbAsync, order.orderId, 'SERVED', { actor: { role: 'staff', username: 'waiter' } });
      assert.equal(s3b.newStatus, 'SERVED');

      // Completed: SERVED -> COMPLETED
      const s4 = await updateDiningOrderStatus(dbAsync, order.orderId, 'COMPLETED', { actor: { role: 'staff', username: 'cook' } });
      assert.equal(s4.newStatus, 'COMPLETED');


      // Cannot reopen completed order
      await assert.rejects(
        async () => {
          await updateDiningOrderStatus(dbAsync, order.orderId, 'PREPARING', { actor: { role: 'staff' } });
        },
        /Illegal dining order transition/
      );
    });
  });

  // ==========================================================================
  // 9. DATABASE-BACKED RBAC PERMISSIONS ENGINE
  // ==========================================================================
  describe('Database-backed RBAC Engine & Gating', () => {
    it('loads permissions dynamically from DB and distinguishes roles correctly', async () => {
      // 1. Super admin has 44 seeded permissions
      const superAdminPerms = await loadUserPermissions(dbAsync, 'admin', 1, 'role_super_admin');
      assert.ok(superAdminPerms.includes('pricing.manage'));
      assert.ok(superAdminPerms.includes('facility.create'));
      assert.ok(superAdminPerms.includes('booking.read'));

      // 2. Staff role has operations permissions but lacks financial/facility mutation
      const staffPerms = await loadUserPermissions(dbAsync, 'staff', 2, 'role_staff');
      assert.ok(staffPerms.includes('booking.read'));
      assert.ok(staffPerms.includes('booking.walkin'));
      assert.ok(staffPerms.includes('booking.extend'));

      assert.equal(hasPermission(staffPerms, 'pricing.manage'), false);
      assert.equal(hasPermission(staffPerms, 'facility.create'), false);

      // 3. Stall staff has dining permissions but lacks turf operations
      const stallPerms = await loadUserPermissions(dbAsync, 'stall', 3, 'role_stall_staff');
      assert.ok(stallPerms.includes('dining.stall.manage'));
      assert.ok(stallPerms.includes('dining.order.manage'));
      assert.equal(hasPermission(stallPerms, 'booking.cancel'), false);
      assert.equal(hasPermission(stallPerms, 'pricing.manage'), false);


      // 4. Custom role works purely through permissions
      const customPerms = ['booking.read', 'booking.extend'];
      assert.equal(hasPermission(customPerms, 'booking.read'), true);
      assert.equal(hasPermission(customPerms, 'booking.cancel'), false);
    });
  });

  // ==========================================================================
  // 10. PREFLIGHT READINESS REPORT
  // ==========================================================================
  describe('Stage 0.5 Preflight Readiness Check', () => {
    it('reports every unreconciled legacy booking without assuming production fixture data', async () => {
      const report = await runPreflightReport();
      const expectedQuarantined = await dbAsync.get(
        'SELECT COUNT(*) AS count FROM bookings WHERE physical_facility_id IS NULL'
      );
      assert.equal(report.status, 'READY', `Preflight must report READY. Error: ${report.error || 'unknown'}`);
      assert.equal(report.missingTargetTables.length, 0);
      assert.equal(report.physicalInventory.missing.length, 0);
      assert.equal(report.shootingMachineInvariant.isValid, true);
      assert.ok(report.rbacAudit.rolePermissionsCount >= 40);
      assert.equal(report.legacyReconciliation.quarantinedCount, Number(expectedQuarantined.count));
    });
  });
});

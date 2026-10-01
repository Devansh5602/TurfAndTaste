import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import dbAsync, { initDatabase } from '../server/db.js';
import quotesRoutes from '../server/routes/v2/quotes.js';
import bookingRoutes from '../server/routes/bookings.js';
import sessionRoutes from '../server/routes/sessions.js';
import { resolvePricing } from '../server/domain/pricing/pricingResolver.js';
import { createCanonicalBooking } from '../server/domain/booking/canonicalBookingCommand.js';

describe('Admin Phase 1.3: Canonical Authority & Pricing Snapshot Closeout', () => {
  let server;
  let baseUrl;
  let staffToken;

  before(async () => {
    await initDatabase();

    const app = express();
    app.use(express.json());
    app.use('/api/v2/quotes', quotesRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/sessions', sessionRoutes);

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    const admin = await dbAsync.get('SELECT * FROM admins WHERE id = 1');
    const secret = process.env.JWT_SECRET || 'turf-taste-test-only-jwt-secret';
    staffToken = jwt.sign(
      { id: admin.id, sv: admin.session_version ?? 0 },
      secret
    );

    // Baseline rates for fac_box_cricket_1
    await dbAsync.run(
      `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, deposit_fixed_paise, is_active)
       VALUES ('pr_seed_bc1_day', 'fac_box_cricket_1', 'BASE_RATE', 'DAY', 100000, 30000, 1)
       ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 100000, is_active = 1`
    );
    await dbAsync.run(
      `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, deposit_fixed_paise, is_active)
       VALUES ('pr_seed_bc1_wday', 'fac_box_cricket_1', 'BASE_RATE', 'WEEKEND_DAY', 120000, 40000, 1)
       ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 120000, is_active = 1`
    );
  });

  after(() => {
    if (server) server.close();
  });

  /* ============================================================
     1. ONE PRICING AUTHORITY: V2 QUOTE CALLERS DELEGATE TO CANONICAL RESOLVER
     ============================================================ */
  describe('Blocker A: Canonical Pricing Authority Parity', () => {
    it('POST /api/v2/quotes returns identical financial results to canonical resolvePricing', async () => {
      const targetDate = '2026-10-20';
      const timeSlot = '02:00 PM – 03:00 PM';
      const facilityId = 'fac_box_cricket_1';

      // 1. Direct canonical calculation
      const canonical = await resolvePricing(dbAsync, {
        facilityId,
        date: targetDate,
        timeSlot,
        durationHours: 1,
        paymentType: 'deposit',
      });

      // 2. HTTP quote endpoint
      const res = await fetch(`${baseUrl}/api/v2/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId, date: targetDate, timeSlot }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);

      // Financial parity
      assert.equal(body.data.totalAmountPaise, canonical.totalAmountPaise);
      assert.equal(body.data.depositAmountPaise, canonical.depositAmountPaise);
      assert.equal(body.data.total, Math.round(canonical.totalAmountPaise / 100));
      assert.equal(body.data.deposit, Math.round(canonical.depositAmountPaise / 100));
      assert.equal(body.data.currency, 'INR');

      // Structured explanation
      assert.ok(body.data.breakdown);
      assert.equal(body.data.breakdown.baseAmountPaise, canonical.breakdown.baseAmountPaise);
      assert.equal(body.data.fullPaymentRequired, canonical.fullPaymentRequired);
      assert.ok(body.data.quoteToken);
    });

    it('POST /api/v2/quotes includes package pre-subtotal and explicit discount in breakdown', async () => {
      const facilityId = 'fac_box_cricket_1';
      // Seed a 3-hour package rule
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_total, min_hours, max_hours, is_active)
         VALUES ('pr_closeout_pkg_3h', ?, 'PACKAGE', 'DAY', 200000, 3, 3, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_total = 200000, is_active = 1`,
        [facilityId]
      );

      const quote = await resolvePricing(dbAsync, {
        facilityId,
        date: '2026-10-21',
        timeSlot: '10:00 AM – 01:00 PM',
        durationHours: 3,
      });

      assert.equal(quote.breakdown.packageUsed, true);
      assert.equal(quote.totalAmountPaise, 200000);
      assert.ok(quote.breakdown.prePackageSubtotalPaise > 0);
      assert.ok(quote.breakdown.packageDiscountPaise >= 0);
    });
  });

  /* ============================================================
     2. ONE AVAILABILITY AUTHORITY: UNIFIED ON FACILITY_BLOCKS
     ============================================================ */
  describe('Blocker B: One Availability Authority & Legacy Block Bridge', () => {
    it('POST /api/bookings/block-slot persists into canonical facility_blocks and reflects in availability', async () => {
      const blockDate = '2026-10-22';
      const blockSlot = '04:00 PM – 05:00 PM';
      const facilityId = 'fac_box_cricket_1';

      // 1. Create block via legacy bridge route
      const blockRes = await fetch(`${baseUrl}/api/bookings/block-slot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          facilityId,
          date: blockDate,
          timeSlot: blockSlot,
          reason: 'Pitch Turf Regrassing',
        }),
      });

      assert.equal(blockRes.status, 200);
      const blockData = await blockRes.json();
      assert.equal(blockData.success, true);
      assert.ok(blockData.blockId);

      // Verify row exists in facility_blocks
      const row = await dbAsync.get('SELECT * FROM facility_blocks WHERE id = ?', [blockData.blockId]);
      assert.ok(row, 'Block must be stored in facility_blocks table');
      assert.equal(row.facility_id, facilityId);
      assert.equal(row.status, 'active');

      // 2. GET /api/bookings/slots must flag this slot as maintenance
      const slotsRes = await fetch(`${baseUrl}/api/bookings/slots?facilityId=${facilityId}&date=${blockDate}`);
      assert.equal(slotsRes.status, 200);
      const slotsData = await slotsRes.json();
      const targetSlot = slotsData.slots.find(s => s.time === blockSlot);
      assert.ok(targetSlot);
      assert.equal(targetSlot.status, 'maintenance');
      assert.match(targetSlot.maintenanceReason, /Pitch Turf Regrassing|Maintenance/);

      // 3. POST /api/v2/quotes must reject the blocked interval with 409
      const quoteRes = await fetch(`${baseUrl}/api/v2/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId, date: blockDate, timeSlot: blockSlot }),
      });
      assert.equal(quoteRes.status, 409);

      // 4. Release via legacy unblock-slot
      const unblockRes = await fetch(`${baseUrl}/api/bookings/unblock-slot`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ facilityId, date: blockDate, timeSlot: blockSlot }),
      });
      assert.equal(unblockRes.status, 200);

      // 5. Verify restored to available
      const restoredSlots = await fetch(`${baseUrl}/api/bookings/slots?facilityId=${facilityId}&date=${blockDate}`).then(r => r.json());
      const restoredSlot = restoredSlots.slots.find(s => s.time === blockSlot);
      assert.equal(restoredSlot.status, 'available');
    });

    it('GET /api/bookings/blocked-slots reads active blocks from canonical facility_blocks', async () => {
      const res = await fetch(`${baseUrl}/api/bookings/blocked-slots?facilityId=fac_box_cricket_1`, {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.blockedSlots));
    });
  });

  /* ============================================================
     3. IMMUTABLE BOOKING PRICING SNAPSHOT
     ============================================================ */
  describe('Blocker C & D: Immutable Booking Pricing Snapshot', () => {
    it('historical booking retains its original pricing snapshot even after current pricing rules change', async () => {
      const facilityId = 'fac_box_cricket_2';
      const targetDate = '2026-10-23';
      const timeSlot = '11:00 AM – 12:00 PM';

      // 1. Configure Rate A (₹800/hr = 80000 paise)
      await dbAsync.run(
        "DELETE FROM pricing_rules WHERE facility_id = ? AND period_type = 'DAY'",
        [facilityId]
      );
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, is_active)
         VALUES ('pr_snap_day', ?, 'BASE_RATE', 'DAY', 80000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 80000, is_active = 1`,
        [facilityId]
      );

      // 2. Create and finalize a booking with Rate A
      const bookingResult = await createCanonicalBooking(dbAsync, {
        id: `TT-SNAP-${Date.now()}`,
        actor: { type: 'STAFF', username: 'staff-qa' },
        source: 'STAFF_WALKIN',
        customer: { name: 'Audit Player', phone: '9898776655' },
        physicalFacilityId: facilityId,
        facilityId,
        date: targetDate,
        timeSlot,
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 80000, amountPaidPaise: 80000, paymentStatus: 'Paid' },
        pricingSnapshot: {
          rateConfig: 'Rate A',
          totalAmountPaise: 80000,
          breakdown: { baseAmountPaise: 80000, addOnAmountPaise: 0 },
          calculatedAt: new Date().toISOString()
        }
      });

      const bookingId = bookingResult.bookingId;

      // 3. Mutate current pricing in the database to Rate B (₹1,500/hr = 150000 paise)
      await dbAsync.run(
        `UPDATE pricing_rules SET rate_paise_per_hour = 150000 WHERE id = 'pr_snap_day'`
      );

      // 4. Retrieve historical booking from /api/bookings
      const listRes = await fetch(`${baseUrl}/api/bookings?search=${bookingId}`, {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      });
      assert.equal(listRes.status, 200);
      const listData = await listRes.json();
      const historicalBooking = listData.bookings.find(b => b.id === bookingId);
      assert.ok(historicalBooking, 'Historical booking must exist in search');

      // 5. Assert: Historical booking preserves Rate A snapshot, NOT current Rate B
      assert.ok(historicalBooking.pricingSnapshot, 'Booking must contain persisted pricingSnapshot');
      assert.equal(historicalBooking.pricingSnapshot.totalAmountPaise, 80000, 'Historical booking must retain Rate A amount');
      assert.equal(historicalBooking.pricingSnapshot.rateConfig, 'Rate A');
      assert.equal(historicalBooking.pricingSnapshot.breakdown.baseAmountPaise, 80000);

      // 6. Assert: A new quote for the same slot reflects the new Rate B
      const newQuote = await resolvePricing(dbAsync, {
        facilityId,
        date: targetDate,
        timeSlot,
        durationHours: 1
      });
      assert.equal(newQuote.totalAmountPaise, 150000, 'New quote must reflect updated Rate B');
    });

    it('session extension persists immutable pricing snapshot in session_adjustments', async () => {
      const facilityId = 'fac_box_cricket_1';
      const bookingId = `TT-EXT-SNAP-${Date.now()}`;

      // Create an in-progress booking and session
      await dbAsync.run(
        `INSERT INTO bookings (id, facility_id, physical_facility_id, facility_name, customer_name, customer_phone, date, time_slot,
         duration, payment_type, amount_paid, payment_status, booking_status, scheduled_start_at, scheduled_end_at)
         VALUES (?, ?, ?, 'Box Cricket Turf 1', 'Extension Tester', '9898112233', '2026-10-24', '10:00 AM – 11:00 AM',
         1, 'FULL', '₹1000', 'Paid', 'IN_PROGRESS', '2026-10-24T04:30:00.000Z', '2026-10-24T05:30:00.000Z')`,
        [bookingId, facilityId, facilityId]
      );
      await dbAsync.run(
        `INSERT INTO facility_sessions (id, booking_id, facility_id, scheduled_start_at, scheduled_end_at, session_status)
         VALUES ('ses_${bookingId}', ?, ?, '2026-10-24T04:30:00.000Z', '2026-10-24T05:30:00.000Z', 'IN_PROGRESS')`,
        [bookingId, facilityId]
      );

      // Approve extension via HTTP endpoint
      const extRes = await fetch(`${baseUrl}/api/sessions/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          bookingId,
          extensionMinutes: 15,
          isFree: false,
        }),
      });

      assert.equal(extRes.status, 200);
      const extData = await extRes.json();
      assert.equal(extData.success, true);
      assert.ok(extData.resolvedChargePaise > 0);

      // Check session_adjustments table for persisted pricing_snapshot
      const adjRow = await dbAsync.get(
        'SELECT * FROM session_adjustments WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
        [`ses_${bookingId}`]
      );
      assert.ok(adjRow);
      assert.ok(adjRow.pricing_snapshot, 'session_adjustments must contain pricing_snapshot');
      const snap = JSON.parse(adjRow.pricing_snapshot);
      assert.equal(snap.isFree, false);
      assert.equal(snap.chargePaise, extData.resolvedChargePaise);
      assert.ok(snap.rateSource);
    });
  });

  /* ============================================================
     4. MIGRATION RECONCILIATION: BOOTSTRAP TARIFF REMOVED
     ============================================================ */
  describe('Blocker E: Migration Reconciliation & Production Safety', () => {
    it('migration 021 safely removes unconfirmed bootstrap aop_shooting_machine row', async () => {
      // Confirm that the bootstrap aop_shooting_machine row is absent from clean production state
      const row = await dbAsync.get(
        "SELECT * FROM add_on_prices WHERE id = 'aop_shooting_machine' AND rate_paise_per_hour = 20000"
      );
      assert.equal(row, null, 'Unconfirmed ₹200 bootstrap tariff must not be present in production truth');
    });

    it('admin-configured custom add-on pricing is preserved and functional', async () => {
      // Base rates for Green Net
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, is_active)
         VALUES ('pr_closeout_gn1_day', 'fac_green_net_1', 'BASE_RATE', 'DAY', 50000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 50000, is_active = 1`
      );
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, is_active)
         VALUES ('pr_closeout_gn1_wkday', 'fac_green_net_1', 'BASE_RATE', 'WEEKEND_DAY', 50000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 50000, is_active = 1`
      );
      // Explicit admin-configured add-on tariff
      await dbAsync.run(
        `INSERT INTO add_on_prices (id, add_on_id, facility_id, rate_paise_per_hour, is_active)
         VALUES ('admin_configured_shooting', 'addon_shooting_machine', 'fac_green_net_1', 25000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 25000, is_active = 1`
      );

      const quote = await resolvePricing(dbAsync, {
        facilityId: 'fac_green_net_1',
        addOnIds: ['addon_shooting_machine'],
        date: '2026-10-25',
        timeSlot: '09:00 AM – 10:00 AM',
        durationHours: 1,
      });

      assert.equal(quote.breakdown.addOnAmountPaise, 25000);
      assert.equal(quote.appliedRules.some(r => r.type === 'ADD_ON' && r.amountPaise === 25000), true);
    });
  });
});

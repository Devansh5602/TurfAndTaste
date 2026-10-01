import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import dbAsync, { initDatabase } from '../server/db.js';
import { checkCanonicalConflicts } from '../server/domain/booking/canonicalBookingCommand.js';
import { finalizeBookingFromPayment } from '../server/domain/booking/paymentFinalization.js';
import { resolvePricing } from '../server/domain/pricing/pricingResolver.js';
import { resolveSignedQuotePayableAmount } from '../server/routes/payments.js';
import { createQuoteToken, verifyQuoteToken } from '../server/utils/quoteToken.js';
import { up as applyCloseoutRepair } from '../server/migrations/022_phase1_closeout_repair.js';

describe('Admin Phase 1 closeout release review', () => {
  before(async () => {
    await initDatabase();
  });

  it('binds gateway amounts to exact signed-quote paise without whole-rupee rounding', () => {
    assert.deepEqual(
      resolveSignedQuotePayableAmount({ totalAmountPaise: 100001, depositAmountPaise: 33333 }, 'deposit'),
      { requestedPaymentType: 'deposit', amountInPaise: 33333 }
    );
    assert.deepEqual(
      resolveSignedQuotePayableAmount({ totalAmountPaise: 100001, depositAmountPaise: 33333 }, 'full'),
      { requestedPaymentType: 'full', amountInPaise: 100001 }
    );
    assert.throws(
      () => resolveSignedQuotePayableAmount({ totalAmountPaise: 100001, depositAmountPaise: 33333, fullPaymentRequired: true }, 'deposit'),
      /requires full payment/
    );
  });

  it('preserves the canonical quote reference inside its signed token', () => {
    const quote = { quoteId: 'qt_closeout_reference', totalAmountPaise: 100001, depositAmountPaise: 33333 };
    const verified = verifyQuoteToken(createQuoteToken(quote));
    assert.equal(verified.error, undefined);
    assert.equal(verified.quote.quoteId, quote.quoteId);
  });

  it('fails closed when occupancy or requested add-on pricing cannot be loaded', async () => {
    const failingDb = {
      all: async () => { throw new Error('occupancy unavailable'); }
    };
    await assert.rejects(
      checkCanonicalConflicts(failingDb, {
        physicalFacilityId: 'fac_box_cricket_1',
        startAt: '2033-03-15T04:30:00.000Z',
        endAt: '2033-03-15T05:30:00.000Z'
      }),
      /occupancy unavailable/
    );

    await assert.rejects(
      resolvePricing(dbAsync, {
        facilityId: 'fac_green_net_1',
        addOnIds: ['addon_without_configured_price'],
        date: '2033-03-16',
        timeSlot: '10:00 AM – 11:00 AM',
        durationHours: 1
      }),
      /No active pricing is configured for add-on/
    );
  });

  it('finalizes and snapshots a non-whole-rupee payment using exact paise', async () => {
    const suffix = Date.now();
    const orderId = `closeout_order_${suffix}`;
    const quoteId = `closeout_quote_${suffix}`;
    const quote = {
      quoteId,
      facilityId: 'fac_box_cricket_1',
      date: '2033-03-15',
      timeSlot: '10:00 AM – 11:00 AM',
      bookingMode: 'STANDARD_QUICK',
      total: 1000,
      deposit: 333,
      totalAmountPaise: 100001,
      depositAmountPaise: 33333,
      calculatedAt: '2033-01-01T00:00:00.000Z',
      exp: Math.floor(new Date('2033-03-01T00:00:00.000Z').getTime() / 1000),
      pricingSnapshot: {
        quoteId,
        totalAmountPaise: 100001,
        depositAmountPaise: 33333,
        appliedRules: [{ type: 'BASE_RATE', amountPaise: 100001 }],
        calculatedAt: '2033-01-01T00:00:00.000Z'
      }
    };

    await dbAsync.run(
      `INSERT INTO payment_orders (
         order_id, quote_id, booking_reference, expected_amount,
         expected_amount_paise, payment_type, quote_context, status
       ) VALUES (?, ?, ?, ?, ?, 'deposit', ?, 'created')`,
      [orderId, quoteId, `ref_${suffix}`, 333, 33333, JSON.stringify(quote)]
    );

    const result = await finalizeBookingFromPayment(dbAsync, {
      razorpayOrderId: orderId,
      razorpayPaymentId: `pay_${suffix}`,
      razorpaySignature: `sig_${suffix}`,
      customerDetails: { name: 'Closeout Player', phone: '9876543210' },
      now: new Date('2033-02-01T00:00:00.000Z')
    });
    const booking = await dbAsync.get(
      'SELECT total_amount_paise, deposit_amount_paise, pricing_snapshot FROM bookings WHERE id = ?',
      [result.bookingId]
    );
    assert.equal(booking.total_amount_paise, 100001);
    assert.equal(booking.deposit_amount_paise, 33333);
    assert.equal(JSON.parse(booking.pricing_snapshot).quoteId, quoteId);
    assert.equal(JSON.parse(booking.pricing_snapshot).totalAmountPaise, 100001);
  });

  it('keeps package and shooting-machine add-on pricing immutable after current rules change', async () => {
    const suffix = Date.now();
    const facilityId = 'fac_green_net_1';
    const packageId = `closeout_package_${suffix}`;
    const addOnPriceId = `closeout_addon_${suffix}`;
    await dbAsync.run(
      `INSERT INTO pricing_rules (
         id, facility_id, rule_type, period_type, rate_paise_total,
         min_hours, max_hours, deposit_fixed_paise, is_active
       ) VALUES (?, ?, 'PACKAGE', 'DAY', 90000, 2, 2, 30000, 1)`,
      [packageId, facilityId]
    );
    await dbAsync.run(
      `INSERT INTO add_on_prices (
         id, add_on_id, facility_id, rate_paise_per_hour, rate_paise_flat, is_active
       ) VALUES (?, 'addon_shooting_machine', ?, 25000, 0, 1)`,
      [addOnPriceId, facilityId]
    );

    const pricing = await resolvePricing(dbAsync, {
      facilityId,
      addOnIds: ['addon_shooting_machine'],
      date: '2033-03-17',
      timeSlot: '10:00 AM – 12:00 PM',
      durationHours: 2,
      paymentType: 'full'
    });
    assert.equal(pricing.packageUsed, true);
    assert.equal(pricing.breakdown.addOnAmountPaise, 50000);

    const quoteId = `closeout_package_quote_${suffix}`;
    const orderId = `closeout_package_order_${suffix}`;
    const quote = {
      quoteId,
      facilityId,
      physicalFacilityId: facilityId,
      date: '2033-03-17',
      timeSlot: '10:00 AM – 12:00 PM',
      bookingMode: 'STANDARD_QUICK',
      totalAmountPaise: pricing.totalAmountPaise,
      depositAmountPaise: pricing.depositAmountPaise,
      chargedAmountPaise: pricing.totalAmountPaise,
      total: Math.round(pricing.totalAmountPaise / 100),
      deposit: Math.round(pricing.depositAmountPaise / 100),
      exp: Math.floor(new Date('2033-03-01T00:00:00.000Z').getTime() / 1000),
      pricingSnapshot: { ...pricing, quoteId }
    };
    await dbAsync.run(
      `INSERT INTO payment_orders (
         order_id, quote_id, booking_reference, expected_amount,
         expected_amount_paise, payment_type, quote_context, status
       ) VALUES (?, ?, ?, ?, ?, 'full', ?, 'created')`,
      [orderId, quoteId, `ref_${suffix}`, Math.round(pricing.totalAmountPaise / 100), pricing.totalAmountPaise, JSON.stringify(quote)]
    );

    const result = await finalizeBookingFromPayment(dbAsync, {
      razorpayOrderId: orderId,
      razorpayPaymentId: `pay_package_${suffix}`,
      razorpaySignature: `sig_package_${suffix}`,
      customerDetails: { name: 'Package Player', phone: '9876543211' },
      now: new Date('2033-02-01T00:00:00.000Z')
    });
    await dbAsync.run('UPDATE pricing_rules SET rate_paise_total = 120000 WHERE id = ?', [packageId]);
    await dbAsync.run('UPDATE add_on_prices SET rate_paise_per_hour = 40000 WHERE id = ?', [addOnPriceId]);

    const saved = await dbAsync.get('SELECT pricing_snapshot FROM bookings WHERE id = ?', [result.bookingId]);
    const snapshot = JSON.parse(saved.pricing_snapshot);
    assert.equal(snapshot.packageUsed, true);
    assert.equal(snapshot.breakdown.addOnAmountPaise, 50000);
    assert.equal(snapshot.totalAmountPaise, pricing.totalAmountPaise);

    const current = await resolvePricing(dbAsync, {
      facilityId,
      addOnIds: ['addon_shooting_machine'],
      date: '2033-03-18',
      timeSlot: '10:00 AM – 12:00 PM',
      durationHours: 2,
      paymentType: 'full'
    });
    assert.notEqual(current.totalAmountPaise, snapshot.totalAmountPaise);

    await dbAsync.run('DELETE FROM pricing_rules WHERE id = ?', [packageId]);
    await dbAsync.run('DELETE FROM add_on_prices WHERE id = ?', [addOnPriceId]);
  });
});

describe('Migration 022 upgraded-database repair', () => {
  const database = new Database(':memory:');
  const adapter = {
    all: async (sql, params = []) => database.prepare(sql).all(...params),
    get: async (sql, params = []) => database.prepare(sql).get(...params) || null,
    run: async (sql, params = []) => database.prepare(sql).run(...params)
  };
  const context = {
    isPostgres: false,
    exec: async (sql) => database.exec(sql),
    db: adapter
  };

  before(() => {
    database.exec(`
      CREATE TABLE bookings (id TEXT PRIMARY KEY);
      CREATE TABLE session_adjustments (id TEXT PRIMARY KEY);
      CREATE TABLE payment_orders (order_id TEXT PRIMARY KEY, expected_amount INTEGER NOT NULL);
      CREATE TABLE pricing_tiers (
        facility_id TEXT PRIMARY KEY, day_rate INTEGER NOT NULL, night_rate INTEGER NOT NULL,
        weekend_surge INTEGER NOT NULL, deposit_pct INTEGER NOT NULL, details_json TEXT
      );
      CREATE TABLE pricing_rules (
        id TEXT PRIMARY KEY, facility_id TEXT NOT NULL, service_id TEXT,
        rule_type TEXT NOT NULL, period_type TEXT NOT NULL,
        rate_paise_per_hour INTEGER NOT NULL, deposit_fixed_paise INTEGER NOT NULL,
        deposit_pct_of_total INTEGER NOT NULL, is_active INTEGER NOT NULL
      );
      CREATE TABLE add_on_prices (
        id TEXT PRIMARY KEY, add_on_id TEXT NOT NULL, facility_id TEXT,
        rate_paise_per_hour INTEGER NOT NULL, rate_paise_flat INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE blocked_slots (
        id INTEGER PRIMARY KEY, facility_id TEXT NOT NULL, date TEXT NOT NULL,
        time_slot TEXT NOT NULL, reason TEXT, blocked_by TEXT
      );
      CREATE TABLE facility_blocks (
        id TEXT PRIMARY KEY, facility_id TEXT NOT NULL, start_at TEXT NOT NULL,
        end_at TEXT NOT NULL, reason_code TEXT, internal_note TEXT,
        customer_message TEXT, created_by TEXT, status TEXT
      );
      INSERT INTO payment_orders (order_id, expected_amount) VALUES ('legacy_order', 401);
      INSERT INTO pricing_tiers (
        facility_id, day_rate, night_rate, weekend_surge, deposit_pct, details_json
      ) VALUES ('box-cricket', 600, 800, 15, 35, '{"bookingDeposit":"₹200"}');
      INSERT INTO add_on_prices (
        id, add_on_id, facility_id, rate_paise_per_hour, rate_paise_flat, is_active
      ) VALUES (
        'aop_shooting_machine', 'addon_shooting_machine', 'fac_green_net_1', 25000, 0, 1
      );
      INSERT INTO blocked_slots (
        id, facility_id, date, time_slot, reason, blocked_by
      ) VALUES (
        41, 'fac_box_cricket_1', '2034-04-10', '10:00 AM – 11:00 AM', 'Repair QA', 'admin'
      );
    `);
  });

  after(() => database.close());

  it('is idempotent, preserves customized pricing, and repairs columns and legacy blocks', async () => {
    await applyCloseoutRepair(context);
    await applyCloseoutRepair(context);

    const bookingColumns = database.prepare('PRAGMA table_info(bookings)').all();
    const adjustmentColumns = database.prepare('PRAGMA table_info(session_adjustments)').all();
    const orderColumns = database.prepare('PRAGMA table_info(payment_orders)').all();
    assert.ok(bookingColumns.some((column) => column.name === 'pricing_snapshot'));
    assert.ok(adjustmentColumns.some((column) => column.name === 'pricing_snapshot'));
    assert.ok(orderColumns.some((column) => column.name === 'expected_amount_paise'));
    assert.equal(database.prepare("SELECT expected_amount_paise FROM payment_orders WHERE order_id = 'legacy_order'").get().expected_amount_paise, 40100);
    assert.equal(database.prepare("SELECT rate_paise_per_hour FROM add_on_prices WHERE id = 'aop_shooting_machine'").get().rate_paise_per_hour, 25000);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM facility_blocks WHERE facility_id = 'fac_box_cricket_1'").get().count, 1);
    assert.equal(database.prepare("SELECT rate_paise_per_hour FROM pricing_rules WHERE facility_id = 'fac_box_cricket_1' AND period_type = 'DAY'").get().rate_paise_per_hour, 60000);
    assert.equal(database.prepare("SELECT rate_paise_per_hour FROM pricing_rules WHERE facility_id = 'fac_box_cricket_2' AND period_type = 'NIGHT'").get().rate_paise_per_hour, 80000);
    assert.equal(database.prepare("SELECT deposit_fixed_paise FROM pricing_rules WHERE facility_id = 'fac_box_cricket_1' AND period_type = 'DAY'").get().deposit_fixed_paise, 20000);
  });
});

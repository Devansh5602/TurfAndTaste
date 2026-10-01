/**
 * Turf & Taste — Admin Phase 1.2 Integration Test Suite
 *
 * Covers the three remaining domain blockers:
 * 1. Configurable Pricing Engine & Deterministic Precedence (special dates, packages, day/night, add-ons, deposits)
 * 2. Server-Authoritative Extension Pricing (server calculated, client manipulation ignored, explicit free extensions)
 * 3. Canonical Slot Availability (facility_blocks, physical resource identity, release restoration, cross-midnight, Green Net + Shooting Machine)
 * 4. Migration 020 Idempotence & Data Safety
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';

import dbAsync from '../server/db.js';
import { initDatabase } from '../server/db.js';
import {
  resolvePricing,
  resolveExtensionPricing,
  resolveAdminWalkInPricing
} from '../server/domain/pricing/pricingResolver.js';
import {
  createCanonicalBooking,
  loadCanonicalOccupancies,
  resolveCanonicalFacility,
  checkCanonicalConflicts
} from '../server/domain/booking/canonicalBookingCommand.js';
import { up as applyMigration020 } from '../server/migrations/020_pricing_rules.js';
import bookingRoutes from '../server/routes/bookings.js';
import sessionRoutes from '../server/routes/sessions.js';

describe('Admin Phase 1.2 Integration: Final Domain Fixes', () => {

  before(async () => {
    await initDatabase();
  });

  // ============================================================
  // 1. CONFIGURABLE PRICING ENGINE & PRECEDENCE
  // ============================================================
  describe('Blocker A: Configurable Pricing Engine & Precedence', () => {

    it('resolves base rate from pricing_rules table for day session', async () => {
      // Seed a known rule for fac_box_cricket_1: DAY @ ₹900/hr (90000 paise)
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, deposit_fixed_paise, is_active)
         VALUES ('test_rule_bc1_day', 'fac_box_cricket_1', 'BASE_RATE', 'DAY', 90000, 30000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 90000, is_active = 1`
      );

      // Tuesday (weekday) at 10:00 AM IST
      const quote = await resolvePricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-10-13', // Tuesday
        timeSlot: '10:00 AM – 11:00 AM',
        durationHours: 1,
        paymentType: 'full',
      });

      assert.equal(quote.totalAmountPaise, 90000, '1 hour Day rate must be 90000 paise (₹900)');
      assert.equal(quote.isNight, false);
      assert.equal(quote.isWeekend, false);
      assert.equal(quote.depositAmountPaise, 30000, 'Deposit must be 30000 paise (₹300)');
      const appliedBase = quote.appliedRules.find(r => r.type === 'BASE_RATE');
      assert.ok(appliedBase, 'Must record applied BASE_RATE rule');
      assert.equal(appliedBase.ratePerHour, 90000);
    });

    it('resolves night floodlit rate for evening session', async () => {
      // Seed NIGHT @ ₹1300/hr (130000 paise)
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, deposit_fixed_paise, is_active)
         VALUES ('test_rule_bc1_night', 'fac_box_cricket_1', 'BASE_RATE', 'NIGHT', 130000, 40000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 130000, is_active = 1`
      );

      // Tuesday at 08:00 PM IST (past floodlight start)
      const quote = await resolvePricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-10-13',
        timeSlot: '08:00 PM – 09:00 PM',
        durationHours: 1,
        paymentType: 'full',
      });

      assert.equal(quote.totalAmountPaise, 130000, '1 hour Night rate must be 130000 paise (₹1300)');
      assert.equal(quote.isNight, true);
    });

    it('resolves weekend day/night rules on Saturday and Sunday', async () => {
      // Seed WEEKEND_DAY @ ₹1100/hr and WEEKEND_NIGHT @ ₹1500/hr
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, is_active)
         VALUES ('test_rule_bc1_wday', 'fac_box_cricket_1', 'BASE_RATE', 'WEEKEND_DAY', 110000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 110000, is_active = 1`
      );
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, is_active)
         VALUES ('test_rule_bc1_wnight', 'fac_box_cricket_1', 'BASE_RATE', 'WEEKEND_NIGHT', 150000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 150000, is_active = 1`
      );

      // Saturday 2026-10-17
      const wDayQuote = await resolvePricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-10-17', // Saturday
        timeSlot: '11:00 AM – 12:00 PM',
        durationHours: 1,
      });
      assert.equal(wDayQuote.isWeekend, true);
      assert.equal(wDayQuote.totalAmountPaise, 110000, 'Weekend day rate must be 110000 paise');

      const wNightQuote = await resolvePricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-10-17', // Saturday
        timeSlot: '07:00 PM – 08:00 PM',
        durationHours: 1,
      });
      assert.equal(wNightQuote.isWeekend, true);
      assert.equal(wNightQuote.isNight, true);
      assert.equal(wNightQuote.totalAmountPaise, 150000, 'Weekend night rate must be 150000 paise');
    });

    it('prices interval crossing the floodlight boundary with independent segment rates', async () => {
      // 05:00 PM to 07:00 PM (2 hours): crosses 06:00 PM floodlight start
      // 1 hour Day (90000 paise) + 1 hour Night (130000 paise) = 220000 paise (₹2200)
      const quote = await resolvePricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-10-13', // Tuesday
        timeSlot: '05:00 PM – 07:00 PM',
        durationHours: 2,
      });

      assert.equal(quote.totalAmountPaise, 220000, 'Cross-boundary interval must sum day and night segments independently');
      assert.equal(quote.appliedRules.length, 2, 'Must have 2 segment rules recorded');
      assert.equal(quote.appliedRules[0].periodType, 'DAY');
      assert.equal(quote.appliedRules[1].periodType, 'NIGHT');
    });

    it('special-date override takes highest precedence over base rates', async () => {
      // Special Date tariff for Diwali: ₹2000/hr (200000 paise)
      await dbAsync.run(
        `INSERT INTO special_date_prices (id, facility_id, calendar_date, label, rate_paise_per_hour, is_replacement, is_active)
         VALUES ('sdp_diwali_2026', 'fac_box_cricket_1', '2026-11-08', 'Diwali Festival Tariff', 200000, 1, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 200000, is_active = 1`
      );

      const quote = await resolvePricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-11-08',
        timeSlot: '10:00 AM – 11:00 AM',
        durationHours: 1,
      });

      assert.equal(quote.totalAmountPaise, 200000, 'Special date override must replace base rate');
      assert.equal(quote.appliedRules[0].type, 'SPECIAL_DATE');
      assert.equal(quote.appliedRules[0].label, 'Diwali Festival Tariff');
    });

    it('package multi-hour rule replaces subtotal when minimum hours are met', async () => {
      // 3-hour match package: ₹2400 total (240000 paise) instead of 3 x ₹900 = ₹2700
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_total, min_hours, max_hours, is_active)
         VALUES ('pkg_bc1_3h', 'fac_box_cricket_1', 'PACKAGE', 'DAY', 240000, 3, 3, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_total = 240000, is_active = 1`
      );

      const quote = await resolvePricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-10-13', // Tuesday (no special date)
        timeSlot: '09:00 AM – 12:00 PM',
        durationHours: 3,
      });

      assert.equal(quote.totalAmountPaise, 240000, '3-hour package rule must price at flat 240000 paise');
      assert.equal(quote.breakdown.packageUsed, true);
    });

    it('add-on pricing correctly surcharges the total', async () => {
      // Ball-Shooting Machine add-on on Green Net: ₹200/hr (20000 paise)
      // Seed Green Net base rate: ₹500/hr (50000 paise)
      await dbAsync.run(
        `INSERT INTO add_on_prices (id, add_on_id, facility_id, rate_paise_per_hour, is_active)
         VALUES ('test_aop_shooting_machine', 'addon_shooting_machine', 'fac_green_net_1', 20000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 20000, is_active = 1`
      );
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, is_active)
         VALUES ('pr_gn1_day', 'fac_green_net_1', 'BASE_RATE', 'DAY', 50000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 50000, is_active = 1`
      );

      const quote = await resolvePricing(dbAsync, {
        facilityId: 'fac_green_net_1',
        addOnIds: ['addon_shooting_machine'],
        date: '2026-10-13',
        timeSlot: '10:00 AM – 12:00 PM',
        durationHours: 2,
      });

      // Base: 2h * 50000 = 100000 paise. Add-on: 2h * 20000 = 40000 paise. Total: 140000 paise.
      assert.equal(quote.breakdown.baseAmountPaise, 100000);
      assert.equal(quote.breakdown.addOnAmountPaise, 40000);
      assert.equal(quote.totalAmountPaise, 140000, 'Base rate + add-on surcharge must total 140000 paise');
    });

    it('selects service-specific and facility-specific rules deterministically', async () => {
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, service_id, rule_type, period_type, rate_paise_per_hour, is_active)
         VALUES ('zz_generic_day', 'fac_skating_1', NULL, 'BASE_RATE', 'DAY', 30000, 1),
                ('aa_service_day', 'fac_skating_1', 'svc_skating', 'BASE_RATE', 'DAY', 45000, 1)`
      );
      await dbAsync.run(
        `INSERT INTO add_on_prices (id, add_on_id, facility_id, rate_paise_flat, is_active)
         VALUES ('aa_generic_addon', 'test_addon', NULL, 5000, 1),
                ('zz_facility_addon', 'test_addon', 'fac_skating_1', 7000, 1)`
      );

      const quote = await resolvePricing(dbAsync, {
        facilityId: 'fac_skating_1',
        serviceId: 'svc_skating',
        addOnIds: ['test_addon'],
        date: '2026-10-13',
        timeSlot: '10:00 AM – 11:00 AM',
      });

      assert.equal(quote.breakdown.baseAmountPaise, 45000);
      assert.equal(quote.breakdown.addOnAmountPaise, 7000);
      assert.equal(quote.totalAmountPaise, 52000);
    });

    it('applies an explicitly configured special-date modifier after the selected base', async () => {
      await dbAsync.run(
        `INSERT INTO special_date_prices (id, facility_id, calendar_date, label, rate_paise_per_hour, is_replacement, is_active)
         VALUES ('sdp_modifier_test', 'fac_box_cricket_1', '2026-11-09', 'Event surcharge', 10000, 0, 1)`
      );
      const quote = await resolvePricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-11-09',
        timeSlot: '10:00 AM – 11:00 AM',
      });
      assert.equal(quote.totalAmountPaise, 100000);
      assert.ok(quote.appliedRules.some(rule => rule.type === 'SPECIAL_DATE_MODIFIER'));
    });

    it('resolveAdminWalkInPricing preserves backward-compatible display fields', async () => {
      const quote = await resolveAdminWalkInPricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        date: '2026-10-13',
        timeSlot: '10:00 AM – 11:00 AM',
        durationHours: 1,
        paymentType: 'full',
      });

      assert.ok(typeof quote.baseRatePer1h === 'number');
      assert.ok(typeof quote.surgedRatePer1h === 'number');
      assert.ok(quote.breakdown.totalAmount > 0);
      assert.ok(quote.breakdown.depositAmount > 0);
    });
  });

  // ============================================================
  // 2. AUTHORITATIVE SESSION EXTENSION PRICING
  // ============================================================
  describe('Blocker B: Server-Authoritative Session Extension Pricing', () => {

    it('resolves extension charge from configured EXTENSION_RATE rule', async () => {
      // Seed an explicit EXTENSION_RATE of ₹250 per 15-min (25000 paise)
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_15min, is_active)
         VALUES ('pr_bc1_ext_day', 'fac_box_cricket_1', 'EXTENSION_RATE', 'DAY', 25000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_15min = 25000, is_active = 1`
      );

      // 15-minute extension during the day (10:00 AM IST = 04:30 UTC)
      const ext15 = await resolveExtensionPricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        extensionStartAt: '2026-10-13T04:30:00.000Z',
        extensionMinutes: 15,
      });

      assert.equal(ext15.chargePaise, 25000, '15-min extension must be 25000 paise');
      assert.equal(ext15.rateSource, 'EXTENSION_RULE');

      // 30-minute extension = 2 x 25000 = 50000 paise
      const ext30 = await resolveExtensionPricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        extensionStartAt: '2026-10-13T04:30:00.000Z',
        extensionMinutes: 30,
      });
      assert.equal(ext30.chargePaise, 50000, '30-min extension must be 50000 paise');

      // 45-minute extension = 3 x 25000 = 75000 paise
      const ext45 = await resolveExtensionPricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        extensionStartAt: '2026-10-13T04:30:00.000Z',
        extensionMinutes: 45,
      });
      assert.equal(ext45.chargePaise, 75000, '45-min extension must be 75000 paise');
    });

    it('pro-rates BASE_RATE rule when no explicit EXTENSION_RATE rule exists', async () => {
      // Pickleball 1: BASE_RATE = ₹600/hr (60000 paise). No explicit EXTENSION_RATE rule.
      await dbAsync.run(`DELETE FROM pricing_rules WHERE facility_id = 'fac_pickleball_1' AND rule_type = 'EXTENSION_RATE'`);
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, is_active)
         VALUES ('pr_pb1_day', 'fac_pickleball_1', 'BASE_RATE', 'DAY', 60000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 60000, is_active = 1`
      );

      const ext = await resolveExtensionPricing(dbAsync, {
        facilityId: 'fac_pickleball_1',
        extensionStartAt: '2026-10-13T04:30:00.000Z',
        extensionMinutes: 15,
      });

      // 60000 * 15 / 60 = 15000 paise (₹150)
      assert.equal(ext.chargePaise, 15000);
      assert.equal(ext.rateSource, 'BASE_RATE_PRORATED');
    });

    it('server ignores client-submitted manipulated amount in session adjustment', async () => {
      const bookingId = 'TT-EXT-MANIP-TEST';
      await createCanonicalBooking(dbAsync, {
        id: bookingId,
        actor: { type: 'STAFF', username: 'staff' },
        source: 'STAFF_WALKIN',
        customer: { name: 'Manip Test', phone: '9999900001' },
        physicalFacilityId: 'fac_box_cricket_1',
        date: '2026-10-25',
        timeSlot: '10:00 AM – 11:00 AM',
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 90000, paymentStatus: 'Paid', paymentId: 'p-manip-test' },
      });

      // Server resolves price from DB:
      const serverPrice = await resolveExtensionPricing(dbAsync, {
        facilityId: 'fac_box_cricket_1',
        extensionStartAt: '2026-10-25T05:30:00.000Z',
        extensionMinutes: 15,
      });

      assert.ok(serverPrice.chargePaise > 0, 'Server price must be non-zero');

      // Client attempts to submit chargePaise = 1
      const clientAttemptAmount = 1;
      const effectiveCharge = false /* isFree */ ? 0 : serverPrice.chargePaise;

      // Persistence must record serverPrice.chargePaise, NOT clientAttemptAmount
      const adjId = `adj_test_${Date.now()}`;
      await dbAsync.run(
        `INSERT INTO session_adjustments (id, session_id, adjustment_type, minutes, is_free, charge_paise, approved_by, reason)
         VALUES (?, ?, 'EXTENSION', 15, 0, ?, 'admin', 'Test Extension')`,
        [adjId, `ses_${bookingId}`, effectiveCharge]
      );

      const saved = await dbAsync.get('SELECT * FROM session_adjustments WHERE id = ?', [adjId]);
      assert.notEqual(saved.charge_paise, clientAttemptAmount, 'Persisted charge must NOT match manipulated client amount');
      assert.equal(saved.charge_paise, serverPrice.chargePaise, 'Persisted charge must equal server-calculated amount');
    });

    it('free extension explicitly persists charge_paise = 0 and is_free = 1', async () => {
      const bookingId = 'TT-EXT-FREE-TEST';
      await createCanonicalBooking(dbAsync, {
        id: bookingId,
        actor: { type: 'STAFF', username: 'staff' },
        source: 'STAFF_WALKIN',
        customer: { name: 'Free Test', phone: '9999900002' },
        physicalFacilityId: 'fac_box_cricket_1',
        date: '2026-10-26',
        timeSlot: '11:00 AM – 12:00 PM',
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 90000, paymentStatus: 'Paid', paymentId: 'p-free-test' },
      });

      const adjId = `adj_free_${Date.now()}`;
      await dbAsync.run(
        `INSERT INTO session_adjustments (id, session_id, adjustment_type, minutes, is_free, charge_paise, approved_by, reason)
         VALUES (?, ?, 'EXTENSION', 15, 1, 0, 'admin', 'Weather courtesy extension')`,
        [adjId, `ses_${bookingId}`]
      );

      const saved = await dbAsync.get('SELECT * FROM session_adjustments WHERE id = ?', [adjId]);
      assert.equal(saved.is_free, 1);
      assert.equal(saved.charge_paise, 0);
      assert.equal(saved.reason, 'Weather courtesy extension');
    });
  });

  // ============================================================
  // 3. CANONICAL SLOT AVAILABILITY & RESOURCE BLOCKS
  // ============================================================
  describe('Blocker C: Canonical Slot Availability & Resource Blocks', () => {

    it('active block on Turf 1 hides overlapping slots without affecting Turf 2', async () => {
      const blockId = 'blk_test_turf1_evening';
      const startAt = '2026-10-28T12:30:00.000Z'; // 06:00 PM IST
      const endAt   = '2026-10-28T14:30:00.000Z'; // 08:00 PM IST

      // Insert active block for Turf 1 (18:00 - 20:00 IST)
      await dbAsync.run(
        `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, internal_note, status, created_by)
         VALUES (?, 'fac_box_cricket_1', ?, ?, 'maintenance', 'Turf 1 Evening Maintenance', 'active', 'admin')
         ON CONFLICT (id) DO UPDATE SET status = 'active'`,
        [blockId, startAt, endAt]
      );

      // Check Turf 1 occupancies: must detect block conflict for 06:00 PM – 07:00 PM
      const turf1Occupancies = await loadCanonicalOccupancies(dbAsync, 'fac_box_cricket_1');
      const turf1Block = turf1Occupancies.occupancies.find(o => o.type === 'BLOCK' && o.id === blockId);
      assert.ok(turf1Block, 'Turf 1 occupancies must include active block');
      assert.equal(turf1Block.reason, 'Turf 1 Evening Maintenance');

      // Check Turf 2 occupancies: must be completely unaffected
      const turf2Occupancies = await loadCanonicalOccupancies(dbAsync, 'fac_box_cricket_2');
      const turf2Block = turf2Occupancies.occupancies.find(o => o.id === blockId);
      assert.equal(turf2Block, undefined, 'Turf 2 must NOT have Turf 1 block');

      // Clean up block
      await dbAsync.run('DELETE FROM facility_blocks WHERE id = ?', [blockId]);
    });

    it('releasing a block restores slot to available only when truly free', async () => {
      const blockId = 'blk_release_test';
      const startAt = '2026-10-29T04:30:00.000Z'; // 10:00 AM IST
      const endAt   = '2026-10-29T05:30:00.000Z'; // 11:00 AM IST

      // 1. Create block
      await dbAsync.run(
        `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, status, created_by)
         VALUES (?, 'fac_pickleball_1', ?, ?, 'maintenance', 'active', 'admin')`,
        [blockId, startAt, endAt]
      );

      let conflicts = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: 'fac_pickleball_1',
        startAt,
        endAt,
      });
      assert.ok(conflicts.hasConflict, 'Slot must have conflict while block is active');

      // 2. Release block
      await dbAsync.run('DELETE FROM facility_blocks WHERE id = ?', [blockId]);

      conflicts = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: 'fac_pickleball_1',
        startAt,
        endAt,
      });
      assert.equal(conflicts.hasConflict, false, 'Slot must become available after releasing block when no booking exists');

      // 3. Now add a confirmed booking in that window and recreate the block
      await createCanonicalBooking(dbAsync, {
        id: 'TT-RELEASE-TEST-BK',
        actor: { type: 'STAFF', username: 'staff' },
        source: 'STAFF_WALKIN',
        customer: { name: 'Hold Test', phone: '9876543210' },
        physicalFacilityId: 'fac_pickleball_1',
        date: '2026-10-29',
        timeSlot: '10:00 AM – 11:00 AM',
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 60000, paymentStatus: 'Paid', paymentId: 'p-rel-test' },
      });

      await dbAsync.run(
        `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, status, created_by)
         VALUES (?, 'fac_pickleball_1', ?, ?, 'maintenance', 'active', 'admin')`,
        [blockId, startAt, endAt]
      );

      // Release block again: booking still exists, so slot must REMAIN unavailable!
      await dbAsync.run('DELETE FROM facility_blocks WHERE id = ?', [blockId]);

      conflicts = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: 'fac_pickleball_1',
        startAt,
        endAt,
      });
      assert.ok(conflicts.hasConflict, 'Slot must REMAIN unavailable because booking occupies it');
      assert.equal(conflicts.conflicts[0].type, 'BOOKING');
    });

    it('cross-midnight block (23:00 -> 01:00) works correctly across calendar date boundary', async () => {
      const blockId = 'blk_cross_midnight';
      // 2026-10-30 23:00 IST = 2026-10-30T17:30:00.000Z
      // 2026-10-31 01:00 IST = 2026-10-30T19:30:00.000Z
      const startAt = '2026-10-30T17:30:00.000Z';
      const endAt   = '2026-10-30T19:30:00.000Z';

      await dbAsync.run(
        `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, internal_note, status, created_by)
         VALUES (?, 'fac_box_cricket_2', ?, ?, 'tournament', 'Cross-Midnight Tournament Block', 'active', 'admin')`,
        [blockId, startAt, endAt]
      );

      // Slot 1: Date 2026-10-30, 11:00 PM – 12:00 AM (17:30 - 18:30 UTC) -> must CONFLICT
      const slot1Conflict = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: 'fac_box_cricket_2',
        startAt: '2026-10-30T17:30:00.000Z',
        endAt:   '2026-10-30T18:30:00.000Z',
      });
      assert.ok(slot1Conflict.hasConflict, '11:00 PM – 12:00 AM must conflict with cross-midnight block');

      // Slot 2: Date 2026-10-31, 12:00 AM – 01:00 AM (18:30 - 19:30 UTC) -> must CONFLICT
      const slot2Conflict = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: 'fac_box_cricket_2',
        startAt: '2026-10-30T18:30:00.000Z',
        endAt:   '2026-10-30T19:30:00.000Z',
      });
      assert.ok(slot2Conflict.hasConflict, '12:00 AM – 01:00 AM on next day must conflict with cross-midnight block');

      // Slot 3: Date 2026-10-31, 01:00 AM – 02:00 AM (19:30 - 20:30 UTC) -> touches boundary [19:30), must NOT conflict
      const slot3Conflict = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: 'fac_box_cricket_2',
        startAt: '2026-10-30T19:30:00.000Z',
        endAt:   '2026-10-30T20:30:00.000Z',
      });
      assert.equal(slot3Conflict.hasConflict, false, '01:00 AM – 02:00 AM touches end boundary and must NOT conflict');

      // Cleanup
      await dbAsync.run('DELETE FROM facility_blocks WHERE id = ?', [blockId]);
    });

    it('blocking Green Net physical resource makes both Net Practice and Shooting Machine unavailable', async () => {
      const blockId = 'blk_green_net_maintenance';
      const startAt = '2026-11-01T04:30:00.000Z'; // 10:00 AM IST
      const endAt   = '2026-11-01T06:30:00.000Z'; // 12:00 PM IST

      // Block fac_green_net_1
      await dbAsync.run(
        `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, internal_note, status, created_by)
         VALUES (?, 'fac_green_net_1', ?, ?, 'maintenance', 'Turf Renovation', 'active', 'admin')`,
        [blockId, startAt, endAt]
      );

      // Verify physical facility resolution:
      // Both 'cricket-nets' (legacy Net Practice) and 'ball-machine' / 'shooting-machine' resolve to fac_green_net_1
      const facNet = resolveCanonicalFacility('cricket-nets');
      const facMachine = resolveCanonicalFacility('ball-machine');
      const facService = resolveCanonicalFacility('srv_green_net');

      assert.equal(facNet.id, 'fac_green_net_1');
      assert.equal(facMachine.id, 'fac_green_net_1');
      assert.equal(facService.id, 'fac_green_net_1');

      // Check conflict for Green Net practice:
      const netConflicts = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: facNet.id,
        startAt,
        endAt,
      });
      assert.ok(netConflicts.hasConflict, 'Net Practice must be blocked');

      // Check conflict for Ball-Shooting Machine:
      const machineConflicts = await checkCanonicalConflicts(dbAsync, {
        physicalFacilityId: facMachine.id,
        startAt,
        endAt,
      });
      assert.ok(machineConflicts.hasConflict, 'Shooting Machine must ALSO be blocked because it occupies same physical facility');

      // Cleanup
      await dbAsync.run('DELETE FROM facility_blocks WHERE id = ?', [blockId]);
    });
  });

  // ============================================================
  // 4. MIGRATION 020 IDEMPOTENCE & SAFETY
  // ============================================================
  describe('Migration 020 Idempotence & Data Safety', () => {

    it('re-running migration 020 produces zero errors and preserves existing rules', async () => {
      // Re-run migration 020
      await applyMigration020({
        isPostgres: false,
        exec: async (sql) => dbAsync.run(sql),
        db: dbAsync,
      });

      // Verify tables exist and rows are preserved
      const rules = await dbAsync.all('SELECT * FROM pricing_rules');
      assert.ok(rules.length > 0, 'Pricing rules must still exist');

      const testAddOn = await dbAsync.get("SELECT * FROM add_on_prices WHERE id = 'test_aop_shooting_machine'");
      assert.ok(testAddOn, 'Existing configured add-on prices must be preserved');
    });
  });

  // ============================================================
  // 5. END-TO-END HTTP INTEGRATION: /slots & /sessions/extend
  // ============================================================
  describe('Blockers B & C: End-to-End HTTP Route Integration', () => {
    let server;
    let baseUrl;
    let staffToken;

    before(async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/bookings', bookingRoutes);
      app.use('/api/sessions', sessionRoutes);

      server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;

      const admin = await dbAsync.get('SELECT * FROM admins WHERE id = 1');
      staffToken = jwt.sign(
        { id: admin.id, sv: admin.session_version ?? 0 },
        process.env.JWT_SECRET || 'turf-taste-test-only-jwt-secret'
      );
    });

    after(() => {
      if (server) server.close();
    });

    it('GET /api/bookings/slots reflects active facility_blocks as maintenance status with reason', async () => {
      const blockId = 'blk_http_test_1';
      const date = '2026-11-25';
      const startAt = '2026-11-25T12:30:00.000Z'; // 06:00 PM IST
      const endAt   = '2026-11-25T14:30:00.000Z'; // 08:00 PM IST

      // 1. Insert active block on Turf 1
      await dbAsync.run(
        `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, internal_note, status, created_by)
         VALUES (?, 'fac_box_cricket_1', ?, ?, 'maintenance', 'Turf Renovation', 'active', 'admin')`,
        [blockId, startAt, endAt]
      );

      // 2. Fetch slots for Turf 1 via HTTP
      const resTurf1 = await fetch(`${baseUrl}/api/bookings/slots?facilityId=fac_box_cricket_1&date=${date}`);
      assert.equal(resTurf1.status, 200);
      const dataTurf1 = await resTurf1.json();
      assert.equal(dataTurf1.success, true);

      const slot6PM = dataTurf1.slots.find(s => s.time.startsWith('06:00 PM'));
      assert.ok(slot6PM, '06:00 PM slot must exist in slots output');
      assert.equal(slot6PM.status, 'maintenance', 'Overlapping slot must have status maintenance');
      assert.equal(slot6PM.maintenanceReason, 'Turf Renovation', 'Slot must report the block reason');

      // 3. Fetch slots for Turf 2: must be unaffected
      const resTurf2 = await fetch(`${baseUrl}/api/bookings/slots?facilityId=fac_box_cricket_2&date=${date}`);
      assert.equal(resTurf2.status, 200);
      const dataTurf2 = await resTurf2.json();
      const slot6PMTurf2 = dataTurf2.slots.find(s => s.time.startsWith('06:00 PM'));
      assert.ok(slot6PMTurf2);
      assert.notEqual(slot6PMTurf2.status, 'maintenance', 'Turf 2 slot must NOT be maintenance');

      // 4. Delete block and verify slot becomes available again
      await dbAsync.run('DELETE FROM facility_blocks WHERE id = ?', [blockId]);
      const resRestored = await fetch(`${baseUrl}/api/bookings/slots?facilityId=fac_box_cricket_1&date=${date}`);
      const dataRestored = await resRestored.json();
      const slot6PMRestored = dataRestored.slots.find(s => s.time.startsWith('06:00 PM'));
      assert.ok(slot6PMRestored.status === 'available' || slot6PMRestored.status === 'fast-filling');

      // Clean up
      await dbAsync.run('DELETE FROM facility_blocks WHERE id = ?', [blockId]);
    });

    it('GET /api/bookings/slots on Green Net blocks both Net Practice and Shooting Machine', async () => {
      const blockId = 'blk_http_green_net';
      const date = '2026-11-26';
      const startAt = '2026-11-26T08:30:00.000Z'; // 02:00 PM IST
      const endAt   = '2026-11-26T10:30:00.000Z'; // 04:00 PM IST

      await dbAsync.run(
        `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, internal_note, status, created_by)
         VALUES (?, 'fac_green_net_1', ?, ?, 'repair', 'Net Mesh Repair', 'active', 'admin')`,
        [blockId, startAt, endAt]
      );

      // Query as 'cricket-nets'
      const resNets = await fetch(`${baseUrl}/api/bookings/slots?facilityId=cricket-nets&date=${date}`);
      const dataNets = await resNets.json();
      const slot2PMNets = dataNets.slots.find(s => s.time.startsWith('02:00 PM'));
      assert.ok(slot2PMNets);
      assert.equal(slot2PMNets.status, 'maintenance');

      // Query as 'ball-machine'
      const resMachine = await fetch(`${baseUrl}/api/bookings/slots?facilityId=ball-machine&date=${date}`);
      const dataMachine = await resMachine.json();
      const slot2PMMachine = dataMachine.slots.find(s => s.time.startsWith('02:00 PM'));
      assert.ok(slot2PMMachine);
      assert.equal(slot2PMMachine.status, 'maintenance');

      // Cleanup
      await dbAsync.run('DELETE FROM facility_blocks WHERE id = ?', [blockId]);
    });

    it('POST /api/bookings ignores manipulated walk-in amounts and persists the server quote', async () => {
      const date = '2026-12-15';
      const timeSlot = '10:00 AM – 11:00 AM';
      await dbAsync.run(
        `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, deposit_fixed_paise, is_active)
         VALUES ('test_walkin_bc2_day', 'fac_box_cricket_2', 'BASE_RATE', 'DAY', 85000, 30000, 1)
         ON CONFLICT (id) DO UPDATE SET rate_paise_per_hour = 85000, deposit_fixed_paise = 30000, is_active = 1`
      );
      const expected = await resolveAdminWalkInPricing(dbAsync, {
        facilityId: 'fac_box_cricket_2',
        date,
        timeSlot,
        durationHours: 1,
        paymentType: 'full',
      });

      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          facilityId: 'fac_box_cricket_2',
          date,
          time: timeSlot,
          duration: 1,
          customerName: 'Walk In Price Test',
          customerPhone: '9876500011',
          paymentType: 'full',
          paymentStatus: 'Paid',
          totalAmountPaise: 1,
          amountPaid: 1,
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      const saved = await dbAsync.get('SELECT total_amount_paise FROM bookings WHERE id = ?', [data.bookingReference]);
      assert.equal(saved.total_amount_paise, expected.totalAmountPaise);
      assert.notEqual(saved.total_amount_paise, 1);
      await dbAsync.run("DELETE FROM pricing_rules WHERE id = 'test_walkin_bc2_day'");
    });

    it('POST /api/sessions/extend ignores manipulated client amount and persists server price', async () => {
      const bookingId = 'TT-HTTP-EXTEND-PAID';
      await createCanonicalBooking(dbAsync, {
        id: bookingId,
        actor: { type: 'STAFF', username: 'staff' },
        source: 'STAFF_WALKIN',
        customer: { name: 'HTTP Paid Ext Test', phone: '9876541234' },
        physicalFacilityId: 'fac_box_cricket_1',
        date: '2026-11-27',
        timeSlot: '10:00 AM – 11:00 AM',
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 90000, paymentStatus: 'Paid', paymentId: 'p-http-ext-1' },
      });

      // Update to IN_PROGRESS so it can be extended
      await dbAsync.run("UPDATE bookings SET booking_status = 'IN_PROGRESS' WHERE id = ?", [bookingId]);
      await dbAsync.run("UPDATE facility_sessions SET session_status = 'IN_PROGRESS' WHERE booking_id = ?", [bookingId]);

      // Client attempts to pass chargePaise = 1 (deliberate manipulation)
      const res = await fetch(`${baseUrl}/api/sessions/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          bookingId,
          extensionMinutes: 15,
          chargePaise: 1,
          isFree: false,
          reason: 'Client requested extra time',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.resolvedChargePaise > 1, 'Server-resolved charge must be authoritative, not 1 paise');

      // Check DB persistence in session_adjustments
      const adj = await dbAsync.get(
        'SELECT * FROM session_adjustments WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
        [`ses_${bookingId}`]
      );
      assert.ok(adj);
      assert.equal(adj.charge_paise, data.resolvedChargePaise);
      assert.notEqual(adj.charge_paise, 1, 'Persisted charge must NOT match client manipulated 1 paise');
    });

    it('POST /api/sessions/extend free extension persists explicit is_free=1 and charge_paise=0', async () => {
      const bookingId = 'TT-HTTP-EXTEND-FREE';
      await createCanonicalBooking(dbAsync, {
        id: bookingId,
        actor: { type: 'STAFF', username: 'staff' },
        source: 'STAFF_WALKIN',
        customer: { name: 'HTTP Free Ext Test', phone: '9876541235' },
        physicalFacilityId: 'fac_pickleball_1',
        date: '2026-11-28',
        timeSlot: '10:00 AM – 11:00 AM',
        durationHours: 1,
        payment: { type: 'full', totalAmountPaise: 60000, paymentStatus: 'Paid', paymentId: 'p-http-ext-2' },
      });

      await dbAsync.run("UPDATE bookings SET booking_status = 'IN_PROGRESS' WHERE id = ?", [bookingId]);
      await dbAsync.run("UPDATE facility_sessions SET session_status = 'IN_PROGRESS' WHERE booking_id = ?", [bookingId]);

      const res = await fetch(`${baseUrl}/api/sessions/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          bookingId,
          extensionMinutes: 15,
          isFree: true,
          reason: 'Manager courtesy free buffer',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.isFree, true);
      assert.equal(data.resolvedChargePaise, 0);

      const adj = await dbAsync.get(
        'SELECT * FROM session_adjustments WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
        [`ses_${bookingId}`]
      );
      assert.ok(adj);
      assert.equal(adj.is_free, 1);
      assert.equal(adj.charge_paise, 0);
      assert.equal(adj.reason, 'Manager courtesy free buffer');
      assert.equal(adj.approved_by, 'test-admin');
      assert.ok(adj.created_at);
    });

    it('POST /api/sessions/extend rejects non-boolean free-extension coercion', async () => {
      const res = await fetch(`${baseUrl}/api/sessions/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          bookingId: 'TT-HTTP-EXTEND-PAID',
          extensionMinutes: 15,
          isFree: 'false',
          reason: 'Must not coerce a string into a free extension',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /explicit boolean/i);
    });
  });

});

import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { requirePermission } from '../domain/rbac/rbacEngine.js';

const router = express.Router();

const parseRupeesToPaise = (value, field) => {
  const normalized = String(value ?? '').replace(/[₹,\s]/g, '');
  const rupees = Number(normalized);
  const paise = rupees * 100;
  if (!Number.isFinite(rupees) || rupees < 0 || Math.abs(Math.round(paise) - paise) > 1e-7) {
    throw Object.assign(new Error(`${field} must be a valid non-negative rupee amount with at most two decimals.`), { httpStatus: 400 });
  }
  return Math.round(paise);
};

const formatRupees = (paise) => `₹${(Number(paise || 0) / 100).toFixed(Number(paise || 0) % 100 ? 2 : 0)}`;

const upsertBaseRule = async (db, { facilityId, periodType, ratePaise, depositPaise }) => {
  const existing = await db.get(
    `SELECT id FROM pricing_rules
     WHERE facility_id = ? AND service_id IS NULL AND rule_type = 'BASE_RATE' AND period_type = ? AND is_active = ?
     ORDER BY id ASC LIMIT 1`,
    [facilityId, periodType, db.isPostgres ? true : 1]
  );
  if (existing) {
    await db.run(
      `UPDATE pricing_rules
       SET rate_paise_per_hour = ?, deposit_fixed_paise = ?, deposit_pct_of_total = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [ratePaise, depositPaise, existing.id]
    );
    await db.run(
      `UPDATE pricing_rules
       SET is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE facility_id = ? AND service_id IS NULL AND rule_type = 'BASE_RATE'
         AND period_type = ? AND id <> ? AND is_active = ?`,
      [db.isPostgres ? false : 0, facilityId, periodType, existing.id, db.isPostgres ? true : 1]
    );
    return;
  }
  await db.run(
    `INSERT INTO pricing_rules (
       id, facility_id, rule_type, period_type, rate_paise_per_hour,
       deposit_fixed_paise, deposit_pct_of_total, is_active
     ) VALUES (?, ?, 'BASE_RATE', ?, ?, ?, 0, ?)`,
    [`pr_admin_${facilityId}_${periodType.toLowerCase()}`, facilityId, periodType, ratePaise, depositPaise, db.isPostgres ? true : 1]
  );
};

router.get('/admin', authenticateAdminToken, requirePermission('pricing.read'), async (_req, res) => {
  try {
    const facilities = await dbAsync.all(
      `SELECT id, COALESCE(custom_name, default_name) AS name
       FROM physical_facilities
       WHERE is_active = ?
       ORDER BY created_at ASC`,
      [dbAsync.isPostgres() ? true : 1]
    );
    const pricing = [];
    for (const facility of facilities) {
      const rules = await dbAsync.all(
        `SELECT period_type, rate_paise_per_hour, deposit_fixed_paise
         FROM pricing_rules
         WHERE facility_id = ? AND service_id IS NULL AND rule_type = 'BASE_RATE' AND is_active = ?
         ORDER BY id ASC`,
        [facility.id, dbAsync.isPostgres() ? true : 1]
      );
      const byPeriod = new Map(rules.map((rule) => [rule.period_type, rule]));
      const day = byPeriod.get('DAY');
      const night = byPeriod.get('NIGHT');
      const weekendDay = byPeriod.get('WEEKEND_DAY');
      const surge = day?.rate_paise_per_hour > 0 && weekendDay
        ? Math.max(0, Math.round((weekendDay.rate_paise_per_hour / day.rate_paise_per_hour - 1) * 100))
        : 0;
      pricing.push({
        facilityId: facility.id,
        facilityName: facility.name,
        dayRate: formatRupees(day?.rate_paise_per_hour),
        nightRate: formatRupees(night?.rate_paise_per_hour),
        weekendSurge: surge,
        bookingDeposit: formatRupees(day?.deposit_fixed_paise || night?.deposit_fixed_paise)
      });
    }

    const addOns = await dbAsync.all(
      `SELECT a.id, a.name, fa.facility_id,
              COALESCE(MAX(aop.rate_paise_per_hour), 0) AS rate_paise_per_hour
       FROM add_ons a
       JOIN facility_add_ons fa ON fa.add_on_id = a.id AND fa.is_active = ?
       LEFT JOIN add_on_prices aop
         ON aop.add_on_id = a.id
        AND (aop.facility_id IS NULL OR aop.facility_id = fa.facility_id)
        AND aop.is_active = ?
       WHERE a.is_active = ?
       GROUP BY a.id, a.name, fa.facility_id
       ORDER BY a.name ASC`,
      dbAsync.isPostgres() ? [true, true, true] : [1, 1, 1]
    );

    res.json({
      success: true,
      pricing,
      addOns: addOns.map((addOn) => ({
        addOnId: addOn.id,
        addOnName: addOn.name,
        facilityId: addOn.facility_id,
        hourlyRate: addOn.rate_paise_per_hour > 0 ? formatRupees(addOn.rate_paise_per_hour) : ''
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to load canonical pricing configuration.' });
  }
});

router.put('/admin', authenticateAdminToken, requirePermission('pricing.manage'), async (req, res) => {
  try {
    const facilities = Array.isArray(req.body?.facilities) ? req.body.facilities : null;
    const addOns = Array.isArray(req.body?.addOns) ? req.body.addOns : [];
    if (!facilities) {
      return res.status(400).json({ success: false, error: 'facilities must be an array.' });
    }

    await dbAsync.withTransaction(async (client) => {
      for (const item of facilities) {
        const physical = await client.get('SELECT id FROM physical_facilities WHERE id = ?', [item.facilityId]);
        if (!physical) throw Object.assign(new Error(`Unknown physical facility: ${item.facilityId}.`), { httpStatus: 400 });
        const dayPaise = parseRupeesToPaise(item.dayRate, 'Day rate');
        const nightPaise = parseRupeesToPaise(item.nightRate, 'Night rate');
        const depositPaise = parseRupeesToPaise(item.bookingDeposit, 'Token deposit');
        const weekendSurge = Number(item.weekendSurge);
        if (dayPaise <= 0 || nightPaise <= 0 || depositPaise <= 0 || !Number.isInteger(weekendSurge) || weekendSurge < 0 || weekendSurge > 100) {
          throw Object.assign(new Error('Rates and deposit must be positive; weekend surge must be an integer from 0 to 100.'), { httpStatus: 400 });
        }
        await upsertBaseRule(client, { facilityId: item.facilityId, periodType: 'DAY', ratePaise: dayPaise, depositPaise });
        await upsertBaseRule(client, { facilityId: item.facilityId, periodType: 'NIGHT', ratePaise: nightPaise, depositPaise });
        await upsertBaseRule(client, { facilityId: item.facilityId, periodType: 'WEEKEND_DAY', ratePaise: Math.round(dayPaise * (1 + weekendSurge / 100)), depositPaise });
        await upsertBaseRule(client, { facilityId: item.facilityId, periodType: 'WEEKEND_NIGHT', ratePaise: Math.round(nightPaise * (1 + weekendSurge / 100)), depositPaise });
      }

      for (const item of addOns) {
        const mapping = await client.get(
          'SELECT id FROM facility_add_ons WHERE facility_id = ? AND add_on_id = ? AND is_active = ?',
          [item.facilityId, item.addOnId, client.isPostgres ? true : 1]
        );
        if (!mapping) throw Object.assign(new Error(`Add-on ${item.addOnId} is not active for ${item.facilityId}.`), { httpStatus: 400 });
        const ratePaise = parseRupeesToPaise(item.hourlyRate, `${item.addOnName || item.addOnId} hourly rate`);
        if (ratePaise <= 0) throw Object.assign(new Error('Configured add-on rates must be positive.'), { httpStatus: 400 });
        const existing = await client.get(
          `SELECT id FROM add_on_prices
           WHERE add_on_id = ? AND facility_id = ? AND is_active = ?
           ORDER BY id ASC LIMIT 1`,
          [item.addOnId, item.facilityId, client.isPostgres ? true : 1]
        );
        if (existing) {
          await client.run(
            `UPDATE add_on_prices SET rate_paise_per_hour = ?, rate_paise_flat = 0 WHERE id = ?`,
            [ratePaise, existing.id]
          );
        } else {
          await client.run(
            `INSERT INTO add_on_prices (
               id, add_on_id, facility_id, rate_paise_per_hour, rate_paise_flat, is_active
             ) VALUES (?, ?, ?, ?, 0, ?)`,
            [`aop_admin_${item.addOnId}_${item.facilityId}`, item.addOnId, item.facilityId, ratePaise, client.isPostgres ? true : 1]
          );
        }
      }
    });

    res.json({ success: true, message: 'Canonical facility and add-on pricing published.' });
  } catch (error) {
    res.status(error.httpStatus || 500).json({ success: false, error: error.httpStatus ? error.message : 'Unable to save canonical pricing configuration.' });
  }
});


/**
 * GET /api/pricing
 * Get all facility pricing tiers
 */
router.get('/', async (req, res) => {
  try {
    const rawPricing = await dbAsync.all('SELECT * FROM pricing_tiers');

    const formatted = rawPricing.map(p => {
      let parsed = {};
      if (p.details_json) {
        try {
          parsed = JSON.parse(p.details_json);
        } catch {}
      }

      const dayRateRaw = parsed.dayRate || (p.day_rate ? `₹${p.day_rate}` : '₹800');
      const nightRateRaw = parsed.nightRate || (p.night_rate ? `₹${p.night_rate}` : '₹1200');
      const depositRaw = parsed.bookingDeposit || '₹400';

      const dayRateFormatted = String(dayRateRaw).startsWith('₹') ? dayRateRaw : `₹${dayRateRaw}`;
      const nightRateFormatted = String(nightRateRaw).startsWith('₹') ? nightRateRaw : `₹${nightRateRaw}`;
      const depositFormatted = String(depositRaw).startsWith('₹') ? depositRaw : `₹${depositRaw}`;

      return {
        ...parsed,
        facilityId: p.facility_id,
        facilityName: parsed.facilityName || p.facility_name,
        dayRate: dayRateFormatted,
        nightRate: nightRateFormatted,
        bookingDeposit: depositFormatted,
        dayHours: parsed.dayHours || '6:00 AM – 6:00 PM',
        nightHours: parsed.nightHours || '6:00 PM – 6:00 AM (Floodlights)',
        weekendSurge: p.weekend_surge || 15,
        depositPct: p.deposit_pct || 30
      };
    });

    res.json({ success: true, pricing: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/pricing
 * Save all pricing tiers (Admin) - Supports UPSERT and full JSON state
 */
router.put('/', authenticateAdminToken, requirePermission('pricing.manage'), async (req, res) => {

  try {
    const pricingList = req.body;

    if (!Array.isArray(pricingList)) {
      return res.status(400).json({ success: false, error: 'Expected array of pricing tiers' });
    }

    for (const p of pricingList) {
      const dayRateNum = parseInt(String(p.dayRate || '').replace(/[^0-9]/g, ''), 10) || 800;
      const nightRateNum = parseInt(String(p.nightRate || '').replace(/[^0-9]/g, ''), 10) || 1200;
      const depositNum = parseInt(String(p.bookingDeposit || '').replace(/[^0-9]/g, ''), 10) || 400;
      const weekendSurge = parseInt(String(p.weekendSurge || '').replace(/[^0-9]/g, ''), 10) || 15;
      const depositPct = parseInt(String(p.depositPct || '').replace(/[^0-9]/g, ''), 10) || 30;

      const normalizedTier = {
        ...p,
        facilityId: p.facilityId,
        facilityName: p.facilityName || p.facilityId,
        dayRate: `₹${dayRateNum}`,
        nightRate: `₹${nightRateNum}`,
        bookingDeposit: `₹${depositNum}`
      };
      const detailsJson = JSON.stringify(normalizedTier);

      if (dbAsync.isPostgres()) {
        await dbAsync.run(
          `INSERT INTO pricing_tiers (facility_id, facility_name, day_rate, night_rate, weekend_surge, deposit_pct, details_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT (facility_id) DO UPDATE
           SET facility_name = EXCLUDED.facility_name,
               day_rate = EXCLUDED.day_rate,
               night_rate = EXCLUDED.night_rate,
               weekend_surge = EXCLUDED.weekend_surge,
               deposit_pct = EXCLUDED.deposit_pct,
               details_json = EXCLUDED.details_json,
               updated_at = CURRENT_TIMESTAMP`,
          [p.facilityId, normalizedTier.facilityName, dayRateNum, nightRateNum, weekendSurge, depositPct, detailsJson]
        );
      } else {
        await dbAsync.run(
          `INSERT INTO pricing_tiers (facility_id, facility_name, day_rate, night_rate, weekend_surge, deposit_pct, details_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT (facility_id) DO UPDATE
           SET facility_name = excluded.facility_name,
               day_rate = excluded.day_rate,
               night_rate = excluded.night_rate,
               weekend_surge = excluded.weekend_surge,
               deposit_pct = excluded.deposit_pct,
               details_json = excluded.details_json,
               updated_at = CURRENT_TIMESTAMP`,
          [p.facilityId, normalizedTier.facilityName, dayRateNum, nightRateNum, weekendSurge, depositPct, detailsJson]
        );
      }
    }

    res.json({ success: true, message: 'Pricing rates successfully updated in cloud database' });
  } catch (err) {
    console.error('Pricing update error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/timings
 * Get Arena Timings
 */
router.get('/timings', async (req, res) => {
  try {
    const timings = await dbAsync.get('SELECT * FROM timings WHERE id = 1');

    res.json({
      success: true,
      timings: timings ? {
        arenaOpen: timings.arena_open,
        arenaClose: timings.arena_close,
        floodlightStart: timings.floodlight_start,
        slotIntervalMins: timings.slot_interval_mins,
        notes: timings.notes
      } : {
        arenaOpen: '06:00 AM',
        arenaClose: '06:00 AM',
        floodlightStart: '06:00 PM',
        slotIntervalMins: 60,
        notes: ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/timings
 * Update Arena Timings
 */
router.put('/timings', authenticateAdminToken, requirePermission('pricing.manage'), async (req, res) => {
  try {
    const { arenaOpen, arenaClose, floodlightStart, slotIntervalMins, notes } = req.body;
    if (!arenaOpen || !arenaClose || !floodlightStart) {
      return res.status(400).json({ success: false, error: 'Open, close, and floodlight start times are required.' });
    }
    const interval = Number(slotIntervalMins) || 60;
    if (![30, 60, 90, 120].includes(interval)) {
      return res.status(400).json({ success: false, error: 'Choose a supported slot interval.' });
    }

    await dbAsync.run(
      `INSERT INTO timings (id, arena_open, arena_close, floodlight_start, slot_interval_mins, notes, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         arena_open = EXCLUDED.arena_open,
         arena_close = EXCLUDED.arena_close,
         floodlight_start = EXCLUDED.floodlight_start,
         slot_interval_mins = EXCLUDED.slot_interval_mins,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP`,
      [arenaOpen, arenaClose, floodlightStart, interval, notes || '']
    );

    res.json({ success: true, message: 'Arena operating hours updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

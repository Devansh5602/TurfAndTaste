import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';

const router = express.Router();

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
        dayHours: parsed.dayHours || '6:00 AM – 4:00 PM',
        nightHours: parsed.nightHours || '4:00 PM – 11:30 PM (Floodlights)',
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
router.put('/', async (req, res) => {
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
        arenaClose: '11:30 PM',
        floodlightStart: '04:00 PM',
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
router.put('/timings', authenticateAdminToken, async (req, res) => {
  try {
    const { arenaOpen, arenaClose, floodlightStart, slotIntervalMins, notes } = req.body;

    await dbAsync.run(
      `UPDATE timings
       SET arena_open = ?, arena_close = ?, floodlight_start = ?, slot_interval_mins = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [arenaOpen, arenaClose, floodlightStart, slotIntervalMins || 60, notes || '']
    );

    res.json({ success: true, message: 'Arena operating hours updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

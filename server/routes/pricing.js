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

    const formatted = rawPricing.map(p => ({
      facilityId: p.facility_id,
      facilityName: p.facility_name,
      dayRate: p.day_rate,
      nightRate: p.night_rate,
      weekendSurge: p.weekend_surge,
      depositPct: p.deposit_pct
    }));

    res.json({ success: true, pricing: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/pricing
 * Save all pricing tiers (Admin)
 */
router.put('/', authenticateAdminToken, async (req, res) => {
  try {
    const pricingList = req.body;

    if (!Array.isArray(pricingList)) {
      return res.status(400).json({ success: false, error: 'Expected array of pricing tiers' });
    }

    for (const p of pricingList) {
      await dbAsync.run(
        `UPDATE pricing_tiers
         SET day_rate = ?, night_rate = ?, weekend_surge = ?, deposit_pct = ?, updated_at = CURRENT_TIMESTAMP
         WHERE facility_id = ?`,
        [p.dayRate, p.nightRate, p.weekendSurge, p.depositPct, p.facilityId]
      );
    }

    res.json({ success: true, message: 'Pricing rates successfully updated in cloud database' });
  } catch (err) {
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

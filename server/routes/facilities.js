import express from 'express';
import dbAsync from '../db.js';

const router = express.Router();

const parseJsonArray = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatFacility = (facility) => ({
  id: facility.id,
  slug: facility.slug,
  name: facility.name,
  type: facility.facility_type,
  status: facility.status,
  bookingEnabled: Boolean(facility.booking_enabled),
  defaultSlotMinutes: facility.default_slot_minutes,
  capacity: facility.capacity,
  shortDescription: facility.short_description,
  description: facility.description,
  amenities: parseJsonArray(facility.amenities_json),
  rules: parseJsonArray(facility.rules_json),
  coverImageUrl: facility.cover_image_url,
  displayOrder: facility.display_order,
});

/**
 * Public facility inventory. The existing SPA intentionally continues to use
 * its static presentation data until its consumer migration is complete.
 */
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const rows = await dbAsync.all(
      `SELECT * FROM facility_profiles
       WHERE (? = 1 OR status = 'active')
       ORDER BY display_order ASC, name ASC`,
      [includeInactive ? 1 : 0],
    );

    res.json({ success: true, count: rows.length, facilities: rows.map(formatFacility) });
  } catch (error) {
    console.error('[Facilities API Error]:', error);
    res.status(500).json({ success: false, error: 'Unable to load facilities.' });
  }
});

router.get('/:identifier', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const facility = await dbAsync.get(
      `SELECT * FROM facility_profiles
       WHERE (id = ? OR slug = ?) AND (? = 1 OR status = 'active')
       LIMIT 1`,
      [req.params.identifier, req.params.identifier, includeInactive ? 1 : 0],
    );

    if (!facility) {
      return res.status(404).json({ success: false, error: 'Facility not found.' });
    }

    return res.json({ success: true, facility: formatFacility(facility) });
  } catch (error) {
    console.error('[Facility API Error]:', error);
    return res.status(500).json({ success: false, error: 'Unable to load this facility.' });
  }
});

export default router;

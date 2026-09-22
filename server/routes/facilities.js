import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { isPlainObject, safeJsonParse, sendError, sendSuccess } from '../utils/api.js';

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

const formatSchedule = (schedule) => ({
  dayOfWeek: schedule.day_of_week,
  opensAtMinutes: schedule.opens_at_minutes,
  closesAtMinutes: schedule.closes_at_minutes,
  slotMinutes: schedule.slot_minutes,
  isBookable: Boolean(schedule.is_bookable),
});

const validId = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ''));

const normalizeSchedules = (value) => {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > 7) return { error: 'Schedules must contain at most one entry for each day.' };

  const days = new Set();
  const schedules = [];
  for (const schedule of value) {
    const dayOfWeek = Number(schedule?.dayOfWeek);
    const opensAtMinutes = Number(schedule?.opensAtMinutes);
    const closesAtMinutes = Number(schedule?.closesAtMinutes);
    const slotMinutes = schedule?.slotMinutes == null ? null : Number(schedule.slotMinutes);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || days.has(dayOfWeek)) {
      return { error: 'Each schedule requires a unique dayOfWeek between 0 and 6.' };
    }
    if (!Number.isInteger(opensAtMinutes) || opensAtMinutes < 0 || opensAtMinutes > 1439
      || !Number.isInteger(closesAtMinutes) || closesAtMinutes < 1 || closesAtMinutes > 1440
      || (slotMinutes !== null && (!Number.isInteger(slotMinutes) || slotMinutes < 15 || slotMinutes > 240))) {
      return { error: 'Schedule times must be valid minutes and slotMinutes must be between 15 and 240.' };
    }
    days.add(dayOfWeek);
    schedules.push({ dayOfWeek, opensAtMinutes, closesAtMinutes, slotMinutes, isBookable: schedule.isBookable !== false });
  }
  return { schedules };
};

const getSchedules = (facilityId) => dbAsync.all(
  'SELECT * FROM facility_schedules WHERE facility_id = ? ORDER BY day_of_week ASC',
  [facilityId],
);

const getFacility = (identifier, includeInactive = false) => dbAsync.get(
  `SELECT * FROM facility_profiles
   WHERE (id = ? OR slug = ?) AND (? = 1 OR status = 'active') LIMIT 1`,
  [identifier, identifier, includeInactive ? 1 : 0],
);

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
    const facility = await getFacility(req.params.identifier, includeInactive);

    if (!facility) {
      return res.status(404).json({ success: false, error: 'Facility not found.' });
    }

    return res.json({ success: true, facility: { ...formatFacility(facility), schedules: (await getSchedules(facility.id)).map(formatSchedule) } });
  } catch (error) {
    console.error('[Facility API Error]:', error);
    return res.status(500).json({ success: false, error: 'Unable to load this facility.' });
  }
});

const saveFacility = async (req, res, isCreate) => {
  if (!isPlainObject(req.body)) return sendError(res, 400, 'Facility payload must be an object.');
  const existing = isCreate ? null : await getFacility(req.params.identifier, true);
  if (!isCreate && !existing) return sendError(res, 404, 'Facility not found.');

  const id = isCreate ? String(req.body.id || '') : existing.id;
  const slug = String(req.body.slug ?? existing?.slug ?? id).trim().toLowerCase();
  const name = String(req.body.name ?? existing?.name ?? '').trim();
  if (!validId(id) || !validId(slug) || name.length < 2 || name.length > 255) {
    return sendError(res, 400, 'Facility id/slug must be lowercase kebab-case and name must be 2–255 characters.');
  }
  const schedulesResult = normalizeSchedules(req.body.schedules);
  if (schedulesResult?.error) return sendError(res, 400, schedulesResult.error);

  const status = req.body.status ?? existing?.status ?? 'active';
  if (!['active', 'inactive', 'draft'].includes(status)) return sendError(res, 400, 'Choose active, inactive, or draft status.');
  const defaultSlotMinutes = Number(req.body.defaultSlotMinutes ?? existing?.default_slot_minutes ?? 60);
  if (!Number.isInteger(defaultSlotMinutes) || defaultSlotMinutes < 15 || defaultSlotMinutes > 240) {
    return sendError(res, 400, 'defaultSlotMinutes must be between 15 and 240.');
  }
  const capacity = req.body.capacity == null ? existing?.capacity ?? null : Number(req.body.capacity);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 10_000)) return sendError(res, 400, 'capacity must be a positive whole number.');
  const amenities = req.body.amenities ?? parseJsonArray(existing?.amenities_json);
  const rules = req.body.rules ?? parseJsonArray(existing?.rules_json);
  if (!Array.isArray(amenities) || !Array.isArray(rules)) return sendError(res, 400, 'amenities and rules must be arrays.');

  const facilityType = String(req.body.type ?? existing?.facility_type ?? 'sport').trim().toLowerCase();
  const bookingEnabled = req.body.bookingEnabled ?? existing?.booking_enabled ?? true;
  const storedBookingEnabled = dbAsync.isPostgres() ? Boolean(bookingEnabled) : (bookingEnabled ? 1 : 0);
  const values = [id, slug, name, facilityType, status, storedBookingEnabled,
    defaultSlotMinutes, capacity, req.body.shortDescription ?? existing?.short_description ?? null,
    req.body.description ?? existing?.description ?? null, JSON.stringify(amenities), JSON.stringify(rules),
    req.body.coverImageUrl ?? existing?.cover_image_url ?? null, Number(req.body.displayOrder ?? existing?.display_order ?? 0),
    existing ? JSON.stringify(safeJsonParse(existing.metadata_json)) : '{}'];

  const statements = [{
    sql: `INSERT INTO facility_profiles (id, slug, name, facility_type, status, booking_enabled, default_slot_minutes, capacity, short_description, description, amenities_json, rules_json, cover_image_url, display_order, metadata_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, facility_type = EXCLUDED.facility_type, status = EXCLUDED.status, booking_enabled = EXCLUDED.booking_enabled, default_slot_minutes = EXCLUDED.default_slot_minutes, capacity = EXCLUDED.capacity, short_description = EXCLUDED.short_description, description = EXCLUDED.description, amenities_json = EXCLUDED.amenities_json, rules_json = EXCLUDED.rules_json, cover_image_url = EXCLUDED.cover_image_url, display_order = EXCLUDED.display_order, metadata_json = EXCLUDED.metadata_json, updated_at = CURRENT_TIMESTAMP`,
    params: values,
  }];
  if (schedulesResult?.schedules) {
    statements.push({ sql: 'DELETE FROM facility_schedules WHERE facility_id = ?', params: [id] });
    schedulesResult.schedules.forEach((schedule) => statements.push({
      sql: 'INSERT INTO facility_schedules (facility_id, day_of_week, opens_at_minutes, closes_at_minutes, slot_minutes, is_bookable) VALUES (?, ?, ?, ?, ?, ?)',
      params: [id, schedule.dayOfWeek, schedule.opensAtMinutes, schedule.closesAtMinutes, schedule.slotMinutes, schedule.isBookable ? 1 : 0],
    }));
  }
  try {
    await dbAsync.transaction(statements);
    const saved = await getFacility(id, true);
    return sendSuccess(res, { facility: { ...formatFacility(saved), schedules: (await getSchedules(id)).map(formatSchedule) } }, isCreate ? 201 : 200);
  } catch (error) {
    console.error('[Facility Management Error]:', error);
    return sendError(res, error?.code === '23505' || /UNIQUE constraint failed/.test(error?.message || '') ? 409 : 500, 'Unable to save facility.');
  }
};

router.post('/', authenticateAdminToken, (req, res) => saveFacility(req, res, true));
router.put('/:identifier', authenticateAdminToken, (req, res) => saveFacility(req, res, false));

export default router;

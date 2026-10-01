import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken, attachOptionalAdmin } from '../middleware/auth.js';
import { isPlainObject, safeJsonParse, sendError, sendSuccess } from '../utils/api.js';
import { requirePermission } from '../domain/rbac/rbacEngine.js';
import { findResourceConflicts } from '../domain/booking/conflictEngine.js';
import { normalizeBookingInterval } from '../domain/time/bookingInterval.js';

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
  metadata: safeJsonParse(facility.metadata_json),
});

const formatSchedule = (schedule) => ({
  dayOfWeek: schedule.day_of_week,
  opensAtMinutes: schedule.opens_at_minutes,
  closesAtMinutes: schedule.closes_at_minutes,
  slotMinutes: schedule.slot_minutes,
  isBookable: Boolean(schedule.is_bookable),
});

const validId = (value) => /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(String(value || ''));

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

/* ============================================================
   1. SECTION & CATEGORY CMS
   ============================================================ */

router.get('/sections', authenticateAdminToken, requirePermission('facility.read'), async (_req, res) => {
  try {
    const rows = await dbAsync.all('SELECT * FROM sections ORDER BY display_order ASC, display_name ASC');
    res.json({ success: true, count: rows.length, sections: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to load sections.' });
  }
});

router.post('/sections', authenticateAdminToken, requirePermission('facility.create'), async (req, res) => {
  try {
    const { id, code, displayName, sectionType = 'SPORTS', displayOrder = 0, status = 'active' } = req.body;
    if (!code || !displayName) {
      return res.status(400).json({ success: false, error: 'code and displayName are required.' });
    }
    const sectionId = id || `sec_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    await dbAsync.run(
      `INSERT INTO sections (id, property_id, code, display_name, section_type, display_order, status)
       VALUES (?, 'prop_patan', ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         code = EXCLUDED.code,
         display_name = EXCLUDED.display_name,
         section_type = EXCLUDED.section_type,
         display_order = EXCLUDED.display_order,
         status = EXCLUDED.status,
         updated_at = CURRENT_TIMESTAMP`,
      [sectionId, code.toUpperCase(), displayName, sectionType.toUpperCase(), Number(displayOrder) || 0, status]
    );
    const saved = await dbAsync.get('SELECT * FROM sections WHERE id = ?', [sectionId]);
    res.status(201).json({ success: true, section: saved });
  } catch (error) {
    console.error('[Section Create Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/sections/:id', authenticateAdminToken, requirePermission('facility.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, displayOrder, status } = req.body;
    const existing = await dbAsync.get('SELECT * FROM sections WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Section not found.' });

    await dbAsync.run(
      `UPDATE sections
       SET display_name = COALESCE(?, display_name),
           display_order = COALESCE(?, display_order),
           status = COALESCE(?, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [displayName, displayOrder !== undefined ? Number(displayOrder) : null, status, id]
    );
    const updated = await dbAsync.get('SELECT * FROM sections WHERE id = ?', [id]);
    res.json({ success: true, section: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ============================================================
   2. PHYSICAL FACILITY CMS
   ============================================================ */

router.get('/physical', authenticateAdminToken, requirePermission('facility.read'), async (_req, res) => {
  try {
    const facilities = await dbAsync.all(`
      SELECT pf.*, s.display_name AS section_name
      FROM physical_facilities pf
      LEFT JOIN sections s ON pf.section_id = s.id
      ORDER BY pf.created_at ASC
    `);

    // Fetch attached services and add-ons
    const enhanced = await Promise.all(facilities.map(async (f) => {
      const services = await dbAsync.all(`
        SELECT s.*, fs.is_primary
        FROM facility_services fs
        JOIN services s ON fs.service_id = s.id
        WHERE fs.facility_id = ?
      `, [f.id]);

      const addOns = await dbAsync.all(`
        SELECT a.*
        FROM facility_add_ons fa
        JOIN add_ons a ON fa.add_on_id = a.id
        WHERE fa.facility_id = ?
      `, [f.id]);

      return {
        id: f.id,
        sectionId: f.section_id,
        sectionName: f.section_name,
        code: f.code,
        defaultName: f.default_name,
        customName: f.custom_name,
        capacity: f.capacity,
        isActive: Boolean(f.is_active),
        isBookable: Boolean(f.is_bookable),
        metadata: safeJsonParse(f.metadata_json),
        services: services.map(s => ({ id: s.id, name: s.name, code: s.code, isPrimary: Boolean(s.is_primary) })),
        addOns: addOns.map(a => ({ id: a.id, name: a.name, code: a.code, description: a.description }))
      };
    }));

    res.json({ success: true, count: enhanced.length, facilities: enhanced });
  } catch (error) {
    console.error('[Physical Facilities Error]:', error);
    res.status(500).json({ success: false, error: 'Unable to load physical facilities.' });
  }
});

router.post('/physical', authenticateAdminToken, requirePermission('facility.create'), async (req, res) => {
  try {
    const { id, sectionId = 'sec_sports', code, defaultName, customName, capacity = 10, isActive = true, isBookable = true, serviceIds = [], addOnIds = [] } = req.body;
    if (!code || !defaultName) {
      return res.status(400).json({ success: false, error: 'code and defaultName are required.' });
    }
    const facilityId = id || `fac_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    await dbAsync.run(
      `INSERT INTO physical_facilities (id, section_id, code, default_name, custom_name, capacity, is_active, is_bookable, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         section_id = EXCLUDED.section_id,
         code = EXCLUDED.code,
         default_name = EXCLUDED.default_name,
         custom_name = EXCLUDED.custom_name,
         capacity = EXCLUDED.capacity,
         is_active = EXCLUDED.is_active,
         is_bookable = EXCLUDED.is_bookable,
         updated_at = CURRENT_TIMESTAMP`,
      [facilityId, sectionId, code, defaultName, customName || defaultName, Number(capacity) || 10, isActive ? 1 : 0, isBookable ? 1 : 0]
    );

    // Update service mappings
    if (Array.isArray(serviceIds) && serviceIds.length > 0) {
      await dbAsync.run('DELETE FROM facility_services WHERE facility_id = ?', [facilityId]);
      for (let i = 0; i < serviceIds.length; i++) {
        const sId = serviceIds[i];
        await dbAsync.run(
          'INSERT INTO facility_services (id, facility_id, service_id, is_primary) VALUES (?, ?, ?, ?)',
          [`fs_${facilityId}_${sId}`, facilityId, sId, i === 0 ? 1 : 0]
        );
      }
    }

    // Update add-on mappings
    if (Array.isArray(addOnIds)) {
      await dbAsync.run('DELETE FROM facility_add_ons WHERE facility_id = ?', [facilityId]);
      for (const aId of addOnIds) {
        await dbAsync.run(
          'INSERT INTO facility_add_ons (id, facility_id, add_on_id) VALUES (?, ?, ?)',
          [`fa_${facilityId}_${aId}`, facilityId, aId]
        );
      }
    }

    res.status(201).json({ success: true, message: `Physical facility ${facilityId} registered.` });
  } catch (error) {
    console.error('[Physical Facility Create Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/physical/:id', authenticateAdminToken, requirePermission('facility.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { customName, capacity, isActive, isBookable, serviceIds, addOnIds } = req.body;
    const existing = await dbAsync.get('SELECT * FROM physical_facilities WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Physical facility not found.' });

    await dbAsync.run(
      `UPDATE physical_facilities
       SET custom_name = COALESCE(?, custom_name),
           capacity = COALESCE(?, capacity),
           is_active = COALESCE(?, is_active),
           is_bookable = COALESCE(?, is_bookable),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [customName, capacity !== undefined ? Number(capacity) : null, isActive !== undefined ? (isActive ? 1 : 0) : null, isBookable !== undefined ? (isBookable ? 1 : 0) : null, id]
    );

    if (Array.isArray(serviceIds)) {
      await dbAsync.run('DELETE FROM facility_services WHERE facility_id = ?', [id]);
      for (let i = 0; i < serviceIds.length; i++) {
        const sId = serviceIds[i];
        await dbAsync.run(
          'INSERT INTO facility_services (id, facility_id, service_id, is_primary) VALUES (?, ?, ?, ?)',
          [`fs_${id}_${sId}`, id, sId, i === 0 ? 1 : 0]
        );
      }
    }

    if (Array.isArray(addOnIds)) {
      await dbAsync.run('DELETE FROM facility_add_ons WHERE facility_id = ?', [id]);
      for (const aId of addOnIds) {
        await dbAsync.run(
          'INSERT INTO facility_add_ons (id, facility_id, add_on_id) VALUES (?, ?, ?)',
          [`fa_${id}_${aId}`, id, aId]
        );
      }
    }

    res.json({ success: true, message: `Physical facility ${id} updated.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ============================================================
   3. SERVICES & ADD-ONS CMS
   ============================================================ */

router.get('/services', authenticateAdminToken, requirePermission('facility.read'), async (_req, res) => {
  try {
    const services = await dbAsync.all('SELECT * FROM services ORDER BY name ASC');
    res.json({ success: true, count: services.length, services });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to load services.' });
  }
});

router.post('/services', authenticateAdminToken, requirePermission('facility.create'), async (req, res) => {
  try {
    const { id, sectionId = 'sec_sports', code, name, isActive = true } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, error: 'code and name are required.' });
    const serviceId = id || `srv_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    await dbAsync.run(
      `INSERT INTO services (id, section_id, code, name, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         is_active = EXCLUDED.is_active,
         updated_at = CURRENT_TIMESTAMP`,
      [serviceId, sectionId, code, name, isActive ? 1 : 0]
    );

    res.status(201).json({ success: true, serviceId, name });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/add-ons', authenticateAdminToken, requirePermission('facility.read'), async (_req, res) => {
  try {
    const addOns = await dbAsync.all('SELECT * FROM add_ons ORDER BY name ASC');
    res.json({ success: true, count: addOns.length, addOns });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to load add-ons.' });
  }
});

router.post('/add-ons', authenticateAdminToken, requirePermission('facility.create'), async (req, res) => {
  try {
    const { id, sectionId = 'sec_sports', code, name, description = '', isActive = true } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, error: 'code and name are required.' });
    const addOnId = id || `addon_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    await dbAsync.run(
      `INSERT INTO add_ons (id, section_id, code, name, description, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         is_active = EXCLUDED.is_active,
         updated_at = CURRENT_TIMESTAMP`,
      [addOnId, sectionId, code, name, description, isActive ? 1 : 0]
    );

    res.status(201).json({ success: true, addOnId, name });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ============================================================
   4. AVAILABILITY & FACILITY BLOCKS
   ============================================================ */

router.get('/blocks', authenticateAdminToken, requirePermission('facility.read'), async (req, res) => {
  try {
    const { facilityId } = req.query;
    let sql = `
      SELECT fb.*, pf.custom_name AS facility_name
      FROM facility_blocks fb
      LEFT JOIN physical_facilities pf ON fb.facility_id = pf.id
      WHERE 1=1
    `;
    const params = [];
    if (facilityId && facilityId !== 'all') {
      sql += ' AND fb.facility_id = ?';
      params.push(facilityId);
    }
    sql += ' ORDER BY fb.start_at DESC';
    const blocks = await dbAsync.all(sql, params);
    res.json({ success: true, count: blocks.length, blocks });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to load blocks.' });
  }
});

router.post('/blocks', authenticateAdminToken, requirePermission('facility.block'), async (req, res) => {
  try {
    const { facilityId, startAt, endAt, reasonCode = 'MAINTENANCE', internalNote = '', customerMessage = '' } = req.body;
    if (!facilityId || !startAt || !endAt) {
      return res.status(400).json({ success: false, error: 'facilityId, startAt, and endAt are required.' });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ success: false, error: 'endAt must be strictly after startAt.' });
    }

    // Conflict check against existing confirmed bookings
    const conflictResult = await findResourceConflicts(dbAsync, {
      facilityId,
      startAt: start.toISOString(),
      endAt: end.toISOString()
    });

    const bookingConflicts = conflictResult.conflicts.filter(c => c.conflictType === 'BOOKING');
    if (bookingConflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot create block: ${bookingConflicts.length} active customer booking(s) overlap with this interval.`,
        conflicts: bookingConflicts
      });
    }

    const blockId = `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const createdBy = req.admin?.username || 'admin';

    await dbAsync.run(
      `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, internal_note, customer_message, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [blockId, facilityId, start.toISOString(), end.toISOString(), reasonCode, internalNote, customerMessage, createdBy]
    );

    res.status(201).json({ success: true, blockId, message: `Block created for ${facilityId} from ${start.toISOString()} to ${end.toISOString()}.` });
  } catch (error) {
    console.error('[Create Block Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/blocks/:id', authenticateAdminToken, requirePermission('facility.block'), async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM facility_blocks WHERE id = ?', [id]);
    res.json({ success: true, message: `Facility block ${id} removed.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ============================================================
   5. FACILITY PROFILES (LEGACY & PUBLIC)
   ============================================================ */

router.get('/', async (req, res) => {
  try {
    const rows = await dbAsync.all(
      `SELECT * FROM facility_profiles
       WHERE status = 'active'
       ORDER BY display_order ASC, name ASC`,
      [],
    );

    res.json({ success: true, count: rows.length, facilities: rows.map(formatFacility) });
  } catch (error) {
    console.error('[Facilities API Error]:', error);
    res.status(500).json({ success: false, error: 'Unable to load facilities.' });
  }
});

router.get('/admin/all', authenticateAdminToken, requirePermission('facility.read'), async (_req, res) => {
  try {
    const rows = await dbAsync.all('SELECT * FROM facility_profiles ORDER BY display_order ASC, name ASC');
    return sendSuccess(res, { facilities: await Promise.all(rows.map(async (facility) => ({
      ...formatFacility(facility),
      schedules: (await getSchedules(facility.id)).map(formatSchedule),
    }))) });
  } catch (error) {
    console.error('[Admin Facilities API Error]:', error);
    return sendError(res, 500, 'Unable to load facilities.');
  }
});

router.get('/:identifier', async (req, res) => {
  try {
    const facility = await getFacility(req.params.identifier);

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

router.post('/', authenticateAdminToken, requirePermission('facility.create'), (req, res) => saveFacility(req, res, true));
router.put('/:identifier', authenticateAdminToken, requirePermission('facility.update'), (req, res) => saveFacility(req, res, false));

export default router;

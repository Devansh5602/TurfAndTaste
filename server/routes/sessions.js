import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { requirePermission } from '../domain/rbac/rbacEngine.js';
import { validateSessionExtension, computeSessionMetrics } from '../domain/session/sessionOperations.js';
import { normalizeBookingInterval } from '../domain/time/bookingInterval.js';
import { findResourceConflicts } from '../domain/booking/conflictEngine.js';

const router = express.Router();

/**
 * GET /api/sessions/lookup
 * Lookup booking / session by booking ID, QR code, phone, or name
 */
router.get('/lookup', authenticateAdminToken, requirePermission('booking.read'), async (req, res) => {
  try {
    const query = String(req.query.q || req.query.query || '').trim();
    if (!query) {
      return res.status(400).json({ success: false, error: 'Search query is required (Booking ID, QR code, or Phone).' });
    }

    const cleanPhone = query.replace(/\D/g, '');
    let sql = `
      SELECT b.*, fs.id AS session_id, fs.actual_start_at, fs.actual_end_at, fs.session_status, fs.delay_minutes, fs.delay_reason, fs.notes AS session_notes
      FROM bookings b
      LEFT JOIN facility_sessions fs ON fs.booking_id = b.id
      WHERE b.id = ? OR b.payment_id = ?
    `;
    const params = [query, query];

    if (cleanPhone.length >= 7) {
      sql += ' OR b.customer_phone LIKE ?';
      params.push(`%${cleanPhone}%`);
    }

    sql += ' ORDER BY b.date DESC, b.created_at DESC LIMIT 10';

    const rows = await dbAsync.all(sql, params);

    const results = rows.map(r => ({
      id: r.id,
      facilityId: r.physical_facility_id || r.facility_id,
      facilityName: r.facility_name,
      date: r.date,
      timeSlot: r.time_slot,
      scheduledStartAt: r.scheduled_start_at,
      scheduledEndAt: r.scheduled_end_at,
      actualStartAt: r.actual_start_at,
      actualEndAt: r.actual_end_at,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      customerEmail: r.customer_email,
      teamName: r.team_name,
      duration: r.duration,
      paymentType: r.payment_type,
      paymentStatus: r.payment_status,
      bookingStatus: r.booking_status,
      sessionStatus: r.session_status || (r.booking_status === 'Checked-in' ? 'CHECKED_IN' : (r.booking_status === 'Confirmed' ? 'CONFIRMED' : r.booking_status)),
      delayMinutes: r.delay_minutes || 0,
      delayReason: r.delay_reason || null,
      sessionNotes: r.session_notes || null,
      createdAt: r.created_at
    }));

    res.json({ success: true, count: results.length, sessions: results });
  } catch (err) {
    console.error('[Session Lookup Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/sessions/today
 * Get ground session operational overview for today
 */
router.get('/today', authenticateAdminToken, requirePermission('booking.read'), async (req, res) => {
  try {
    const today = req.query.date || new Date().toISOString().slice(0, 10);

    const rows = await dbAsync.all(
      `SELECT b.*, fs.id AS session_id, fs.actual_start_at, fs.actual_end_at, fs.session_status, fs.delay_minutes, fs.delay_reason, fs.notes AS session_notes
       FROM bookings b
       LEFT JOIN facility_sessions fs ON fs.booking_id = b.id
       WHERE b.date = ? AND b.booking_status != 'Cancelled'
       ORDER BY b.scheduled_start_at ASC, b.time_slot ASC`,
      [today]
    );

    const sessions = rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      facilityId: r.physical_facility_id || r.facility_id,
      facilityName: r.facility_name,
      date: r.date,
      timeSlot: r.time_slot,
      scheduledStartAt: r.scheduled_start_at,
      scheduledEndAt: r.scheduled_end_at,
      actualStartAt: r.actual_start_at,
      actualEndAt: r.actual_end_at,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      bookingStatus: r.booking_status,
      sessionStatus: r.session_status || r.booking_status,
      delayMinutes: r.delay_minutes || 0,
      delayReason: r.delay_reason,
      sessionNotes: r.session_notes,
      amountPaid: r.amount_paid,
      paymentStatus: r.payment_status
    }));

    res.json({ success: true, date: today, count: sessions.length, sessions });
  } catch (err) {
    console.error('[Session Today Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sessions/checkin
 * Staff QR / manual check-in
 */
router.post('/checkin', authenticateAdminToken, requirePermission('booking.checkin'), async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId is required.' });

    const booking = await dbAsync.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });

    if (booking.booking_status === 'Cancelled') {
      return res.status(409).json({ success: false, error: 'Cannot check-in a cancelled booking.' });
    }

    const facilityId = booking.physical_facility_id || booking.facility_id;
    let scheduledStart = booking.scheduled_start_at;
    let scheduledEnd = booking.scheduled_end_at;
    if (!scheduledStart || !scheduledEnd) {
      const norm = normalizeBookingInterval({ date: booking.date, timeSlot: booking.time_slot });
      scheduledStart = norm.startAt.toISOString();
      scheduledEnd = norm.endAt.toISOString();
    }

    const existingSession = await dbAsync.get('SELECT * FROM facility_sessions WHERE booking_id = ?', [bookingId]);
    const operatorId = req.admin?.username || 'staff';

    if (existingSession) {
      await dbAsync.run(
        `UPDATE facility_sessions
         SET session_status = 'CHECKED_IN', operator_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [operatorId, existingSession.id]
      );
    } else {
      const sessionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await dbAsync.run(
        `INSERT INTO facility_sessions (id, booking_id, facility_id, scheduled_start_at, scheduled_end_at, session_status, operator_id)
         VALUES (?, ?, ?, ?, ?, 'CHECKED_IN', ?)`,
        [sessionId, bookingId, facilityId, scheduledStart, scheduledEnd, operatorId]
      );
    }

    await dbAsync.run(
      "UPDATE bookings SET booking_status = 'Checked-in' WHERE id = ?",
      [bookingId]
    );

    res.json({
      success: true,
      bookingId,
      status: 'Checked-in',
      message: `Customer ${booking.customer_name} checked in successfully.`
    });
  } catch (err) {
    console.error('[Session Checkin Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sessions/start
 * Staff logs actual session start
 */
router.post('/start', authenticateAdminToken, requirePermission('booking.checkin'), async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId is required.' });

    const booking = await dbAsync.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });

    if (booking.booking_status === 'Cancelled') {
      return res.status(409).json({ success: false, error: 'Cannot start a cancelled booking.' });
    }

    const actualStart = new Date().toISOString();
    const facilityId = booking.physical_facility_id || booking.facility_id;
    let scheduledStart = booking.scheduled_start_at;
    let scheduledEnd = booking.scheduled_end_at;
    if (!scheduledStart || !scheduledEnd) {
      const norm = normalizeBookingInterval({ date: booking.date, timeSlot: booking.time_slot });
      scheduledStart = norm.startAt.toISOString();
      scheduledEnd = norm.endAt.toISOString();
    }

    const metrics = computeSessionMetrics(scheduledStart, scheduledEnd, actualStart, null);
    const existingSession = await dbAsync.get('SELECT * FROM facility_sessions WHERE booking_id = ?', [bookingId]);
    const operatorId = req.admin?.username || 'staff';

    if (existingSession) {
      await dbAsync.run(
        `UPDATE facility_sessions
         SET actual_start_at = ?, session_status = 'IN_PROGRESS', delay_minutes = ?, operator_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [actualStart, metrics.startDelayMinutes, operatorId, existingSession.id]
      );
    } else {
      const sessionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await dbAsync.run(
        `INSERT INTO facility_sessions (id, booking_id, facility_id, scheduled_start_at, scheduled_end_at, actual_start_at, session_status, delay_minutes, operator_id)
         VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?)`,
        [sessionId, bookingId, facilityId, scheduledStart, scheduledEnd, actualStart, metrics.startDelayMinutes, operatorId]
      );
    }

    await dbAsync.run(
      "UPDATE bookings SET booking_status = 'In Progress' WHERE id = ?",
      [bookingId]
    );

    res.json({
      success: true,
      bookingId,
      actualStartAt: actualStart,
      startDelayMinutes: metrics.startDelayMinutes,
      status: 'In Progress',
      message: `Session started for ${booking.customer_name}.`
    });
  } catch (err) {
    console.error('[Session Start Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sessions/end
 * Staff logs actual session completion
 */
router.post('/end', authenticateAdminToken, requirePermission('booking.checkin'), async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId is required.' });

    const booking = await dbAsync.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });

    const actualEnd = new Date().toISOString();
    const existingSession = await dbAsync.get('SELECT * FROM facility_sessions WHERE booking_id = ?', [bookingId]);
    const operatorId = req.admin?.username || 'staff';

    if (existingSession) {
      await dbAsync.run(
        `UPDATE facility_sessions
         SET actual_end_at = ?, session_status = 'COMPLETED', operator_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [actualEnd, operatorId, existingSession.id]
      );
    }

    await dbAsync.run(
      "UPDATE bookings SET booking_status = 'Completed' WHERE id = ?",
      [bookingId]
    );

    res.json({
      success: true,
      bookingId,
      actualEndAt: actualEnd,
      status: 'Completed',
      message: `Session completed for ${booking.customer_name}.`
    });
  } catch (err) {
    console.error('[Session End Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sessions/delay
 * Record ground handover delay or customer late arrival
 */
router.post('/delay', authenticateAdminToken, requirePermission('booking.update'), async (req, res) => {
  try {
    const { bookingId, delayMinutes, delayReason, notes } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId is required.' });

    const booking = await dbAsync.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });

    const operatorId = req.admin?.username || 'staff';
    const existingSession = await dbAsync.get('SELECT * FROM facility_sessions WHERE booking_id = ?', [bookingId]);

    if (existingSession) {
      await dbAsync.run(
        `UPDATE facility_sessions
         SET delay_minutes = ?, delay_reason = ?, notes = ?, operator_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [Number(delayMinutes) || 0, delayReason || 'Ground Delay', notes || '', operatorId, existingSession.id]
      );
    }

    res.json({
      success: true,
      bookingId,
      delayMinutes: Number(delayMinutes) || 0,
      delayReason,
      message: 'Delay details recorded.'
    });
  } catch (err) {
    console.error('[Session Delay Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sessions/extend
 * Staff approval and execution of a 15-minute session extension
 */
router.post('/extend', authenticateAdminToken, requirePermission('booking.extend'), async (req, res) => {
  try {
    const { bookingId, extensionMinutes = 15, isFree = false, chargePaise = 0, reason = '' } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId is required.' });

    const booking = await dbAsync.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });

    if (booking.booking_status === 'Cancelled') {
      return res.status(409).json({ success: false, error: 'Cannot extend a cancelled booking.' });
    }

    const facilityId = booking.physical_facility_id || booking.facility_id;
    let scheduledStart = booking.scheduled_start_at;
    let scheduledEnd = booking.scheduled_end_at;
    if (!scheduledStart || !scheduledEnd) {
      const norm = normalizeBookingInterval({ date: booking.date, timeSlot: booking.time_slot });
      scheduledStart = norm.startAt.toISOString();
      scheduledEnd = norm.endAt.toISOString();
    }

    const currentEndDate = new Date(scheduledEnd);
    const proposedEndDate = new Date(currentEndDate.getTime() + (Number(extensionMinutes) || 15) * 60000);

    // Conflict Check against NEXT bookings or blocks on the SAME physical resource
    const conflictResult = await findResourceConflicts(dbAsync, {
      facilityId,
      startAt: currentEndDate.toISOString(),
      endAt: proposedEndDate.toISOString(),
      excludeBookingId: bookingId
    });

    if (conflictResult.hasConflict) {
      const firstConflict = conflictResult.conflicts[0];
      return res.status(409).json({
        success: false,
        error: `Cannot extend session: Conflicting reservation or block (${firstConflict.conflictType}) detected starting at ${firstConflict.interval.startAt.toISOString()}.`,
        conflicts: conflictResult.conflicts
      });
    }

    // Validate extension rule parameters
    const extensionValidation = validateSessionExtension({
      currentScheduledEndAt: scheduledEnd,
      extensionMinutes: Number(extensionMinutes) || 15,
      isApprovedByStaff: true
    });

    if (!extensionValidation.valid) {
      return res.status(400).json({ success: false, error: extensionValidation.error });
    }

    const operatorId = req.admin?.username || 'staff';
    let session = await dbAsync.get('SELECT * FROM facility_sessions WHERE booking_id = ?', [bookingId]);

    if (!session) {
      const sessionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await dbAsync.run(
        `INSERT INTO facility_sessions (id, booking_id, facility_id, scheduled_start_at, scheduled_end_at, session_status, operator_id)
         VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', ?)`,
        [sessionId, bookingId, facilityId, scheduledStart, scheduledEnd, operatorId]
      );
      session = await dbAsync.get('SELECT * FROM facility_sessions WHERE id = ?', [sessionId]);
    }

    // Record adjustment entry
    const adjId = `adj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await dbAsync.run(
      `INSERT INTO session_adjustments (id, session_id, adjustment_type, minutes, is_free, charge_paise, approved_by, reason)
       VALUES (?, ?, 'EXTENSION', ?, ?, ?, ?, ?)`,
      [adjId, session.id, Number(extensionMinutes) || 15, isFree ? 1 : 0, Number(chargePaise) || 0, operatorId, reason || 'Staff Approved Extension']
    );

    // Update session scheduled end
    await dbAsync.run(
      `UPDATE facility_sessions
       SET scheduled_end_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [proposedEndDate.toISOString(), session.id]
    );

    // Update booking scheduled end and time slot
    await dbAsync.run(
      `UPDATE bookings
       SET scheduled_end_at = ?
       WHERE id = ?`,
      [proposedEndDate.toISOString(), bookingId]
    );

    res.json({
      success: true,
      bookingId,
      extensionMinutes: Number(extensionMinutes) || 15,
      newScheduledEndAt: proposedEndDate.toISOString(),
      isFree: Boolean(isFree),
      chargePaise: Number(chargePaise) || 0,
      approvedBy: operatorId,
      message: `Session extended by ${extensionMinutes} minutes until ${proposedEndDate.toLocaleTimeString()}.`
    });
  } catch (err) {
    console.error('[Session Extension Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

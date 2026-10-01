import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { requirePermission } from '../domain/rbac/rbacEngine.js';
import { validateSessionExtension, computeSessionMetrics } from '../domain/session/sessionOperations.js';
import { normalizeBookingInterval } from '../domain/time/bookingInterval.js';
import { findResourceConflicts } from '../domain/booking/conflictEngine.js';
import { canTransitionBookingStatus } from '../domain/booking/bookingStateMachine.js';

const router = express.Router();

const PERSISTED_BOOKING_STATUS = Object.freeze({
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked-in',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
});

const validateSessionTransition = (booking, nextStatus, action) => {
  const transition = canTransitionBookingStatus(booking.booking_status, nextStatus);
  if (!transition.valid) {
    return {
      valid: false,
      error: `Cannot ${action} while this booking is ${booking.booking_status}. ${transition.error}`,
    };
  }
  return { valid: true, status: PERSISTED_BOOKING_STATUS[transition.toStatus] };
};

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

    const transition = validateSessionTransition(booking, 'CHECKED_IN', 'check in this booking');
    if (!transition.valid) return res.status(409).json({ success: false, error: transition.error });

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
      'UPDATE bookings SET booking_status = ? WHERE id = ?',
      [transition.status, bookingId]
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

    const transition = validateSessionTransition(booking, 'IN_PROGRESS', 'start this session');
    if (!transition.valid) return res.status(409).json({ success: false, error: transition.error });

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
      'UPDATE bookings SET booking_status = ? WHERE id = ?',
      [transition.status, bookingId]
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

    const transition = validateSessionTransition(booking, 'COMPLETED', 'complete this session');
    if (!transition.valid) return res.status(409).json({ success: false, error: transition.error });

    const actualEnd = new Date().toISOString();
    const existingSession = await dbAsync.get('SELECT * FROM facility_sessions WHERE booking_id = ?', [bookingId]);
    const operatorId = req.admin?.username || 'staff';

    if (!existingSession) {
      return res.status(409).json({ success: false, error: 'This session has not been started and cannot be completed.' });
    }
    await dbAsync.run(
      `UPDATE facility_sessions
       SET actual_end_at = ?, session_status = 'COMPLETED', operator_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [actualEnd, operatorId, existingSession.id]
    );

    await dbAsync.run(
      'UPDATE bookings SET booking_status = ? WHERE id = ?',
      [transition.status, bookingId]
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

    const normalizedStatus = String(booking.booking_status || '').toUpperCase().replace(/[- ]/g, '_');
    if (!['CHECKED_IN', 'IN_PROGRESS'].includes(normalizedStatus)) {
      return res.status(409).json({ success: false, error: 'A delay can only be recorded after check-in and before session completion.' });
    }

    const operatorId = req.admin?.username || 'staff';
    const existingSession = await dbAsync.get('SELECT * FROM facility_sessions WHERE booking_id = ?', [bookingId]);

    if (!existingSession) {
      return res.status(409).json({ success: false, error: 'No active ground session exists for this booking.' });
    }
    await dbAsync.run(
      `UPDATE facility_sessions
       SET delay_minutes = ?, delay_reason = ?, notes = ?, operator_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [Number(delayMinutes) || 0, delayReason || 'Ground Delay', notes || '', operatorId, existingSession.id]
    );

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

    const normalizedStatus = String(booking.booking_status || '').toUpperCase().replace(/[- ]/g, '_');
    if (normalizedStatus !== 'IN_PROGRESS') {
      return res.status(409).json({ success: false, error: 'Only an in-progress session can be extended.' });
    }

    const requestedExtensionMinutes = Number(extensionMinutes);
    if (!Number.isInteger(requestedExtensionMinutes) || requestedExtensionMinutes <= 0) {
      return res.status(400).json({ success: false, error: 'Extension minutes must be a positive whole number.' });
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
    const proposedEndDate = new Date(currentEndDate.getTime() + requestedExtensionMinutes * 60000);

    // Validate extension rule parameters before entering transaction
    const extensionValidation = validateSessionExtension({
      currentScheduledEndAt: scheduledEnd,
      extensionMinutes: requestedExtensionMinutes,
      isApprovedByStaff: true
    });

    if (!extensionValidation.valid) {
      return res.status(400).json({ success: false, error: extensionValidation.error });
    }

    const operatorId = req.admin?.username || 'staff';
    const session = await dbAsync.get('SELECT * FROM facility_sessions WHERE booking_id = ?', [bookingId]);
    if (!session) {
      return res.status(409).json({ success: false, error: 'No active ground session exists for this booking.' });
    }

    // Conflict check + all writes inside a single serialized transaction with
    // physical-resource lock. Prevents concurrent extensions from both passing
    // the read before either write commits.
    let conflictResult;
    await dbAsync.withTransaction(async (client) => {
      if (client.isPostgres) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`extend_lock_${facilityId}`]);
      }

      // Re-check conflicts inside the transaction
      conflictResult = await findResourceConflicts(client, {
        facilityId,
        startAt: currentEndDate.toISOString(),
        endAt: proposedEndDate.toISOString(),
        excludeBookingId: bookingId
      });

      if (conflictResult.hasConflict) {
        const firstConflict = conflictResult.conflicts[0];
        const err = new Error(
          `Cannot extend session: Conflicting reservation or block (${firstConflict.conflictType}) detected starting at ${firstConflict.interval?.startAt?.toISOString() ?? firstConflict.startAt}.`
        );
        err.conflicts = conflictResult.conflicts;
        err.httpStatus = 409;
        throw err;
      }

      // Record adjustment entry
      const adjId = `adj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await client.run(
        `INSERT INTO session_adjustments (id, session_id, adjustment_type, minutes, is_free, charge_paise, approved_by, reason)
         VALUES (?, ?, 'EXTENSION', ?, ?, ?, ?, ?)`,
        [adjId, session.id, requestedExtensionMinutes, isFree ? 1 : 0, Number(chargePaise) || 0, operatorId, reason || 'Staff Approved Extension']
      );

      // The session keeps its contractual scheduled end; the booking interval
      // carries the current occupied end and the adjustment is the immutable
      // audit record. This avoids counting the same extension twice.
      await client.run(
        `UPDATE bookings SET scheduled_end_at = ? WHERE id = ?`,
        [proposedEndDate.toISOString(), bookingId]
      );
    });

    res.json({
      success: true,
      bookingId,
      extensionMinutes: requestedExtensionMinutes,
      newScheduledEndAt: proposedEndDate.toISOString(),
      isFree: Boolean(isFree),
      chargePaise: Number(chargePaise) || 0,
      approvedBy: operatorId,
      message: `Session extended by ${extensionMinutes} minutes until ${proposedEndDate.toLocaleTimeString()}.`
    });
  } catch (err) {
    if (err.httpStatus === 409) {
      return res.status(409).json({ success: false, error: err.message, conflicts: err.conflicts });
    }
    console.error('[Session Extension Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

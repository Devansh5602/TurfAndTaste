import express from 'express';
import dbAsync from '../db.js';
import { attachOptionalAdmin, authenticateAdminToken } from '../middleware/auth.js';
import { verifyQuoteToken } from '../utils/quoteToken.js';
import { dayOfWeekForVenueDate, normalizeScheduleClose, slotHasStarted, venueNow } from '../utils/venueTime.js';
import { canAccessBookingHistory, resolveBookingHistoryLookup } from '../domain/guest/guestPrivacy.js';
import { canTransitionBookingStatus } from '../domain/booking/bookingStateMachine.js';
import { normalizeBookingInterval } from '../domain/time/bookingInterval.js';
import { validateLeadTime } from '../domain/booking/bookingRules.js';
import { requirePermission } from '../domain/rbac/rbacEngine.js';
import {
  createCanonicalBooking,
  createCanonicalPaymentHold,
  getCanonicalResourceAvailability,
  checkCanonicalConflicts,
  resolveCanonicalFacility
} from '../domain/booking/canonicalBookingCommand.js';

const router = express.Router();

const parseSlotRange = (timeSlot) => {
  const parts = String(timeSlot || '').split(/[–—-]/).map(part => part.trim());
  const toMinutes = (value) => {
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (match[3].toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };
  if (parts.length < 2) return null;
  const start = toMinutes(parts[0]);
  let end = toMinutes(parts[1]);
  if (start === null || end === null) return null;
  if (end <= start) end += 1440;
  return { start, end };
};

const slotsOverlap = (first, second) => first.start < second.end && second.start < first.end;

/**
 * GET /api/bookings
 * Get all bookings with filtering options (Requires booking.read)
 */
router.get('/', authenticateAdminToken, requirePermission('booking.read'), async (req, res) => {

  try {
    const { facilityId, status, date, search } = req.query;

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (facilityId && facilityId !== 'all') {
      query += ' AND facility_id = ?';
      params.push(facilityId);
    }

    if (status && status !== 'all') {
      query += ' AND booking_status = ?';
      params.push(status);
    }

    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }

    if (search) {
      query += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ? OR id LIKE ? OR team_name LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    query += ' ORDER BY created_at DESC';

    const rawBookings = await dbAsync.all(query, params);

    const formattedBookings = rawBookings.map(b => ({
      id: b.id,
      facilityId: b.facility_id,
      facilityName: b.facility_name,
      date: b.date,
      time: b.time_slot,
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      customerEmail: b.customer_email || 'N/A',
      teamName: b.team_name || '',
      duration: b.duration,
      paymentType: b.payment_type,
      amount: b.amount_paid,
      paymentStatus: b.payment_status,
      status: b.booking_status,
      paymentId: b.payment_id,
      createdAt: b.created_at
    }));

    res.json({ success: true, count: formattedBookings.length, bookings: formattedBookings });
  } catch (err) {
    console.error('[Bookings API Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/bookings/history
 * Search Customer Booking History by Phone or Email (Protected)
 */
router.get('/history', attachOptionalAdmin, async (req, res) => {
  try {
    const { phone, email } = req.query;

    let cleanPhone = String(phone || '').replace(/\D/g, '');
    let cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[6-9]\d{9}$/.test(cleanPhone) && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Enter the full 10-digit mobile number or a valid email address used for the booking.' });
    }

    const access = canAccessBookingHistory(req);
    if (!access.allowed) {
      return res.status(401).json({ success: false, error: access.error });
    }
    const lookup = resolveBookingHistoryLookup(access, { phone: cleanPhone, email: cleanEmail });
    if (!lookup.valid) {
      return res.status(403).json({ success: false, error: lookup.error });
    }
    cleanPhone = lookup.phone;
    cleanEmail = lookup.email;

    let query = 'SELECT * FROM bookings WHERE 1=0';
    const params = [];

    if (/^[6-9]\d{9}$/.test(cleanPhone)) {
      query += ' OR customer_phone = ?';
      params.push(cleanPhone);
    }

    if (/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      query += ' OR LOWER(customer_email) = ?';
      params.push(cleanEmail);
    }

    query += ' ORDER BY date DESC, created_at DESC';

    const rawHistory = await dbAsync.all(query, params);
    const history = rawHistory.map(b => ({
      id: b.id,
      facilityId: b.facility_id,
      facilityName: b.facility_name,
      date: b.date,
      time: b.time_slot,
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      customerEmail: b.customer_email,
      teamName: b.team_name,
      duration: b.duration,
      paymentType: b.payment_type,
      amount: b.amount_paid,
      paymentStatus: b.payment_status,
      status: b.booking_status,
      paymentId: b.payment_id,
      createdAt: b.created_at
    }));

    res.json({ success: true, count: history.length, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/bookings/slots
 * Get Slot availability for facility and date
 */
router.get('/slots', async (req, res) => {
  try {
    const { facilityId, date } = req.query;
    const duration = Math.max(1, Math.min(6, Number(req.query.duration) || 1));
    const targetDate = date || venueNow().date;
    if (!facilityId || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({ success: false, error: 'A facility and valid booking date are required.' });
    }
    if (targetDate < venueNow().date) {
      return res.status(409).json({ success: false, error: 'Past dates cannot be booked.' });
    }
    const formatTime = (minutes) => {
      const normalized = minutes % 1440;
      const hours = Math.floor(normalized / 60);
      const mins = normalized % 60;
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      return `${String(displayHour).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
    };
    const facility = await dbAsync.get(
      "SELECT id FROM facility_profiles WHERE id = ? AND status = 'active' AND booking_enabled = ?",
      [facilityId, dbAsync.isPostgres() ? true : 1],
    );
    if (!facility) return res.status(404).json({ success: false, error: 'This facility is not currently bookable.' });
    const schedule = await dbAsync.get(
      'SELECT * FROM facility_schedules WHERE facility_id = ? AND day_of_week = ? AND is_bookable = ?',
      [facilityId, dayOfWeekForVenueDate(targetDate), dbAsync.isPostgres() ? true : 1],
    );
    if (!schedule) return res.status(409).json({ success: false, error: 'This facility is closed on the selected day.' });
    const timings = await dbAsync.get('SELECT floodlight_start FROM timings WHERE id = 1');
    const floodlight = parseSlotRange(`12:00 AM – ${timings?.floodlight_start || '06:00 PM'}`)?.end ?? 1080;
    const allSlots = [];
    const durationMinutes = duration * 60;
    const closesAt = normalizeScheduleClose(schedule.opens_at_minutes, schedule.closes_at_minutes);
    for (let start = schedule.opens_at_minutes; start + durationMinutes <= closesAt; start += schedule.slot_minutes || 60) {
      if (slotHasStarted(targetDate, start)) continue;
      const peak = start >= floodlight;
      allSlots.push({
        time: `${formatTime(start)} – ${formatTime(start + durationMinutes)}`,
        category: peak ? 'Floodlit Session' : 'Day Session',
        peak
      });
    }

    let bookedSlots = [];
    let blockedSlots = [];
    if (facilityId) {
      const existing = await dbAsync.all(
        "SELECT time_slot FROM bookings WHERE facility_id = ? AND date = ? AND booking_status != 'Cancelled'",
        [facilityId, targetDate]
      );
      bookedSlots = existing;

      const blocked = await dbAsync.all(
        "SELECT time_slot, reason FROM blocked_slots WHERE facility_id = ? AND date = ?",
        [facilityId, targetDate]
      );
      blockedSlots = blocked;
    }

    const slotsWithStatus = allSlots.map(slot => {
      const slotRange = parseSlotRange(slot.time);
      const isBooked = bookedSlots.some(booking => {
        const bookingRange = parseSlotRange(booking.time_slot);
        return slotRange && bookingRange ? slotsOverlap(slotRange, bookingRange) : booking.time_slot === slot.time;
      });
      const blockedSlot = blockedSlots.find(blocked => {
        const blockedRange = parseSlotRange(blocked.time_slot);
        return slotRange && blockedRange ? slotsOverlap(slotRange, blockedRange) : blocked.time_slot === slot.time;
      });
      const isBlocked = Boolean(blockedSlot);
      const isPrimeEvening = slot.peak && slotRange && slotRange.start >= 1080 && slotRange.start < 1260;
      return {
        ...slot,
        status: isBooked ? 'booked' : (isBlocked ? 'maintenance' : (isPrimeEvening ? 'fast-filling' : 'available')),
        maintenanceReason: blockedSlot?.reason || null
      };
    });

    res.json({ success: true, date: targetDate, facilityId, slots: slotsWithStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bookings/hold
 * Create temporary payment hold on physical facility
 */
router.post('/hold', async (req, res) => {
  try {
    const result = await createCanonicalPaymentHold(dbAsync, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(409).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bookings
 * Create new booking reservation via canonical booking engine
 */
router.post('/', attachOptionalAdmin, async (req, res) => {
  try {
    const payload = req.body;
    const isAdminReservation = Boolean(req.admin);

    // If staff walk-in, check permission
    if (isAdminReservation) {
      let permissions = req.admin.permissions;
      if (!Array.isArray(permissions) || permissions.length === 0) {
        const { loadUserPermissions } = await import('../domain/rbac/rbacEngine.js');
        permissions = await loadUserPermissions(dbAsync, 'admin', req.admin.id || req.admin.userId || 1, req.admin.role);
      }
      const { hasPermission } = await import('../domain/rbac/rbacEngine.js');
      if (!hasPermission(permissions, 'booking.create_walkin') && req.admin.role !== 'super_admin') {
        return res.status(403).json({ success: false, error: 'Forbidden: Missing required permission "booking.create_walkin".' });
      }
    }

    const customerName = (payload.customer?.name || payload.customerName || '').trim();
    const customerPhone = (payload.customer?.phone || payload.customerPhone || '').trim();
    const customerEmail = (payload.customer?.email || payload.customerEmail || '').trim();
    const date = (payload.date || '').trim();
    const timeSlot = (payload.slot?.time || payload.time || '').trim();
    const facilityId = (payload.facilityId || payload.physicalFacilityId || '').trim();

    // Strict Validation
    if (!customerName || customerName.length < 2) {
      return res.status(400).json({ success: false, error: 'Customer name is required (minimum 2 characters).' });
    }

    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ success: false, error: 'A valid 10-digit customer phone number is required.' });
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      return res.status(400).json({ success: false, error: 'Valid booking date (YYYY-MM-DD) is required.' });
    }

    if (!timeSlot && !payload.startAt) {
      return res.status(400).json({ success: false, error: 'Booking time slot is required.' });
    }

    if (!facilityId) {
      return res.status(400).json({ success: false, error: 'Facility selection is required.' });
    }

    const submittedPaymentId = String(payload.paymentId || '').trim();
    if (!isAdminReservation && submittedPaymentId.length < 8) {
      return res.status(400).json({ success: false, error: 'Enter a valid UPI transaction reference so staff can review the reservation.' });
    }

    const duration = payload.duration || 1;
    const paymentType = payload.paymentType || 'deposit';
    let verifiedQuote = null;

    if (!isAdminReservation) {
      const verification = verifyQuoteToken(payload.quote?.quoteToken || payload.quoteToken);
      if (verification.error) return res.status(400).json({ success: false, error: verification.error });
      verifiedQuote = verification.quote;
      if (verifiedQuote.facilityId !== facilityId || verifiedQuote.date !== date || verifiedQuote.timeSlot !== timeSlot || verifiedQuote.durationHours !== (Number(duration) || 1)) {
        return res.status(409).json({ success: false, error: 'Booking details changed. Please refresh your quote.' });
      }
    }

    // Execute Canonical Booking Command
    let result;
    try {
      result = await createCanonicalBooking(dbAsync, {
        id: payload.id,
        actor: isAdminReservation ? { type: 'STAFF', username: req.admin.username } : { type: 'CUSTOMER', username: 'guest' },
        source: isAdminReservation ? 'STAFF_WALKIN' : 'CUSTOMER_APP',
        customer: {
          name: customerName,
          phone: cleanPhone,
          email: customerEmail,
          teamName: payload.customer?.teamName || payload.teamName || ''
        },
        physicalFacilityId: facilityId,
        facilityId,
        serviceId: payload.serviceId || null,
        addOnIds: payload.addOnIds || [],
        startAt: payload.startAt,
        endAt: payload.endAt,
        date,
        timeSlot,
        durationHours: Number(duration) || 1,
        bookingMode: payload.bookingType || 'STANDARD_QUICK',
        deliveryPreference: payload.deliveryPreference || 'WHATSAPP',
        // status is NOT forwarded from client — it is server-derived in canonicalBookingCommand
        payment: {
          type: paymentType,
          totalAmountPaise: verifiedQuote ? verifiedQuote.total * 100 : (payload.amount ? Math.round(parseFloat(String(payload.amount).replace(/[^0-9.]/g, '')) * 100) : 0),
          depositAmountPaise: verifiedQuote ? verifiedQuote.deposit * 100 : 0,
          paymentStatus: isAdminReservation ? (payload.paymentStatus || 'Paid') : 'Pending verification',
          paymentId: submittedPaymentId || (isAdminReservation ? 'counter-payment' : null)
        },
        holdToken: payload.holdToken || null
      });

    } catch (cmdErr) {
      const errMsg = cmdErr.message || 'Booking creation failed.';
      const isConflict = /prevented|conflict|already reserved|lead time|threshold/i.test(errMsg);
      return res.status(isConflict ? 409 : 400).json({ success: false, error: errMsg });
    }

    if (verifiedQuote) {
      try {
        await dbAsync.run(
          'INSERT INTO quote_redemptions (quote_id, booking_id, expires_at) VALUES (?, ?, ?)',
          [verifiedQuote.quoteId, result.bookingId, new Date(verifiedQuote.exp * 1000).toISOString()]
        );
      } catch (e) {
        // Redundancy check
      }
    }

    const amountPaid = verifiedQuote
      ? `₹${paymentType === 'full' ? verifiedQuote.total : verifiedQuote.deposit} (${paymentType === 'full' ? 'Full Payment' : 'Token Deposit'})`
      : (payload.amount || (paymentType === 'full' ? 'Full payment recorded' : 'Token deposit recorded'));

    res.status(201).json({
      success: true,
      bookingReference: result.bookingId,
      booking: {
        id: result.bookingId,
        facilityId: result.physicalFacilityId,
        facilityName: result.facilityName,
        date,
        time: timeSlot,
        customerName: result.customer.name,
        customerPhone: result.customer.phone,
        customerEmail: result.customer.email,
        teamName: payload.teamName || '',
        duration,
        paymentType,
        amount: amountPaid,
        paymentStatus: result.payment.paymentStatus,
        status: result.bookingStatus,
        paymentId: submittedPaymentId || (isAdminReservation ? 'counter-payment' : null)
      },
      message: isAdminReservation
        ? 'Walk-in booking saved.'
        : 'UPI reference received. The reservation is awaiting staff payment review.'
    });
  } catch (err) {
    console.error('[Create Booking Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/bookings/:id/status
 * Update Booking Status
 */
router.put('/:id/status', authenticateAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const existing = await dbAsync.get('SELECT id, booking_status FROM bookings WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    const check = canTransitionBookingStatus(existing.booking_status, status);
    if (!check.valid) {
      return res.status(409).json({ success: false, error: check.error });
    }

    const isCancelling = check.toStatus === 'CANCELLED';
    const requiredPerm = isCancelling ? 'booking.cancel' : 'booking.update';

    let permissions = req.admin.permissions;
    if (!Array.isArray(permissions) || permissions.length === 0) {
      const { loadUserPermissions } = await import('../domain/rbac/rbacEngine.js');
      permissions = await loadUserPermissions(dbAsync, 'admin', req.admin.id || req.admin.userId || 1, req.admin.role);
    }
    const { hasPermission } = await import('../domain/rbac/rbacEngine.js');
    if (!hasPermission(permissions, requiredPerm) && req.admin.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: `Forbidden: Missing required permission "${requiredPerm}".` });
    }

    const cancellationActor = isCancelling ? (req.admin?.username || 'admin') : null;
    const cancelledAt = isCancelling ? new Date().toISOString() : null;

    let updateSql = 'UPDATE bookings SET booking_status = ?';
    const params = [status];
    if (isCancelling) {
      updateSql += ', cancellation_actor = ?, cancelled_at = ?';
      params.push(cancellationActor, cancelledAt);
    }
    updateSql += ' WHERE id = ?';
    params.push(id);

    const result = await dbAsync.run(updateSql, params);
    if (!result.rowCount) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    res.json({ success: true, bookingId: id, newStatus: status, isTerminal: isCancelling });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/bookings/:id
 * Cancels and preserves booking history (Soft-cancel); does not erase audit trail.
 */
router.delete('/:id', authenticateAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    let permissions = req.admin.permissions;
    if (!Array.isArray(permissions) || permissions.length === 0) {
      const { loadUserPermissions } = await import('../domain/rbac/rbacEngine.js');
      permissions = await loadUserPermissions(dbAsync, 'admin', req.admin.id || req.admin.userId || 1, req.admin.role);
    }
    const { hasPermission } = await import('../domain/rbac/rbacEngine.js');
    if (!hasPermission(permissions, 'booking.cancel') && req.admin.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Missing required permission "booking.cancel".' });
    }

    const existing = await dbAsync.get('SELECT id, booking_status FROM bookings WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    const check = canTransitionBookingStatus(existing.booking_status, 'CANCELLED');
    if (!check.valid) {
      return res.status(409).json({ success: false, error: check.error });
    }

    const cancellationActor = req.admin?.username || 'admin';
    const cancelledAt = new Date().toISOString();

    await dbAsync.run(
      'UPDATE bookings SET booking_status = ?, cancellation_actor = ?, cancelled_at = ? WHERE id = ?',
      ['Cancelled', cancellationActor, cancelledAt, id]
    );

    res.json({ success: true, bookingId: id, status: 'Cancelled', message: 'Booking cancelled and inventory released; historical record preserved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/bookings/blocked-slots
 * Get list of currently blocked slots
 */
router.get('/blocked-slots', authenticateAdminToken, requirePermission('booking.read'), async (req, res) => {
  try {
    const { facilityId, date } = req.query;
    let query = 'SELECT * FROM blocked_slots WHERE 1=1';
    const params = [];
    if (facilityId) {
      query += ' AND facility_id = ?';
      params.push(facilityId);
    }
    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }
    query += ' ORDER BY date DESC, time_slot ASC';
    const blocked = await dbAsync.all(query, params);
    res.json({ success: true, blockedSlots: blocked });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bookings/block-slot
 * Admin blocks a slot for maintenance or private tournament
 */
router.post('/block-slot', authenticateAdminToken, requirePermission('facility.block'), async (req, res) => {
  try {
    const { facilityId, date, timeSlot, reason } = req.body;
    if (!facilityId || !date || !timeSlot) {
      return res.status(400).json({ success: false, error: 'facilityId, date, and timeSlot are required' });
    }

    await dbAsync.run(
      `INSERT INTO blocked_slots (facility_id, date, time_slot, reason, blocked_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (facility_id, date, time_slot) DO UPDATE
       SET reason = EXCLUDED.reason`,
      [facilityId, date, timeSlot, reason || 'Maintenance', req.admin?.username || 'admin']
    );

    res.json({ success: true, message: `Slot ${timeSlot} on ${date} successfully blocked.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/bookings/unblock-slot
 * Admin releases a blocked slot
 */
router.delete('/unblock-slot', authenticateAdminToken, requirePermission('facility.block'), async (req, res) => {

  try {
    const { facilityId, date, timeSlot } = req.body;
    if (!facilityId || !date || !timeSlot) {
      return res.status(400).json({ success: false, error: 'facilityId, date, and timeSlot are required' });
    }

    await dbAsync.run(
      'DELETE FROM blocked_slots WHERE facility_id = ? AND date = ? AND time_slot = ?',
      [facilityId, date, timeSlot]
    );

    res.json({ success: true, message: `Slot ${timeSlot} on ${date} unblocked and released.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

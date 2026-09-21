import express from 'express';
import dbAsync from '../db.js';
import { attachOptionalAdmin, authenticateAdminToken } from '../middleware/auth.js';

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
 * Get all bookings with filtering options
 */
router.get('/', authenticateAdminToken, async (req, res) => {
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
 * Search Customer Booking History by Phone or Email
 */
router.get('/history', async (req, res) => {
  try {
    const { phone, email } = req.query;

    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[6-9]\d{9}$/.test(cleanPhone) && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Enter the full 10-digit mobile number or a valid email address used for the booking.' });
    }

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
    const targetDate = date || new Date().toISOString().split('T')[0];
    const formatTime = (minutes) => {
      const normalized = minutes % 1440;
      const hours = Math.floor(normalized / 60);
      const mins = normalized % 60;
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      return `${String(displayHour).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
    };
    const allSlots = [];
    const durationMinutes = duration * 60;
    for (let start = 360; start + durationMinutes <= 1800; start += 60) {
      const peak = start >= 1080;
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
 * POST /api/bookings
 * Create new booking reservation
 */
router.post('/', attachOptionalAdmin, async (req, res) => {
  try {
    const payload = req.body;

    const customerName = (payload.customer?.name || payload.customerName || '').trim();
    const customerPhone = (payload.customer?.phone || payload.customerPhone || '').trim();
    const customerEmail = (payload.customer?.email || payload.customerEmail || '').trim();
    const date = (payload.date || '').trim();
    const timeSlot = (payload.slot?.time || payload.time || '').trim();
    const facilityId = (payload.facilityId || '').trim();
    const facilityName = (payload.facilityName || '').trim() || facilityId;

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

    if (!timeSlot) {
      return res.status(400).json({ success: false, error: 'Booking time slot is required.' });
    }

    if (!facilityId) {
      return res.status(400).json({ success: false, error: 'Facility selection is required.' });
    }

    // Double-Booking Prevention: Check if slot is already reserved
    const requestedRange = parseSlotRange(timeSlot);
    const existingBookings = await dbAsync.all(
      "SELECT id, customer_name, time_slot FROM bookings WHERE facility_id = ? AND date = ? AND booking_status != 'Cancelled'",
      [facilityId, date]
    );
    const existingBooking = existingBookings.find(booking => {
      const bookingRange = parseSlotRange(booking.time_slot);
      return requestedRange && bookingRange ? slotsOverlap(requestedRange, bookingRange) : booking.time_slot === timeSlot;
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        error: `The time slot "${timeSlot}" on ${date} is already reserved. Please select an available slot.`
      });
    }

    // Check if slot is blocked by Admin
    const blockedSlots = await dbAsync.all(
      "SELECT id, reason, time_slot FROM blocked_slots WHERE facility_id = ? AND date = ?",
      [facilityId, date]
    );
    const blockedSlot = blockedSlots.find(blocked => {
      const blockedRange = parseSlotRange(blocked.time_slot);
      return requestedRange && blockedRange ? slotsOverlap(requestedRange, blockedRange) : blocked.time_slot === timeSlot;
    });

    if (blockedSlot) {
      return res.status(409).json({
        success: false,
        error: `This time slot is temporarily blocked for facility maintenance${blockedSlot.reason ? ` (${blockedSlot.reason})` : ''}. Please choose another slot.`
      });
    }

    const id = payload.id || `TT-${Math.floor(100000 + Math.random() * 900000)}`;
    const teamName = payload.customer?.teamName || payload.teamName || '';
    const duration = payload.duration || 1;
    const paymentType = payload.paymentType || 'deposit';
    const amountPaid = payload.amount || (paymentType === 'full' ? 'Full payment recorded' : 'Token deposit recorded');
    const isAdminReservation = Boolean(req.admin);
    const submittedPaymentId = String(payload.paymentId || '').trim();

    // A public POST is exclusively the direct-UPI review flow. Paid/confirmed
    // state is owned by the cryptographically verified gateway endpoint, never
    // by fields supplied from a browser. Counter staff can create checked-in
    // walk-ins through their authenticated session.
    if (!isAdminReservation && submittedPaymentId.length < 8) {
      return res.status(400).json({ success: false, error: 'Enter a valid UPI transaction reference so staff can review the reservation.' });
    }

    const allowedAdminStatuses = new Set(['Confirmed', 'Checked-in', 'Completed', 'Cancelled', 'Payment Review']);
    const paymentStatus = isAdminReservation
      ? (payload.paymentStatus || 'Paid')
      : 'Pending verification';
    const paymentId = submittedPaymentId || (isAdminReservation ? 'counter-payment' : null);
    const bookingStatus = isAdminReservation && allowedAdminStatuses.has(payload.status)
      ? payload.status
      : 'Payment Review';

    await dbAsync.run(
      `INSERT INTO bookings (
        id, facility_id, facility_name, date, time_slot, customer_name,
        customer_phone, customer_email, team_name, duration, payment_type,
        amount_paid, payment_status, booking_status, payment_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, facilityId, facilityName, date, timeSlot, customerName,
        customerPhone, customerEmail, teamName, duration, paymentType,
        amountPaid, paymentStatus, bookingStatus, paymentId
      ]
    );

    res.status(201).json({
      success: true,
      bookingReference: id,
      booking: {
        id,
        facilityId,
        facilityName,
        date,
        time: timeSlot,
        customerName,
        customerPhone,
        customerEmail,
        teamName,
        duration,
        paymentType,
        amount: amountPaid,
        paymentStatus,
        status: bookingStatus,
        paymentId
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
    const allowedStatuses = new Set(['Confirmed', 'Checked-in', 'Completed', 'Cancelled']);

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ success: false, error: 'Choose a valid booking status.' });
    }

    const result = await dbAsync.run('UPDATE bookings SET booking_status = ? WHERE id = ?', [status, id]);
    if (!result.rowCount) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    res.json({ success: true, bookingId: id, newStatus: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/bookings/:id
 * Permanently delete a booking after the management UI's confirmation/undo window.
 */
router.delete('/:id', authenticateAdminToken, async (req, res) => {
  try {
    const result = await dbAsync.run('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    if (!result.rowCount) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }
    res.json({ success: true, bookingId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/bookings/blocked-slots
 * Get list of currently blocked slots
 */
router.get('/blocked-slots', authenticateAdminToken, async (req, res) => {
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
router.post('/block-slot', authenticateAdminToken, async (req, res) => {
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
router.delete('/unblock-slot', authenticateAdminToken, async (req, res) => {
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

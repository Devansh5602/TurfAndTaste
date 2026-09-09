import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/bookings
 * Get all bookings with filtering options
 */
router.get('/', async (req, res) => {
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

    if (!phone && !email) {
      return res.status(400).json({ success: false, error: 'Please provide phone or email parameter' });
    }

    let query = 'SELECT * FROM bookings WHERE 1=0';
    const params = [];

    if (phone) {
      query += ' OR customer_phone LIKE ?';
      params.push(`%${phone.trim()}%`);
    }

    if (email) {
      query += ' OR customer_email LIKE ?';
      params.push(`%${email.trim()}%`);
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
    const targetDate = date || new Date().toISOString().split('T')[0];

    const allSlots = [
      { time: '06:00 AM – 07:00 AM', category: 'Morning Early', peak: false },
      { time: '07:00 AM – 08:00 AM', category: 'Morning Early', peak: false },
      { time: '08:00 AM – 09:00 AM', category: 'Morning Prime', peak: false },
      { time: '09:00 AM – 10:00 AM', category: 'Morning', peak: false },
      { time: '10:00 AM – 11:00 AM', category: 'Morning', peak: false },
      { time: '11:00 AM – 12:00 PM', category: 'Afternoon', peak: false },
      { time: '02:00 PM – 03:00 PM', category: 'Afternoon', peak: false },
      { time: '03:00 PM – 04:00 PM', category: 'Afternoon', peak: false },
      { time: '04:00 PM – 05:00 PM', category: 'Evening Floodlit', peak: true },
      { time: '05:00 PM – 06:00 PM', category: 'Evening Floodlit', peak: true },
      { time: '06:00 PM – 07:00 PM', category: 'Prime Floodlit', peak: true },
      { time: '07:00 PM – 08:00 PM', category: 'Prime Floodlit', peak: true },
      { time: '08:00 PM – 09:00 PM', category: 'Prime Floodlit', peak: true },
      { time: '09:00 PM – 10:00 PM', category: 'Night Floodlit', peak: true },
      { time: '10:00 PM – 11:00 PM', category: 'Night Floodlit', peak: true }
    ];

    let bookedSlots = [];
    if (facilityId) {
      const existing = await dbAsync.all(
        "SELECT time_slot FROM bookings WHERE facility_id = ? AND date = ? AND booking_status != 'Cancelled'",
        [facilityId, targetDate]
      );
      bookedSlots = existing.map(e => e.time_slot);
    }

    const slotsWithStatus = allSlots.map(slot => {
      const isBooked = bookedSlots.includes(slot.time);
      return {
        ...slot,
        status: isBooked ? 'booked' : (slot.peak ? 'fast-filling' : 'available')
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
router.post('/', async (req, res) => {
  try {
    const payload = req.body;

    const id = payload.id || `TT-${Math.floor(100000 + Math.random() * 900000)}`;
    const facilityId = payload.facilityId || 'box-cricket';
    const facilityName = payload.facilityName || 'Box Cricket Arena';
    const date = payload.date || new Date().toISOString().split('T')[0];
    const timeSlot = payload.slot?.time || payload.time || '06:00 PM – 07:00 PM';
    const customerName = payload.customer?.name || payload.customerName || 'Guest Player';
    const customerPhone = payload.customer?.phone || payload.customerPhone || 'N/A';
    const customerEmail = payload.customer?.email || payload.customerEmail || 'N/A';
    const teamName = payload.customer?.teamName || payload.teamName || '';
    const duration = payload.duration || 1;
    const paymentType = payload.paymentType || 'deposit';
    const amountPaid = payload.amount || (paymentType === 'full' ? '₹1200 (Full Paid)' : '₹500 (Token Deposit)');
    const paymentId = payload.paymentId || `pay_mock_${Date.now()}`;
    const bookingStatus = payload.status || 'Confirmed';

    await dbAsync.run(
      `INSERT INTO bookings (
        id, facility_id, facility_name, date, time_slot, customer_name,
        customer_phone, customer_email, team_name, duration, payment_type,
        amount_paid, payment_status, booking_status, payment_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', ?, ?)`,
      [
        id, facilityId, facilityName, date, timeSlot, customerName,
        customerPhone, customerEmail, teamName, duration, paymentType,
        amountPaid, bookingStatus, paymentId
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
        status: bookingStatus,
        paymentId
      },
      message: 'Booking successfully stored in Cloud Supabase Database'
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
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const result = await dbAsync.run('UPDATE bookings SET booking_status = ? WHERE id = ?', [status, id]);

    res.json({ success: true, bookingId: id, newStatus: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/bookings/:id
 * Delete or Cancel a booking
 */
router.delete('/:id', authenticateAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM bookings WHERE id = ?', [id]);
    res.json({ success: true, deletedId: id, message: 'Booking removed from system' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

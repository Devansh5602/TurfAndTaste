import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { requirePermission } from '../domain/rbac/rbacEngine.js';

const router = express.Router();

/**
 * GET /api/customers
 * Customer directory aggregated from verified bookings & customer records
 */
router.get('/', authenticateAdminToken, requirePermission('booking.read'), async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT 
        customer_phone,
        MAX(customer_name) as customer_name,
        MAX(customer_email) as customer_email,
        COUNT(id) as total_bookings,
        SUM(CASE WHEN payment_status = 'Paid' THEN total_amount_paise ELSE 0 END) as total_spent_paise,
        MAX(created_at) as last_booking_at,
        MIN(created_at) as first_booking_at
      FROM bookings
      WHERE customer_phone IS NOT NULL AND customer_phone != ''
    `;
    const params = [];

    if (search) {
      query += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' GROUP BY customer_phone ORDER BY last_booking_at DESC LIMIT 100';

    const customers = await dbAsync.all(query, params);

    // Fetch notes count for these customers
    const formatted = await Promise.all(customers.map(async (c) => {
      const notes = await dbAsync.all(
        'SELECT id, note, created_by, created_at FROM customer_notes WHERE customer_phone = ? ORDER BY created_at DESC',
        [c.customer_phone]
      );
      return {
        phone: c.customer_phone,
        name: c.customer_name || 'Guest Player',
        email: c.customer_email || 'N/A',
        totalBookings: Number(c.total_bookings) || 0,
        totalSpentPaise: Number(c.total_spent_paise) || 0,
        lastBookingAt: c.last_booking_at,
        firstBookingAt: c.first_booking_at,
        notes: notes || []
      };
    }));

    res.json({ success: true, count: formatted.length, customers: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/customers/:phone/bookings
 * Full chronological booking history for a specific customer
 */
router.get('/:phone/bookings', authenticateAdminToken, requirePermission('booking.read'), async (req, res) => {
  try {
    const { phone } = req.params;
    const bookings = await dbAsync.all(
      `SELECT * FROM bookings
       WHERE customer_phone = ?
       ORDER BY created_at DESC`,
      [phone]
    );

    const notes = await dbAsync.all(
      `SELECT * FROM customer_notes
       WHERE customer_phone = ?
       ORDER BY created_at DESC`,
      [phone]
    );

    res.json({ success: true, count: bookings.length, bookings, notes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/customers/:phone/notes
 * Add internal staff operational note on a customer
 */
router.post('/:phone/notes', authenticateAdminToken, requirePermission('booking.update'), async (req, res) => {
  try {
    const { phone } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, error: 'Note text is required.' });
    }

    const id = `cn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const createdBy = req.admin?.username || 'staff';

    await dbAsync.run(
      'INSERT INTO customer_notes (id, customer_phone, note, created_by) VALUES (?, ?, ?, ?)',
      [id, phone, note.trim(), createdBy]
    );

    const created = await dbAsync.get('SELECT * FROM customer_notes WHERE id = ?', [id]);
    res.status(201).json({ success: true, note: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

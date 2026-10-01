import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { requirePermission } from '../domain/rbac/rbacEngine.js';

const router = express.Router();

/**
 * GET /api/reviews
 * Publicly approved customer reviews
 */
router.get('/', async (req, res) => {
  try {
    const { facilityId } = req.query;
    let sql = "SELECT id, customer_name, facility_id, rating, comment, admin_response, created_at FROM reviews WHERE status = 'approved'";
    const params = [];
    if (facilityId) {
      sql += ' AND facility_id = ?';
      params.push(facilityId);
    }
    sql += ' ORDER BY created_at DESC LIMIT 50';
    const reviews = await dbAsync.all(sql, params);
    res.json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reviews/admin
 * Admin reviews queue for moderation (pending, approved, rejected)
 */
router.get('/admin', authenticateAdminToken, requirePermission('review.moderate'), async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM reviews';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const reviews = await dbAsync.all(sql, params);
    res.json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reviews
 * Customer or player submits a review
 */
router.post('/', async (req, res) => {
  try {
    const { customerName, customerPhone, facilityId, rating = 5, comment, bookingId } = req.body;
    if (!customerName || !comment) {
      return res.status(400).json({ success: false, error: 'Customer name and comment are required.' });
    }

    const numRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
    const id = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await dbAsync.run(
      `INSERT INTO reviews (id, booking_id, customer_name, customer_phone, facility_id, rating, comment, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, bookingId || null, customerName.trim(), customerPhone || null, facilityId || null, numRating, comment.trim()]
    );

    res.status(201).json({ success: true, message: 'Review submitted for moderation.', reviewId: id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/reviews/:id/status
 * Staff moderates a review (approved, rejected, pending)
 */
router.put('/:id/status', authenticateAdminToken, requirePermission('review.moderate'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending', 'hidden'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid review status.' });
    }

    const existing = await dbAsync.get('SELECT id FROM reviews WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    const moderator = req.admin?.username || 'admin';
    const now = new Date().toISOString();

    await dbAsync.run(
      'UPDATE reviews SET status = ?, moderated_by = ?, moderated_at = ? WHERE id = ?',
      [status, moderator, now, id]
    );

    res.json({ success: true, reviewId: id, status, message: `Review status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/reviews/:id/response
 * Staff adds a public management response to a review
 */
router.put('/:id/response', authenticateAdminToken, requirePermission('review.moderate'), async (req, res) => {
  try {
    const { id } = req.params;
    const { adminResponse } = req.body;

    const existing = await dbAsync.get('SELECT id FROM reviews WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    await dbAsync.run(
      'UPDATE reviews SET admin_response = ? WHERE id = ?',
      [adminResponse ? adminResponse.trim() : null, id]
    );

    res.json({ success: true, reviewId: id, adminResponse, message: 'Management response saved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reviews/:id/reply
 * Alias for review reply
 */
router.post('/:id/reply', authenticateAdminToken, requirePermission('review.moderate'), async (req, res) => {
  try {
    const { id } = req.params;
    const adminResponse = req.body.response || req.body.adminResponse;

    const existing = await dbAsync.get('SELECT id FROM reviews WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    await dbAsync.run(
      'UPDATE reviews SET admin_response = ? WHERE id = ?',
      [adminResponse ? adminResponse.trim() : null, id]
    );

    res.json({ success: true, reviewId: id, response: adminResponse, adminResponse, message: 'Management response saved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


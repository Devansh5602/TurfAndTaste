import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/inquiries
 * List all submitted inquiries
 */
router.get('/', authenticateAdminToken, async (req, res) => {
  try {
    const inquiries = await dbAsync.all('SELECT * FROM inquiries ORDER BY created_at DESC');
    res.json({ success: true, count: inquiries.length, inquiries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/inquiries
 * Submit a contact/event inquiry
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, category, message } = req.body;

    if (!name || !phone || !message) {
      return res.status(400).json({ success: false, error: 'Name, phone, and message are required' });
    }

    const result = await dbAsync.run(
      'INSERT INTO inquiries (name, email, phone, category, message) VALUES (?, ?, ?, ?, ?)',
      [name, email || 'N/A', phone, category || 'General Inquiry', message]
    );

    res.status(201).json({
      success: true,
      inquiryId: result.lastInsertRowid || Date.now(),
      message: 'Inquiry received successfully! Saved to cloud database.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/inquiries/:id/status
 * Update Inquiry Status (unread -> resolved)
 */
router.put('/:id/status', authenticateAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await dbAsync.run('UPDATE inquiries SET status = ? WHERE id = ?', [status || 'resolved', id]);

    res.json({ success: true, inquiryId: id, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

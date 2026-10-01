import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { requirePermission } from '../domain/rbac/rbacEngine.js';

const router = express.Router();

/**
 * GET /api/notices
 * Publicly visible notices for customer app & clubhouse display
 */
router.get('/', async (_req, res) => {
  try {
    const isPostgres = typeof dbAsync.isPostgres === 'function' && dbAsync.isPostgres();
    const notices = await dbAsync.all(
      `SELECT id, title, content, type, is_pinned, created_at
       FROM notices
       WHERE status = 'published'
       ORDER BY ${isPostgres ? 'is_pinned DESC' : 'is_pinned DESC'}, created_at DESC`
    );
    res.json({ success: true, count: notices.length, notices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/notices/admin
 * Admin list of all notices including drafts and archives
 */
router.get('/admin', authenticateAdminToken, requirePermission('notice.manage'), async (_req, res) => {
  try {
    const notices = await dbAsync.all('SELECT * FROM notices ORDER BY is_pinned DESC, created_at DESC');
    res.json({ success: true, count: notices.length, notices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/notices
 * Admin creates a new notice
 */
router.post('/', authenticateAdminToken, requirePermission('notice.manage'), async (req, res) => {
  try {
    const { title, content, type = 'info', isPinned = false, status = 'published' } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required.' });
    }

    const id = `not_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isPostgres = typeof dbAsync.isPostgres === 'function' && dbAsync.isPostgres();
    const createdBy = req.admin?.username || 'admin';

    await dbAsync.run(
      `INSERT INTO notices (id, title, content, type, is_pinned, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, title.trim(), content.trim(), type, isPostgres ? Boolean(isPinned) : (isPinned ? 1 : 0), status, createdBy]
    );

    const created = await dbAsync.get('SELECT * FROM notices WHERE id = ?', [id]);
    res.status(201).json({ success: true, notice: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/notices/:id
 * Admin updates an existing notice
 */
router.put('/:id', authenticateAdminToken, requirePermission('notice.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type, isPinned, status } = req.body;

    const existing = await dbAsync.get('SELECT * FROM notices WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Notice not found.' });
    }

    const isPostgres = typeof dbAsync.isPostgres === 'function' && dbAsync.isPostgres();
    const newTitle = title !== undefined ? title.trim() : existing.title;
    const newContent = content !== undefined ? content.trim() : existing.content;
    const newType = type !== undefined ? type : existing.type;
    const newPinned = isPinned !== undefined ? (isPostgres ? Boolean(isPinned) : (isPinned ? 1 : 0)) : existing.is_pinned;
    const newStatus = status !== undefined ? status : existing.status;

    await dbAsync.run(
      `UPDATE notices
       SET title = ?, content = ?, type = ?, is_pinned = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newTitle, newContent, newType, newPinned, newStatus, id]
    );

    const updated = await dbAsync.get('SELECT * FROM notices WHERE id = ?', [id]);
    res.json({ success: true, notice: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/notices/:id
 * Admin deletes a notice
 */
router.delete('/:id', authenticateAdminToken, requirePermission('notice.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbAsync.run('DELETE FROM notices WHERE id = ?', [id]);
    if (!result.rowCount) {
      return res.status(404).json({ success: false, error: 'Notice not found.' });
    }
    res.json({ success: true, message: 'Notice removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const loginRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, maxAttempts: 8, key: (req) => `${req.ip}:${String(req.body?.username || '').toLowerCase()}` });

/**
 * POST /api/admin/login
 * Admin Login Endpoint
 */
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    if (!JWT_SECRET) {
      return res.status(503).json({ success: false, error: 'Management authentication is not configured.' });
    }
    const { username, password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const adminUser = await dbAsync.get('SELECT * FROM admins ORDER BY id ASC LIMIT 1');

    if (!adminUser) {
      return res.status(404).json({ success: false, error: 'Admin account not initialized' });
    }

    const isValidPassword = bcrypt.compareSync(password, adminUser.password_hash) || password === adminUser.password_hash;

    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
    }
    loginRateLimit.reset(req);

    // Generate JWT Token
    const token = jwt.sign(
      { id: adminUser.id, username: adminUser.username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        role: 'admin'
      },
      message: 'Admin authentication successful'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/verify
 * Verify active token
 */
router.get('/verify', authenticateAdminToken, (req, res) => {
  res.json({
    success: true,
    admin: req.admin,
    authenticated: true
  });
});

/**
 * PUT /api/admin/password
 * Update Admin Password
 */
router.put('/password', authenticateAdminToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    }

    const adminUser = await dbAsync.get('SELECT * FROM admins WHERE id = ?', [req.admin.id]);

    if (!adminUser) {
      return res.status(404).json({ success: false, error: 'Admin user not found' });
    }

    const isValidPassword = bcrypt.compareSync(currentPassword, adminUser.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    const newPasswordHash = bcrypt.hashSync(newPassword, 10);
    await dbAsync.run('UPDATE admins SET password_hash = ? WHERE id = ?', [newPasswordHash, req.admin.id]);

    return res.json({
      success: true,
      message: 'Admin password successfully updated in cloud database'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

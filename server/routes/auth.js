import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import dbAsync from '../db.js';
import { ADMIN_ROLES, authenticateAdminToken, requireAdminRole } from '../middleware/auth.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const loginRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, maxAttempts: 8, key: (req) => `${req.ip}:${String(req.body?.username || '').toLowerCase()}` });
const supportedRoles = new Set(Object.values(ADMIN_ROLES));
const isEnabled = (value) => value === true || Number(value) === 1;
const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(String(value || ''));

const passwordsMatch = (candidate, storedHash) => {
  if (typeof candidate !== 'string' || typeof storedHash !== 'string') return false;
  if (isBcryptHash(storedHash)) return bcrypt.compareSync(candidate, storedHash);

  // Transitional support for a legacy plaintext seed. New writes always use
  // bcrypt, and a successful legacy login is upgraded immediately below.
  const candidateBuffer = Buffer.from(candidate);
  const storedBuffer = Buffer.from(storedHash);
  return candidateBuffer.length === storedBuffer.length && timingSafeEqual(candidateBuffer, storedBuffer);
};

const validateNewPassword = (password) => {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    return 'New password must be between 10 and 128 characters long.';
  }
  return null;
};

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

    // Keep the established password-only portal compatible by defaulting its
    // omitted username to the configured legacy administrator name. New API
    // consumers can and should explicitly provide their username.
    const normalizedUsername = String(username || process.env.DEFAULT_ADMIN_USERNAME || 'admin').trim();
    const adminUser = normalizedUsername
      ? await dbAsync.get('SELECT * FROM admins WHERE username = ?', [normalizedUsername])
      : null;

    const isValidPassword = Boolean(adminUser) && passwordsMatch(password, adminUser.password_hash);

    if (!isValidPassword || !isEnabled(adminUser.is_enabled) || !supportedRoles.has(adminUser.role)) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
    }
    loginRateLimit.reset(req);

    // Do not leave a legacy plaintext seed in place after it has been used.
    if (!isBcryptHash(adminUser.password_hash)) {
      await dbAsync.run('UPDATE admins SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password, 12), adminUser.id]);
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: adminUser.id, username: adminUser.username, role: adminUser.role, sv: Number(adminUser.session_version ?? 0) },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role
      },
      message: 'Admin authentication successful'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/admin/accounts/:id/enabled
 * A deliberately small account-control endpoint. Only super administrators
 * can disable a management account, and safeguards prevent lockout of the
 * final enabled super administrator.
 */
router.put('/accounts/:id/enabled', authenticateAdminToken, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN), async (req, res) => {
  try {
    const adminId = Number.parseInt(req.params.id, 10);
    const { isEnabled: nextEnabled } = req.body;
    if (!Number.isInteger(adminId) || adminId < 1 || typeof nextEnabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'A valid account id and boolean isEnabled value are required.' });
    }
    if (adminId === Number(req.admin.id) && !nextEnabled) {
      return res.status(400).json({ success: false, error: 'You cannot disable your own active management account.' });
    }

    const target = await dbAsync.get('SELECT id, username, role, is_enabled FROM admins WHERE id = ?', [adminId]);
    if (!target) return res.status(404).json({ success: false, error: 'Management account not found.' });
    if (!supportedRoles.has(target.role)) {
      return res.status(409).json({ success: false, error: 'This account has an unsupported role and cannot be changed until it is corrected.' });
    }

    if (!nextEnabled && target.role === ADMIN_ROLES.SUPER_ADMIN && isEnabled(target.is_enabled)) {
      const enabledSuperAdmins = await dbAsync.get(
        'SELECT COUNT(*) AS count FROM admins WHERE role = ? AND is_enabled = ?',
        [ADMIN_ROLES.SUPER_ADMIN, dbAsync.isPostgres() ? true : 1]
      );
      if (Number(enabledSuperAdmins?.count) <= 1) {
        return res.status(409).json({ success: false, error: 'At least one enabled super administrator must remain.' });
      }
    }

    // Enablement is a security boundary, so invalidate all of the target’s
    // earlier JWTs whether the account is being disabled or restored.
    await dbAsync.run(
      'UPDATE admins SET is_enabled = ?, session_version = session_version + 1 WHERE id = ?',
      [dbAsync.isPostgres() ? nextEnabled : Number(nextEnabled), adminId]
    );
    return res.json({
      success: true,
      account: { id: target.id, username: target.username, role: target.role, isEnabled: nextEnabled },
      message: nextEnabled ? 'Management account enabled.' : 'Management account disabled.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Unable to update the management account.' });
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

    const passwordValidationError = validateNewPassword(newPassword);
    if (passwordValidationError) return res.status(400).json({ success: false, error: passwordValidationError });

    const adminUser = await dbAsync.get('SELECT * FROM admins WHERE id = ?', [req.admin.id]);

    if (!adminUser) {
      return res.status(404).json({ success: false, error: 'Admin user not found' });
    }

    const isValidPassword = passwordsMatch(currentPassword, adminUser.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, error: 'Choose a new password that differs from your current password.' });
    }

    const newPasswordHash = bcrypt.hashSync(newPassword, 12);
    // A password change revokes every existing session, including the current
    // browser token. The client must sign in again with the new password.
    await dbAsync.run(
      'UPDATE admins SET password_hash = ?, session_version = session_version + 1 WHERE id = ?',
      [newPasswordHash, req.admin.id]
    );

    return res.json({
      success: true,
      message: 'Admin password successfully updated in cloud database'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

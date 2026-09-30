import jwt from 'jsonwebtoken';
import dbAsync from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
export const ADMIN_ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  STAFF: 'staff',
  STALL_STAFF: 'stall_staff'
});
const activeAdminRoles = new Set(Object.values(ADMIN_ROLES));

const isEnabled = (value) => value === true || Number(value) === 1;

// JWTs identify a session, but management authorization remains authoritative
// in the database. This makes account disablement effective immediately for
// already-issued tokens and rejects unsupported future role values by default.
export const getActiveAdmin = async (decoded) => {
  if (!decoded?.id) return null;

  try {
    const admin = await dbAsync.get(
      'SELECT id, username, role, stall_id, is_enabled, session_version FROM admins WHERE id = ?',
      [decoded.id]
    );
    if (!admin || !isEnabled(admin.is_enabled)) return null;

    // Check if role is a standard admin role or a custom role defined in roles table
    let isValidRole = activeAdminRoles.has(admin.role);
    if (!isValidRole) {
      const dbRole = await dbAsync.get(
        'SELECT id FROM roles WHERE role_key = ? OR id = ?',
        [admin.role, `role_${admin.role}`]
      );
      if (dbRole) isValidRole = true;
    }
    if (!isValidRole) return null;

    // Tokens issued before this migration carry version zero
    if (Number(decoded.sv ?? 0) !== Number(admin.session_version ?? 0)) return null;

    const { loadUserPermissions } = await import('../domain/rbac/rbacEngine.js');
    const permissions = await loadUserPermissions(dbAsync, 'admin', admin.id, admin.role);

    return {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      stallId: admin.stall_id || null,
      permissions: Array.isArray(permissions) ? permissions : [],
      sessionVersion: Number(admin.session_version ?? 0)
    };
  } catch (_e) {
    try {
      const admin = await dbAsync.get(
        'SELECT id, username, role, is_enabled, session_version FROM admins WHERE id = ?',
        [decoded.id]
      );
      if (!admin || !isEnabled(admin.is_enabled) || !activeAdminRoles.has(admin.role)) return null;
      if (Number(decoded.sv ?? 0) !== Number(admin.session_version ?? 0)) return null;

      const { loadUserPermissions } = await import('../domain/rbac/rbacEngine.js');
      const permissions = await loadUserPermissions(dbAsync, 'admin', admin.id, admin.role);

      return {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        stallId: null,
        permissions: Array.isArray(permissions) ? permissions : [],
        sessionVersion: Number(admin.session_version ?? 0)
      };
    } catch {
      return null;
    }
  }
};

export async function authenticateAdminToken(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(503).json({ success: false, error: 'Management authentication is not configured.' });
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access denied. No authentication token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await getActiveAdmin(decoded);
    if (!admin) {
      return res.status(403).json({ success: false, error: 'Management access is unavailable for this account.' });
    }
    req.admin = admin;
    return next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token.' });
  }
}

export const requireAdminRole = (...roles) => (req, res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) {
    return res.status(403).json({ success: false, error: 'You do not have permission to perform this management action.' });
  }
  return next();
};

// Attach a verified management identity when a token is present without making
// public customer routes require a login. Routes can use this to safely offer
// staff-only variants of an otherwise public action (for example counter
// walk-in reservations).
export async function attachOptionalAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return next();
  if (!JWT_SECRET) {
    return res.status(503).json({ success: false, error: 'Management authentication is not configured.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await getActiveAdmin(decoded);
    if (!admin) {
      return res.status(403).json({ success: false, error: 'Management access is unavailable for this account.' });
    }
    req.admin = admin;
    return next();
  } catch {
    return res.status(403).json({ success: false, error: 'Invalid or expired token.' });
  }
}

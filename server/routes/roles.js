import express from 'express';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { requirePermission, PERMISSION_VOCABULARY } from '../domain/rbac/rbacEngine.js';

const router = express.Router();

/**
 * GET /api/roles
 * List all defined roles with their permission assignments
 */
router.get('/', authenticateAdminToken, requirePermission('role.manage'), async (_req, res) => {
  try {
    const roles = await dbAsync.all('SELECT * FROM roles ORDER BY is_system DESC, name ASC');

    const withPermissions = await Promise.all(roles.map(async (role) => {
      const perms = await dbAsync.all(
        `SELECT p.id, p.permission_key as key, p.module, p.description
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = ?
         ORDER BY p.module, p.permission_key`,
        [role.id]
      );
      return {
        ...role,
        permissions: perms || []
      };
    }));

    res.json({ success: true, count: withPermissions.length, roles: withPermissions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/roles/permissions
 * List all registered permission keys in vocabulary
 */
router.get('/permissions', authenticateAdminToken, requirePermission('role.manage'), async (_req, res) => {
  try {
    const permissions = await dbAsync.all('SELECT id, permission_key as key, module, description FROM permissions ORDER BY module, permission_key');
    res.json({ success: true, permissions: permissions.length > 0 ? permissions : PERMISSION_VOCABULARY });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/roles
 * Create a new custom role
 */
router.post('/', authenticateAdminToken, requirePermission('role.manage'), async (req, res) => {
  try {
    const { name, description, permissionKeys = [] } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Role name is required.' });
    }

    const id = `role_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36).slice(4)}`;
    const isPostgres = typeof dbAsync.isPostgres === 'function' && dbAsync.isPostgres();

    await dbAsync.withTransaction(async (client) => {
      await client.run(
        `INSERT INTO roles (id, name, description, is_system)
         VALUES (?, ?, ?, ?)`,
        [id, name.trim(), description ? description.trim() : null, isPostgres ? false : 0]
      );

      for (const key of permissionKeys) {
        const perm = await client.get('SELECT id FROM permissions WHERE permission_key = ?', [key]);
        if (perm) {
          const rpId = `rp_${id}_${perm.id}`;
          await client.run(
            'INSERT INTO role_permissions (id, role_id, permission_id) VALUES (?, ?, ?)',
            [rpId, id, perm.id]
          );
        }
      }
    });

    const created = await dbAsync.get('SELECT * FROM roles WHERE id = ?', [id]);
    res.status(201).json({ success: true, role: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/roles/:id/permissions
 * Update permissions assigned to a role
 */
router.put('/:id/permissions', authenticateAdminToken, requirePermission('role.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permissionKeys = [] } = req.body;

    const role = await dbAsync.get('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) {
      return res.status(404).json({ success: false, error: 'Role not found.' });
    }

    await dbAsync.withTransaction(async (client) => {
      await client.run('DELETE FROM role_permissions WHERE role_id = ?', [id]);

      for (const key of permissionKeys) {
        const perm = await client.get('SELECT id FROM permissions WHERE permission_key = ?', [key]);
        if (perm) {
          const rpId = `rp_${id}_${perm.id}_${Date.now().toString(36).slice(4)}`;
          await client.run(
            'INSERT INTO role_permissions (id, role_id, permission_id) VALUES (?, ?, ?)',
            [rpId, id, perm.id]
          );
        }
      }
    });

    res.json({ success: true, roleId: id, message: 'Role permissions updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/roles/staff
 * List all staff administrator accounts and their roles
 */
router.get('/staff', authenticateAdminToken, requirePermission('role.manage'), async (_req, res) => {
  try {
    const staff = await dbAsync.all(
      `SELECT id, username, role, is_enabled as is_active, created_at, stall_id
       FROM admins
       ORDER BY id ASC`
    );
    res.json({ success: true, count: staff.length, staff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

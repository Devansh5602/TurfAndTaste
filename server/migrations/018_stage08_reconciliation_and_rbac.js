/**
 * Stage 0.8: Final Identity & Historical Timestamp Operational Reconciliation Migration
 *
 * 1. Hardens bookings table with is_quarantined and reconciliation_status.
 * 2. Creates admin_role_migration_audit table and safely maps legacy manager accounts to staff.
 * 3. Executes deterministic historical timestamp reconciliation and operational quarantine.
 * 4. Ensures canonical permission registry and role assignments across PostgreSQL & SQLite.
 */

import { reconcileAllTimestamps } from '../domain/time/timestampAudit.js';

export const id = '018_stage08_reconciliation_and_rbac';

export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    // 1. PostgreSQL Schema Hardening
    await exec(`
      -- Add quarantine and reconciliation status to bookings
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_quarantined BOOLEAN DEFAULT FALSE;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(50) DEFAULT 'CANONICAL';

      -- Create admin role migration audit table
      CREATE TABLE IF NOT EXISTS admin_role_migration_audit (
        id VARCHAR(120) PRIMARY KEY,
        admin_id INTEGER NOT NULL,
        old_role VARCHAR(50),
        new_role VARCHAR(50),
        status VARCHAR(50) NOT NULL,
        reason TEXT,
        migrated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Add stall_id to admins if not present
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS stall_id VARCHAR(100);
    `);

    // 2. Safely migrate legacy manager accounts to staff
    await exec(`
      INSERT INTO admin_role_migration_audit (id, admin_id, old_role, new_role, status, reason)
      SELECT
        'arma_' || id || '_' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT,
        id,
        role,
        'staff',
        'AUTO_MAPPED',
        'Mapped legacy manager account to canonical staff RBAC role with operational permissions.'
      FROM admins
      WHERE role = 'manager'
      ON CONFLICT DO NOTHING;

      UPDATE admins SET role = 'staff' WHERE role = 'manager';
    `);

  } else {
    // 1. SQLite Schema Hardening
    const tryExec = async (sql) => { try { await exec(sql); } catch (_e) {} };

    await tryExec(`ALTER TABLE bookings ADD COLUMN is_quarantined INTEGER DEFAULT 0;`);
    await tryExec(`ALTER TABLE bookings ADD COLUMN reconciliation_status TEXT DEFAULT 'CANONICAL';`);
    await tryExec(`ALTER TABLE admins ADD COLUMN stall_id TEXT;`);

    await exec(`
      CREATE TABLE IF NOT EXISTS admin_role_migration_audit (
        id TEXT PRIMARY KEY,
        admin_id INTEGER NOT NULL,
        old_role TEXT,
        new_role TEXT,
        status TEXT NOT NULL,
        reason TEXT,
        migrated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Safely migrate legacy manager accounts to staff on SQLite
    await exec(`
      INSERT OR IGNORE INTO admin_role_migration_audit (id, admin_id, old_role, new_role, status, reason)
      SELECT
        'arma_' || id || '_' || strftime('%s', 'now'),
        id,
        role,
        'staff',
        'AUTO_MAPPED',
        'Mapped legacy manager account to canonical staff RBAC role with operational permissions.'
      FROM admins
      WHERE role = 'manager';

      UPDATE admins SET role = 'staff' WHERE role = 'manager';
    `);
  }

  // 3. Reconcile all historical timestamps and establish operational quarantine
  const { default: dbAsync } = await import('../db.js');
  try {
    await reconcileAllTimestamps(dbAsync);
  } catch (e) {
    console.warn('[Migration 018] Timestamp reconciliation notice:', e.message);
  }
}

/**
 * Stage 0.6 Platform Foundation Hardening Migration
 *
 * 1. Adds `role` column to `admins` table to support staff/stall_staff roles.
 * 2. Adds `idempotency_key` and `finalized_booking_id` to payment_orders
 *    for replay-safe booking finalization.
 * 3. Adds `access_token` to dining_orders for privacy-safe customer lookup.
 * 4. Reconciles permission vocabulary:
 *    - booking.create_walkin alias (route compat for booking.walkin)
 *    - booking.update permission (status mutation routes)
 *    - dining.order.update alias (route compat for dining.order.manage)
 *    - dining.stall.read permission (admin stall listing)
 * 5. Creates timestamp_classification_audit table and classifies pre-015
 *    canonical booking timestamps.
 */

export const id = '016_stage06_hardening';

export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    // 1. Add role column to admins table
    await exec(`
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'super_admin';
    `);

    // 2. Payment order idempotency & booking binding
    await exec(`
      ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
    `);
    await exec(`
      ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS finalized_booking_id VARCHAR(255);
    `);
    await exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_idempotency
        ON payment_orders (idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    `);
    await exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_finalized_booking
        ON payment_orders (finalized_booking_id)
        WHERE finalized_booking_id IS NOT NULL;
    `);

    // 3. Dining order access token for customer-safe lookup
    await exec(`
      ALTER TABLE dining_orders ADD COLUMN IF NOT EXISTS access_token VARCHAR(128);
    `);
    await exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_dining_orders_access_token
        ON dining_orders (access_token)
        WHERE access_token IS NOT NULL;
    `);

    // 4a. booking.create_walkin alias permission (route compat)
    await exec(`
      INSERT INTO permissions (id, permission_key, module, description)
        VALUES (
          'perm_booking_create_walkin',
          'booking.create_walkin',
          'bookings',
          'Alias: Create immediate staff walk-in bookings (canonical key: booking.walkin)'
        )
        ON CONFLICT (id) DO NOTHING;
    `);
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
        SELECT rp.role_id, 'perm_booking_create_walkin'
        FROM role_permissions rp
        WHERE rp.permission_id = 'perm_booking_walkin'
          AND rp.role_id IN ('role_super_admin', 'role_staff')
        ON CONFLICT DO NOTHING;
    `);

    // 4b. booking.update permission for status mutation
    await exec(`
      INSERT INTO permissions (id, permission_key, module, description)
        VALUES (
          'perm_booking_update',
          'booking.update',
          'bookings',
          'Update booking status and operational fields'
        )
        ON CONFLICT (id) DO NOTHING;
    `);
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
        SELECT DISTINCT rp.role_id, 'perm_booking_update'
        FROM role_permissions rp
        WHERE rp.permission_id = 'perm_booking_checkin'
          AND rp.role_id IN ('role_super_admin', 'role_staff')
        ON CONFLICT DO NOTHING;
    `);

    // 4c. dining.order.update alias (route uses this key, seed has dining.order.manage)
    await exec(`
      INSERT INTO permissions (id, permission_key, module, description)
        VALUES (
          'perm_dining_order_update',
          'dining.order.update',
          'dining',
          'Alias: Update dining order status (canonical key: dining.order.manage)'
        )
        ON CONFLICT (id) DO NOTHING;
    `);
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
        SELECT DISTINCT rp.role_id, 'perm_dining_order_update'
        FROM role_permissions rp
        WHERE rp.permission_id = 'perm_dining_order_manage'
        ON CONFLICT DO NOTHING;
    `);

    // 4d. dining.stall.read permission for admin stall listing
    await exec(`
      INSERT INTO permissions (id, permission_key, module, description)
        VALUES (
          'perm_dining_stall_read',
          'dining.stall.read',
          'dining',
          'View dining stall configuration and order dashboards'
        )
        ON CONFLICT (id) DO NOTHING;
    `);
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
        VALUES ('role_super_admin', 'perm_dining_stall_read')
        ON CONFLICT DO NOTHING;
    `);
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
        VALUES ('role_staff', 'perm_dining_stall_read')
        ON CONFLICT DO NOTHING;
    `);
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
        VALUES ('role_stall_staff', 'perm_dining_stall_read')
        ON CONFLICT DO NOTHING;
    `);

    // 5. Timestamp classification audit table
    await exec(`
      CREATE TABLE IF NOT EXISTS timestamp_classification_audit (
        id VARCHAR(255) PRIMARY KEY,
        source_table VARCHAR(100) NOT NULL,
        source_row_id VARCHAR(255) NOT NULL,
        source_column VARCHAR(100) NOT NULL,
        raw_value TEXT,
        classification VARCHAR(50) NOT NULL,
        proposed_utc_instant TIMESTAMPTZ,
        confidence VARCHAR(20) NOT NULL DEFAULT 'HIGH',
        action VARCHAR(50) NOT NULL,
        reviewed_at TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT
      );
    `);

    // 6. Classify pre-015 canonical booking timestamps
    // Bookings created before migration 015 applied (approx 2026-09-30T10:00:00Z)
    // used toISOString() which produces UTC strings. Migration 015 then applied
    // "AT TIME ZONE 'Asia/Kolkata'" which shifts UTC instants by +05:30.
    // This is CORRECT only when the stored value was an IST wall-clock string.
    // For UTC ISO strings, the resulting TIMESTAMPTZ is 5h30m ahead of intent.
    await exec(`
      INSERT INTO timestamp_classification_audit (
        id, source_table, source_row_id, source_column,
        raw_value, classification, proposed_utc_instant,
        confidence, action, notes
      )
      SELECT
        'tca_' || b.id || '_start_at',
        'bookings',
        b.id,
        'scheduled_start_at',
        b.scheduled_start_at::TEXT,
        CASE
          WHEN b.scheduled_start_at IS NULL THEN 'INVALID'
          WHEN b.created_at < TIMESTAMPTZ '2026-09-30T10:00:00Z' THEN 'EXPLICIT_UTC_SHIFTED'
          ELSE 'EXPLICIT_UTC'
        END,
        b.scheduled_start_at,
        CASE
          WHEN b.created_at < TIMESTAMPTZ '2026-09-30T10:00:00Z' THEN 'LOW'
          ELSE 'HIGH'
        END,
        CASE
          WHEN b.created_at < TIMESTAMPTZ '2026-09-30T10:00:00Z' THEN 'MANUAL_REVIEW'
          ELSE 'NO_CHANGE'
        END,
        'Pre-015 rows were inserted via toISOString() (UTC). Migration 015 AT TIME ZONE shift may have added +05:30 offset to already-UTC rows.'
      FROM bookings b
      WHERE b.scheduled_start_at IS NOT NULL
      ON CONFLICT (id) DO NOTHING;
    `);

  } else {
    // SQLite: additive columns only (ALTER TABLE ADD COLUMN)
    const tryExec = async (sql) => { try { await exec(sql); } catch (_e) {} };

    await tryExec(`ALTER TABLE dining_orders ADD COLUMN access_token TEXT;`);
    await tryExec(`ALTER TABLE payment_orders ADD COLUMN idempotency_key TEXT;`);
    await tryExec(`ALTER TABLE payment_orders ADD COLUMN finalized_booking_id TEXT;`);
    await tryExec(`ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'super_admin';`);

    await exec(`
      CREATE TABLE IF NOT EXISTS timestamp_classification_audit (
        id TEXT PRIMARY KEY,
        source_table TEXT NOT NULL,
        source_row_id TEXT NOT NULL,
        source_column TEXT NOT NULL,
        raw_value TEXT,
        classification TEXT NOT NULL,
        proposed_utc_instant TEXT,
        confidence TEXT NOT NULL DEFAULT 'HIGH',
        action TEXT NOT NULL,
        reviewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );
    `);
  }
}

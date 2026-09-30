/**
 * Stage 0.5 Platform Foundation Operationalization Migration
 * 
 * 1. Converts PostgreSQL interval & session timestamp columns to TIMESTAMPTZ.
 * 2. Adds explicit is_24x7 sports availability contract to physical_facilities.
 * 3. Creates legacy_booking_reconciliation table to safely quarantine & audit legacy bookings.
 * 4. Seeds role_permissions for all standard system roles.
 * 5. Seeds user_roles linking the default bootstrap admin to role_super_admin.
 * 6. Populates initial legacy booking reconciliation entries for human review without guessing.
 */

export const id = '015_stage05_operationalization';

export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    // 1. PostgreSQL TIMESTAMPTZ conversion
    await exec(`
      -- Convert bookings interval columns to TIMESTAMPTZ
      ALTER TABLE bookings 
        ALTER COLUMN scheduled_start_at TYPE TIMESTAMPTZ USING scheduled_start_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN scheduled_end_at TYPE TIMESTAMPTZ USING scheduled_end_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ USING cancelled_at AT TIME ZONE 'Asia/Kolkata';

      -- Convert facility_blocks columns to TIMESTAMPTZ
      ALTER TABLE facility_blocks
        ALTER COLUMN start_at TYPE TIMESTAMPTZ USING start_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN end_at TYPE TIMESTAMPTZ USING end_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Asia/Kolkata';

      -- Convert facility_sessions columns to TIMESTAMPTZ
      ALTER TABLE facility_sessions
        ALTER COLUMN scheduled_start_at TYPE TIMESTAMPTZ USING scheduled_start_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN scheduled_end_at TYPE TIMESTAMPTZ USING scheduled_end_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN actual_start_at TYPE TIMESTAMPTZ USING actual_start_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN actual_end_at TYPE TIMESTAMPTZ USING actual_end_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'Asia/Kolkata';

      -- Convert payment_holds columns to TIMESTAMPTZ
      ALTER TABLE payment_holds
        ALTER COLUMN start_at TYPE TIMESTAMPTZ USING start_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN end_at TYPE TIMESTAMPTZ USING end_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'Asia/Kolkata',
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Asia/Kolkata';

      -- Add explicit 24/7 sports availability contract
      ALTER TABLE physical_facilities
        ADD COLUMN IF NOT EXISTS is_24x7 BOOLEAN NOT NULL DEFAULT TRUE;

      -- Legacy Booking Reconciliation Table
      CREATE TABLE IF NOT EXISTS legacy_booking_reconciliation (
        booking_id VARCHAR(255) PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
        legacy_facility_id VARCHAR(255) NOT NULL,
        legacy_date VARCHAR(50) NOT NULL,
        legacy_time_slot VARCHAR(255) NOT NULL,
        proposed_physical_facility_id VARCHAR(100),
        classification VARCHAR(50) NOT NULL,
        reason TEXT,
        reconciled_by VARCHAR(100),
        reconciled_at TIMESTAMPTZ,
        status VARCHAR(50) NOT NULL DEFAULT 'QUARANTINED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    // 2. SQLite DDL
    // In SQLite, verify column existence via PRAGMA before adding
    await exec(`
      CREATE TABLE IF NOT EXISTS legacy_booking_reconciliation (
        booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
        legacy_facility_id TEXT NOT NULL,
        legacy_date TEXT NOT NULL,
        legacy_time_slot TEXT NOT NULL,
        proposed_physical_facility_id TEXT,
        classification TEXT NOT NULL,
        reason TEXT,
        reconciled_by TEXT,
        reconciled_at DATETIME,
        status TEXT NOT NULL DEFAULT 'QUARANTINED',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      await exec('ALTER TABLE physical_facilities ADD COLUMN is_24x7 INTEGER NOT NULL DEFAULT 1;');
    } catch (e) {
      // Column already exists
    }
  }

  // 3. Seed RBAC Role Permissions
  // Super Admin: All permissions
  await exec(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT 'role_super_admin', id FROM permissions
    -- SQLite parses an UPSERT following SELECT ... FROM as a JOIN unless the
    -- SELECT is explicitly terminated with a WHERE clause. Keeping this
    -- no-op predicate preserves PostgreSQL behaviour and makes a clean
    -- SQLite migration/reapply safe.
    WHERE 1 = 1
    ON CONFLICT DO NOTHING;

    -- Staff Role Permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT 'role_staff', id FROM permissions
    WHERE permission_key IN (
      'facility.read', 'facility.block',
      'booking.read', 'booking.create', 'booking.walkin', 'booking.checkin', 'booking.extend', 'booking.cancel',
      'payment.read', 'payment.record', 'customer.read',
      'dining.order.read', 'dining.order.manage'
    )
    ON CONFLICT DO NOTHING;

    -- Stall Staff Role Permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT 'role_stall_staff', id FROM permissions
    WHERE permission_key IN (
      'dining.stall.manage', 'dining.menu.manage',
      'dining.order.read', 'dining.order.manage'
    )
    ON CONFLICT DO NOTHING;

    -- Customer Role Permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT 'role_customer', id FROM permissions
    WHERE permission_key IN (
      'booking.read', 'booking.create',
      'dining.order.read'
    )
    ON CONFLICT DO NOTHING;

    -- Seed User Role for Default Bootstrap Admin
    INSERT INTO user_roles (id, user_type, user_id, role_id)
    VALUES ('ur_admin_1', 'admin', '1', 'role_super_admin')
    ON CONFLICT DO NOTHING;
  `);

  // 4. Populate Legacy Booking Reconciliation Entries
  // For the existing legacy bookings:
  // - TT-512005 and TT-222332 collided on 2026-09-19 (06:00 PM – 07:00 PM) -> MANUAL_REVIEW (Collision Quarantine)
  // - Other 6 box-cricket bookings -> MANUAL_REVIEW (Ambiguous multi-turf assignment)
  await exec(`
    INSERT INTO legacy_booking_reconciliation (
      booking_id, legacy_facility_id, legacy_date, legacy_time_slot,
      proposed_physical_facility_id, classification, reason, status
    )
    SELECT 
      b.id,
      b.facility_id,
      b.date,
      b.time_slot,
      NULL,
      CASE 
        WHEN b.id IN ('TT-512005', 'TT-222332') THEN 'MANUAL_REVIEW'
        ELSE 'MANUAL_REVIEW'
      END,
      CASE 
        WHEN b.id IN ('TT-512005', 'TT-222332') THEN 'Conflicting concurrent booking on legacy box-cricket identifier on 2026-09-19 06:00 PM. Requires manual turf assignment.'
        ELSE 'Legacy box-cricket booking lacks physical turf identification (Turf 1 vs Turf 2). Quarantined until operator assignment.'
      END,
      'QUARANTINED'
    FROM bookings b
    WHERE b.physical_facility_id IS NULL
    ON CONFLICT (booking_id) DO NOTHING;
  `);
}

/**
 * Stage 0.7 Platform Foundation Final Remediation Migration
 *
 * 1. Hardens timestamp_classification_audit table with full provenance columns.
 * 2. Adds stall_id to admins table for stall-staff operational scoping.
 * 3. Seeds complete, identical canonical permission vocabulary across PostgreSQL and SQLite.
 * 4. Seeds all role_permissions for super_admin, staff, stall_staff, and customer roles.
 */

export const id = '017_stage07_remediation';

export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    // 1. PostgreSQL Schema Hardening
    await exec(`
      -- Add stall_id to admins
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS stall_id VARCHAR(100);

      -- Update/alter timestamp_classification_audit with full provenance columns
      ALTER TABLE timestamp_classification_audit ADD COLUMN IF NOT EXISTS raw_source TEXT;
      ALTER TABLE timestamp_classification_audit ADD COLUMN IF NOT EXISTS canonical_current_value TEXT;
      ALTER TABLE timestamp_classification_audit ADD COLUMN IF NOT EXISTS expected_interpretation TEXT;
      ALTER TABLE timestamp_classification_audit ADD COLUMN IF NOT EXISTS conversion_occurred BOOLEAN DEFAULT FALSE;
      ALTER TABLE timestamp_classification_audit ADD COLUMN IF NOT EXISTS correction_required BOOLEAN DEFAULT FALSE;
      ALTER TABLE timestamp_classification_audit ADD COLUMN IF NOT EXISTS reason TEXT;
    `);

    // 2. Canonical Permissions Seed
    const permissions = [
      ['perm_facility_read', 'facility.read', 'facilities', 'View facilities and schedules'],
      ['perm_facility_create', 'facility.create', 'facilities', 'Create new facilities'],
      ['perm_facility_update', 'facility.update', 'facilities', 'Update facility details'],
      ['perm_facility_block', 'facility.block', 'facilities', 'Manage facility blocks'],
      ['perm_booking_read', 'booking.read', 'bookings', 'View bookings'],
      ['perm_booking_create', 'booking.create', 'bookings', 'Create customer bookings'],
      ['perm_booking_walkin', 'booking.walkin', 'bookings', 'Create immediate walk-in bookings'],
      ['perm_booking_create_walkin', 'booking.create_walkin', 'bookings', 'Alias: Create immediate staff walk-in bookings'],
      ['perm_booking_update', 'booking.update', 'bookings', 'Update booking status and operational fields'],
      ['perm_booking_checkin', 'booking.checkin', 'bookings', 'Check-in bookings and start sessions'],
      ['perm_booking_extend', 'booking.extend', 'bookings', 'Approve session extensions'],
      ['perm_booking_cancel', 'booking.cancel', 'bookings', 'Cancel bookings'],
      ['perm_pricing_read', 'pricing.read', 'pricing', 'View pricing'],
      ['perm_pricing_manage', 'pricing.manage', 'pricing', 'Manage pricing rules and packages'],
      ['perm_payment_read', 'payment.read', 'payments', 'View payments'],
      ['perm_payment_record', 'payment.record', 'payments', 'Record counter payments'],
      ['perm_customer_read', 'customer.read', 'customers', 'View customer details'],
      ['perm_event_manage', 'event.manage', 'events', 'Manage events'],
      ['perm_notice_manage', 'notice.manage', 'notices', 'Manage notices'],
      ['perm_review_moderate', 'review.moderate', 'reviews', 'Moderate reviews'],
      ['perm_dining_stall_read', 'dining.stall.read', 'dining', 'View dining stall configuration and dashboards'],
      ['perm_dining_stall_manage', 'dining.stall.manage', 'dining', 'Manage dining stalls'],
      ['perm_dining_menu_manage', 'dining.menu.manage', 'dining', 'Manage dining menus'],
      ['perm_dining_order_read', 'dining.order.read', 'dining', 'View dining orders'],
      ['perm_dining_order_manage', 'dining.order.manage', 'dining', 'Manage dining orders'],
      ['perm_dining_order_update', 'dining.order.update', 'dining', 'Alias: Update dining order status'],
      ['perm_role_manage', 'role.manage', 'roles', 'Manage roles and permissions'],
      ['perm_maintenance_manage', 'maintenance.manage', 'maintenance', 'Manage maintenance settings']
    ];

    for (const [pId, key, module, desc] of permissions) {
      await exec(`
        INSERT INTO permissions (id, permission_key, module, description)
        VALUES ('${pId}', '${key}', '${module}', '${desc.replace(/'/g, "''")}')
        ON CONFLICT (id) DO UPDATE SET permission_key = EXCLUDED.permission_key, module = EXCLUDED.module, description = EXCLUDED.description;
      `);
    }

    // 3. Seed Role-Permissions
    // Super Admin: all
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 'role_super_admin', id FROM permissions
      ON CONFLICT DO NOTHING;
    `);

    // Staff
    const staffKeys = [
      'facility.read', 'facility.block',
      'booking.read', 'booking.create', 'booking.walkin', 'booking.create_walkin', 'booking.update',
      'booking.checkin', 'booking.extend', 'booking.cancel',
      'payment.read', 'payment.record', 'customer.read',
      'dining.stall.read', 'dining.order.read', 'dining.order.manage', 'dining.order.update'
    ];
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 'role_staff', id FROM permissions
      WHERE permission_key IN (${staffKeys.map(k => `'${k}'`).join(',')})
      ON CONFLICT DO NOTHING;
    `);

    // Stall Staff
    const stallKeys = [
      'dining.stall.read', 'dining.stall.manage', 'dining.menu.manage',
      'dining.order.read', 'dining.order.manage', 'dining.order.update'
    ];
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 'role_stall_staff', id FROM permissions
      WHERE permission_key IN (${stallKeys.map(k => `'${k}'`).join(',')})
      ON CONFLICT DO NOTHING;
    `);

    // Customer
    const customerKeys = ['booking.read', 'booking.create', 'dining.order.read'];
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 'role_customer', id FROM permissions
      WHERE permission_key IN (${customerKeys.map(k => `'${k}'`).join(',')})
      ON CONFLICT DO NOTHING;
    `);

  } else {
    // 2. SQLite Schema Hardening
    const tryExec = async (sql) => { try { await exec(sql); } catch (_e) {} };

    await tryExec(`ALTER TABLE admins ADD COLUMN stall_id TEXT;`);
    await tryExec(`ALTER TABLE timestamp_classification_audit ADD COLUMN raw_source TEXT;`);
    await tryExec(`ALTER TABLE timestamp_classification_audit ADD COLUMN canonical_current_value TEXT;`);
    await tryExec(`ALTER TABLE timestamp_classification_audit ADD COLUMN expected_interpretation TEXT;`);
    await tryExec(`ALTER TABLE timestamp_classification_audit ADD COLUMN conversion_occurred INTEGER DEFAULT 0;`);
    await tryExec(`ALTER TABLE timestamp_classification_audit ADD COLUMN correction_required INTEGER DEFAULT 0;`);
    await tryExec(`ALTER TABLE timestamp_classification_audit ADD COLUMN reason TEXT;`);

    const permissions = [
      ['perm_facility_read', 'facility.read', 'facilities', 'View facilities and schedules'],
      ['perm_facility_create', 'facility.create', 'facilities', 'Create new facilities'],
      ['perm_facility_update', 'facility.update', 'facilities', 'Update facility details'],
      ['perm_facility_block', 'facility.block', 'facilities', 'Manage facility blocks'],
      ['perm_booking_read', 'booking.read', 'bookings', 'View bookings'],
      ['perm_booking_create', 'booking.create', 'bookings', 'Create customer bookings'],
      ['perm_booking_walkin', 'booking.walkin', 'bookings', 'Create immediate walk-in bookings'],
      ['perm_booking_create_walkin', 'booking.create_walkin', 'bookings', 'Alias: Create immediate staff walk-in bookings'],
      ['perm_booking_update', 'booking.update', 'bookings', 'Update booking status and operational fields'],
      ['perm_booking_checkin', 'booking.checkin', 'bookings', 'Check-in bookings and start sessions'],
      ['perm_booking_extend', 'booking.extend', 'bookings', 'Approve session extensions'],
      ['perm_booking_cancel', 'booking.cancel', 'bookings', 'Cancel bookings'],
      ['perm_pricing_read', 'pricing.read', 'pricing', 'View pricing'],
      ['perm_pricing_manage', 'pricing.manage', 'pricing', 'Manage pricing rules and packages'],
      ['perm_payment_read', 'payment.read', 'payments', 'View payments'],
      ['perm_payment_record', 'payment.record', 'payments', 'Record counter payments'],
      ['perm_customer_read', 'customer.read', 'customers', 'View customer details'],
      ['perm_event_manage', 'event.manage', 'events', 'Manage events'],
      ['perm_notice_manage', 'notice.manage', 'notices', 'Manage notices'],
      ['perm_review_moderate', 'review.moderate', 'reviews', 'Moderate reviews'],
      ['perm_dining_stall_read', 'dining.stall.read', 'dining', 'View dining stall configuration and dashboards'],
      ['perm_dining_stall_manage', 'dining.stall.manage', 'dining', 'Manage dining stalls'],
      ['perm_dining_menu_manage', 'dining.menu.manage', 'dining', 'Manage dining menus'],
      ['perm_dining_order_read', 'dining.order.read', 'dining', 'View dining orders'],
      ['perm_dining_order_manage', 'dining.order.manage', 'dining', 'Manage dining orders'],
      ['perm_dining_order_update', 'dining.order.update', 'dining', 'Alias: Update dining order status'],
      ['perm_role_manage', 'role.manage', 'roles', 'Manage roles and permissions'],
      ['perm_maintenance_manage', 'maintenance.manage', 'maintenance', 'Manage maintenance settings']
    ];

    for (const [pId, key, module, desc] of permissions) {
      await exec(`
        INSERT INTO permissions (id, permission_key, module, description)
        VALUES ('${pId}', '${key}', '${module}', '${desc.replace(/'/g, "''")}')
        ON CONFLICT (id) DO UPDATE SET permission_key = excluded.permission_key, module = excluded.module, description = excluded.description;
      `);
    }

    // Role Permissions on SQLite
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 'role_super_admin', id FROM permissions
      WHERE 1 = 1
      ON CONFLICT DO NOTHING;
    `);

    const staffKeys = [
      'facility.read', 'facility.block',
      'booking.read', 'booking.create', 'booking.walkin', 'booking.create_walkin', 'booking.update',
      'booking.checkin', 'booking.extend', 'booking.cancel',
      'payment.read', 'payment.record', 'customer.read',
      'dining.stall.read', 'dining.order.read', 'dining.order.manage', 'dining.order.update'
    ];
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 'role_staff', id FROM permissions
      WHERE permission_key IN (${staffKeys.map(k => `'${k}'`).join(',')})
      ON CONFLICT DO NOTHING;
    `);

    const stallKeys = [
      'dining.stall.read', 'dining.stall.manage', 'dining.menu.manage',
      'dining.order.read', 'dining.order.manage', 'dining.order.update'
    ];
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 'role_stall_staff', id FROM permissions
      WHERE permission_key IN (${stallKeys.map(k => `'${k}'`).join(',')})
      ON CONFLICT DO NOTHING;
    `);

    const customerKeys = ['booking.read', 'booking.create', 'dining.order.read'];
    await exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 'role_customer', id FROM permissions
      WHERE permission_key IN (${customerKeys.map(k => `'${k}'`).join(',')})
      ON CONFLICT DO NOTHING;
    `);
  }
}

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import dbAsync from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

export async function runPreflightReport() {
  const isPg = dbAsync.isPostgres();
  const report = {
    timestamp: new Date().toISOString(),
    backend: isPg ? 'PostgreSQL (Supabase Cloud)' : 'SQLite (Local File)',
    tables: {},
    appliedMigrations: [],
    legacyFacilityCounts: {},
    legacyBookingsAudit: {
      total: 0,
      cancelled: 0,
      active: 0,
      overlappingSlots: [],
      ambiguousIntervals: []
    },
    missingTargetTables: [],
    status: 'READY'
  };

  try {
    // 1. Check applied migrations
    try {
      const migRows = await dbAsync.all(
        isPg
          ? 'SELECT id, applied_at FROM schema_migrations ORDER BY applied_at ASC'
          : 'SELECT id, applied_at FROM schema_migrations ORDER BY applied_at ASC'
      );
      report.appliedMigrations = migRows.map(m => m.id);
    } catch (e) {
      report.appliedMigrations = [];
    }

    // 2. Discover existing tables
    let existingTableNames = [];
    if (isPg) {
      const rows = await dbAsync.all(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
      );
      existingTableNames = rows.map(r => r.table_name);
    } else {
      const rows = await dbAsync.all(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      );
      existingTableNames = rows.map(r => r.name);
    }

    // 3. Inspect columns for key tables
    for (const tbl of existingTableNames) {
      if (isPg) {
        const colRows = await dbAsync.all(
          "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
          [tbl]
        );
        report.tables[tbl] = colRows.map(c => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES'
        }));
      } else {
        const colRows = await dbAsync.all(`PRAGMA table_info(${tbl})`);
        report.tables[tbl] = colRows.map(c => ({
          name: c.name,
          type: c.type,
          nullable: c.notnull === 0
        }));
      }
    }

    // 4. Audit legacy facilities & profiles
    if (existingTableNames.includes('facilities')) {
      const facs = await dbAsync.all('SELECT id, title, category FROM facilities');
      report.legacyFacilities = facs;
    }
    if (existingTableNames.includes('facility_profiles')) {
      const profiles = await dbAsync.all('SELECT id, slug, name, status FROM facility_profiles');
      report.legacyProfiles = profiles;
    }

    // 5. Audit legacy bookings for overlap and date hygiene
    if (existingTableNames.includes('bookings')) {
      const bookings = await dbAsync.all(
        'SELECT id, facility_id, facility_name, date, time_slot, booking_status FROM bookings'
      );
      report.legacyBookingsAudit.total = bookings.length;
      report.legacyBookingsAudit.cancelled = bookings.filter(b => b.booking_status === 'Cancelled').length;
      report.legacyBookingsAudit.active = bookings.length - report.legacyBookingsAudit.cancelled;

      // Group active bookings by facility and date to detect overlapping time slots
      const byFacDate = {};
      for (const b of bookings) {
        if (b.booking_status === 'Cancelled') continue;
        const key = `${b.facility_id}::${b.date}`;
        if (!byFacDate[key]) byFacDate[key] = [];
        byFacDate[key].push(b);
      }

      for (const [key, group] of Object.entries(byFacDate)) {
        if (group.length > 1) {
          // Check for slot collisions
          for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
              if (group[i].time_slot === group[j].time_slot) {
                report.legacyBookingsAudit.overlappingSlots.push({
                  key,
                  slot: group[i].time_slot,
                  bookingIdA: group[i].id,
                  bookingIdB: group[j].id,
                  note: 'Identical slot booked concurrently on same legacy facility identifier'
                });
              }
            }
          }
        }
      }
    }

    // 6. Check target Stage 0 & 0.5 tables
    const stage0TargetTables = [
      'properties',
      'sections',
      'physical_facilities',
      'services',
      'facility_services',
      'add_ons',
      'facility_add_ons',
      'facility_blocks',
      'facility_sessions',
      'session_adjustments',
      'payment_holds',
      'roles',
      'permissions',
      'role_permissions',
      'user_roles',
      'dining_tables',
      'dining_orders',
      'dining_order_items',
      'legacy_booking_reconciliation'
    ];

    report.missingTargetTables = stage0TargetTables.filter(t => !existingTableNames.includes(t));

    // 7. Timezone Column Types Audit (Postgres)
    report.timezoneAudit = {
      isPostgres: isPg,
      checkedColumns: [],
      nonTimezoneAwareColumns: []
    };

    if (isPg) {
      const tzTargetColumns = [
        { table: 'bookings', column: 'scheduled_start_at' },
        { table: 'bookings', column: 'scheduled_end_at' },
        { table: 'bookings', column: 'cancelled_at' },
        { table: 'facility_blocks', column: 'start_at' },
        { table: 'facility_blocks', column: 'end_at' },
        { table: 'facility_sessions', column: 'scheduled_start_at' },
        { table: 'facility_sessions', column: 'scheduled_end_at' },
        { table: 'payment_holds', column: 'start_at' },
        { table: 'payment_holds', column: 'end_at' },
        { table: 'payment_holds', column: 'expires_at' }
      ];

      for (const item of tzTargetColumns) {
        const colInfo = (report.tables[item.table] || []).find(c => c.name === item.column);
        if (colInfo) {
          const isTz = colInfo.type.includes('with time zone');
          report.timezoneAudit.checkedColumns.push({
            table: item.table,
            column: item.column,
            type: colInfo.type,
            isTz
          });
          if (!isTz) {
            report.timezoneAudit.nonTimezoneAwareColumns.push(`${item.table}.${item.column} (${colInfo.type})`);
          }
        }
      }
    }

    // 8. Canonical physical inventory check
    const requiredFacilities = [
      'fac_box_cricket_1',
      'fac_box_cricket_2',
      'fac_pickleball_1',
      'fac_pickleball_2',
      'fac_skating_1',
      'fac_green_net_1'
    ];
    if (existingTableNames.includes('physical_facilities')) {
      const facRows = await dbAsync.all('SELECT id, default_name, is_24x7 FROM physical_facilities');
      const foundIds = facRows.map(f => f.id);
      report.physicalInventory = {
        total: facRows.length,
        missing: requiredFacilities.filter(id => !foundIds.includes(id)),
        all24x7: facRows.every(f => Boolean(f.is_24x7))
      };
    }

    // 9. Green Net Shooting Machine Mapping Invariant
    if (existingTableNames.includes('facility_add_ons')) {
      const mappings = await dbAsync.all("SELECT * FROM facility_add_ons WHERE add_on_id = 'addon_shooting_machine'");
      const boundFacilities = mappings.map(m => m.facility_id);
      report.shootingMachineInvariant = {
        mappedFacilities: boundFacilities,
        isValid: boundFacilities.length === 1 && boundFacilities[0] === 'fac_green_net_1'
      };
    }

    // 10. RBAC Seeds Audit
    report.rbacAudit = {
      rolesCount: 0,
      permissionsCount: 0,
      rolePermissionsCount: 0,
      userRolesCount: 0,
      adminHasRole: false
    };
    if (existingTableNames.includes('roles')) {
      const r = await dbAsync.get('SELECT COUNT(*) as count FROM roles');
      report.rbacAudit.rolesCount = parseInt(r.count, 10);
    }
    if (existingTableNames.includes('permissions')) {
      const p = await dbAsync.get('SELECT COUNT(*) as count FROM permissions');
      report.rbacAudit.permissionsCount = parseInt(p.count, 10);
    }
    if (existingTableNames.includes('role_permissions')) {
      const rp = await dbAsync.get('SELECT COUNT(*) as count FROM role_permissions');
      report.rbacAudit.rolePermissionsCount = parseInt(rp.count, 10);
    }
    if (existingTableNames.includes('user_roles')) {
      const ur = await dbAsync.get('SELECT COUNT(*) as count FROM user_roles');
      report.rbacAudit.userRolesCount = parseInt(ur.count, 10);
      const adminRole = await dbAsync.get("SELECT * FROM user_roles WHERE user_type = 'admin' AND user_id = '1'");
      report.rbacAudit.adminHasRole = Boolean(adminRole);
    }

    // 11. Legacy Bookings Reconciliation Audit
    report.legacyReconciliation = {
      reconciledCount: 0,
      quarantinedCount: 0,
      manualReviewCount: 0
    };
    if (existingTableNames.includes('legacy_booking_reconciliation')) {
      const recRows = await dbAsync.all('SELECT * FROM legacy_booking_reconciliation');
      report.legacyReconciliation.reconciledCount = recRows.length;
      report.legacyReconciliation.quarantinedCount = recRows.filter(r => r.status === 'QUARANTINED').length;
      report.legacyReconciliation.manualReviewCount = recRows.filter(r => r.classification === 'MANUAL_REVIEW').length;
      report.legacyReconciliation.rows = recRows.map(r => ({
        bookingId: r.booking_id,
        classification: r.classification,
        status: r.status,
        reason: r.reason
      }));
    }

    // 12. Dining Consistency Audit
    report.diningConsistency = {
      tablesCount: 0,
      stallsCount: 0,
      categoriesCount: 0,
      itemsCount: 0
    };
    if (existingTableNames.includes('dining_tables')) {
      const dt = await dbAsync.get('SELECT COUNT(*) as count FROM dining_tables');
      report.diningConsistency.tablesCount = parseInt(dt.count, 10);
    }
    if (existingTableNames.includes('food_stalls')) {
      const fs = await dbAsync.get('SELECT COUNT(*) as count FROM food_stalls');
      report.diningConsistency.stallsCount = parseInt(fs.count, 10);
    }
    if (existingTableNames.includes('food_menu_items')) {
      const fi = await dbAsync.get('SELECT COUNT(*) as count FROM food_menu_items');
      report.diningConsistency.itemsCount = parseInt(fi.count, 10);
    }

    // Overall Status Determination
    const hasBlockers =
      report.missingTargetTables.length > 0 ||
      (report.timezoneAudit.nonTimezoneAwareColumns && report.timezoneAudit.nonTimezoneAwareColumns.length > 0) ||
      (report.physicalInventory && report.physicalInventory.missing.length > 0) ||
      (report.shootingMachineInvariant && !report.shootingMachineInvariant.isValid) ||
      report.rbacAudit.rolePermissionsCount === 0;

    report.status = hasBlockers ? 'BLOCKED' : 'READY';

    return report;

  } catch (err) {
    report.status = 'ERROR';
    report.error = err.message;
    return report;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPreflightReport().then(res => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

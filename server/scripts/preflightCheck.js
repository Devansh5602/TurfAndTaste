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

    // 6. Check target Stage 0 tables
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
      'dining_order_items'
    ];

    report.missingTargetTables = stage0TargetTables.filter(t => !existingTableNames.includes(t));

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

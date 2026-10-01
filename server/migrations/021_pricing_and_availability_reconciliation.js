import { normalizeBookingInterval } from '../domain/time/bookingInterval.js';

export const id = '021_pricing_and_availability_reconciliation';

export async function up(contextOrDb) {
  const isContext = contextOrDb && typeof contextOrDb === 'object' && ('exec' in contextOrDb || 'isPostgres' in contextOrDb);
  const isPostgres = isContext
    ? Boolean(typeof contextOrDb.isPostgres === 'function' ? contextOrDb.isPostgres() : contextOrDb.isPostgres)
    : Boolean(typeof contextOrDb.query === 'function' && !contextOrDb.prepare);
  const exec = isContext && contextOrDb.exec
    ? contextOrDb.exec
    : async (sql) => (isPostgres ? contextOrDb.query(sql) : contextOrDb.exec(sql));
  const db = isContext && contextOrDb.db ? contextOrDb.db : contextOrDb;

  // 1. Remove unsupported bootstrap Shooting Machine tariff from databases where 020 already ran.
  // Only target the exact bootstrap signature so custom operator configurations are never destroyed.
  await db.run(
    `DELETE FROM add_on_prices
     WHERE id = 'aop_shooting_machine'
       AND add_on_id = 'addon_shooting_machine'
       AND facility_id = 'fac_green_net_1'
       AND rate_paise_per_hour = 20000
       AND rate_paise_flat = 0
       AND is_active = ?`,
    [isPostgres ? true : 1]
  );

  // 2. Add pricing_snapshot column to bookings
  if (isPostgres) {
    await exec(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_snapshot TEXT;`);
  } else {
    const bookingColumns = await db.all('PRAGMA table_info(bookings)');
    if (!bookingColumns.some((column) => column.name === 'pricing_snapshot')) {
      await exec(`ALTER TABLE bookings ADD COLUMN pricing_snapshot TEXT;`);
    }
  }

  // 3. Add pricing_snapshot column to session_adjustments
  if (isPostgres) {
    await exec(`ALTER TABLE session_adjustments ADD COLUMN IF NOT EXISTS pricing_snapshot TEXT;`);
  } else {
    const adjustmentColumns = await db.all('PRAGMA table_info(session_adjustments)');
    if (!adjustmentColumns.some((column) => column.name === 'pricing_snapshot')) {
      await exec(`ALTER TABLE session_adjustments ADD COLUMN pricing_snapshot TEXT;`);
    }
  }

  // 4. Reconcile legacy blocked_slots into facility_blocks
  const legacyBlocks = await db.all('SELECT * FROM blocked_slots');
  for (const legacyBlock of legacyBlocks) {
    const interval = normalizeBookingInterval({ date: legacyBlock.date, timeSlot: legacyBlock.time_slot });
    const startISO = interval.startAt.toISOString();
    const endISO = interval.endAt.toISOString();
    const existing = await db.get(
      'SELECT id FROM facility_blocks WHERE facility_id = ? AND start_at = ? AND end_at = ?',
      [legacyBlock.facility_id, startISO, endISO]
    );

    if (!existing) {
      await db.run(
        `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, internal_note, customer_message, created_by, status)
         VALUES (?, ?, ?, ?, 'MAINTENANCE', ?, ?, ?, 'active')`,
        [
          `fb_migrated_${legacyBlock.id}`,
          legacyBlock.facility_id,
          startISO,
          endISO,
          `Migrated from legacy blocked_slots: ${legacyBlock.reason || 'Maintenance'}`,
          legacyBlock.reason || 'Facility Maintenance Block',
          legacyBlock.blocked_by || 'legacy_migration'
        ]
      );
    }
  }
}

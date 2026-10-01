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

  const tryExec = async (sql) => {
    try {
      await exec(sql);
    } catch (_e) {}
  };

  // 1. Remove unsupported bootstrap Shooting Machine tariff from databases where 020 already ran.
  // Only target the exact bootstrap signature so custom operator configurations are never destroyed.
  try {
    if (isPostgres) {
      await db.run(
        `DELETE FROM add_on_prices
         WHERE id = 'aop_shooting_machine'
           AND add_on_id = 'addon_shooting_machine'
           AND rate_paise_per_hour = 20000
           AND rate_paise_flat = 0`
      );
    } else {
      await db.run(
        `DELETE FROM add_on_prices
         WHERE id = 'aop_shooting_machine'
           AND add_on_id = 'addon_shooting_machine'
           AND rate_paise_per_hour = 20000
           AND rate_paise_flat = 0`
      );
    }
  } catch (_e) {}

  // 2. Add pricing_snapshot column to bookings
  if (isPostgres) {
    await exec(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_snapshot TEXT;`);
  } else {
    await tryExec(`ALTER TABLE bookings ADD COLUMN pricing_snapshot TEXT;`);
  }

  // 3. Add pricing_snapshot column to session_adjustments
  if (isPostgres) {
    await exec(`ALTER TABLE session_adjustments ADD COLUMN IF NOT EXISTS pricing_snapshot TEXT;`);
  } else {
    await tryExec(`ALTER TABLE session_adjustments ADD COLUMN pricing_snapshot TEXT;`);
  }

  // 4. Reconcile legacy blocked_slots into facility_blocks
  try {
    const legacyBlocks = await db.all('SELECT * FROM blocked_slots');
    for (const lb of legacyBlocks) {
      try {
        const interval = normalizeBookingInterval({ date: lb.date, timeSlot: lb.time_slot });
        const startISO = interval.startAt.toISOString();
        const endISO = interval.endAt.toISOString();

        // Check if an equivalent block already exists in facility_blocks
        const existing = await db.get(
          'SELECT id FROM facility_blocks WHERE facility_id = ? AND start_at = ? AND end_at = ?',
          [lb.facility_id, startISO, endISO]
        );

        if (!existing) {
          const blockId = `fb_migrated_${lb.id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await db.run(
            `INSERT INTO facility_blocks (id, facility_id, start_at, end_at, reason_code, internal_note, customer_message, created_by, status)
             VALUES (?, ?, ?, ?, 'MAINTENANCE', ?, ?, ?, 'active')`,
            [
              blockId,
              lb.facility_id,
              startISO,
              endISO,
              `Migrated from legacy blocked_slots: ${lb.reason || 'Maintenance'}`,
              lb.reason || 'Facility Maintenance Block',
              lb.blocked_by || 'legacy_migration'
            ]
          );
        }
      } catch (_intervalErr) {}
    }
  } catch (_tableErr) {
    // blocked_slots table might not exist in clean environments
  }
}

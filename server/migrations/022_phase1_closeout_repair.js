import { normalizeBookingInterval } from '../domain/time/bookingInterval.js';

export const id = '022_phase1_closeout_repair';

const LEGACY_TIER_FACILITIES = {
  'box-cricket': ['fac_box_cricket_1', 'fac_box_cricket_2'],
  pickleball: ['fac_pickleball_1', 'fac_pickleball_2'],
  'cricket-nets': ['fac_green_net_1'],
  skating: ['fac_skating_1']
};

async function addSqliteColumnIfMissing(db, table, column, definition, exec) {
  const columns = await db.all(`PRAGMA table_info(${table})`);
  if (!columns.some((entry) => entry.name === column)) {
    await exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export async function up(context) {
  const isPostgres = Boolean(
    typeof context.isPostgres === 'function' ? context.isPostgres() : context.isPostgres
  );
  const { db, exec } = context;

  if (isPostgres) {
    await exec('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_snapshot TEXT;');
    await exec('ALTER TABLE session_adjustments ADD COLUMN IF NOT EXISTS pricing_snapshot TEXT;');
    await exec('ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS expected_amount_paise INTEGER;');
  } else {
    await addSqliteColumnIfMissing(db, 'bookings', 'pricing_snapshot', 'TEXT', exec);
    await addSqliteColumnIfMissing(db, 'session_adjustments', 'pricing_snapshot', 'TEXT', exec);
    await addSqliteColumnIfMissing(db, 'payment_orders', 'expected_amount_paise', 'INTEGER', exec);
  }

  await db.run(
    `UPDATE payment_orders
     SET expected_amount_paise = expected_amount * 100
     WHERE expected_amount_paise IS NULL`
  );

  const legacyTiers = await db.all(
    `SELECT facility_id, day_rate, night_rate, weekend_surge, deposit_pct, details_json
     FROM pricing_tiers`
  );
  for (const tier of legacyTiers) {
    const physicalFacilityIds = LEGACY_TIER_FACILITIES[tier.facility_id] || [];
    for (const facilityId of physicalFacilityIds) {
      const dayPaise = Math.round(Number(tier.day_rate) || 0) * 100;
      const nightPaise = Math.round(Number(tier.night_rate) || 0) * 100;
      const surge = Math.max(0, Math.round(Number(tier.weekend_surge) || 0));
      let configuredDeposit = 0;
      try {
        configuredDeposit = Number(String(JSON.parse(tier.details_json || '{}').bookingDeposit || '').replace(/[^0-9.]/g, '')) || 0;
      } catch {}
      const depositPaise = Math.max(0, Math.round((configuredDeposit || Number(tier.deposit_pct) || 0) * 100));
      const rates = [
        ['DAY', dayPaise],
        ['NIGHT', nightPaise],
        ['WEEKEND_DAY', Math.round(dayPaise * (1 + surge / 100))],
        ['WEEKEND_NIGHT', Math.round(nightPaise * (1 + surge / 100))]
      ];
      for (const [periodType, ratePaise] of rates) {
        const existing = await db.get(
          `SELECT id FROM pricing_rules
           WHERE facility_id = ? AND service_id IS NULL
             AND rule_type = 'BASE_RATE' AND period_type = ? AND is_active = ?
           ORDER BY id ASC LIMIT 1`,
          [facilityId, periodType, isPostgres ? true : 1]
        );
        if (!existing && ratePaise > 0) {
          await db.run(
            `INSERT INTO pricing_rules (
               id, facility_id, rule_type, period_type, rate_paise_per_hour,
               deposit_fixed_paise, deposit_pct_of_total, is_active
             ) VALUES (?, ?, 'BASE_RATE', ?, ?, ?, 0, ?)`,
            [`pr_reconciled_${facilityId}_${periodType.toLowerCase()}`, facilityId, periodType, ratePaise, depositPaise, isPostgres ? true : 1]
          );
        }
      }
    }
  }

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

  const legacyBlocks = await db.all('SELECT * FROM blocked_slots');
  for (const legacyBlock of legacyBlocks) {
    const interval = normalizeBookingInterval({ date: legacyBlock.date, timeSlot: legacyBlock.time_slot });
    const startAt = interval.startAt.toISOString();
    const endAt = interval.endAt.toISOString();
    const existing = await db.get(
      'SELECT id FROM facility_blocks WHERE facility_id = ? AND start_at = ? AND end_at = ?',
      [legacyBlock.facility_id, startAt, endAt]
    );
    if (!existing) {
      await db.run(
        `INSERT INTO facility_blocks (
           id, facility_id, start_at, end_at, reason_code,
           internal_note, customer_message, created_by, status
         ) VALUES (?, ?, ?, ?, 'MAINTENANCE', ?, ?, ?, 'active')`,
        [
          `fb_migrated_${legacyBlock.id}`,
          legacyBlock.facility_id,
          startAt,
          endAt,
          `Migrated from legacy blocked_slots: ${legacyBlock.reason || 'Maintenance'}`,
          legacyBlock.reason || 'Facility Maintenance Block',
          legacyBlock.blocked_by || 'legacy_migration'
        ]
      );
    }
  }
}

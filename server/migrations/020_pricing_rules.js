export const id = '020_pricing_rules';

export async function up(contextOrDb) {
  const isContext = contextOrDb && typeof contextOrDb === 'object' && ('exec' in contextOrDb || 'isPostgres' in contextOrDb);
  const isPostgres = isContext
    ? Boolean(typeof contextOrDb.isPostgres === 'function' ? contextOrDb.isPostgres() : contextOrDb.isPostgres)
    : Boolean(typeof contextOrDb.query === 'function' && !contextOrDb.prepare);
  const exec = isContext && contextOrDb.exec
    ? contextOrDb.exec
    : async (sql) => (isPostgres ? contextOrDb.query(sql) : contextOrDb.exec(sql));
  const db = isContext && contextOrDb.db ? contextOrDb.db : contextOrDb;

  // Base, package, and extension pricing rules per facility/service
  await exec(`
    CREATE TABLE IF NOT EXISTS pricing_rules (
      id                    ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} PRIMARY KEY,
      facility_id           ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} NOT NULL,
      service_id            ${isPostgres ? 'VARCHAR(100)' : 'TEXT'},
      rule_type             ${isPostgres ? 'VARCHAR(50)' : 'TEXT'} NOT NULL DEFAULT 'BASE_RATE',
      period_type           ${isPostgres ? 'VARCHAR(50)' : 'TEXT'} NOT NULL DEFAULT 'DAY',
      rate_paise_per_hour   INTEGER NOT NULL DEFAULT 0,
      rate_paise_total      INTEGER NOT NULL DEFAULT 0,
      rate_paise_per_15min  INTEGER NOT NULL DEFAULT 0,
      min_hours             INTEGER NOT NULL DEFAULT 1,
      max_hours             INTEGER NOT NULL DEFAULT 24,
      deposit_fixed_paise   INTEGER NOT NULL DEFAULT 0,
      deposit_pct_of_total  INTEGER NOT NULL DEFAULT 0,
      is_active             ${isPostgres ? 'BOOLEAN' : 'INTEGER'} NOT NULL DEFAULT ${isPostgres ? 'TRUE' : '1'},
      notes                 ${isPostgres ? 'TEXT' : 'TEXT'},
      created_at            ${isPostgres ? 'TIMESTAMP' : 'DATETIME'} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at            ${isPostgres ? 'TIMESTAMP' : 'DATETIME'} NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Calendar-date specific rate overrides
  await exec(`
    CREATE TABLE IF NOT EXISTS special_date_prices (
      id                   ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} PRIMARY KEY,
      facility_id          ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} NOT NULL,
      service_id           ${isPostgres ? 'VARCHAR(100)' : 'TEXT'},
      calendar_date        ${isPostgres ? 'VARCHAR(10)' : 'TEXT'} NOT NULL,
      label                ${isPostgres ? 'VARCHAR(255)' : 'TEXT'},
      rate_paise_per_hour  INTEGER NOT NULL DEFAULT 0,
      is_replacement       ${isPostgres ? 'BOOLEAN' : 'INTEGER'} NOT NULL DEFAULT ${isPostgres ? 'TRUE' : '1'},
      is_active            ${isPostgres ? 'BOOLEAN' : 'INTEGER'} NOT NULL DEFAULT ${isPostgres ? 'TRUE' : '1'},
      created_at           ${isPostgres ? 'TIMESTAMP' : 'DATETIME'} NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add-on hourly and flat tariffs
  await exec(`
    CREATE TABLE IF NOT EXISTS add_on_prices (
      id                   ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} PRIMARY KEY,
      add_on_id            ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} NOT NULL,
      facility_id          ${isPostgres ? 'VARCHAR(100)' : 'TEXT'},
      rate_paise_per_hour  INTEGER NOT NULL DEFAULT 0,
      rate_paise_flat      INTEGER NOT NULL DEFAULT 0,
      is_active            ${isPostgres ? 'BOOLEAN' : 'INTEGER'} NOT NULL DEFAULT ${isPostgres ? 'TRUE' : '1'},
      created_at           ${isPostgres ? 'TIMESTAMP' : 'DATETIME'} NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default pricing rules from pricing_tiers
  let tiers = [];
  try {
    tiers = await db.all('SELECT facility_id, day_rate, night_rate, weekend_surge, deposit_pct, details_json FROM pricing_tiers');
  } catch (_e) {
    tiers = [];
  }

  for (const tier of tiers) {
    const fid = tier.facility_id;
    const dayRate = Math.round(Number(tier.day_rate) || 0);
    const nightRate = Math.round(Number(tier.night_rate) || 0);
    const surge = Math.round(Number(tier.weekend_surge) || 0);
    let configuredDeposit = 0;
    try {
      configuredDeposit = Number(String(JSON.parse(tier.details_json || '{}').bookingDeposit || '').replace(/[^0-9.]/g, '')) || 0;
    } catch {}
    const depositFixed = Math.max(0, Math.round((configuredDeposit || Number(tier.deposit_pct) || 0) * 100));

    const weekendDayRate = surge > 0 ? Math.round(dayRate * (1 + surge / 100)) : dayRate;
    const weekendNightRate = surge > 0 ? Math.round(nightRate * (1 + surge / 100)) : nightRate;
    const ext15min = Math.round(dayRate / 4);

    const rows = [
      [`pr_${fid}_day`,    fid, 'DAY',           'BASE_RATE',      dayRate * 100,         depositFixed, 0],
      [`pr_${fid}_night`,  fid, 'NIGHT',         'BASE_RATE',      nightRate * 100,       depositFixed, 0],
      [`pr_${fid}_wday`,   fid, 'WEEKEND_DAY',   'BASE_RATE',      weekendDayRate * 100,  depositFixed, 0],
      [`pr_${fid}_wnight`, fid, 'WEEKEND_NIGHT', 'BASE_RATE',      weekendNightRate * 100, depositFixed, 0],
      [`pr_${fid}_ext`,    fid, 'DAY',           'EXTENSION_RATE', 0,                     0,            ext15min * 100],
    ];

    for (const [id, facilityId, periodType, ruleType, ratePerHour, depositFixedPaise, ratePer15min] of rows) {
      if (isPostgres) {
        await db.run(
          `INSERT INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, rate_paise_per_15min, deposit_fixed_paise, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
           ON CONFLICT (id) DO NOTHING`,
          [id, facilityId, ruleType, periodType, ratePerHour, ratePer15min, depositFixedPaise]
        );
      } else {
        await db.run(
          `INSERT OR IGNORE INTO pricing_rules (id, facility_id, rule_type, period_type, rate_paise_per_hour, rate_paise_per_15min, deposit_fixed_paise, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [id, facilityId, ruleType, periodType, ratePerHour, ratePer15min, depositFixedPaise]
        );
      }
    }
  }
}

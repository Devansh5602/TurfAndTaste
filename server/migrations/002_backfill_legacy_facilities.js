/**
 * Make the existing operational facility records visible through the v2
 * schema. This is intentionally a one-way, non-destructive backfill: legacy
 * bookings keep their facility IDs and continue to use their current tables.
 */
export const id = '002_backfill_legacy_facilities';

export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    await exec(`
      INSERT INTO facility_profiles (
        id, slug, name, facility_type, status, booking_enabled,
        default_slot_minutes, short_description, display_order
      )
      SELECT
        id, id, title, COALESCE(category, 'sport'),
        COALESCE(status, 'active'), TRUE, 60,
        NULL, 0
      FROM facilities
      ON CONFLICT (id) DO NOTHING;
    `);
    return;
  }

  await exec(`
    INSERT OR IGNORE INTO facility_profiles (
      id, slug, name, facility_type, status, booking_enabled,
      default_slot_minutes, short_description, display_order
    )
    SELECT
      id, id, title, COALESCE(category, 'sport'),
      COALESCE(status, 'active'), 1, 60,
      NULL, 0
    FROM facilities;
  `);
}

/**
 * SQLite development installations historically seed pricing tiers without
 * inserting legacy `facilities` rows. Use those operational tiers as a safe
 * fallback inventory so the v2 public facility endpoint never starts empty.
 */
export const id = '003_backfill_pricing_facilities';

export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    await exec(`
      INSERT INTO facility_profiles (
        id, slug, name, facility_type, status, booking_enabled,
        default_slot_minutes, display_order
      )
      SELECT
        facility_id, facility_id, facility_name, 'sport', 'active', TRUE, 60, 0
      FROM pricing_tiers
      ON CONFLICT (id) DO NOTHING;
    `);
    return;
  }

  await exec(`
    INSERT OR IGNORE INTO facility_profiles (
      id, slug, name, facility_type, status, booking_enabled,
      default_slot_minutes, display_order
    )
    SELECT
      facility_id, facility_id, facility_name, 'sport', 'active', 1, 60, 0
    FROM pricing_tiers;
  `);
}

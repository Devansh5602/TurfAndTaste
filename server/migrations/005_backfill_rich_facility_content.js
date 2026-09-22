/**
 * One-time bridge from the established public facility copy into the managed
 * model. It preserves customer-facing parity before the SPA switches readers.
 * Existing administrator-authored rich records are never overwritten.
 */
export const id = '005_backfill_rich_facility_content';

const sqlText = (value) => `'${String(value ?? '').replace(/'/g, "''")}'`;
const sqlJson = (value) => sqlText(JSON.stringify(value));

export async function up({ isPostgres, exec }) {
  const { facilitiesData } = await import('../../src/data/facilitiesData.js');

  for (const [displayOrder, facility] of facilitiesData.entries()) {
    const isDining = facility.category === 'dining';
    const metadata = {
      tag: facility.tag,
      badge: facility.badge,
      specs: facility.specs,
      highlights: facility.highlights,
      suitableFor: facility.suitableFor,
      legacyPricing: facility.pricing,
      seededFrom: 'src/data/facilitiesData.js',
    };
    const bookingEnabled = isDining ? (isPostgres ? 'FALSE' : '0') : (isPostgres ? 'TRUE' : '1');
    const type = isDining ? 'dining' : facility.category;

    await exec(`
      INSERT INTO facility_profiles (
        id, slug, name, facility_type, status, booking_enabled,
        default_slot_minutes, short_description, description, amenities_json,
        rules_json, cover_image_url, display_order, metadata_json
      ) VALUES (
        ${sqlText(facility.id)}, ${sqlText(facility.slug)}, ${sqlText(facility.name)},
        ${sqlText(type)}, 'active', ${bookingEnabled}, 60,
        ${sqlText(facility.shortDesc)}, ${sqlText(facility.fullDesc)},
        ${sqlJson(facility.highlights || [])}, ${sqlJson(facility.rules || [])},
        ${sqlText(facility.image)}, ${displayOrder}, ${sqlJson(metadata)}
      )
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        facility_type = EXCLUDED.facility_type,
        booking_enabled = EXCLUDED.booking_enabled,
        short_description = EXCLUDED.short_description,
        description = EXCLUDED.description,
        amenities_json = EXCLUDED.amenities_json,
        rules_json = EXCLUDED.rules_json,
        cover_image_url = EXCLUDED.cover_image_url,
        display_order = EXCLUDED.display_order,
        metadata_json = EXCLUDED.metadata_json,
        updated_at = CURRENT_TIMESTAMP
      WHERE facility_profiles.description IS NULL OR facility_profiles.description = '';
    `);

    // Seed editable defaults only. Schedule rows are never replaced by this
    // migration, so later administrator changes stay authoritative.
    const opensAt = isDining ? 420 : 360;
    const closesAt = isDining ? 1380 : 360;
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      await exec(`
        INSERT INTO facility_schedules (
          facility_id, day_of_week, opens_at_minutes, closes_at_minutes,
          slot_minutes, is_bookable
        ) VALUES (
          ${sqlText(facility.id)}, ${dayOfWeek}, ${opensAt}, ${closesAt}, 60, ${bookingEnabled}
        ) ON CONFLICT (facility_id, day_of_week) DO NOTHING;
      `);
    }
  }
}

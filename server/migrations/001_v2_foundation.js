/**
 * First additive v2 migration.
 *
 * Legacy tables remain authoritative for existing booking routes while v2
 * facility/content APIs are introduced incrementally. Keeping these tables
 * separate avoids a destructive rewrite of live booking records.
 */
export const id = '001_v2_foundation';

export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    await exec(`
      CREATE TABLE IF NOT EXISTS business_settings (
        key VARCHAR(120) PRIMARY KEY,
        value_json TEXT NOT NULL,
        visibility VARCHAR(20) NOT NULL DEFAULT 'public',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS facility_profiles (
        id VARCHAR(255) PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        facility_type VARCHAR(50) NOT NULL DEFAULT 'sport',
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        booking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        default_slot_minutes INTEGER NOT NULL DEFAULT 60,
        capacity INTEGER,
        short_description TEXT,
        description TEXT,
        amenities_json TEXT NOT NULL DEFAULT '[]',
        rules_json TEXT NOT NULL DEFAULT '[]',
        cover_image_url TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS facility_schedules (
        id BIGSERIAL PRIMARY KEY,
        facility_id VARCHAR(255) NOT NULL REFERENCES facility_profiles(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        opens_at_minutes INTEGER NOT NULL CHECK (opens_at_minutes BETWEEN 0 AND 1439),
        closes_at_minutes INTEGER NOT NULL CHECK (closes_at_minutes BETWEEN 1 AND 1440),
        slot_minutes INTEGER,
        is_bookable BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (facility_id, day_of_week)
      );

      CREATE INDEX IF NOT EXISTS idx_facility_profiles_status_order
        ON facility_profiles (status, display_order);
      CREATE INDEX IF NOT EXISTS idx_facility_schedules_facility
        ON facility_schedules (facility_id, day_of_week);
    `);

    await exec(`
      INSERT INTO business_settings (key, value_json, visibility)
      VALUES ('public_contact', '{}', 'public')
      ON CONFLICT (key) DO NOTHING;
    `);
  } else {
    await exec(`
      CREATE TABLE IF NOT EXISTS business_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'public',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS facility_profiles (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        facility_type TEXT NOT NULL DEFAULT 'sport',
        status TEXT NOT NULL DEFAULT 'active',
        booking_enabled INTEGER NOT NULL DEFAULT 1,
        default_slot_minutes INTEGER NOT NULL DEFAULT 60,
        capacity INTEGER,
        short_description TEXT,
        description TEXT,
        amenities_json TEXT NOT NULL DEFAULT '[]',
        rules_json TEXT NOT NULL DEFAULT '[]',
        cover_image_url TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS facility_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id TEXT NOT NULL REFERENCES facility_profiles(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        opens_at_minutes INTEGER NOT NULL CHECK (opens_at_minutes BETWEEN 0 AND 1439),
        closes_at_minutes INTEGER NOT NULL CHECK (closes_at_minutes BETWEEN 1 AND 1440),
        slot_minutes INTEGER,
        is_bookable INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (facility_id, day_of_week)
      );

      CREATE INDEX IF NOT EXISTS idx_facility_profiles_status_order
        ON facility_profiles (status, display_order);
      CREATE INDEX IF NOT EXISTS idx_facility_schedules_facility
        ON facility_schedules (facility_id, day_of_week);

      INSERT OR IGNORE INTO business_settings (key, value_json, visibility)
      VALUES ('public_contact', '{}', 'public');
    `);
  }
}

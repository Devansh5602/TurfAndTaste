/**
 * Provider-neutral media metadata. Files remain in object storage or another
 * provider; the database records only references and presentation metadata.
 */
export const id = '004_media_assets';

export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    await exec(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id VARCHAR(255) PRIMARY KEY,
        owner_type VARCHAR(80) NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        kind VARCHAR(40) NOT NULL DEFAULT 'image',
        storage_provider VARCHAR(80) NOT NULL,
        storage_key TEXT NOT NULL,
        public_url TEXT,
        alt_text TEXT,
        width INTEGER,
        height INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (storage_provider, storage_key)
      );
      CREATE INDEX IF NOT EXISTS idx_media_assets_owner
        ON media_assets (owner_type, owner_id, sort_order);
    `);
    return;
  }

  await exec(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'image',
      storage_provider TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      public_url TEXT,
      alt_text TEXT,
      width INTEGER,
      height INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (storage_provider, storage_key)
    );
    CREATE INDEX IF NOT EXISTS idx_media_assets_owner
      ON media_assets (owner_type, owner_id, sort_order);
  `);
}

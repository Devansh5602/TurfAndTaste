export const id = '011_food_menu_foundation';

// A single merchant/menu model keeps ordinary food stalls and the convenience
// parlour operationally consistent. Prices are stored in paise, never floats.
export async function up({ isPostgres, exec }) {
  await exec(isPostgres ? `
    CREATE TABLE IF NOT EXISTS food_stalls (
      id VARCHAR(100) PRIMARY KEY,
      slug VARCHAR(120) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      stall_type VARCHAR(30) NOT NULL DEFAULT 'food',
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      short_description TEXT,
      description TEXT,
      logo_image_url TEXT,
      cover_image_url TEXT,
      operating_hours_json TEXT NOT NULL DEFAULT '[]',
      contact_json TEXT NOT NULL DEFAULT '{}',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS food_menu_categories (
      id VARCHAR(100) PRIMARY KEY,
      stall_id VARCHAR(100) NOT NULL REFERENCES food_stalls(id),
      slug VARCHAR(120) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE (stall_id, slug)
    );
    CREATE TABLE IF NOT EXISTS food_menu_items (
      id VARCHAR(100) PRIMARY KEY,
      stall_id VARCHAR(100) NOT NULL REFERENCES food_stalls(id),
      category_id VARCHAR(100) REFERENCES food_menu_categories(id),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
      image_url TEXT,
      dietary_type VARCHAR(30) NOT NULL DEFAULT 'unspecified',
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_food_stalls_public ON food_stalls(status, display_order);
    CREATE INDEX IF NOT EXISTS idx_food_categories_stall ON food_menu_categories(stall_id, is_active, display_order);
    CREATE INDEX IF NOT EXISTS idx_food_items_stall ON food_menu_items(stall_id, is_active, is_available, display_order);
  ` : `
    CREATE TABLE IF NOT EXISTS food_stalls (
      id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      stall_type TEXT NOT NULL DEFAULT 'food', status TEXT NOT NULL DEFAULT 'draft',
      short_description TEXT, description TEXT, logo_image_url TEXT, cover_image_url TEXT,
      operating_hours_json TEXT NOT NULL DEFAULT '[]', contact_json TEXT NOT NULL DEFAULT '{}',
      metadata_json TEXT NOT NULL DEFAULT '{}', display_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS food_menu_categories (
      id TEXT PRIMARY KEY, stall_id TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT, is_active INTEGER NOT NULL DEFAULT 1, display_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE (stall_id, slug), FOREIGN KEY (stall_id) REFERENCES food_stalls(id)
    );
    CREATE TABLE IF NOT EXISTS food_menu_items (
      id TEXT PRIMARY KEY, stall_id TEXT NOT NULL, category_id TEXT, name TEXT NOT NULL,
      description TEXT, price_paise INTEGER NOT NULL CHECK (price_paise >= 0), image_url TEXT,
      dietary_type TEXT NOT NULL DEFAULT 'unspecified', is_available INTEGER NOT NULL DEFAULT 1,
      is_featured INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0, metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stall_id) REFERENCES food_stalls(id), FOREIGN KEY (category_id) REFERENCES food_menu_categories(id)
    );
    CREATE INDEX IF NOT EXISTS idx_food_stalls_public ON food_stalls(status, display_order);
    CREATE INDEX IF NOT EXISTS idx_food_categories_stall ON food_menu_categories(stall_id, is_active, display_order);
    CREATE INDEX IF NOT EXISTS idx_food_items_stall ON food_menu_items(stall_id, is_active, is_available, display_order);
  `);
}

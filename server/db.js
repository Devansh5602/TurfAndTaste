import pg from 'pg';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

let isPostgres = false;
let pgPool = null;
let sqliteDb = null;

if (databaseUrl && databaseUrl.startsWith('postgres')) {
  isPostgres = true;
  console.log('[Database] Connecting to Cloud Supabase PostgreSQL...');
  pgPool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
} else {
  console.log('[Database] Using Local SQLite Database...');
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  // A caller can opt into a disposable SQLite database for integration tests.
  // Production and local development retain the established project data path.
  const dbPath = process.env.SQLITE_DB_PATH || path.join(dataDir, 'turf_and_taste.db');
  try {
    const { default: Database } = await import('better-sqlite3');
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
  } catch (e) {
    console.warn('[Database] SQLite not available in this environment:', e.message);
  }
}

export async function initDatabase() {
  if (isPostgres) {
    try {
      console.log('[Supabase Cloud DB] Running PostgreSQL table migrations...');

      // 1. Admins Table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS admins (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Facilities Table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS facilities (
          id VARCHAR(255) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(255),
          base_price_day INTEGER NOT NULL,
          base_price_night INTEGER NOT NULL,
          deposit_amount INTEGER NOT NULL,
          status VARCHAR(50) DEFAULT 'active'
        );
      `);

      // 3. Bookings Table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id VARCHAR(255) PRIMARY KEY,
          facility_id VARCHAR(255) NOT NULL,
          facility_name VARCHAR(255) NOT NULL,
          date VARCHAR(50) NOT NULL,
          time_slot VARCHAR(255) NOT NULL,
          customer_name VARCHAR(255) NOT NULL,
          customer_phone VARCHAR(50) NOT NULL,
          customer_email VARCHAR(255),
          team_name VARCHAR(255),
          duration INTEGER DEFAULT 1,
          payment_type VARCHAR(50) DEFAULT 'deposit',
          amount_paid VARCHAR(255) NOT NULL,
          payment_status VARCHAR(50) DEFAULT 'Paid',
          booking_status VARCHAR(50) DEFAULT 'Confirmed',
          payment_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. Payments Audit Table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          booking_id VARCHAR(255) NOT NULL,
          razorpay_order_id VARCHAR(255),
          razorpay_payment_id VARCHAR(255),
          razorpay_signature TEXT,
          amount INTEGER NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR',
          payment_type VARCHAR(50) DEFAULT 'deposit',
          status VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Inquiries Table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS inquiries (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          category VARCHAR(100) DEFAULT 'General',
          message TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'unread',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Pricing Tiers Table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS pricing_tiers (
          facility_id VARCHAR(255) PRIMARY KEY,
          facility_name VARCHAR(255) NOT NULL,
          day_rate INTEGER NOT NULL,
          night_rate INTEGER NOT NULL,
          weekend_surge INTEGER DEFAULT 15,
          deposit_pct INTEGER DEFAULT 30,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE pricing_tiers ADD COLUMN IF NOT EXISTS details_json TEXT;
      `);

      // 7. Arena Timings Table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS timings (
          id INTEGER PRIMARY KEY DEFAULT 1,
          arena_open VARCHAR(50) DEFAULT '06:00 AM',
          arena_close VARCHAR(50) DEFAULT '06:00 AM',
          floodlight_start VARCHAR(50) DEFAULT '06:00 PM',
          slot_interval_mins INTEGER DEFAULT 60,
          notes TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 8. Annual Archives Table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS annual_archives (
          id VARCHAR(255) PRIMARY KEY,
          year INTEGER NOT NULL,
          start_date VARCHAR(50) NOT NULL,
          end_date VARCHAR(50) NOT NULL,
          total_bookings INTEGER NOT NULL,
          total_revenue INTEGER NOT NULL,
          deposit_collected INTEGER NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          pdf_size_bytes INTEGER DEFAULT 0,
          recipients TEXT,
          purged_from_db BOOLEAN DEFAULT FALSE,
          archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          archived_by VARCHAR(100) DEFAULT 'admin'
        );
      `);

      // 9. System Settings Table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 10. Blocked Slots Table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS blocked_slots (
          id SERIAL PRIMARY KEY,
          facility_id VARCHAR(255) NOT NULL,
          date VARCHAR(50) NOT NULL,
          time_slot VARCHAR(255) NOT NULL,
          reason TEXT,
          blocked_by VARCHAR(100) DEFAULT 'admin',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (facility_id, date, time_slot)
        );
      `);

      // Seed Default Admin
      const adminRes = await pgPool.query('SELECT count(*) as count FROM admins');
      if (parseInt(adminRes.rows[0].count, 10) === 0) {
        const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;
        if (!defaultPassword) {
          throw new Error('DEFAULT_ADMIN_PASSWORD must be configured before initializing the first admin account.');
        }
        const passwordHash = bcrypt.hashSync(defaultPassword, 10);
        await pgPool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', [defaultUsername, passwordHash]);
        console.log(`[Supabase DB] Default Admin Created -> Username: ${defaultUsername}`);
      }

      // Seed Facilities if empty
      const facilityRes = await pgPool.query('SELECT count(*) as count FROM facilities');
      if (parseInt(facilityRes.rows[0].count, 10) === 0) {
        const seedFacilities = [
          ['box-cricket', 'Box Cricket Arena', 'Cricket', 1200, 1500, 500],
          ['pickleball', 'Pickleball Courts', 'Racket Sports', 600, 800, 300],
          ['ball-machine', 'Ball-Shooting Machine Lane', 'Training', 500, 650, 250],
          ['skating', 'Skating Rink', 'Wheels & Rollers', 400, 500, 200]
        ];

        for (const f of seedFacilities) {
          await pgPool.query(
            'INSERT INTO facilities (id, title, category, base_price_day, base_price_night, deposit_amount) VALUES ($1, $2, $3, $4, $5, $6)',
            f
          );
        }
      }

      // Add missing standard tiers without overwriting administrator-configured rates.
      const seedPricing = [
        ['box-cricket', 'Box Cricket Arena', 600, 800, 15, 35, 200],
        ['pickleball', 'Pickleball Courts', 200, 350, 15, 30, 100],
        ['cricket-nets', 'Cricket Practice Nets', 500, 650, 10, 40, 250],
        ['ball-machine', 'Ball-Shooting Machine Lane', 500, 650, 10, 40, 400],
        ['skating', 'Skating Rink', 400, 500, 10, 30, 400]
      ];
      for (const p of seedPricing) {
        const [facilityId, facilityName, dayRate, nightRate, weekendSurge, depositPct, bookingDeposit] = p;
        const detailsJson = JSON.stringify({
          facilityId, facilityName, dayRate: `₹${dayRate}`, nightRate: `₹${nightRate}`,
          bookingDeposit: `₹${bookingDeposit}`, dayHours: '6:00 AM – 6:00 PM',
          nightHours: '6:00 PM – 6:00 AM (Floodlights)'
        });
        await pgPool.query(
          `INSERT INTO pricing_tiers (facility_id, facility_name, day_rate, night_rate, weekend_surge, deposit_pct, details_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (facility_id) DO UPDATE SET details_json = EXCLUDED.details_json
           WHERE pricing_tiers.details_json IS NULL`,
          [...p.slice(0, 6), detailsJson]
        );
      }

      // Seed Timings if empty
      const timingRes = await pgPool.query('SELECT count(*) as count FROM timings');
      if (parseInt(timingRes.rows[0].count, 10) === 0) {
        await pgPool.query(`
          INSERT INTO timings (id, arena_open, arena_close, floodlight_start, slot_interval_mins, notes)
          VALUES (1, '06:00 AM', '06:00 AM', '06:00 PM', 60, '24-hour sports schedule: day sessions 6:00 AM – 6:00 PM and floodlit sessions 6:00 PM – 6:00 AM.')
          ON CONFLICT (id) DO NOTHING
        `);
      }

      // Seed Default Email Distribution List Setting if not exists
      await pgPool.query(`
        INSERT INTO system_settings (key, value)
        VALUES ('archive_email_list', 'admin@turfandtaste.com, accounts@turfandtaste.com')
        ON CONFLICT (key) DO NOTHING;
      `);

      console.log('✅ [Supabase Cloud DB] Tables & Schema successfully verified!');
    } catch (err) {
      console.error('❌ [Supabase Migration Error]:', err.message);
    }
  } else {
    // SQLite Fallback setup
    console.log('[SQLite DB] Initializing local tables...');
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS facilities (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT, base_price_day INTEGER NOT NULL, base_price_night INTEGER NOT NULL, deposit_amount INTEGER NOT NULL, status TEXT DEFAULT 'active');
      CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, facility_id TEXT NOT NULL, facility_name TEXT NOT NULL, date TEXT NOT NULL, time_slot TEXT NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_email TEXT, team_name TEXT, duration INTEGER DEFAULT 1, payment_type TEXT DEFAULT 'deposit', amount_paid TEXT NOT NULL, payment_status TEXT DEFAULT 'Paid', booking_status TEXT DEFAULT 'Confirmed', payment_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id TEXT NOT NULL, razorpay_order_id TEXT, razorpay_payment_id TEXT, razorpay_signature TEXT, amount INTEGER NOT NULL, currency TEXT DEFAULT 'INR', payment_type TEXT DEFAULT 'deposit', status TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS inquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, category TEXT DEFAULT 'General', message TEXT NOT NULL, status TEXT DEFAULT 'unread', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS pricing_tiers (facility_id TEXT PRIMARY KEY, facility_name TEXT NOT NULL, day_rate INTEGER NOT NULL, night_rate INTEGER NOT NULL, weekend_surge INTEGER DEFAULT 15, deposit_pct INTEGER DEFAULT 30, details_json TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS timings (id INTEGER PRIMARY KEY DEFAULT 1, arena_open TEXT DEFAULT '06:00 AM', arena_close TEXT DEFAULT '06:00 AM', floodlight_start TEXT DEFAULT '06:00 PM', slot_interval_mins INTEGER DEFAULT 60, notes TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS annual_archives (id TEXT PRIMARY KEY, year INTEGER NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, total_bookings INTEGER NOT NULL, total_revenue INTEGER NOT NULL, deposit_collected INTEGER NOT NULL, file_name TEXT NOT NULL, file_path TEXT NOT NULL, pdf_size_bytes INTEGER DEFAULT 0, recipients TEXT, purged_from_db INTEGER DEFAULT 0, archived_at DATETIME DEFAULT CURRENT_TIMESTAMP, archived_by TEXT DEFAULT 'admin');
      CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS blocked_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, facility_id TEXT NOT NULL, date TEXT NOT NULL, time_slot TEXT NOT NULL, reason TEXT, blocked_by TEXT DEFAULT 'admin', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(facility_id, date, time_slot));
      INSERT OR IGNORE INTO system_settings (key, value) VALUES ('archive_email_list', 'admin@turfandtaste.com, accounts@turfandtaste.com');
      INSERT OR IGNORE INTO timings (id, arena_open, arena_close, floodlight_start, slot_interval_mins, notes)
      VALUES (1, '06:00 AM', '06:00 AM', '06:00 PM', 60, '24-hour sports schedule: day sessions 6:00 AM – 6:00 PM and floodlit sessions 6:00 PM – 6:00 AM.');
    `);

    const pricingColumns = sqliteDb.prepare('PRAGMA table_info(pricing_tiers)').all();
    if (!pricingColumns.some(column => column.name === 'details_json')) {
      sqliteDb.exec('ALTER TABLE pricing_tiers ADD COLUMN details_json TEXT');
    }

    const seedPricing = [
      ['box-cricket', 'Box Cricket Arena', 600, 800, 15, 35, 200],
      ['pickleball', 'Pickleball Courts', 200, 350, 15, 30, 100],
      ['cricket-nets', 'Cricket Practice Nets', 500, 650, 10, 40, 250],
      ['ball-machine', 'Ball-Shooting Machine Lane', 500, 650, 10, 40, 400],
      ['skating', 'Skating Rink', 400, 500, 10, 30, 400]
    ];
    const addPricingTier = sqliteDb.prepare(
      'INSERT OR IGNORE INTO pricing_tiers (facility_id, facility_name, day_rate, night_rate, weekend_surge, deposit_pct, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const updatePricingDetails = sqliteDb.prepare('UPDATE pricing_tiers SET details_json = ? WHERE facility_id = ? AND details_json IS NULL');
    for (const tier of seedPricing) {
      const [facilityId, facilityName, dayRate, nightRate, weekendSurge, depositPct, bookingDeposit] = tier;
      const detailsJson = JSON.stringify({
        facilityId, facilityName, dayRate: `₹${dayRate}`, nightRate: `₹${nightRate}`,
        bookingDeposit: `₹${bookingDeposit}`, dayHours: '6:00 AM – 6:00 PM',
        nightHours: '6:00 PM – 6:00 AM (Floodlights)'
      });
      addPricingTier.run(facilityId, facilityName, dayRate, nightRate, weekendSurge, depositPct, detailsJson);
      updatePricingDetails.run(detailsJson, facilityId);
    }

    const adminCount = sqliteDb.prepare('SELECT count(*) AS count FROM admins').get().count;
    if (Number(adminCount) === 0) {
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;
      if (!defaultPassword) {
        throw new Error('DEFAULT_ADMIN_PASSWORD must be configured before initializing the first admin account.');
      }
      const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
      sqliteDb.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)')
        .run(defaultUsername, bcrypt.hashSync(defaultPassword, 10));
    }
  }
}

// Universal Async Database Abstraction Layer
export const dbAsync = {
  isPostgres: () => isPostgres,

  query: async (sql, params = []) => {
    if (isPostgres) {
      // Convert SQLite ? placeholders to Postgres $1, $2, $3...
      let paramCount = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramCount++}`);
      const result = await pgPool.query(pgSql, params);
      return result;
    } else {
      const stmt = sqliteDb.prepare(sql);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return { rows: stmt.all(...params) };
      } else {
        const info = stmt.run(...params);
        return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
      }
    }
  },

  get: async (sql, params = []) => {
    const res = await dbAsync.query(sql, params);
    return res.rows[0] || null;
  },

  all: async (sql, params = []) => {
    const res = await dbAsync.query(sql, params);
    return res.rows || [];
  },

  run: async (sql, params = []) => {
    return await dbAsync.query(sql, params);
  }
};

export default dbAsync;

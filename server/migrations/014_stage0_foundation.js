/**
 * Stage 0 Platform Foundation Migration (Additive & Non-destructive)
 * 
 * Establishes:
 * 1. Single Patan Property, Sections, Physical Facilities, Services, Add-Ons hierarchy
 * 2. Physical resource blocks, sessions, adjustments, and payment holds
 * 3. Granular RBAC tables (roles, permissions, role_permissions, user_roles)
 * 4. Dining tables, orders, order items
 * 5. Additive timezone-aware interval & preference columns on legacy bookings table
 */

export const id = '014_stage0_foundation';

export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    // 1. PostgreSQL DDL
    await exec(`
      -- Properties
      CREATE TABLE IF NOT EXISTS properties (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        country VARCHAR(100) NOT NULL DEFAULT 'India',
        timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Sections
      CREATE TABLE IF NOT EXISTS sections (
        id VARCHAR(100) PRIMARY KEY,
        property_id VARCHAR(100) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(255) NOT NULL,
        section_type VARCHAR(50) NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Physical Facilities
      CREATE TABLE IF NOT EXISTS physical_facilities (
        id VARCHAR(100) PRIMARY KEY,
        section_id VARCHAR(100) NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        code VARCHAR(100) NOT NULL UNIQUE,
        default_name VARCHAR(255) NOT NULL,
        custom_name VARCHAR(255) NOT NULL,
        capacity INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_bookable BOOLEAN NOT NULL DEFAULT TRUE,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Services
      CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(100) PRIMARY KEY,
        section_id VARCHAR(100) NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Facility Services mapping
      CREATE TABLE IF NOT EXISTS facility_services (
        id VARCHAR(100) PRIMARY KEY,
        facility_id VARCHAR(100) NOT NULL REFERENCES physical_facilities(id) ON DELETE CASCADE,
        service_id VARCHAR(100) NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        is_primary BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(facility_id, service_id)
      );

      -- Add-Ons (e.g. Ball-Shooting Machine)
      CREATE TABLE IF NOT EXISTS add_ons (
        id VARCHAR(100) PRIMARY KEY,
        section_id VARCHAR(100) NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Facility Add-Ons mapping
      CREATE TABLE IF NOT EXISTS facility_add_ons (
        id VARCHAR(100) PRIMARY KEY,
        facility_id VARCHAR(100) NOT NULL REFERENCES physical_facilities(id) ON DELETE CASCADE,
        add_on_id VARCHAR(100) NOT NULL REFERENCES add_ons(id) ON DELETE CASCADE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(facility_id, add_on_id)
      );

      -- Facility Blocks (Interval-based maintenance, events, private blocks)
      CREATE TABLE IF NOT EXISTS facility_blocks (
        id VARCHAR(100) PRIMARY KEY,
        facility_id VARCHAR(100) NOT NULL REFERENCES physical_facilities(id) ON DELETE CASCADE,
        start_at TIMESTAMP NOT NULL,
        end_at TIMESTAMP NOT NULL,
        reason_code VARCHAR(50) NOT NULL DEFAULT 'MAINTENANCE',
        internal_note TEXT,
        customer_message TEXT,
        created_by VARCHAR(100) DEFAULT 'admin',
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (end_at > start_at)
      );
      CREATE INDEX IF NOT EXISTS idx_facility_blocks_range ON facility_blocks (facility_id, start_at, end_at, status);

      -- Facility Sessions (Scheduled vs Actual Session Ground Operations)
      CREATE TABLE IF NOT EXISTS facility_sessions (
        id VARCHAR(100) PRIMARY KEY,
        booking_id VARCHAR(255) NOT NULL,
        facility_id VARCHAR(100) NOT NULL REFERENCES physical_facilities(id) ON DELETE CASCADE,
        scheduled_start_at TIMESTAMP NOT NULL,
        scheduled_end_at TIMESTAMP NOT NULL,
        actual_start_at TIMESTAMP,
        actual_end_at TIMESTAMP,
        session_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        delay_minutes INTEGER DEFAULT 0,
        delay_reason TEXT,
        notes TEXT,
        operator_id VARCHAR(100),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Session Adjustments (15-minute extensions, staff delay adjustments)
      CREATE TABLE IF NOT EXISTS session_adjustments (
        id VARCHAR(100) PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL REFERENCES facility_sessions(id) ON DELETE CASCADE,
        adjustment_type VARCHAR(50) NOT NULL DEFAULT 'EXTENSION',
        minutes INTEGER NOT NULL,
        is_free BOOLEAN NOT NULL DEFAULT FALSE,
        charge_paise INTEGER NOT NULL DEFAULT 0,
        approved_by VARCHAR(100) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Payment Holds (Ephemeral hold with server-controlled TTL)
      CREATE TABLE IF NOT EXISTS payment_holds (
        id VARCHAR(100) PRIMARY KEY,
        facility_id VARCHAR(100) NOT NULL REFERENCES physical_facilities(id) ON DELETE CASCADE,
        start_at TIMESTAMP NOT NULL,
        end_at TIMESTAMP NOT NULL,
        hold_token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
        customer_identifier VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (end_at > start_at)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_holds_active ON payment_holds (facility_id, expires_at, status);

      -- Roles & Permissions (RBAC)
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(100) PRIMARY KEY,
        role_key VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id VARCHAR(100) PRIMARY KEY,
        permission_key VARCHAR(100) NOT NULL UNIQUE,
        module VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id VARCHAR(100) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        id VARCHAR(100) PRIMARY KEY,
        user_type VARCHAR(50) NOT NULL DEFAULT 'admin',
        user_id VARCHAR(255) NOT NULL,
        role_id VARCHAR(100) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_type, user_id, role_id)
      );

      -- Campus Dining Tables & Table Orders
      CREATE TABLE IF NOT EXISTS dining_tables (
        id VARCHAR(100) PRIMARY KEY,
        section_id VARCHAR(100) NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        table_number VARCHAR(50) NOT NULL UNIQUE,
        display_label VARCHAR(100) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        qr_code_token VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dining_orders (
        id VARCHAR(100) PRIMARY KEY,
        stall_id VARCHAR(100),
        table_id VARCHAR(100) REFERENCES dining_tables(id) ON DELETE SET NULL,
        table_number VARCHAR(50) NOT NULL,
        order_number VARCHAR(50) NOT NULL UNIQUE,
        order_source VARCHAR(30) NOT NULL DEFAULT 'CUSTOMER',
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        order_status VARCHAR(50) NOT NULL DEFAULT 'PLACED',
        subtotal_paise INTEGER NOT NULL DEFAULT 0,
        tax_paise INTEGER NOT NULL DEFAULT 0,
        total_amount_paise INTEGER NOT NULL DEFAULT 0,
        payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dining_order_items (
        id VARCHAR(100) PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL REFERENCES dining_orders(id) ON DELETE CASCADE,
        menu_item_id VARCHAR(100),
        item_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price_paise INTEGER NOT NULL,
        total_price_paise INTEGER NOT NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Additive Columns on Legacy bookings Table (Non-destructive)
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS physical_facility_id VARCHAR(100);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMP;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMP;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_type VARCHAR(50) DEFAULT 'STANDARD_QUICK';
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_preference VARCHAR(50) DEFAULT 'WHATSAPP';
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount_paise INTEGER;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount_paise INTEGER;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_actor VARCHAR(100);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

      CREATE INDEX IF NOT EXISTS idx_bookings_physical_interval
        ON bookings (physical_facility_id, scheduled_start_at, scheduled_end_at, booking_status);
    `);
  } else {
    // 2. SQLite DDL
    await exec(`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT 'India',
        timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        code TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        section_type TEXT NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS physical_facilities (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        code TEXT NOT NULL UNIQUE,
        default_name TEXT NOT NULL,
        custom_name TEXT NOT NULL,
        capacity INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_bookable INTEGER NOT NULL DEFAULT 1,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS facility_services (
        id TEXT PRIMARY KEY,
        facility_id TEXT NOT NULL REFERENCES physical_facilities(id) ON DELETE CASCADE,
        service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        is_primary INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(facility_id, service_id)
      );

      CREATE TABLE IF NOT EXISTS add_ons (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS facility_add_ons (
        id TEXT PRIMARY KEY,
        facility_id TEXT NOT NULL REFERENCES physical_facilities(id) ON DELETE CASCADE,
        add_on_id TEXT NOT NULL REFERENCES add_ons(id) ON DELETE CASCADE,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(facility_id, add_on_id)
      );

      CREATE TABLE IF NOT EXISTS facility_blocks (
        id TEXT PRIMARY KEY,
        facility_id TEXT NOT NULL REFERENCES physical_facilities(id) ON DELETE CASCADE,
        start_at DATETIME NOT NULL,
        end_at DATETIME NOT NULL,
        reason_code TEXT NOT NULL DEFAULT 'MAINTENANCE',
        internal_note TEXT,
        customer_message TEXT,
        created_by TEXT DEFAULT 'admin',
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (end_at > start_at)
      );
      CREATE INDEX IF NOT EXISTS idx_facility_blocks_range ON facility_blocks (facility_id, start_at, end_at, status);

      CREATE TABLE IF NOT EXISTS facility_sessions (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        facility_id TEXT NOT NULL REFERENCES physical_facilities(id) ON DELETE CASCADE,
        scheduled_start_at DATETIME NOT NULL,
        scheduled_end_at DATETIME NOT NULL,
        actual_start_at DATETIME,
        actual_end_at DATETIME,
        session_status TEXT NOT NULL DEFAULT 'PENDING',
        delay_minutes INTEGER DEFAULT 0,
        delay_reason TEXT,
        notes TEXT,
        operator_id TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS session_adjustments (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES facility_sessions(id) ON DELETE CASCADE,
        adjustment_type TEXT NOT NULL DEFAULT 'EXTENSION',
        minutes INTEGER NOT NULL,
        is_free INTEGER NOT NULL DEFAULT 0,
        charge_paise INTEGER NOT NULL DEFAULT 0,
        approved_by TEXT NOT NULL,
        reason TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_holds (
        id TEXT PRIMARY KEY,
        facility_id TEXT NOT NULL REFERENCES physical_facilities(id) ON DELETE CASCADE,
        start_at DATETIME NOT NULL,
        end_at DATETIME NOT NULL,
        hold_token TEXT NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        customer_identifier TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (end_at > start_at)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_holds_active ON payment_holds (facility_id, expires_at, status);

      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        role_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        permission_key TEXT NOT NULL UNIQUE,
        module TEXT NOT NULL,
        description TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        id TEXT PRIMARY KEY,
        user_type TEXT NOT NULL DEFAULT 'admin',
        user_id TEXT NOT NULL,
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_type, user_id, role_id)
      );

      CREATE TABLE IF NOT EXISTS dining_tables (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        table_number TEXT NOT NULL UNIQUE,
        display_label TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        qr_code_token TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dining_orders (
        id TEXT PRIMARY KEY,
        stall_id TEXT,
        table_id TEXT REFERENCES dining_tables(id) ON DELETE SET NULL,
        table_number TEXT NOT NULL,
        order_number TEXT NOT NULL UNIQUE,
        order_source TEXT NOT NULL DEFAULT 'CUSTOMER',
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        order_status TEXT NOT NULL DEFAULT 'PLACED',
        subtotal_paise INTEGER NOT NULL DEFAULT 0,
        tax_paise INTEGER NOT NULL DEFAULT 0,
        total_amount_paise INTEGER NOT NULL DEFAULT 0,
        payment_status TEXT NOT NULL DEFAULT 'PENDING',
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dining_order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES dining_orders(id) ON DELETE CASCADE,
        menu_item_id TEXT,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price_paise INTEGER NOT NULL,
        total_price_paise INTEGER NOT NULL,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // In SQLite, add columns to bookings if missing
    const bookingColumns = [
      { name: 'physical_facility_id', type: 'TEXT' },
      { name: 'scheduled_start_at', type: 'DATETIME' },
      { name: 'scheduled_end_at', type: 'DATETIME' },
      { name: 'booking_type', type: 'TEXT DEFAULT "STANDARD_QUICK"' },
      { name: 'delivery_preference', type: 'TEXT DEFAULT "WHATSAPP"' },
      { name: 'total_amount_paise', type: 'INTEGER' },
      { name: 'deposit_amount_paise', type: 'INTEGER' },
      { name: 'cancellation_actor', type: 'TEXT' },
      { name: 'cancelled_at', type: 'DATETIME' }
    ];

    for (const col of bookingColumns) {
      try {
        await exec(`ALTER TABLE bookings ADD COLUMN ${col.name} ${col.type};`);
      } catch (e) {
        // Column already exists
      }
    }
  }

  // 3. Seed Canonical Baseline Property, Sections & Physical Facilities
  await exec(`
    INSERT INTO properties (id, name, city, state, country, timezone)
    VALUES ('prop_patan', 'Turf & Taste', 'Patan', 'Gujarat', 'India', 'Asia/Kolkata')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO sections (id, property_id, code, display_name, section_type, display_order)
    VALUES
      ('sec_sports', 'prop_patan', 'SPORTS', 'Sports & Recreational Arena', 'SPORTS', 1),
      ('sec_dining', 'prop_patan', 'DINING', 'Turf & Taste Campus Dining', 'DINING', 2)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO physical_facilities (id, section_id, code, default_name, custom_name, capacity)
    VALUES
      ('fac_box_cricket_1', 'sec_sports', 'box-cricket-turf-1', 'Box Cricket Turf 1', 'Box Cricket Turf 1', 16),
      ('fac_box_cricket_2', 'sec_sports', 'box-cricket-turf-2', 'Box Cricket Turf 2', 'Box Cricket Turf 2', 16),
      ('fac_pickleball_1', 'sec_sports', 'pickleball-court-1', 'Pickleball Court 1', 'Pickleball Court 1', 4),
      ('fac_pickleball_2', 'sec_sports', 'pickleball-court-2', 'Pickleball Court 2', 'Pickleball Court 2', 4),
      ('fac_skating_1', 'sec_sports', 'skating-rink-1', 'Skating Rink 1', 'Skating Rink', 25),
      ('fac_green_net_1', 'sec_sports', 'cricket-green-net-1', 'Cricket Green Net 1', 'Cricket Practice Net', 8)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO services (id, section_id, code, name)
    VALUES
      ('srv_box_cricket', 'sec_sports', 'box-cricket', 'Box Cricket'),
      ('srv_pickleball', 'sec_sports', 'pickleball', 'Pickleball'),
      ('srv_skating', 'sec_sports', 'skating', 'Skating'),
      ('srv_green_net', 'sec_sports', 'cricket-green-net', 'Cricket Green Net Practice')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO facility_services (id, facility_id, service_id, is_primary)
    VALUES
      ('fs_bc_1', 'fac_box_cricket_1', 'srv_box_cricket', ${isPostgres ? 'TRUE' : '1'}),
      ('fs_bc_2', 'fac_box_cricket_2', 'srv_box_cricket', ${isPostgres ? 'TRUE' : '1'}),
      ('fs_pb_1', 'fac_pickleball_1', 'srv_pickleball', ${isPostgres ? 'TRUE' : '1'}),
      ('fs_pb_2', 'fac_pickleball_2', 'srv_pickleball', ${isPostgres ? 'TRUE' : '1'}),
      ('fs_sk_1', 'fac_skating_1', 'srv_skating', ${isPostgres ? 'TRUE' : '1'}),
      ('fs_gn_1', 'fac_green_net_1', 'srv_green_net', ${isPostgres ? 'TRUE' : '1'})
    ON CONFLICT (id) DO NOTHING;

    -- Add-On: Ball-Shooting Machine attached to Cricket Green Net 1
    INSERT INTO add_ons (id, section_id, code, name, description)
    VALUES
      ('addon_shooting_machine', 'sec_sports', 'shooting-machine', 'Ball-Shooting Machine', 'Automated cricket bowling machine add-on')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO facility_add_ons (id, facility_id, add_on_id)
    VALUES
      ('fa_gn_machine', 'fac_green_net_1', 'addon_shooting_machine')
    ON CONFLICT (id) DO NOTHING;

    -- Standard System Roles
    INSERT INTO roles (id, role_key, name, description, is_system)
    VALUES
      ('role_super_admin', 'super_admin', 'Super Administrator', 'Full platform operational and administrative authority', ${isPostgres ? 'TRUE' : '1'}),
      ('role_staff', 'staff', 'Operations Staff', 'Ground session management, walk-ins, and extensions', ${isPostgres ? 'TRUE' : '1'}),
      ('role_stall_staff', 'stall_staff', 'Stall Staff', 'Dining stall order fulfillment and menu management', ${isPostgres ? 'TRUE' : '1'}),
      ('role_customer', 'customer', 'Registered Customer', 'Customer self-service bookings and food orders', ${isPostgres ? 'TRUE' : '1'})
    ON CONFLICT (id) DO NOTHING;

    -- Standard Permissions
    INSERT INTO permissions (id, permission_key, module, description)
    VALUES
      ('perm_facility_read', 'facility.read', 'facilities', 'View facilities and schedules'),
      ('perm_facility_create', 'facility.create', 'facilities', 'Create new facilities'),
      ('perm_facility_update', 'facility.update', 'facilities', 'Update facility details'),
      ('perm_facility_block', 'facility.block', 'facilities', 'Manage facility blocks'),
      ('perm_booking_read', 'booking.read', 'bookings', 'View bookings'),
      ('perm_booking_create', 'booking.create', 'bookings', 'Create customer bookings'),
      ('perm_booking_walkin', 'booking.walkin', 'bookings', 'Create immediate walk-in bookings'),
      ('perm_booking_checkin', 'booking.checkin', 'bookings', 'Check-in bookings and start sessions'),
      ('perm_booking_extend', 'booking.extend', 'bookings', 'Approve session extensions'),
      ('perm_booking_cancel', 'booking.cancel', 'bookings', 'Cancel bookings'),
      ('perm_pricing_read', 'pricing.read', 'pricing', 'View pricing'),
      ('perm_pricing_manage', 'pricing.manage', 'pricing', 'Manage pricing rules and packages'),
      ('perm_payment_read', 'payment.read', 'payments', 'View payments'),
      ('perm_payment_record', 'payment.record', 'payments', 'Record counter payments'),
      ('perm_customer_read', 'customer.read', 'customers', 'View customer details'),
      ('perm_event_manage', 'event.manage', 'events', 'Manage events'),
      ('perm_notice_manage', 'notice.manage', 'notices', 'Manage notices'),
      ('perm_review_moderate', 'review.moderate', 'reviews', 'Moderate reviews'),
      ('perm_dining_stall', 'dining.stall.manage', 'dining', 'Manage dining stalls'),
      ('perm_dining_menu', 'dining.menu.manage', 'dining', 'Manage dining menus'),
      ('perm_dining_order_read', 'dining.order.read', 'dining', 'View dining orders'),
      ('perm_dining_order_manage', 'dining.order.manage', 'dining', 'Manage dining orders'),
      ('perm_role_manage', 'role.manage', 'roles', 'Manage roles and permissions'),
      ('perm_maintenance_manage', 'maintenance.manage', 'maintenance', 'Manage maintenance settings')
    ON CONFLICT (id) DO NOTHING;

    -- Baseline Dining Tables
    INSERT INTO dining_tables (id, section_id, table_number, display_label)
    VALUES
      ('tbl_1', 'sec_dining', 'T1', 'Table 1 - Patio'),
      ('tbl_2', 'sec_dining', 'T2', 'Table 2 - Patio'),
      ('tbl_3', 'sec_dining', 'T3', 'Table 3 - Arena View'),
      ('tbl_4', 'sec_dining', 'T4', 'Table 4 - Arena View'),
      ('tbl_5', 'sec_dining', 'T5', 'Table 5 - Lounge')
    ON CONFLICT (id) DO NOTHING;
  `);
}

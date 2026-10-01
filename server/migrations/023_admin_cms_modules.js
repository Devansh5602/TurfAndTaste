export const id = '023_admin_cms_modules';

export async function up(context) {
  const isPostgres = Boolean(
    typeof context.isPostgres === 'function' ? context.isPostgres() : context.isPostgres
  );
  const { exec } = context;

  // 1. Property Notices CMS
  await exec(`
    CREATE TABLE IF NOT EXISTS notices (
      id           ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} PRIMARY KEY,
      title        ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
      content      ${isPostgres ? 'TEXT' : 'TEXT'} NOT NULL,
      type         ${isPostgres ? 'VARCHAR(50)' : 'TEXT'} NOT NULL DEFAULT 'info',
      is_pinned    ${isPostgres ? 'BOOLEAN' : 'INTEGER'} NOT NULL DEFAULT ${isPostgres ? 'FALSE' : '0'},
      status       ${isPostgres ? 'VARCHAR(50)' : 'TEXT'} NOT NULL DEFAULT 'published',
      created_by   ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} DEFAULT 'admin',
      created_at   ${isPostgres ? 'TIMESTAMP' : 'DATETIME'} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   ${isPostgres ? 'TIMESTAMP' : 'DATETIME'} NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Customer Reviews Moderation
  await exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id             ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} PRIMARY KEY,
      booking_id     ${isPostgres ? 'VARCHAR(100)' : 'TEXT'},
      customer_name  ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
      customer_phone ${isPostgres ? 'VARCHAR(50)' : 'TEXT'},
      facility_id    ${isPostgres ? 'VARCHAR(100)' : 'TEXT'},
      rating         INTEGER NOT NULL DEFAULT 5,
      comment        ${isPostgres ? 'TEXT' : 'TEXT'},
      status         ${isPostgres ? 'VARCHAR(50)' : 'TEXT'} NOT NULL DEFAULT 'pending',
      admin_response ${isPostgres ? 'TEXT' : 'TEXT'},
      moderated_by   ${isPostgres ? 'VARCHAR(100)' : 'TEXT'},
      moderated_at   ${isPostgres ? 'TIMESTAMP' : 'DATETIME'},
      created_at     ${isPostgres ? 'TIMESTAMP' : 'DATETIME'} NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Customer CRM Internal Staff Notes
  await exec(`
    CREATE TABLE IF NOT EXISTS customer_notes (
      id             ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} PRIMARY KEY,
      customer_phone ${isPostgres ? 'VARCHAR(50)' : 'TEXT'} NOT NULL,
      note           ${isPostgres ? 'TEXT' : 'TEXT'} NOT NULL,
      created_by     ${isPostgres ? 'VARCHAR(100)' : 'TEXT'} DEFAULT 'staff',
      created_at     ${isPostgres ? 'TIMESTAMP' : 'DATETIME'} NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function down() {
  // Additive migration
}

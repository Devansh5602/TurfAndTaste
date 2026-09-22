export const id = '008_admin_roles';

// This additive migration establishes the smallest useful management-account
// foundation. Existing administrators become enabled super administrators so
// current installations retain access while later modules can add permissions.
export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    await exec(`
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'super_admin';
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;
      UPDATE admins
      SET role = 'super_admin'
      WHERE role IS NULL OR role NOT IN ('super_admin', 'manager');
      UPDATE admins SET is_enabled = TRUE WHERE is_enabled IS NULL;
    `);
    return;
  }

  await exec(`
    ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'super_admin';
    ALTER TABLE admins ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1;
    UPDATE admins
    SET role = 'super_admin'
    WHERE role IS NULL OR role NOT IN ('super_admin', 'manager');
    UPDATE admins SET is_enabled = 1 WHERE is_enabled IS NULL;
  `);
}

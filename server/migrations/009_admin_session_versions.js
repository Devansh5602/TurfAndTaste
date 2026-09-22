export const id = '009_admin_session_versions';

// A monotonic session version lets security-sensitive account changes revoke
// already-issued JWTs without introducing a global token blacklist.
export async function up({ isPostgres, exec }) {
  if (isPostgres) {
    await exec(`
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
      UPDATE admins SET session_version = 0 WHERE session_version IS NULL;
    `);
    return;
  }

  await exec(`
    ALTER TABLE admins ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
    UPDATE admins SET session_version = 0 WHERE session_version IS NULL;
  `);
}

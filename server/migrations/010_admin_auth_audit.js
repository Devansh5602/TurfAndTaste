export const id = '010_admin_auth_audit';

export async function up({ isPostgres, exec }) {
  await exec(isPostgres ? `
    CREATE TABLE IF NOT EXISTS admin_auth_audit (
      id SERIAL PRIMARY KEY,
      actor_admin_id INTEGER,
      action VARCHAR(80) NOT NULL,
      target_type VARCHAR(50),
      target_id VARCHAR(255),
      outcome VARCHAR(30) NOT NULL,
      metadata_json TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_admin_auth_audit_created_at ON admin_auth_audit(created_at);
    CREATE INDEX IF NOT EXISTS idx_admin_auth_audit_actor ON admin_auth_audit(actor_admin_id);
  ` : `
    CREATE TABLE IF NOT EXISTS admin_auth_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_admin_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      outcome TEXT NOT NULL,
      metadata_json TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_admin_auth_audit_created_at ON admin_auth_audit(created_at);
    CREATE INDEX IF NOT EXISTS idx_admin_auth_audit_actor ON admin_auth_audit(actor_admin_id);
  `);
}

export const id = '006_quote_redemptions';
export async function up({ isPostgres, exec }) {
  await exec(isPostgres ? `CREATE TABLE IF NOT EXISTS quote_redemptions (quote_id VARCHAR(255) PRIMARY KEY, booking_id VARCHAR(255) NOT NULL, expires_at TIMESTAMP NOT NULL, redeemed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);` : `CREATE TABLE IF NOT EXISTS quote_redemptions (quote_id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, expires_at DATETIME NOT NULL, redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
}

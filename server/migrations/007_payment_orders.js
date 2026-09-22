export const id = '007_payment_orders';
export async function up({ isPostgres, exec }) {
  await exec(isPostgres ? `
    CREATE TABLE IF NOT EXISTS payment_orders (
      order_id VARCHAR(255) PRIMARY KEY, quote_id VARCHAR(255) NOT NULL,
      booking_reference VARCHAR(255) NOT NULL, expected_amount INTEGER NOT NULL,
      payment_type VARCHAR(30) NOT NULL, quote_context TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'created', payment_id VARCHAR(255),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, verified_at TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_payment_id ON payment_orders(payment_id) WHERE payment_id IS NOT NULL;
  ` : `
    CREATE TABLE IF NOT EXISTS payment_orders (
      order_id TEXT PRIMARY KEY, quote_id TEXT NOT NULL,
      booking_reference TEXT NOT NULL, expected_amount INTEGER NOT NULL,
      payment_type TEXT NOT NULL, quote_context TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created', payment_id TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, verified_at DATETIME
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_payment_id ON payment_orders(payment_id) WHERE payment_id IS NOT NULL;
  `);
}

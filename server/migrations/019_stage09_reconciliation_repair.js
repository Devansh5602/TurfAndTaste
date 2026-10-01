/**
 * Stage 0.9: Timestamp Reconciliation & Operational Quarantine Repair Migration
 *
 * Additive repair migration for environments where migration 018 has already executed:
 * 1. Ensures quarantine columns and audit tables exist.
 * 2. Re-runs deterministic timestamp reconciliation using the transaction-scoped database adapter.
 * 3. Preserves explicit UTC / offset instants, converts unannotated legacy strings once, and quarantines ambiguous rows.
 */

import { reconcileAllTimestamps } from '../domain/time/timestampAudit.js';

export const id = '019_stage09_reconciliation_repair';

export async function up({ isPostgres, exec, db }) {
  if (isPostgres) {
    await exec(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_quarantined BOOLEAN DEFAULT FALSE;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(50) DEFAULT 'CANONICAL';

      CREATE TABLE IF NOT EXISTS timestamp_classification_audit (
        id VARCHAR(255) PRIMARY KEY,
        source_table VARCHAR(100) NOT NULL,
        source_row_id VARCHAR(100) NOT NULL,
        source_column VARCHAR(100) NOT NULL,
        raw_source TEXT,
        canonical_current_value TEXT,
        expected_interpretation TEXT,
        classification VARCHAR(50) NOT NULL,
        conversion_occurred BOOLEAN DEFAULT FALSE,
        correction_required BOOLEAN DEFAULT FALSE,
        proposed_utc_instant TEXT,
        confidence VARCHAR(20),
        reason TEXT,
        reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    const tryExec = async (sql) => { try { await exec(sql); } catch (_e) {} };
    await tryExec(`ALTER TABLE bookings ADD COLUMN is_quarantined INTEGER DEFAULT 0;`);
    await tryExec(`ALTER TABLE bookings ADD COLUMN reconciliation_status TEXT DEFAULT 'CANONICAL';`);

    await exec(`
      CREATE TABLE IF NOT EXISTS timestamp_classification_audit (
        id TEXT PRIMARY KEY,
        source_table TEXT NOT NULL,
        source_row_id TEXT NOT NULL,
        source_column TEXT NOT NULL,
        raw_source TEXT,
        canonical_current_value TEXT,
        expected_interpretation TEXT,
        classification TEXT NOT NULL,
        conversion_occurred INTEGER DEFAULT 0,
        correction_required INTEGER DEFAULT 0,
        proposed_utc_instant TEXT,
        confidence TEXT,
        reason TEXT,
        reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  if (db) {
    await reconcileAllTimestamps(db);
  }
}

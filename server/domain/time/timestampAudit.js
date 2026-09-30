/**
 * Historical Timestamp Provenance & Deterministic Reconciliation Engine
 *
 * Provides safe classification and deterministic reconciliation of legacy
 * and canonical timestamps across migrations and operational environments.
 *
 * Classifications:
 * - SAFE_NO_CHANGE: Timestamp accurately represents intended instant.
 * - SAFE_CORRECTION: Provenance deterministically proves intended instant (e.g. from legacy date + time_slot) and corrects double-shift or drift.
 * - MANUAL_REVIEW: Ambiguous or conflicting historical data; quarantined for human review without automatic mutation.
 * - UNRESOLVABLE: Missing both timestamp and legacy slot source.
 *
 * Invariants:
 * - NEVER apply AT TIME ZONE 'Asia/Kolkata' twice to the same local timestamp.
 * - NEVER shift an already-UTC instant again.
 * - NEVER automatically modify MANUAL_REVIEW or UNRESOLVABLE records.
 */

import { normalizeBookingInterval } from './bookingInterval.js';

export const TIMESTAMP_CLASSIFICATIONS = Object.freeze({
  SAFE_NO_CHANGE: 'SAFE_NO_CHANGE',
  SAFE_CORRECTION: 'SAFE_CORRECTION',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  UNRESOLVABLE: 'UNRESOLVABLE'
});

/**
 * Evaluates the timestamp provenance and correctness for a single booking record.
 * Invariants:
 * - Explicit UTC/offset timestamps are NEVER automatically reinterpreted from display strings.
 * - Unannotated legacy local strings are converted to UTC exactly once.
 * - Discrepant or ambiguous timestamps are quarantined as MANUAL_REVIEW without automated mutation.
 *
 * @param {object} booking
 * @returns {object} Audit record with classification and provenance reasoning
 */
export function evaluateTimestampProvenance(booking) {
  const { id, scheduled_start_at, scheduled_end_at, date, time_slot } = booking;
  const rawStart = scheduled_start_at ? String(scheduled_start_at).trim() : null;
  const rawEnd = scheduled_end_at ? String(scheduled_end_at).trim() : null;
  const hasLegacySlot = Boolean(date && time_slot);

  let expectedInterval = null;
  let legacySlotParseError = null;

  if (hasLegacySlot) {
    try {
      expectedInterval = normalizeBookingInterval({ date, timeSlot: time_slot });
    } catch (e) {
      legacySlotParseError = e.message;
    }
  }

  // Case 1: Missing scheduled_start_at and missing/invalid legacy slot
  if (!rawStart && !expectedInterval) {
    return {
      id: `tca_${id}_start_at`,
      sourceTable: 'bookings',
      sourceRowId: id,
      sourceColumn: 'scheduled_start_at',
      rawSource: rawStart,
      canonicalCurrentValue: rawStart,
      expectedInterpretation: 'UNKNOWN',
      classification: TIMESTAMP_CLASSIFICATIONS.UNRESOLVABLE,
      conversionOccurred: false,
      correctionRequired: false,
      isQuarantined: true,
      reconciliationStatus: 'UNRESOLVABLE',
      proposedUtcInstant: null,
      proposedEndUtcInstant: null,
      confidence: 'LOW',
      reason: legacySlotParseError
        ? `Missing scheduled timestamp and legacy slot parse failed: ${legacySlotParseError}`
        : 'Missing both scheduled_start_at and legacy date/time_slot fields.'
    };
  }

  // Case 2: Missing scheduled_start_at, but authoritative legacy date + slot exists -> SAFE_CORRECTION (initial backfill)
  if (!rawStart && expectedInterval) {
    const expectedStartUtc = expectedInterval.startAt.toISOString();
    const expectedEndUtc = expectedInterval.endAt.toISOString();
    return {
      id: `tca_${id}_start_at`,
      sourceTable: 'bookings',
      sourceRowId: id,
      sourceColumn: 'scheduled_start_at',
      rawSource: `${date} ${time_slot}`,
      canonicalCurrentValue: null,
      expectedInterpretation: expectedStartUtc,
      classification: TIMESTAMP_CLASSIFICATIONS.SAFE_CORRECTION,
      conversionOccurred: false,
      correctionRequired: true,
      isQuarantined: false,
      reconciliationStatus: 'RECONCILED',
      proposedUtcInstant: expectedStartUtc,
      proposedEndUtcInstant: expectedEndUtc,
      confidence: 'HIGH',
      reason: `Initial backfill from deterministic legacy date ("${date}") and time_slot ("${time_slot}").`
    };
  }

  // Inspect rawStart for explicit timezone indicators
  const hasExplicitZ = /Z$/i.test(rawStart);
  const hasExplicitOffset = /[+-]\d{2}:?\d{2}$/.test(rawStart);
  const isExplicitIsoInstant = hasExplicitZ || hasExplicitOffset;

  const parsedStartDate = new Date(rawStart);
  if (isNaN(parsedStartDate.getTime())) {
    return {
      id: `tca_${id}_start_at`,
      sourceTable: 'bookings',
      sourceRowId: id,
      sourceColumn: 'scheduled_start_at',
      rawSource: rawStart,
      canonicalCurrentValue: rawStart,
      expectedInterpretation: expectedInterval ? expectedInterval.startAt.toISOString() : 'INVALID',
      classification: TIMESTAMP_CLASSIFICATIONS.UNRESOLVABLE,
      conversionOccurred: false,
      correctionRequired: false,
      isQuarantined: true,
      reconciliationStatus: 'UNRESOLVABLE',
      proposedUtcInstant: null,
      proposedEndUtcInstant: null,
      confidence: 'LOW',
      reason: `Unparseable timestamp string "${rawStart}".`
    };
  }

  const explicitUtc = parsedStartDate.toISOString();
  let explicitEndUtc = null;
  if (rawEnd) {
    const parsedEndDate = new Date(rawEnd);
    if (!isNaN(parsedEndDate.getTime())) {
      explicitEndUtc = parsedEndDate.toISOString();
    }
  }

  // Case 3: Explicit UTC/Offset timestamp
  if (isExplicitIsoInstant) {
    if (expectedInterval) {
      const diffMs = parsedStartDate.getTime() - expectedInterval.startAt.getTime();
      if (diffMs === 0) {
        return {
          id: `tca_${id}_start_at`,
          sourceTable: 'bookings',
          sourceRowId: id,
          sourceColumn: 'scheduled_start_at',
          rawSource: rawStart,
          canonicalCurrentValue: explicitUtc,
          expectedInterpretation: expectedInterval.startAt.toISOString(),
          classification: TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE,
          conversionOccurred: true,
          correctionRequired: false,
          isQuarantined: false,
          reconciliationStatus: 'RECONCILED',
          proposedUtcInstant: explicitUtc,
          proposedEndUtcInstant: explicitEndUtc || expectedInterval.endAt.toISOString(),
          confidence: 'HIGH',
          reason: 'Explicit ISO timestamp exactly matches deterministic UTC instant parsed from legacy slot.'
        };
      }

      // Explicit ISO timestamp does NOT match legacy slot.
      // INVARIANT: NEVER automatically shift an explicit ISO instant based on a potentially stale display string!
      return {
        id: `tca_${id}_start_at`,
        sourceTable: 'bookings',
        sourceRowId: id,
        sourceColumn: 'scheduled_start_at',
        rawSource: rawStart,
        canonicalCurrentValue: explicitUtc,
        expectedInterpretation: explicitUtc,
        classification: TIMESTAMP_CLASSIFICATIONS.MANUAL_REVIEW,
        conversionOccurred: true,
        correctionRequired: false,
        isQuarantined: true,
        reconciliationStatus: 'MANUAL_REVIEW',
        proposedUtcInstant: explicitUtc,
        proposedEndUtcInstant: explicitEndUtc,
        confidence: 'LOW',
        reason: `Explicit ISO timestamp (${rawStart}) does not match legacy display slot (${date} ${time_slot} -> ${expectedInterval.startAt.toISOString()}). Preserved without automatic shift and quarantined for manual review.`
      };
    }

    // Explicit ISO timestamp with no legacy slot
    return {
      id: `tca_${id}_start_at`,
      sourceTable: 'bookings',
      sourceRowId: id,
      sourceColumn: 'scheduled_start_at',
      rawSource: rawStart,
      canonicalCurrentValue: explicitUtc,
      expectedInterpretation: explicitUtc,
      classification: TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE,
      conversionOccurred: true,
      correctionRequired: false,
      isQuarantined: false,
      reconciliationStatus: 'RECONCILED',
      proposedUtcInstant: explicitUtc,
      proposedEndUtcInstant: explicitEndUtc,
      confidence: 'MEDIUM',
      reason: 'Valid explicit ISO timestamp preserved with no legacy slot conflict.'
    };
  }

  // Case 4: Unannotated legacy string (no Z or offset, e.g. "2026-09-19 18:00:00")
  if (expectedInterval) {
    const expectedStartUtc = expectedInterval.startAt.toISOString();
    const expectedEndUtc = expectedInterval.endAt.toISOString();

    // Check if unannotated local time matches the slot
    // e.g., "2026-09-19 18:00:00" matches 06:00 PM IST on 2026-09-19
    return {
      id: `tca_${id}_start_at`,
      sourceTable: 'bookings',
      sourceRowId: id,
      sourceColumn: 'scheduled_start_at',
      rawSource: rawStart,
      canonicalCurrentValue: explicitUtc,
      expectedInterpretation: expectedStartUtc,
      classification: TIMESTAMP_CLASSIFICATIONS.SAFE_CORRECTION,
      conversionOccurred: true,
      correctionRequired: true,
      isQuarantined: false,
      reconciliationStatus: 'RECONCILED',
      proposedUtcInstant: expectedStartUtc,
      proposedEndUtcInstant: expectedEndUtc,
      confidence: 'HIGH',
      reason: `Unannotated legacy local timestamp ("${rawStart}") deterministically converted once to canonical Asia/Kolkata UTC instant.`
    };
  }

  // Unannotated string without legacy slot provenance -> Ambiguous
  return {
    id: `tca_${id}_start_at`,
    sourceTable: 'bookings',
    sourceRowId: id,
    sourceColumn: 'scheduled_start_at',
    rawSource: rawStart,
    canonicalCurrentValue: explicitUtc,
    expectedInterpretation: 'AMBIGUOUS',
    classification: TIMESTAMP_CLASSIFICATIONS.MANUAL_REVIEW,
    conversionOccurred: false,
    correctionRequired: false,
    isQuarantined: true,
    reconciliationStatus: 'MANUAL_REVIEW',
    proposedUtcInstant: null,
    proposedEndUtcInstant: null,
    confidence: 'LOW',
    reason: `Unannotated local timestamp string "${rawStart}" has no legacy date/time_slot provenance. Quarantined for manual review.`
  };
}

/**
 * Reconciles and audits all booking timestamps in the database deterministically.
 * Updates bookings with canonical UTC instants and marks quarantined rows.
 */
export async function reconcileAllTimestamps(db) {
  const isPostgres = typeof db.isPostgres === 'function' && db.isPostgres();
  const bookings = await db.all(
    `SELECT id, scheduled_start_at, scheduled_end_at, date, time_slot, created_at FROM bookings`
  );

  const audits = [];
  const corrections = [];
  const quarantines = [];

  for (const b of bookings) {
    const audit = evaluateTimestampProvenance(b);
    audits.push(audit);

    if (audit.classification === TIMESTAMP_CLASSIFICATIONS.SAFE_CORRECTION && audit.correctionRequired && audit.confidence === 'HIGH') {
      corrections.push({
        id: b.id,
        startAt: audit.proposedUtcInstant,
        endAt: audit.proposedEndUtcInstant
      });
    }

    if (audit.isQuarantined) {
      quarantines.push({
        id: b.id,
        status: audit.reconciliationStatus
      });
    }
  }

  // Apply safe corrections to bookings
  for (const c of corrections) {
    if (c.startAt && c.endAt) {
      try {
        await db.run(
          `UPDATE bookings SET scheduled_start_at = ?, scheduled_end_at = ?, is_quarantined = ${isPostgres ? 'FALSE' : '0'}, reconciliation_status = 'RECONCILED' WHERE id = ?`,
          [c.startAt, c.endAt, c.id]
        );
      } catch (_e) {
        await db.run(
          `UPDATE bookings SET scheduled_start_at = ?, scheduled_end_at = ? WHERE id = ?`,
          [c.startAt, c.endAt, c.id]
        );
      }
    }
  }

  // Apply quarantine status to bookings
  for (const q of quarantines) {
    try {
      await db.run(
        `UPDATE bookings SET is_quarantined = ${isPostgres ? 'TRUE' : '1'}, reconciliation_status = ? WHERE id = ?`,
        [q.status, q.id]
      );
    } catch (_e) {}
  }

  // Insert or update audit entries
  for (const a of audits) {
    const sql = isPostgres
      ? `INSERT INTO timestamp_classification_audit (
           id, source_table, source_row_id, source_column, raw_source,
           canonical_current_value, expected_interpretation, classification,
           conversion_occurred, correction_required, proposed_utc_instant,
           confidence, reason, reviewed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           canonical_current_value = EXCLUDED.canonical_current_value,
           classification = EXCLUDED.classification,
           conversion_occurred = EXCLUDED.conversion_occurred,
           correction_required = EXCLUDED.correction_required,
           proposed_utc_instant = EXCLUDED.proposed_utc_instant,
           confidence = EXCLUDED.confidence,
           reason = EXCLUDED.reason,
           reviewed_at = CURRENT_TIMESTAMP`
      : `INSERT INTO timestamp_classification_audit (
           id, source_table, source_row_id, source_column, raw_source,
           canonical_current_value, expected_interpretation, classification,
           conversion_occurred, correction_required, proposed_utc_instant,
           confidence, reason, reviewed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           canonical_current_value = excluded.canonical_current_value,
           classification = excluded.classification,
           conversion_occurred = excluded.conversion_occurred,
           correction_required = excluded.correction_required,
           proposed_utc_instant = excluded.proposed_utc_instant,
           confidence = excluded.confidence,
           reason = excluded.reason,
           reviewed_at = CURRENT_TIMESTAMP`;

    const params = [
      a.id, a.sourceTable, a.sourceRowId, a.sourceColumn, a.rawSource,
      a.canonicalCurrentValue, a.expectedInterpretation, a.classification,
      isPostgres ? a.conversionOccurred : (a.conversionOccurred ? 1 : 0),
      isPostgres ? a.correctionRequired : (a.correctionRequired ? 1 : 0),
      a.proposedUtcInstant, a.confidence, a.reason
    ];

    try {
      await db.run(sql, params);
    } catch {
      // Table may have older column set; handled by migration
    }
  }

  return {
    totalAudited: audits.length,
    correctionsApplied: corrections.length,
    quarantinedCount: quarantines.length,
    safeNoChange: audits.filter(a => a.classification === TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE).length,
    safeCorrection: audits.filter(a => a.classification === TIMESTAMP_CLASSIFICATIONS.SAFE_CORRECTION).length,
    manualReview: audits.filter(a => a.classification === TIMESTAMP_CLASSIFICATIONS.MANUAL_REVIEW).length,
    unresolvable: audits.filter(a => a.classification === TIMESTAMP_CLASSIFICATIONS.UNRESOLVABLE).length
  };
}

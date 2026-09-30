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
 * @param {object} booking
 * @returns {object} Audit record with classification and provenance reasoning
 */
export function evaluateTimestampProvenance(booking) {
  const { id, scheduled_start_at, scheduled_end_at, date, time_slot } = booking;
  const rawStart = scheduled_start_at ? String(scheduled_start_at) : null;
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

  // Case 1: Completely missing start timestamp AND missing/unparseable legacy slot
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
      proposedUtcInstant: null,
      confidence: 'LOW',
      reason: legacySlotParseError
        ? `Missing scheduled timestamp and legacy slot parse failed: ${legacySlotParseError}`
        : 'Missing both scheduled_start_at and legacy date/time_slot fields.'
    };
  }

  // Case 2: We have an authoritative legacy date + time_slot
  if (expectedInterval) {
    const expectedStartUtc = expectedInterval.startAt.toISOString();
    const expectedEndUtc = expectedInterval.endAt.toISOString();

    if (!rawStart) {
      // Legacy date/slot exists, but scheduled_start_at was never backfilled
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
        proposedUtcInstant: expectedStartUtc,
        proposedEndUtcInstant: expectedEndUtc,
        confidence: 'HIGH',
        reason: `Deterministic provenance from legacy date ("${date}") and time_slot ("${time_slot}"). Initial backfill to UTC instant.`
      };
    }

    const currentStartDate = new Date(rawStart);
    if (isNaN(currentStartDate.getTime())) {
      return {
        id: `tca_${id}_start_at`,
        sourceTable: 'bookings',
        sourceRowId: id,
        sourceColumn: 'scheduled_start_at',
        rawSource: rawStart,
        canonicalCurrentValue: rawStart,
        expectedInterpretation: expectedStartUtc,
        classification: TIMESTAMP_CLASSIFICATIONS.SAFE_CORRECTION,
        conversionOccurred: true,
        correctionRequired: true,
        proposedUtcInstant: expectedStartUtc,
        proposedEndUtcInstant: expectedEndUtc,
        confidence: 'HIGH',
        reason: `Invalid/corrupt timestamp string "${rawStart}". Corrected to deterministic legacy slot instant ${expectedStartUtc}.`
      };
    }

    const currentStartUtc = currentStartDate.toISOString();
    const diffMs = currentStartDate.getTime() - expectedInterval.startAt.getTime();

    // Exactly matching UTC instant
    if (diffMs === 0) {
      return {
        id: `tca_${id}_start_at`,
        sourceTable: 'bookings',
        sourceRowId: id,
        sourceColumn: 'scheduled_start_at',
        rawSource: rawStart,
        canonicalCurrentValue: currentStartUtc,
        expectedInterpretation: expectedStartUtc,
        classification: TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE,
        conversionOccurred: true,
        correctionRequired: false,
        proposedUtcInstant: currentStartUtc,
        confidence: 'HIGH',
        reason: 'Canonical timestamp exactly matches deterministic UTC instant parsed from legacy date and time_slot.'
      };
    }

    // Shifted by +5:30 (19800000 ms) or -5:30 due to timezone conversion
    const isShifted5h30 = Math.abs(diffMs) === 19800000;
    if (isShifted5h30) {
      return {
        id: `tca_${id}_start_at`,
        sourceTable: 'bookings',
        sourceRowId: id,
        sourceColumn: 'scheduled_start_at',
        rawSource: rawStart,
        canonicalCurrentValue: currentStartUtc,
        expectedInterpretation: expectedStartUtc,
        classification: TIMESTAMP_CLASSIFICATIONS.SAFE_CORRECTION,
        conversionOccurred: true,
        correctionRequired: true,
        proposedUtcInstant: expectedStartUtc,
        proposedEndUtcInstant: expectedEndUtc,
        confidence: 'HIGH',
        reason: `Double-shift or offset drift detected (diff: ${diffMs / 3600000}h). Corrected to match authoritative IST slot ${date} ${time_slot}.`
      };
    }

    // Discrepancy that is not an exact 5h30m shift
    return {
      id: `tca_${id}_start_at`,
      sourceTable: 'bookings',
      sourceRowId: id,
      sourceColumn: 'scheduled_start_at',
      rawSource: rawStart,
      canonicalCurrentValue: currentStartUtc,
      expectedInterpretation: expectedStartUtc,
      classification: TIMESTAMP_CLASSIFICATIONS.MANUAL_REVIEW,
      conversionOccurred: true,
      correctionRequired: false,
      proposedUtcInstant: expectedStartUtc,
      proposedEndUtcInstant: expectedEndUtc,
      confidence: 'LOW',
      reason: `Discrepancy between scheduled_start_at (${currentStartUtc}) and legacy slot (${date} ${time_slot} -> ${expectedStartUtc}). Quarantined for manual review.`
    };
  }

  // Case 3: No legacy date/slot, only scheduled_start_at
  const currentStartDate = new Date(rawStart);
  if (isNaN(currentStartDate.getTime())) {
    return {
      id: `tca_${id}_start_at`,
      sourceTable: 'bookings',
      sourceRowId: id,
      sourceColumn: 'scheduled_start_at',
      rawSource: rawStart,
      canonicalCurrentValue: rawStart,
      expectedInterpretation: 'INVALID',
      classification: TIMESTAMP_CLASSIFICATIONS.UNRESOLVABLE,
      conversionOccurred: false,
      correctionRequired: false,
      proposedUtcInstant: null,
      confidence: 'LOW',
      reason: `Unparseable timestamp "${rawStart}" with no legacy date/time_slot fallback.`
    };
  }

  return {
    id: `tca_${id}_start_at`,
    sourceTable: 'bookings',
    sourceRowId: id,
    sourceColumn: 'scheduled_start_at',
    rawSource: rawStart,
    canonicalCurrentValue: currentStartDate.toISOString(),
    expectedInterpretation: currentStartDate.toISOString(),
    classification: TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE,
    conversionOccurred: true,
    correctionRequired: false,
    proposedUtcInstant: currentStartDate.toISOString(),
    confidence: 'MEDIUM',
    reason: 'Valid ISO timestamp preserved with no conflicting legacy slot.'
  };
}

/**
 * Reconciles and audits all booking timestamps in the database deterministically.
 */
export async function reconcileAllTimestamps(db) {
  const isPostgres = typeof db.isPostgres === 'function' && db.isPostgres();
  const bookings = await db.all(
    `SELECT id, scheduled_start_at, scheduled_end_at, date, time_slot, created_at FROM bookings`
  );

  const audits = [];
  const corrections = [];

  for (const b of bookings) {
    const audit = evaluateTimestampProvenance(b);
    audits.push(audit);

    // Only apply corrections for SAFE_CORRECTION with HIGH confidence
    if (audit.classification === TIMESTAMP_CLASSIFICATIONS.SAFE_CORRECTION && audit.correctionRequired && audit.confidence === 'HIGH') {
      corrections.push({
        id: b.id,
        startAt: audit.proposedUtcInstant,
        endAt: audit.proposedEndUtcInstant
      });
    }
  }

  // Apply safe corrections
  for (const c of corrections) {
    if (c.startAt && c.endAt) {
      await db.run(
        `UPDATE bookings SET scheduled_start_at = ?, scheduled_end_at = ? WHERE id = ?`,
        [c.startAt, c.endAt, c.id]
      );
    }
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
    safeNoChange: audits.filter(a => a.classification === TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE).length,
    safeCorrection: audits.filter(a => a.classification === TIMESTAMP_CLASSIFICATIONS.SAFE_CORRECTION).length,
    manualReview: audits.filter(a => a.classification === TIMESTAMP_CLASSIFICATIONS.MANUAL_REVIEW).length,
    unresolvable: audits.filter(a => a.classification === TIMESTAMP_CLASSIFICATIONS.UNRESOLVABLE).length
  };
}

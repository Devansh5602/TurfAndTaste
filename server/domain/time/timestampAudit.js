/**
 * Historical Timestamp Provenance & Deterministic Reconciliation Engine
 *
 * Provides safe classification and deterministic reconciliation of legacy
 * and canonical timestamps across migrations and operational environments.
 *
 * Invariants:
 * - PostgreSQL TIMESTAMPTZ values (returned as JS Date objects) represent exact UTC instants.
 * - An already stored instant is NEVER reclassified as an unannotated local string or altered based on display text.
 * - Unannotated legacy local strings (e.g. YYYY-MM-DD HH:MM:SS) are converted to canonical UTC exactly once.
 * - Discrepant, conflicting, or ambiguous timestamps are quarantined as MANUAL_REVIEW without automated shift.
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
 *
 * @param {object} booking
 * @returns {object} Audit record with classification and provenance reasoning
 */
export function evaluateTimestampProvenance(booking) {
  const { id, scheduled_start_at, scheduled_end_at, date, time_slot } = booking;
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

  // Case 1: Missing timestamp and missing/unparseable legacy slot
  if (scheduled_start_at == null && !expectedInterval) {
    return {
      id: `tca_${id}_start_at`,
      sourceTable: 'bookings',
      sourceRowId: id,
      sourceColumn: 'scheduled_start_at',
      rawSource: null,
      canonicalCurrentValue: null,
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

  // Case 2: Missing timestamp, but valid legacy date + slot exists -> initial backfill
  if (scheduled_start_at == null && expectedInterval) {
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

  // Determine if input is a JS Date object (e.g. from PostgreSQL TIMESTAMPTZ driver)
  if (scheduled_start_at instanceof Date) {
    if (isNaN(scheduled_start_at.getTime())) {
      return {
        id: `tca_${id}_start_at`,
        sourceTable: 'bookings',
        sourceRowId: id,
        sourceColumn: 'scheduled_start_at',
        rawSource: 'Invalid Date',
        canonicalCurrentValue: null,
        expectedInterpretation: 'INVALID',
        classification: TIMESTAMP_CLASSIFICATIONS.UNRESOLVABLE,
        conversionOccurred: false,
        correctionRequired: false,
        isQuarantined: true,
        reconciliationStatus: 'UNRESOLVABLE',
        proposedUtcInstant: null,
        proposedEndUtcInstant: null,
        confidence: 'LOW',
        reason: 'JavaScript Date object is invalid (NaN timestamp).'
      };
    }

    const currentUtcInstant = scheduled_start_at.toISOString();
    let currentEndUtcInstant = null;
    if (scheduled_end_at instanceof Date && !isNaN(scheduled_end_at.getTime())) {
      currentEndUtcInstant = scheduled_end_at.toISOString();
    }

    if (expectedInterval) {
      if (scheduled_start_at.getTime() === expectedInterval.startAt.getTime()) {
        return {
          id: `tca_${id}_start_at`,
          sourceTable: 'bookings',
          sourceRowId: id,
          sourceColumn: 'scheduled_start_at',
          rawSource: currentUtcInstant,
          canonicalCurrentValue: currentUtcInstant,
          expectedInterpretation: expectedInterval.startAt.toISOString(),
          classification: TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE,
          conversionOccurred: true,
          correctionRequired: false,
          isQuarantined: false,
          reconciliationStatus: 'RECONCILED',
          proposedUtcInstant: currentUtcInstant,
          proposedEndUtcInstant: currentEndUtcInstant || expectedInterval.endAt.toISOString(),
          confidence: 'HIGH',
          reason: 'PostgreSQL TIMESTAMPTZ instant exactly matches expected UTC instant from legacy slot.'
        };
      }

      // Stored instant does not match the legacy slot.
      // INVARIANT: An existing PostgreSQL TIMESTAMPTZ instant must NEVER be overwritten with a shifted local time!
      return {
        id: `tca_${id}_start_at`,
        sourceTable: 'bookings',
        sourceRowId: id,
        sourceColumn: 'scheduled_start_at',
        rawSource: currentUtcInstant,
        canonicalCurrentValue: currentUtcInstant,
        expectedInterpretation: currentUtcInstant,
        classification: TIMESTAMP_CLASSIFICATIONS.MANUAL_REVIEW,
        conversionOccurred: true,
        correctionRequired: false,
        isQuarantined: true,
        reconciliationStatus: 'MANUAL_REVIEW',
        proposedUtcInstant: currentUtcInstant,
        proposedEndUtcInstant: currentEndUtcInstant,
        confidence: 'LOW',
        reason: `PostgreSQL TIMESTAMPTZ instant (${currentUtcInstant}) does not match legacy display slot (${date} ${time_slot} -> ${expectedInterval.startAt.toISOString()}). Preserved without automatic shift and quarantined for manual review.`
      };
    }

    return {
      id: `tca_${id}_start_at`,
      sourceTable: 'bookings',
      sourceRowId: id,
      sourceColumn: 'scheduled_start_at',
      rawSource: currentUtcInstant,
      canonicalCurrentValue: currentUtcInstant,
      expectedInterpretation: currentUtcInstant,
      classification: TIMESTAMP_CLASSIFICATIONS.SAFE_NO_CHANGE,
      conversionOccurred: true,
      correctionRequired: false,
      isQuarantined: false,
      reconciliationStatus: 'RECONCILED',
      proposedUtcInstant: currentUtcInstant,
      proposedEndUtcInstant: currentEndUtcInstant,
      confidence: 'MEDIUM',
      reason: 'Valid PostgreSQL TIMESTAMPTZ instant preserved with no legacy slot conflict.'
    };
  }

  // String handling
  const rawStart = String(scheduled_start_at).trim();
  const rawEnd = scheduled_end_at ? String(scheduled_end_at).trim() : null;

  // Check for explicit ISO 8601 UTC ('Z') or offset ('+05:30', '-04:00', '+0530')
  const hasExplicitZ = /Z$/i.test(rawStart);
  const hasExplicitOffset = /[+-]\d{2}(?::?\d{2})?$/.test(rawStart);
  const hasGmtOffset = /\bGMT[+-]\d{4}\b/i.test(rawStart);
  const isExplicitInstant = hasExplicitZ || hasExplicitOffset || hasGmtOffset;

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

  if (isExplicitInstant) {
    if (expectedInterval) {
      if (parsedStartDate.getTime() === expectedInterval.startAt.getTime()) {
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
      // INVARIANT: NEVER automatically shift an explicit ISO instant based on display slot!
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

  // Already reconciled marker
  if (booking.reconciliation_status === 'RECONCILED') {
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
      confidence: 'HIGH',
      reason: 'Record was already reconciled in a previous migration run.'
    };
  }

  // Unannotated legacy local string (e.g. "2026-09-19 18:00:00")
  const isUnannotatedLocalPattern = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(rawStart);

  if (isUnannotatedLocalPattern && expectedInterval) {
    const expectedStartUtc = expectedInterval.startAt.toISOString();
    const expectedEndUtc = expectedInterval.endAt.toISOString();
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

  // Unannotated string without legacy slot or with unproven format -> Ambiguous
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
    reason: `Unannotated local timestamp string "${rawStart}" has ambiguous provenance. Quarantined for manual review.`
  };
}

/**
 * Reconciles and audits all booking timestamps in the database deterministically.
 * Updates bookings with canonical UTC instants and marks quarantined rows.
 *
 * @param {object} db Active database transaction or connection adapter
 */
export async function reconcileAllTimestamps(db) {
  const isPostgres = typeof db.isPostgres === 'function' ? db.isPostgres() : Boolean(db.isPostgres);
  const bookings = await db.all(
    `SELECT id, scheduled_start_at, scheduled_end_at, date, time_slot, reconciliation_status, is_quarantined FROM bookings`
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
      await db.run(
        `UPDATE bookings SET scheduled_start_at = ?, scheduled_end_at = ?, is_quarantined = ${isPostgres ? 'FALSE' : '0'}, reconciliation_status = 'RECONCILED' WHERE id = ?`,
        [c.startAt, c.endAt, c.id]
      );
    }
  }

  // Apply quarantine status to bookings
  for (const q of quarantines) {
    await db.run(
      `UPDATE bookings SET is_quarantined = ${isPostgres ? 'TRUE' : '1'}, reconciliation_status = ? WHERE id = ?`,
      [q.status, q.id]
    );
  }

  // Insert or update audit entries
  for (const a of audits) {
    const action = a.correctionRequired ? 'CORRECTION_APPLIED' : (a.isQuarantined ? 'QUARANTINED' : 'NO_CHANGE');
    const sql = isPostgres
      ? `INSERT INTO timestamp_classification_audit (
           id, source_table, source_row_id, source_column, raw_source, raw_value,
           canonical_current_value, expected_interpretation, classification,
           conversion_occurred, correction_required, proposed_utc_instant,
           confidence, action, notes, reason, reviewed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           canonical_current_value = EXCLUDED.canonical_current_value,
           classification = EXCLUDED.classification,
           conversion_occurred = EXCLUDED.conversion_occurred,
           correction_required = EXCLUDED.correction_required,
           proposed_utc_instant = EXCLUDED.proposed_utc_instant,
           confidence = EXCLUDED.confidence,
           action = EXCLUDED.action,
           reason = EXCLUDED.reason,
           reviewed_at = CURRENT_TIMESTAMP`
      : `INSERT INTO timestamp_classification_audit (
           id, source_table, source_row_id, source_column, raw_source, raw_value,
           canonical_current_value, expected_interpretation, classification,
           conversion_occurred, correction_required, proposed_utc_instant,
           confidence, action, notes, reason, reviewed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           canonical_current_value = excluded.canonical_current_value,
           classification = excluded.classification,
           conversion_occurred = excluded.conversion_occurred,
           correction_required = excluded.correction_required,
           proposed_utc_instant = excluded.proposed_utc_instant,
           confidence = excluded.confidence,
           action = excluded.action,
           reason = excluded.reason,
           reviewed_at = CURRENT_TIMESTAMP`;

    const params = [
      a.id, a.sourceTable, a.sourceRowId, a.sourceColumn, a.rawSource, a.rawSource,
      a.canonicalCurrentValue, a.expectedInterpretation, a.classification,
      isPostgres ? a.conversionOccurred : (a.conversionOccurred ? 1 : 0),
      isPostgres ? a.correctionRequired : (a.correctionRequired ? 1 : 0),
      a.proposedUtcInstant, a.confidence, action, a.reason, a.reason
    ];

    await db.run(sql, params);
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

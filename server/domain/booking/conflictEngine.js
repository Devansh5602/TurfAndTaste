/**
 * Physical Resource Conflict & Overlap Engine
 * 
 * Rules:
 * 1. Physical Resource Identity: Conflicts are evaluated strictly per physical facility ID.
 * 2. Interval Semantics: Half-open [start_at, end_at)
 *    - touching boundaries (e.g. 18:00–19:00 and 19:00–20:00) do NOT overlap.
 * 3. Conflict Sources:
 *    - Confirmed / Checked-in / In-progress Bookings
 *    - Active Facility Blocks (maintenance, private blocks, events)
 *    - Active Unexpired Payment Holds
 * 4. Multi-Turf Concurrency:
 *    - Two different physical facilities (e.g. Turf 1 and Turf 2) CAN be booked simultaneously.
 *    - Same physical facility (e.g. Turf 1 and Turf 1) CANNOT overlap.
 *    - Green Net with Shooting Machine conflicts with Green Net practice because both occupy fac_green_net_1.
 */

import { intervalsOverlap, normalizeBookingInterval } from '../time/bookingInterval.js';
import { isOccupyingStatus } from './bookingStateMachine.js';

/**
 * Pure conflict detection function against in-memory occupancies.
 */
export function checkIntervalConflicts(requestedInterval, occupancies = [], options = {}) {
  const { excludeId = null } = options;
  const requested = normalizeBookingInterval(requestedInterval);
  const conflicts = [];

  for (const item of occupancies) {
    if (excludeId && item.id === excludeId) continue;

    // Filter out non-occupying statuses (e.g. cancelled bookings, inactive blocks, expired holds)
    if (item.status && !isOccupyingStatus(item.status) && item.status !== 'ACTIVE') {
      continue;
    }

    if (item.expiresAt && new Date(item.expiresAt).getTime() <= new Date().getTime()) {
      // Expired payment hold
      continue;
    }

    const occupiedInterval = normalizeBookingInterval({
      startAt: item.startAt || item.scheduledStartAt || item.startsAt,
      endAt: item.endAt || item.scheduledEndAt || item.endsAt
    });

    if (intervalsOverlap(requested, occupiedInterval)) {
      conflicts.push({
        conflictType: item.type || 'BOOKING',
        conflictId: item.id,
        occupiedFacilityId: item.facilityId,
        interval: occupiedInterval,
        reason: item.reason || null
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

/**
 * Database-backed resource conflict lookup.
 */
export async function findResourceConflicts(db, options) {
  const {
    facilityId,
    startAt,
    endAt,
    excludeBookingId = null,
    now = new Date()
  } = options;

  const reqInterval = normalizeBookingInterval({ startAt, endAt });
  const startISO = reqInterval.startAt.toISOString();
  const endISO = reqInterval.endAt.toISOString();

  // 1. Check existing confirmed bookings on same physical facility
  // Postgres or SQLite: match physical_facility_id OR legacy facility_id
  const bookingsQuery = `
    SELECT id, facility_id, scheduled_start_at, scheduled_end_at, booking_status, date, time_slot
    FROM bookings
    WHERE (physical_facility_id = ? OR facility_id = ?)
      AND booking_status NOT IN ('Cancelled', 'CANCELLED', 'EXPIRED')
  `;

  const existingBookings = await db.all(bookingsQuery, [facilityId, facilityId]);
  const activeBookings = existingBookings.map(b => {
    let bStart = b.scheduled_start_at;
    let bEnd = b.scheduled_end_at;
    if (!bStart || !bEnd) {
      // Fallback to legacy date + time_slot normalization
      try {
        const norm = normalizeBookingInterval({ date: b.date, timeSlot: b.time_slot });
        bStart = norm.startAt;
        bEnd = norm.endAt;
      } catch (e) {
        return null;
      }
    }
    return {
      id: b.id,
      type: 'BOOKING',
      facilityId: b.facility_id,
      startAt: bStart,
      endAt: bEnd,
      status: b.booking_status
    };
  }).filter(Boolean);

  // 2. Check active facility blocks if table exists
  let activeBlocks = [];
  try {
    const blocks = await db.all(
      `SELECT id, facility_id, start_at, end_at, reason_code, internal_note
       FROM facility_blocks
       WHERE facility_id = ? AND status = 'active'`,
      [facilityId]
    );
    activeBlocks = blocks.map(bl => ({
      id: bl.id,
      type: 'BLOCK',
      facilityId: bl.facility_id,
      startAt: bl.start_at,
      endAt: bl.end_at,
      status: 'ACTIVE',
      reason: bl.internal_note || bl.reason_code
    }));
  } catch (e) {
    // If table not yet created in older schema
  }

  // 3. Check active payment holds if table exists
  let activeHolds = [];
  try {
    const holds = await db.all(
      `SELECT id, facility_id, start_at, end_at, expires_at
       FROM payment_holds
       WHERE facility_id = ? AND status = 'ACTIVE' AND expires_at > ?`,
      [facilityId, now.toISOString()]
    );
    activeHolds = holds.map(h => ({
      id: h.id,
      type: 'PAYMENT_HOLD',
      facilityId: h.facility_id,
      startAt: h.start_at,
      endAt: h.end_at,
      status: 'ACTIVE',
      expiresAt: h.expires_at
    }));
  } catch (e) {
    // Table not yet created
  }

  const allOccupancies = [...activeBookings, ...activeBlocks, ...activeHolds];
  return checkIntervalConflicts(reqInterval, allOccupancies, { excludeId: excludeBookingId });
}

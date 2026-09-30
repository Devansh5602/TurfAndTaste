/**
 * Authoritative Booking Rules Engine
 * 
 * Rules:
 * 1. Quick Booking:
 *    - Start: Whole-hour only (:00)
 *    - Duration: 1 Hour (60m) or 2 Hours (120m)
 *    - 1.5h / 90m is STRICTLY INVALID
 * 2. Custom Booking:
 *    - Start: Quarter-hour boundaries (:00, :15, :30, :45)
 *    - Duration: Whole-hour multiples only (>= 60m, divisible by 60m)
 *    - Fractional durations (e.g. 1.5h, 75m, 90m) are STRICTLY INVALID
 * 3. Lead Time:
 *    - Customer Self-Service: Minimum 60 minutes lead time from current civil time
 *    - Staff/Admin Walk-in: Immediate booking permitted (0 lead time)
 * 4. Next Quick Start Rounding:
 *    - If physical occupancy ends at a partial hour (e.g. 20:30), next quick start rounds up to 21:00
 *    - Custom booking can start at 20:30
 */

import { getISTMinutes, normalizeBookingInterval } from '../time/bookingInterval.js';

export const QUICK_DURATIONS_HOURS = [1, 2];
export const CUSTOM_ALLOWED_MINUTES = [0, 15, 30, 45];
export const CUSTOM_MIN_DURATION_MINUTES = 60;
export const CUSTOMER_MIN_LEAD_TIME_MINUTES = 60;

/**
 * Validates a Standard Quick Booking request.
 */
export function validateQuickBooking(interval) {
  const norm = normalizeBookingInterval(interval);
  const istMins = getISTMinutes(norm.startAt);

  if (istMins !== 0) {
    return {
      valid: false,
      error: `Standard Quick booking must start on a whole hour (:00). Given start time has :${String(istMins).padStart(2, '0')}.`
    };
  }

  if (!QUICK_DURATIONS_HOURS.includes(norm.durationHours)) {
    return {
      valid: false,
      error: `Standard Quick booking duration must be 1 Hour or 2 Hours. Requested duration: ${norm.durationHours} hours.`
    };
  }

  return { valid: true, interval: norm };
}

/**
 * Validates a Custom Booking request.
 */
export function validateCustomBooking(interval) {
  const norm = normalizeBookingInterval(interval);
  const istMins = getISTMinutes(norm.startAt);

  if (!CUSTOM_ALLOWED_MINUTES.includes(istMins)) {
    return {
      valid: false,
      error: `Custom booking start time must align to a quarter-hour boundary (:00, :15, :30, :45). Given: :${String(istMins).padStart(2, '0')}.`
    };
  }

  if (norm.durationMinutes < CUSTOM_MIN_DURATION_MINUTES) {
    return {
      valid: false,
      error: `Custom booking duration must be at least ${CUSTOM_MIN_DURATION_MINUTES} minutes (1 hour). Given: ${norm.durationMinutes} minutes.`
    };
  }

  if (norm.durationMinutes % 60 !== 0) {
    return {
      valid: false,
      error: `Custom booking duration must be an exact whole-hour multiple (e.g. 1h, 2h, 3h). Fractional durations like ${norm.durationMinutes} minutes are not permitted.`
    };
  }

  return { valid: true, interval: norm };
}

/**
 * Validates customer lead-time requirements.
 */
export function validateLeadTime(startAt, options = {}) {
  const { isStaffWalkIn = false, now = new Date() } = options;
  const targetStart = new Date(startAt).getTime();
  const currentNow = new Date(now).getTime();

  if (isStaffWalkIn) {
    // Admin/Staff walk-in may create immediate bookings as long as start is not in the distant past
    if (targetStart < currentNow - 5 * 60000) { // allow 5m clock-skew tolerance
      return {
        valid: false,
        error: 'Immediate walk-in booking cannot be created for past times.'
      };
    }
    return { valid: true, isImmediate: true };
  }

  // Customer self-service requires minimum 60 minutes
  const diffMinutes = Math.floor((targetStart - currentNow) / 60000);
  if (diffMinutes < CUSTOMER_MIN_LEAD_TIME_MINUTES) {
    return {
      valid: false,
      error: `Customer booking requires a minimum of ${CUSTOMER_MIN_LEAD_TIME_MINUTES} minutes lead time. Slot starts in ${diffMinutes} minutes.`
    };
  }

  return { valid: true, isImmediate: false };
}

/**
 * Calculates the next available standard quick start instant after a given occupancy end time.
 * If occupancy ends on a whole hour (e.g. 20:00), returns that exact instant.
 * If occupancy ends on a partial hour (e.g. 20:15, 20:30, 20:45), rounds up to the next whole hour (e.g. 21:00).
 */
export function nextQuickStartAfter(occupiedEndAt) {
  const endDate = new Date(occupiedEndAt);
  const istMins = getISTMinutes(endDate);

  if (istMins === 0) {
    return new Date(endDate.getTime());
  }

  // Round up to next whole hour
  const minutesToAdd = 60 - istMins;
  return new Date(endDate.getTime() + minutesToAdd * 60000);
}

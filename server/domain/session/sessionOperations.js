/**
 * Ground Session Operations & Extension Engine
 * 
 * Rules:
 * 1. Distinction: scheduled_start_at / scheduled_end_at vs actual_start_at / actual_end_at
 * 2. Delay adjustments: Handover delay or late customer arrival are logged explicitly.
 * 3. Extensions:
 *    - 15-minute increments only (15, 30, 45, 60, etc.)
 *    - Requires Admin/Staff manual approval
 *    - May be free or chargeable
 *    - Cannot overlap a subsequent booking or maintenance block
 * 4. Next Quick Start Rounding:
 *    - If session extension ends at 20:30, next standard quick start is 21:00.
 */

import { nextQuickStartAfter } from '../booking/bookingRules.js';
import { normalizeBookingInterval } from '../time/bookingInterval.js';

export const EXTENSION_INCREMENT_MINUTES = 15;

/**
 * Validates a session extension request.
 */
export function validateSessionExtension(options) {
  const {
    currentScheduledEndAt,
    extensionMinutes,
    nextBookingStartAt = null,
    isApprovedByStaff = false
  } = options;

  if (!isApprovedByStaff) {
    return {
      valid: false,
      error: 'Extensions require explicit Admin or Staff approval.'
    };
  }

  if (typeof extensionMinutes !== 'number' || extensionMinutes <= 0 || extensionMinutes % EXTENSION_INCREMENT_MINUTES !== 0) {
    return {
      valid: false,
      error: `Extensions must be in ${EXTENSION_INCREMENT_MINUTES}-minute increments. Given: ${extensionMinutes} minutes.`
    };
  }

  const currentEnd = new Date(currentScheduledEndAt);
  if (Number.isNaN(currentEnd.getTime())) {
    return { valid: false, error: 'Invalid currentScheduledEndAt provided.' };
  }

  const proposedEnd = new Date(currentEnd.getTime() + extensionMinutes * 60000);

  // Check collision with next scheduled booking
  if (nextBookingStartAt) {
    const nextStart = new Date(nextBookingStartAt);
    if (proposedEnd.getTime() > nextStart.getTime()) {
      const availableMinutes = Math.max(0, Math.floor((nextStart.getTime() - currentEnd.getTime()) / 60000));
      return {
        valid: false,
        error: `Extension of ${extensionMinutes}m conflicts with the next scheduled booking at ${nextStart.toISOString()}. Maximum possible extension is ${availableMinutes}m.`
      };
    }
  }

  const nextQuickStart = nextQuickStartAfter(proposedEnd);

  return {
    valid: true,
    currentEndAt: currentEnd,
    proposedEndAt: proposedEnd,
    extensionMinutes,
    nextStandardQuickStartAt: nextQuickStart
  };
}

/**
 * Computes scheduled vs actual session operational metrics.
 */
export function computeSessionMetrics(scheduledStart, scheduledEnd, actualStart, actualEnd) {
  const schedS = new Date(scheduledStart).getTime();
  const schedE = new Date(scheduledEnd).getTime();
  const actS = actualStart ? new Date(actualStart).getTime() : null;
  const actE = actualEnd ? new Date(actualEnd).getTime() : null;

  let startDelayMinutes = 0;
  if (actS && actS > schedS) {
    startDelayMinutes = Math.round((actS - schedS) / 60000);
  }

  let totalActualMinutes = null;
  if (actS && actE) {
    totalActualMinutes = Math.round((actE - actS) / 60000);
  }

  return {
    scheduledDurationMinutes: Math.round((schedE - schedS) / 60000),
    startDelayMinutes,
    totalActualMinutes,
    isOverdue: !actE && Date.now() > schedE
  };
}

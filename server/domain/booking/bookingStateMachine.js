/**
 * Canonical Booking State Machine
 * 
 * Formal States:
 * - PENDING_PAYMENT
 * - CONFIRMED
 * - CHECKED_IN
 * - IN_PROGRESS
 * - COMPLETED
 * - CANCELLED (TERMINAL)
 * - EXPIRED (TERMINAL)
 * 
 * Invariants:
 * 1. CANCELLED is strictly terminal. Never allow CANCELLED -> CONFIRMED.
 * 2. COMPLETED is terminal.
 * 3. EXPIRED is terminal.
 * 4. Only CONFIRMED, CHECKED_IN, and IN_PROGRESS occupy physical resources.
 */

export const BOOKING_STATES = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

const ALLOWED_TRANSITIONS = {
  [BOOKING_STATES.PENDING_PAYMENT]: [
    BOOKING_STATES.CONFIRMED,
    BOOKING_STATES.EXPIRED,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.CONFIRMED]: [
    BOOKING_STATES.CHECKED_IN,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.CHECKED_IN]: [
    BOOKING_STATES.IN_PROGRESS,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.IN_PROGRESS]: [
    BOOKING_STATES.COMPLETED,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.COMPLETED]: [], // Terminal
  [BOOKING_STATES.CANCELLED]: [], // Terminal
  [BOOKING_STATES.EXPIRED]: []    // Terminal
};

/**
 * Validates whether a state transition is legal according to the state machine.
 */
export function canTransitionBookingStatus(fromStatus, toStatus) {
  const normFrom = String(fromStatus || '').toUpperCase().replace('-', '_').replace(' ', '_');
  const normTo = String(toStatus || '').toUpperCase().replace('-', '_').replace(' ', '_');

  if (!BOOKING_STATES[normFrom] || !BOOKING_STATES[normTo]) {
    return {
      valid: false,
      error: `Unknown booking status in transition: "${fromStatus}" -> "${toStatus}"`
    };
  }

  if (normFrom === BOOKING_STATES.CANCELLED) {
    return {
      valid: false,
      error: 'Cancelled is a terminal state. A cancelled booking can NEVER be reopened or confirmed.'
    };
  }

  const allowed = ALLOWED_TRANSITIONS[normFrom] || [];
  if (!allowed.includes(normTo)) {
    return {
      valid: false,
      error: `Illegal state transition from "${normFrom}" to "${normTo}". Allowed transitions: ${allowed.join(', ') || 'None (terminal)'}`
    };
  }

  return { valid: true, fromStatus: normFrom, toStatus: normTo };
}

/**
 * Returns true if the booking status actively occupies the physical resource.
 */
export function isOccupyingStatus(status) {
  const norm = String(status || '').toUpperCase().replace('-', '_').replace(' ', '_');
  return [
    BOOKING_STATES.CONFIRMED,
    BOOKING_STATES.CHECKED_IN,
    BOOKING_STATES.IN_PROGRESS
  ].includes(norm);
}

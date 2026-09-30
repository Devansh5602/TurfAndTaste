/**
 * Safe Guest Identity & Privacy Engine
 * 
 * Rules:
 * 1. Booking History Access Control:
 *    - Unauthenticated querying of booking history by phone or email alone is strictly prohibited.
 *    - Access requires:
 *      a) Authenticated Admin or Staff session (req.admin), OR
 *      b) Valid signed guest history verification token (verified contact proof).
 * 2. Identity Association:
 *    - Future account claiming must link verified phone/email, never name alone.
 */

import jwt from 'jsonwebtoken';

const GUEST_HISTORY_SECRET = process.env.JWT_SECRET || 'turf-and-taste-guest-history-guard';

/**
 * Generates a temporary signed token allowing access to booking history for a verified contact.
 */
export function generateGuestHistoryToken(contact, type = 'phone') {
  return jwt.sign(
    { contact, type, purpose: 'guest_history_access' },
    GUEST_HISTORY_SECRET,
    { expiresIn: '15m' }
  );
}

/**
 * Verifies a guest history access token.
 */
export function verifyGuestHistoryToken(token) {
  if (!token) return { valid: false, error: 'Access token required.' };
  try {
    const decoded = jwt.verify(token, GUEST_HISTORY_SECRET);
    if (decoded.purpose !== 'guest_history_access') {
      return { valid: false, error: 'Invalid token purpose.' };
    }
    return { valid: true, contact: decoded.contact, type: decoded.type };
  } catch (err) {
    return { valid: false, error: 'Verification token is invalid or has expired.' };
  }
}

/**
 * Validates request authorization for viewing booking history.
 */
export function canAccessBookingHistory(req) {
  // 1. Authenticated Admin / Staff has legitimate operational access
  if (req.admin) {
    return { allowed: true, actor: 'admin' };
  }

  // 2. Check for signed history access token in headers or query
  const token = req.headers['x-guest-token'] || req.query.token;
  if (token) {
    const verified = verifyGuestHistoryToken(token);
    if (verified.valid) {
      return { allowed: true, actor: 'verified_guest', contact: verified.contact };
    }
    return { allowed: false, error: verified.error };
  }

  // 3. Unauthenticated lookup rejected
  return {
    allowed: false,
    error: 'Booking history requires identity verification. Please authenticate or provide a verified lookup token.'
  };
}

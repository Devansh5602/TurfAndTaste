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

const GUEST_HISTORY_SECRET = process.env.JWT_SECRET;

function historyTokenSecret() {
  if (!GUEST_HISTORY_SECRET) {
    throw new Error('Guest booking-history tokens are unavailable because JWT_SECRET is not configured.');
  }
  return GUEST_HISTORY_SECRET;
}

/**
 * Generates a temporary signed token allowing access to booking history for a verified contact.
 */
export function generateGuestHistoryToken(contact, type = 'phone') {
  if (!['phone', 'email'].includes(type)) {
    throw new Error('Guest booking-history token type must be phone or email.');
  }
  return jwt.sign(
    { contact, type, purpose: 'guest_history_access' },
    historyTokenSecret(),
    { expiresIn: '15m' }
  );
}

/**
 * Verifies a guest history access token.
 */
export function verifyGuestHistoryToken(token) {
  if (!token) return { valid: false, error: 'Access token required.' };
  try {
    const decoded = jwt.verify(token, historyTokenSecret());
    if (decoded.purpose !== 'guest_history_access') {
      return { valid: false, error: 'Invalid token purpose.' };
    }
    if (!['phone', 'email'].includes(decoded.type) || typeof decoded.contact !== 'string' || !decoded.contact.trim()) {
      return { valid: false, error: 'Guest history token is malformed.' };
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
      return { allowed: true, actor: 'verified_guest', contact: verified.contact, type: verified.type };
    }
    return { allowed: false, error: verified.error };
  }

  // 3. Unauthenticated lookup rejected
  return {
    allowed: false,
    error: 'Booking history requires identity verification. Please authenticate or provide a verified lookup token.'
  };
}

/**
 * Restricts a verified guest-history request to the exact contact asserted by
 * its signed token. A token for one phone/email must never be usable to look
 * up another customer's history by changing the query string.
 */
export function resolveBookingHistoryLookup(access, { phone, email } = {}) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (access?.actor === 'admin') {
    return { valid: true, phone: cleanPhone, email: cleanEmail };
  }

  if (access?.actor !== 'verified_guest') {
    return { valid: false, error: 'Booking history requires verified identity.' };
  }

  if (access.type === 'phone') {
    const tokenPhone = String(access.contact || '').replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(tokenPhone) || cleanPhone !== tokenPhone || cleanEmail) {
      return { valid: false, error: 'This verified link may only access its associated mobile number.' };
    }
    return { valid: true, phone: tokenPhone, email: '' };
  }

  if (access.type === 'email') {
    const tokenEmail = String(access.contact || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(tokenEmail) || cleanEmail !== tokenEmail || cleanPhone) {
      return { valid: false, error: 'This verified link may only access its associated email address.' };
    }
    return { valid: true, phone: '', email: tokenEmail };
  }

  return { valid: false, error: 'Guest history token has an unsupported contact type.' };
}

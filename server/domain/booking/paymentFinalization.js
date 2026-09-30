/**
 * Canonical Payment Finalization Transaction
 *
 * The SINGLE authoritative path for converting a verified Razorpay payment
 * into a confirmed booking. No other code path may INSERT a booking after
 * payment success.
 *
 * Architecture:
 * 1. Load and validate persisted payment_order (server context — never client).
 * 2. Parse and validate server quote (price authority).
 * 3. Verify expiry.
 * 4. Resolve physical facility from server quote.
 * 5. Validate canonical booking interval.
 * 6. Customer lead time check.
 * 7. Validate customer details.
 * 8. Execute within a unified, atomic transaction (db.withTransaction):
 *    - PostgreSQL: acquire physical-facility advisory lock, lock payment_order row FOR UPDATE.
 *    - SQLite: serialize through async transaction mutex + BEGIN IMMEDIATE.
 *    - Idempotency check under lock (if already finalized, return existing booking safely).
 *    - Complete fail-closed conflict check (bookings, active blocks, approved session extensions, active holds).
 *    - All mutations in one transaction: booking insert, session insert, payment record,
 *      quote redemption, hold conversion, payment order verification.
 * 9. Commit or full rollback.
 *
 * Invariants:
 * - Client-submitted prices are IGNORED — server quote is price authority.
 * - Client-submitted status is IGNORED — Confirmed is derived from payment success.
 * - Same payment retry returns existing booking (idempotent — no duplicate booking).
 * - Concurrent attempts for SAME resource + interval yield exactly 1 booking.
 * - Concurrent attempts for DIFFERENT resources succeed.
 */

import { formatToISTString, normalizeBookingInterval, intervalsOverlap } from '../time/bookingInterval.js';
import { validateQuickBooking, validateCustomBooking, validateLeadTime } from './bookingRules.js';
import { isOccupyingStatus } from './bookingStateMachine.js';
import { resolveCanonicalFacility } from './canonicalBookingCommand.js';

/**
 * @param {object} db - dbAsync abstraction layer (with withTransaction)
 * @param {object} params
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {string} params.razorpaySignature
 * @param {object} params.customerDetails  { name, phone, email, teamName }
 * @param {string} [params.holdToken]
 * @param {Date}   [params.now]
 */
export async function finalizeBookingFromPayment(db, params) {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    customerDetails = {},
    holdToken = null,
    now = new Date()
  } = params;

  // ── 1. Load persisted payment order ─────────────────────────────────────────
  const orderContext = await db.get(
    'SELECT * FROM payment_orders WHERE order_id = ?',
    [razorpayOrderId]
  );
  if (!orderContext) {
    throw Object.assign(new Error('Payment order not found.'), { code: 'ORDER_NOT_FOUND', httpStatus: 404 });
  }

  // ── 2. Idempotency guard (pre-lock check for fast return) ───────────────────
  if (orderContext.status === 'verified' && orderContext.finalized_booking_id) {
    const existing = await db.get('SELECT * FROM bookings WHERE id = ?', [orderContext.finalized_booking_id]);
    if (existing) {
      return _existingResult(existing, razorpayPaymentId);
    }
  }
  if (orderContext.status !== 'created') {
    throw Object.assign(
      new Error('This payment order has already been processed.'),
      { code: 'ORDER_ALREADY_PROCESSED', httpStatus: 409 }
    );
  }

  // ── 3. Parse server quote ────────────────────────────────────────────────────
  let quote;
  try {
    quote = JSON.parse(orderContext.quote_context);
  } catch {
    throw Object.assign(
      new Error('Payment order context is corrupt — cannot recover booking.'),
      { code: 'INVALID_QUOTE_CONTEXT', httpStatus: 500 }
    );
  }
  if (quote.exp < Math.floor(now.getTime() / 1000)) {
    throw Object.assign(
      new Error('Payment quote expired before booking finalization. Contact support if payment was captured.'),
      { code: 'QUOTE_EXPIRED', httpStatus: 409 }
    );
  }

  // ── 4. Resolve facility from SERVER quote ────────────────────────────────────
  const facility = resolveCanonicalFacility(quote.facilityId);
  if (!facility) {
    throw Object.assign(
      new Error(`Facility "${quote.facilityId}" from quote is not in authoritative inventory.`),
      { code: 'INVALID_FACILITY', httpStatus: 500 }
    );
  }
  const resolvedFacilityId = facility.id;
  const facilityName = facility.customName || facility.defaultName;

  // ── 5. Normalize canonical interval from SERVER quote ────────────────────────
  let normInterval;
  try {
    normInterval = normalizeBookingInterval({ date: quote.date, timeSlot: quote.timeSlot });
  } catch (e) {
    throw Object.assign(
      new Error(`Cannot parse booking interval from server quote: ${e.message}`),
      { code: 'INVALID_INTERVAL', httpStatus: 500 }
    );
  }

  // ── 6. Booking mode validation ───────────────────────────────────────────────
  const bookingMode = quote.bookingMode || 'STANDARD_QUICK';
  if (bookingMode === 'STANDARD_QUICK') {
    const check = validateQuickBooking(normInterval);
    if (!check.valid) throw Object.assign(new Error(check.error), { code: 'INVALID_BOOKING_MODE', httpStatus: 400 });
  } else {
    const check = validateCustomBooking(normInterval);
    if (!check.valid) throw Object.assign(new Error(check.error), { code: 'INVALID_BOOKING_MODE', httpStatus: 400 });
  }

  // ── 7. Customer lead time ────────────────────────────────────────────────────
  const leadCheck = validateLeadTime(normInterval.startAt, { isStaffWalkIn: false, now });
  if (!leadCheck.valid) {
    throw Object.assign(new Error(leadCheck.error), { code: 'LEAD_TIME_VIOLATION', httpStatus: 409 });
  }

  // ── 8. Validate customer details ─────────────────────────────────────────────
  const customerName = String(customerDetails.name || '').trim();
  const customerPhone = String(customerDetails.phone || '').replace(/\D/g, '');
  const customerEmail = String(customerDetails.email || '').trim().toLowerCase();
  const teamName = String(customerDetails.teamName || '').trim();
  if (!customerName || customerName.length < 2) {
    throw Object.assign(new Error('A valid customer name (minimum 2 characters) is required.'), { code: 'INVALID_CUSTOMER', httpStatus: 400 });
  }
  if (!/^[6-9]\d{9}$/.test(customerPhone)) {
    throw Object.assign(new Error('A valid 10-digit Indian mobile number is required.'), { code: 'INVALID_CUSTOMER', httpStatus: 400 });
  }

  // ── 9. SERVER-authoritative amounts ─────────────────────────────────────────
  const paymentType = orderContext.payment_type;           // 'full' | 'deposit'
  const expectedAmount = Number(orderContext.expected_amount); // rupees
  const totalAmountPaise = paymentType === 'full'
    ? Math.round(expectedAmount * 100)
    : Math.round((quote.total || expectedAmount) * 100);
  const depositAmountPaise = paymentType === 'deposit'
    ? Math.round(expectedAmount * 100)
    : Math.round((quote.deposit || 0) * 100);

  // ── 10. Generate booking ID ──────────────────────────────────────────────────
  const bookingId = `TT-${Math.floor(100000 + Math.random() * 900000)}`;

  // ── 11. Transaction Execution (PostgreSQL & SQLite Unified) ──────────────────
  const ctx = {
    bookingId, resolvedFacilityId, facilityName, normInterval, bookingMode,
    customerName, customerPhone, customerEmail, teamName,
    paymentType, totalAmountPaise, depositAmountPaise,
    quote, orderContext, razorpayOrderId, razorpayPaymentId, razorpaySignature,
    holdToken, now
  };

  return await db.withTransaction(async (tx) => {
    // A. Concurrency Protection & Row Locking
    if (tx.isPostgres) {
      // Per-facility advisory lock scoped to this transaction
      await tx.query(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        [`finalize_lock_${resolvedFacilityId}`]
      );
      // Lock payment_orders row FOR UPDATE
      const lockRow = await tx.query(
        `SELECT status, finalized_booking_id FROM payment_orders WHERE order_id = $1 FOR UPDATE`,
        [razorpayOrderId]
      );
      const lockedOrder = lockRow.rows[0];
      if (!lockedOrder) throw Object.assign(new Error('Payment order not found inside transaction.'), { httpStatus: 404 });
      if (lockedOrder.status === 'verified' && lockedOrder.finalized_booking_id) {
        const bRow = await tx.query(`SELECT * FROM bookings WHERE id = $1`, [lockedOrder.finalized_booking_id]);
        if (bRow.rows[0]) return _existingResult(bRow.rows[0], razorpayPaymentId);
      }
      if (lockedOrder.status !== 'created') {
        throw Object.assign(new Error('Payment order has already been processed.'), { httpStatus: 409 });
      }
    } else {
      // SQLite: under BEGIN IMMEDIATE + tx mutex
      const lockedOrder = await tx.get(
        `SELECT status, finalized_booking_id FROM payment_orders WHERE order_id = ?`,
        [razorpayOrderId]
      );
      if (!lockedOrder) throw Object.assign(new Error('Payment order not found inside transaction.'), { httpStatus: 404 });
      if (lockedOrder.status === 'verified' && lockedOrder.finalized_booking_id) {
        const existing = await tx.get(`SELECT * FROM bookings WHERE id = ?`, [lockedOrder.finalized_booking_id]);
        if (existing) return _existingResult(existing, razorpayPaymentId);
      }
      if (lockedOrder.status !== 'created') {
        throw Object.assign(new Error('Payment order has already been processed.'), { httpStatus: 409 });
      }
    }

    // B. Fail-Closed Occupancy & Conflict Determination Under Lock
    await _assertNoConflicts(tx, ctx);

    // C. Atomic Persistence of all mutations
    await _persistFinalizedBooking(tx, ctx);

    return _successResult(ctx);
  });
}

/**
 * Checks for physical resource conflicts across confirmed bookings, active blocks,
 * approved session extensions, and active holds. Fails closed on query errors.
 */
async function _assertNoConflicts(tx, ctx) {
  const { resolvedFacilityId, normInterval, holdToken, now } = ctx;

  // 1. Confirmed bookings on the physical facility
  const bookings = await tx.all(
    `SELECT id, booking_status, scheduled_start_at, scheduled_end_at, date, time_slot
     FROM bookings
     WHERE (physical_facility_id = ? OR (physical_facility_id IS NULL AND facility_id = ?))`,
    [resolvedFacilityId, resolvedFacilityId]
  );

  for (const b of bookings) {
    if (!isOccupyingStatus(b.booking_status)) continue;
    let bi;
    if (b.scheduled_start_at && b.scheduled_end_at) {
      bi = normalizeBookingInterval({ startAt: b.scheduled_start_at, endAt: b.scheduled_end_at });
    } else if (b.date && b.time_slot) {
      try {
        bi = normalizeBookingInterval({ date: b.date, timeSlot: b.time_slot });
      } catch {
        continue;
      }
    } else {
      continue;
    }

    if (intervalsOverlap(normInterval, bi)) {
      throw Object.assign(
        new Error(`Double-booking prevented: Facility already reserved (${b.id}).`),
        { code: 'BOOKING_CONFLICT', httpStatus: 409 }
      );
    }
  }

  // 2. Active facility maintenance / event blocks (fail-closed)
  const blocks = await tx.all(
    `SELECT id, facility_id, start_at, end_at, reason_code, internal_note
     FROM facility_blocks
     WHERE facility_id = ? AND status = 'active'`,
    [resolvedFacilityId]
  );

  for (const bl of blocks) {
    if (!bl.start_at || !bl.end_at) continue;
    const bli = normalizeBookingInterval({ startAt: bl.start_at, endAt: bl.end_at });
    if (intervalsOverlap(normInterval, bli)) {
      throw Object.assign(
        new Error(`Double-booking prevented: Facility is blocked for ${bl.reason_code || 'maintenance'}.`),
        { code: 'BOOKING_CONFLICT', httpStatus: 409 }
      );
    }
  }

  // 3. Approved session extensions extending active facility sessions (fail-closed)
  const sessionsWithExt = await tx.all(
    `SELECT fs.id, fs.booking_id, fs.facility_id, fs.scheduled_start_at, fs.scheduled_end_at,
            COALESCE(SUM(sa.minutes), 0) as extension_minutes
     FROM facility_sessions fs
     LEFT JOIN session_adjustments sa ON sa.session_id = fs.id AND sa.adjustment_type = 'EXTENSION'
     WHERE fs.facility_id = ? AND fs.session_status NOT IN ('CANCELLED', 'COMPLETED')
     GROUP BY fs.id, fs.booking_id, fs.facility_id, fs.scheduled_start_at, fs.scheduled_end_at`,
    [resolvedFacilityId]
  );

  for (const s of sessionsWithExt) {
    const extMinutes = parseInt(s.extension_minutes, 10) || 0;
    if (extMinutes > 0 && s.scheduled_start_at && s.scheduled_end_at) {
      const baseInterval = normalizeBookingInterval({ startAt: s.scheduled_start_at, endAt: s.scheduled_end_at });
      const extendedEnd = new Date(baseInterval.endAt.getTime() + extMinutes * 60000);
      const extInterval = { startAt: baseInterval.startAt, endAt: extendedEnd };
      if (intervalsOverlap(normInterval, extInterval)) {
        throw Object.assign(
          new Error(`Double-booking prevented: Resource is occupied by an approved session extension until ${formatToISTString(extendedEnd)}.`),
          { code: 'BOOKING_CONFLICT', httpStatus: 409 }
        );
      }
    }
  }

  // 4. Active unexpired payment holds (fail-closed)
  const holds = await tx.all(
    `SELECT id, facility_id, start_at, end_at, hold_token, expires_at, customer_identifier
     FROM payment_holds
     WHERE facility_id = ? AND status = 'ACTIVE' AND expires_at > ?`,
    [resolvedFacilityId, now.toISOString()]
  );

  for (const h of holds) {
    if (holdToken && h.hold_token === holdToken) {
      // Verify hold facility and interval match the quote
      const hi = normalizeBookingInterval({ startAt: h.start_at, endAt: h.end_at });
      if (h.facility_id === resolvedFacilityId && intervalsOverlap(normInterval, hi)) {
        continue; // Valid hold owned by caller
      }
    }
    const hi = normalizeBookingInterval({ startAt: h.start_at, endAt: h.end_at });
    if (intervalsOverlap(normInterval, hi)) {
      throw Object.assign(
        new Error('Double-booking prevented: An active hold conflicts with this slot.'),
        { code: 'BOOKING_CONFLICT', httpStatus: 409 }
      );
    }
  }
}

async function _persistFinalizedBooking(tx, ctx) {
  const { bookingId, resolvedFacilityId, facilityName, normInterval, bookingMode,
          customerName, customerPhone, customerEmail, teamName,
          paymentType, totalAmountPaise, depositAmountPaise,
          quote, orderContext, razorpayOrderId, razorpayPaymentId, razorpaySignature,
          holdToken } = ctx;

  const { insertSql, insertParams, sessionSql, sessionParams } = _buildBookingInsert({
    bookingId, resolvedFacilityId, facilityName, normInterval, bookingMode,
    customerName, customerPhone, customerEmail, teamName,
    paymentType, totalAmountPaise, depositAmountPaise, razorpayPaymentId
  });

  await tx.run(insertSql, insertParams);
  await tx.run(sessionSql, sessionParams);

  await tx.run(
    `INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_type, status)
     VALUES (?, ?, ?, ?, ?, ?, 'captured')`,
    [bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature, orderContext.expected_amount, paymentType]
  );

  await tx.run(
    `INSERT INTO quote_redemptions (quote_id, booking_id, expires_at)
     VALUES (?, ?, ?)
     ON CONFLICT (quote_id) DO NOTHING`,
    [quote.quoteId, bookingId, new Date(quote.exp * 1000).toISOString()]
  );

  if (holdToken) {
    await tx.run(
      `UPDATE payment_holds SET status = 'CONVERTED' WHERE hold_token = ? AND status = 'ACTIVE'`,
      [holdToken]
    );
  }

  await tx.run(
    `UPDATE payment_orders
       SET status = 'verified', payment_id = ?, verified_at = CURRENT_TIMESTAMP, finalized_booking_id = ?
     WHERE order_id = ? AND status = 'created'`,
    [razorpayPaymentId, bookingId, razorpayOrderId]
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function _buildBookingInsert(opts) {
  const {
    bookingId, resolvedFacilityId, facilityName, normInterval, bookingMode,
    customerName, customerPhone, customerEmail, teamName,
    paymentType, totalAmountPaise, depositAmountPaise, razorpayPaymentId
  } = opts;

  const istDate = formatToISTString(normInterval.startAt).slice(0, 10);
  const fmtTime = (d) => {
    const h = (d.getUTCHours() + 5 + Math.floor((d.getUTCMinutes() + 30) / 60)) % 24;
    const m = (d.getUTCMinutes() + 30) % 60;
    const p = h >= 12 ? 'PM' : 'AM'; const dh = h % 12 || 12;
    return `${String(dh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
  };
  const legacySlot = `${fmtTime(normInterval.startAt)} – ${fmtTime(normInterval.endAt)}`;
  const amtStr = `₹${(totalAmountPaise / 100).toFixed(2)} (${paymentType === 'full' ? 'Full Payment' : 'Token Deposit'})`;

  return {
    insertSql: `INSERT INTO bookings (
      id, facility_id, facility_name, date, time_slot,
      customer_name, customer_phone, customer_email, team_name,
      duration, payment_type, amount_paid, payment_status, booking_status,
      payment_id, physical_facility_id, scheduled_start_at, scheduled_end_at,
      booking_type, delivery_preference, total_amount_paise, deposit_amount_paise
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, 'Paid', 'Confirmed',
      ?, ?, ?, ?,
      ?, 'WHATSAPP', ?, ?
    )`,
    insertParams: [
      bookingId, resolvedFacilityId, facilityName, istDate, legacySlot,
      customerName, customerPhone, customerEmail || null, teamName || null,
      normInterval.durationHours, paymentType, amtStr,
      razorpayPaymentId, resolvedFacilityId,
      normInterval.startAt.toISOString(), normInterval.endAt.toISOString(),
      bookingMode, totalAmountPaise, depositAmountPaise
    ],
    sessionSql: `INSERT INTO facility_sessions (
      id, booking_id, facility_id, scheduled_start_at, scheduled_end_at, session_status
    ) VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    sessionParams: [
      `ses_${bookingId}`, bookingId, resolvedFacilityId,
      normInterval.startAt.toISOString(), normInterval.endAt.toISOString()
    ]
  };
}

function _existingResult(b, paymentId) {
  return {
    idempotent: true,
    bookingId: b.id,
    physicalFacilityId: b.physical_facility_id || b.facility_id,
    facilityName: b.facility_name,
    date: b.date,
    timeSlot: b.time_slot,
    customerName: b.customer_name,
    customerPhone: b.customer_phone,
    bookingStatus: b.booking_status,
    paymentId
  };
}

function _successResult(ctx) {
  const { bookingId, resolvedFacilityId, facilityName, normInterval,
          customerName, customerPhone, customerEmail, teamName,
          paymentType, razorpayPaymentId } = ctx;
  return {
    success: true,
    idempotent: false,
    bookingId,
    physicalFacilityId: resolvedFacilityId,
    facilityName,
    date: formatToISTString(normInterval.startAt).slice(0, 10),
    interval: normInterval,
    customerName,
    customerPhone,
    customerEmail,
    teamName,
    paymentType,
    bookingStatus: 'Confirmed',
    paymentId: razorpayPaymentId
  };
}

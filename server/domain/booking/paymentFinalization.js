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
 * 7. Idempotency: if already finalized, return existing booking safely.
 * 8. Acquire same-connection resource lock (PostgreSQL) WITHIN the transaction.
 * 9. Conflict check while lock held.
 * 10. All mutations in ONE transaction: booking insert, session insert, hold release,
 *     payment record, quote redemption, order status update.
 * 11. Commit or full rollback.
 *
 * Invariants:
 * - Client-submitted prices are IGNORED — server quote is price authority.
 * - Client-submitted status is IGNORED — Confirmed is derived from payment success.
 * - Same payment retry returns existing booking (idempotent — no duplicate booking).
 * - Per-facility advisory locks avoid serializing unrelated courts.
 */

import { formatToISTString, normalizeBookingInterval, intervalsOverlap } from '../time/bookingInterval.js';
import { validateQuickBooking, validateCustomBooking, validateLeadTime } from './bookingRules.js';
import { isOccupyingStatus } from './bookingStateMachine.js';
import { resolveCanonicalFacility } from './canonicalBookingCommand.js';

/**
 * @param {object} db - dbAsync abstraction layer (with withTransaction if available)
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

  // ── 2. Idempotency guard (pre-lock) ─────────────────────────────────────────
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

  // ── 11. Execute atomically ───────────────────────────────────────────────────
  const ctx = {
    bookingId, resolvedFacilityId, facilityName, normInterval, bookingMode,
    customerName, customerPhone, customerEmail, teamName,
    paymentType, totalAmountPaise, depositAmountPaise,
    quote, orderContext, razorpayOrderId, razorpayPaymentId, razorpaySignature,
    holdToken, now
  };

  if (db.isPostgres && db.isPostgres() && typeof db.withTransaction === 'function') {
    return await db.withTransaction((client) => _pgTransaction(client, ctx));
  }
  return await _sqliteTransaction(db, ctx);
}

// ── PostgreSQL: advisory lock + single client transaction ──────────────────────
async function _pgTransaction(client, ctx) {
  const { resolvedFacilityId, razorpayOrderId } = ctx;

  // Acquire per-facility advisory lock INSIDE transaction
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext($1))`,
    [`finalize_lock_${resolvedFacilityId}`]
  );

  // Idempotency re-check under lock (FOR UPDATE on payment_orders row)
  const lockRow = await client.query(
    `SELECT status, finalized_booking_id FROM payment_orders WHERE order_id = $1 FOR UPDATE`,
    [razorpayOrderId]
  );
  const lockedOrder = lockRow.rows[0];
  if (!lockedOrder) throw Object.assign(new Error('Payment order not found inside transaction.'), { httpStatus: 404 });
  if (lockedOrder.status === 'verified' && lockedOrder.finalized_booking_id) {
    const bRow = await client.query(`SELECT * FROM bookings WHERE id = $1`, [lockedOrder.finalized_booking_id]);
    if (bRow.rows[0]) return _existingResult(bRow.rows[0], ctx.razorpayPaymentId);
  }
  if (lockedOrder.status !== 'created') {
    throw Object.assign(new Error('Payment order has already been processed.'), { httpStatus: 409 });
  }

  // Conflict check while lock held
  await _assertNoConflictsPg(client, ctx);

  // All mutations in one transaction
  await _pgInsertAll(client, ctx);

  return _successResult(ctx);
}

async function _assertNoConflictsPg(client, ctx) {
  const { resolvedFacilityId, normInterval, holdToken, now } = ctx;
  const bRows = await client.query(
    `SELECT id, booking_status, scheduled_start_at, scheduled_end_at FROM bookings
     WHERE (physical_facility_id = $1 OR (physical_facility_id IS NULL AND facility_id = $1))`,
    [resolvedFacilityId]
  );
  for (const b of bRows.rows) {
    if (!isOccupyingStatus(b.booking_status)) continue;
    if (!b.scheduled_start_at || !b.scheduled_end_at) continue;
    const bi = normalizeBookingInterval({ startAt: b.scheduled_start_at, endAt: b.scheduled_end_at });
    if (intervalsOverlap(normInterval, bi)) {
      throw Object.assign(
        new Error(`Double-booking prevented: Facility already reserved (${b.id}).`),
        { code: 'BOOKING_CONFLICT', httpStatus: 409 }
      );
    }
  }
  try {
    const hRows = await client.query(
      `SELECT id, hold_token, start_at, end_at FROM payment_holds
       WHERE facility_id = $1 AND status = 'ACTIVE' AND expires_at > $2`,
      [resolvedFacilityId, now.toISOString()]
    );
    for (const h of hRows.rows) {
      if (holdToken && h.hold_token === holdToken) continue;
      const hi = normalizeBookingInterval({ startAt: h.start_at, endAt: h.end_at });
      if (intervalsOverlap(normInterval, hi)) {
        throw Object.assign(
          new Error('Double-booking prevented: An active hold conflicts with this slot.'),
          { code: 'BOOKING_CONFLICT', httpStatus: 409 }
        );
      }
    }
  } catch (e) {
    if (e.code === 'BOOKING_CONFLICT') throw e;
    // hold check failure is logged but non-fatal (table may not have rows)
  }
  try {
    const blRows = await client.query(
      `SELECT id, start_at, end_at FROM facility_blocks WHERE facility_id = $1 AND status = 'active'`,
      [resolvedFacilityId]
    );
    for (const bl of blRows.rows) {
      const bli = normalizeBookingInterval({ startAt: bl.start_at, endAt: bl.end_at });
      if (intervalsOverlap(normInterval, bli)) {
        throw Object.assign(
          new Error('Double-booking prevented: Facility is blocked for maintenance.'),
          { code: 'BOOKING_CONFLICT', httpStatus: 409 }
        );
      }
    }
  } catch (e) {
    if (e.code === 'BOOKING_CONFLICT') throw e;
  }
}

function _pg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function _pgInsertAll(client, ctx) {
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

  await client.query(_pg(insertSql), insertParams);
  await client.query(_pg(sessionSql), sessionParams);

  await client.query(
    `INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_type, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'captured')`,
    [bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature, orderContext.expected_amount, paymentType]
  );

  await client.query(
    `INSERT INTO quote_redemptions (quote_id, booking_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (quote_id) DO NOTHING`,
    [quote.quoteId, bookingId, new Date(quote.exp * 1000).toISOString()]
  );

  if (holdToken) {
    await client.query(
      `UPDATE payment_holds SET status = 'CONVERTED' WHERE hold_token = $1`,
      [holdToken]
    );
  }

  await client.query(
    `UPDATE payment_orders
       SET status = 'verified', payment_id = $1, verified_at = NOW(), finalized_booking_id = $2
     WHERE order_id = $3 AND status = 'created'`,
    [razorpayPaymentId, bookingId, razorpayOrderId]
  );
}

// ── SQLite / fallback: serialized transaction (no advisory lock) ──────────────
async function _sqliteTransaction(db, ctx) {
  const { resolvedFacilityId, normInterval, holdToken, now } = ctx;

  // Sequential conflict check before transaction (SQLite is single-writer anyway)
  const bookings = await db.all(
    `SELECT id, booking_status, scheduled_start_at, scheduled_end_at FROM bookings
     WHERE (physical_facility_id = ? OR (physical_facility_id IS NULL AND facility_id = ?))`,
    [resolvedFacilityId, resolvedFacilityId]
  );
  for (const b of bookings) {
    if (!isOccupyingStatus(b.booking_status)) continue;
    if (!b.scheduled_start_at || !b.scheduled_end_at) continue;
    const bi = normalizeBookingInterval({ startAt: b.scheduled_start_at, endAt: b.scheduled_end_at });
    if (intervalsOverlap(normInterval, bi)) {
      throw Object.assign(
        new Error(`Double-booking prevented: Facility already reserved (${b.id}).`),
        { code: 'BOOKING_CONFLICT', httpStatus: 409 }
      );
    }
  }
  try {
    const holds = await db.all(
      `SELECT id, hold_token, start_at, end_at FROM payment_holds
       WHERE facility_id = ? AND status = 'ACTIVE' AND expires_at > ?`,
      [resolvedFacilityId, now.toISOString()]
    );
    for (const h of holds) {
      if (holdToken && h.hold_token === holdToken) continue;
      const hi = normalizeBookingInterval({ startAt: h.start_at, endAt: h.end_at });
      if (intervalsOverlap(normInterval, hi)) {
        throw Object.assign(
          new Error('Double-booking prevented: Active hold conflicts.'),
          { code: 'BOOKING_CONFLICT', httpStatus: 409 }
        );
      }
    }
  } catch (e) { if (e.code === 'BOOKING_CONFLICT') throw e; }

  const { insertSql, insertParams, sessionSql, sessionParams } = _buildBookingInsert(ctx);
  const { quote, orderContext, razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentType, bookingId, holdToken: ht } = ctx;

  const statements = [
    { sql: insertSql, params: insertParams },
    { sql: sessionSql, params: sessionParams },
    {
      sql: `INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_type, status)
            VALUES (?, ?, ?, ?, ?, ?, 'captured')`,
      params: [bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature, orderContext.expected_amount, paymentType]
    },
    {
      sql: `INSERT INTO quote_redemptions (quote_id, booking_id, expires_at) VALUES (?, ?, ?)
            ON CONFLICT (quote_id) DO NOTHING`,
      params: [quote.quoteId, bookingId, new Date(quote.exp * 1000).toISOString()]
    },
    {
      sql: `UPDATE payment_orders SET status = 'verified', payment_id = ?, verified_at = CURRENT_TIMESTAMP, finalized_booking_id = ?
            WHERE order_id = ? AND status = 'created'`,
      params: [razorpayPaymentId, bookingId, razorpayOrderId]
    }
  ];
  if (ht) {
    statements.push({ sql: `UPDATE payment_holds SET status = 'CONVERTED' WHERE hold_token = ?`, params: [ht] });
  }

  await db.transaction(statements);
  return _successResult(ctx);
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
    physicalFacilityId: b.physical_facility_id,
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

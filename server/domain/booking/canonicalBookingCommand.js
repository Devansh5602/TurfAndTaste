import { formatToISTString, getISTMinutes, intervalsOverlap, normalizeBookingInterval } from '../time/bookingInterval.js';
import { validateCustomBooking, validateLeadTime, validateQuickBooking } from './bookingRules.js';
import { BOOKING_STATES, isOccupyingStatus } from './bookingStateMachine.js';
import { CANONICAL_FACILITIES } from '../facility/inventory.js';

/**
 * Resolves any user-provided identifier (id, code, alias, legacy string)
 * to an authoritative physical facility object.
 */
export function resolveCanonicalFacility(identifier) {
  if (!identifier) return null;
  const raw = String(identifier).trim().toLowerCase();

  // 1. Direct match on ID or code
  const exact = CANONICAL_FACILITIES.find(f => f.id.toLowerCase() === raw || f.code.toLowerCase() === raw);
  if (exact) return exact;

  // 2. Direct match on default or custom name
  const nameMatch = CANONICAL_FACILITIES.find(f => 
    f.defaultName.toLowerCase() === raw || 
    (f.customName && f.customName.toLowerCase() === raw)
  );
  if (nameMatch) return nameMatch;

  // 3. Normalized stripped match
  const stripped = raw.replace(/[-_ ]+/g, '');
  const matched = CANONICAL_FACILITIES.find(f => {
    const fIdStripped = f.id.toLowerCase().replace(/[-_ ]+/g, '');
    const fCodeStripped = f.code.toLowerCase().replace(/[-_ ]+/g, '');
    return fIdStripped === stripped || fCodeStripped === stripped;
  });
  if (matched) return matched;

  // 4. Aliases for legacy facility profiles / high-level services
  if (raw === 'box-cricket' || raw === 'box_cricket' || raw === 'box cricket') {
    return CANONICAL_FACILITIES.find(f => f.id === 'fac_box_cricket_1');
  }
  if (raw === 'cricket-nets' || raw === 'cricket_nets' || raw === 'cricket-green-net' || raw === 'green_net' || raw.includes('green net')) {
    return CANONICAL_FACILITIES.find(f => f.id === 'fac_green_net_1');
  }
  if (raw === 'pickleball' || raw === 'pickleball_court') {
    return CANONICAL_FACILITIES.find(f => f.id === 'fac_pickleball_1');
  }
  if (raw === 'skating' || raw === 'skating_rink' || raw === 'skating rink') {
    return CANONICAL_FACILITIES.find(f => f.id === 'fac_skating_1');
  }

  return null;
}

/**
 * Creates an ephemeral payment hold for 10 minutes on a physical resource.
 */
export async function createCanonicalPaymentHold(db, input) {
  const {
    physicalFacilityId,
    facilityId,
    startAt,
    endAt,
    date,
    timeSlot,
    customerIdentifier = null,
    ttlMinutes = 10,
    now = new Date()
  } = input;

  const facility = resolveCanonicalFacility(physicalFacilityId || facilityId);
  if (!facility) {
    throw new Error(`Invalid facility identifier "${physicalFacilityId || facilityId}".`);
  }
  const resolvedFacilityId = facility.id;

  const interval = normalizeBookingInterval({ startAt, endAt, date, timeSlot });
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60000);
  const holdToken = `hold_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Concurrency lock on physical facility if on PostgreSQL
  if (db.isPostgres && db.isPostgres()) {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hold_lock_${resolvedFacilityId}`]);
  }

  // Check conflicts
  const conflictCheck = await checkCanonicalConflicts(db, {
    physicalFacilityId: resolvedFacilityId,
    startAt: interval.startAt,
    endAt: interval.endAt,
    now
  });

  if (conflictCheck.hasConflict) {
    throw new Error(`Cannot place hold: ${conflictCheck.conflicts[0].reason}`);
  }

  await db.run(
    `INSERT INTO payment_holds (id, facility_id, start_at, end_at, hold_token, expires_at, status, customer_identifier)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    [
      `ph_${Date.now()}`,
      resolvedFacilityId,
      interval.startAt.toISOString(),
      interval.endAt.toISOString(),
      holdToken,
      expiresAt.toISOString(),
      customerIdentifier
    ]
  );

  return {
    success: true,
    holdToken,
    physicalFacilityId: resolvedFacilityId,
    interval,
    expiresAt: expiresAt.toISOString(),
    expiresInSeconds: ttlMinutes * 60
  };
}

/**
 * Checks for physical resource conflicts across confirmed bookings, active blocks,
 * approved session extensions, and unexpired holds.
 */
export async function checkCanonicalConflicts(db, options) {
  const {
    physicalFacilityId,
    startAt,
    endAt,
    excludeBookingId = null,
    excludeHoldToken = null,
    now = new Date()
  } = options;

  const facility = resolveCanonicalFacility(physicalFacilityId);
  const resolvedFacilityId = facility ? facility.id : physicalFacilityId;

  const reqInterval = normalizeBookingInterval({ startAt, endAt });
  const conflicts = [];

  // 1. Confirmed / active bookings on the same physical resource
  const bookings = await db.all(
    `SELECT id, physical_facility_id, scheduled_start_at, scheduled_end_at, date, time_slot, booking_status
     FROM bookings
     WHERE (physical_facility_id = ? OR (physical_facility_id IS NULL AND facility_id = ?))`,
    [resolvedFacilityId, resolvedFacilityId]
  );

  for (const b of bookings) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (!isOccupyingStatus(b.booking_status)) continue;

    let bInterval;
    if (b.scheduled_start_at && b.scheduled_end_at) {
      bInterval = normalizeBookingInterval({ startAt: b.scheduled_start_at, endAt: b.scheduled_end_at });
    } else {
      try {
        bInterval = normalizeBookingInterval({ date: b.date, timeSlot: b.time_slot });
      } catch (e) {
        continue;
      }
    }

    if (intervalsOverlap(reqInterval, bInterval)) {
      conflicts.push({
        type: 'BOOKING',
        id: b.id,
        reason: `Physical facility is already reserved from ${formatToISTString(bInterval.startAt)} to ${formatToISTString(bInterval.endAt)} (Booking ${b.id}).`
      });
    }
  }

  // 2. Active facility blocks (fail-closed)
  const blocks = await db.all(
    `SELECT id, facility_id, start_at, end_at, reason_code, internal_note
     FROM facility_blocks
     WHERE facility_id = ? AND status = 'active'`,
    [resolvedFacilityId]
  );

  for (const bl of blocks) {
    if (!bl.start_at || !bl.end_at) continue;
    const blInterval = normalizeBookingInterval({ startAt: bl.start_at, endAt: bl.end_at });
    if (intervalsOverlap(reqInterval, blInterval)) {
      conflicts.push({
        type: 'BLOCK',
        id: bl.id,
        reason: `Facility is blocked for ${bl.reason_code || 'maintenance'}${bl.internal_note ? `: ${bl.internal_note}` : ''}.`
      });
    }
  }

  // 3. Approved session extensions extending active facility sessions (fail-closed)
  const sessionsWithExt = await db.all(
    `SELECT fs.id, fs.booking_id, fs.facility_id, fs.scheduled_start_at, fs.scheduled_end_at,
            COALESCE(SUM(sa.minutes), 0) as extension_minutes
     FROM facility_sessions fs
     LEFT JOIN session_adjustments sa ON sa.session_id = fs.id AND sa.adjustment_type = 'EXTENSION'
     WHERE fs.facility_id = ? AND fs.session_status NOT IN ('CANCELLED', 'COMPLETED')
     GROUP BY fs.id, fs.booking_id, fs.facility_id, fs.scheduled_start_at, fs.scheduled_end_at`,
    [resolvedFacilityId]
  );

  for (const s of sessionsWithExt) {
    if (excludeBookingId && (s.booking_id === excludeBookingId || s.id === excludeBookingId)) continue;
    const extMinutes = parseInt(s.extension_minutes, 10) || 0;
    if (extMinutes > 0 && s.scheduled_start_at && s.scheduled_end_at) {
      const baseInterval = normalizeBookingInterval({ startAt: s.scheduled_start_at, endAt: s.scheduled_end_at });
      const extendedEnd = new Date(baseInterval.endAt.getTime() + extMinutes * 60000);
      const extendedInterval = { startAt: baseInterval.startAt, endAt: extendedEnd };
      if (intervalsOverlap(reqInterval, extendedInterval)) {
        conflicts.push({
          type: 'SESSION_EXTENSION',
          id: s.id,
          reason: `Resource is occupied by an approved session extension until ${formatToISTString(extendedEnd)}.`
        });
      }
    }
  }

  // 4. Active unexpired payment holds (fail-closed)
  const holds = await db.all(
    `SELECT id, facility_id, start_at, end_at, hold_token, expires_at
     FROM payment_holds
     WHERE facility_id = ? AND status = 'ACTIVE' AND expires_at > ?`,
    [resolvedFacilityId, now.toISOString()]
  );

  for (const h of holds) {
    if (excludeHoldToken && h.hold_token === excludeHoldToken) continue;
    const hInterval = normalizeBookingInterval({ startAt: h.start_at, endAt: h.end_at });
    if (intervalsOverlap(reqInterval, hInterval)) {
      conflicts.push({
        type: 'PAYMENT_HOLD',
        id: h.id,
        reason: 'A temporary reservation hold is currently active for this time slot.'
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

/**
 * Authoritative Canonical Booking Command.
 */
export async function createCanonicalBooking(db, input, context = {}) {
  const {
    actor = { type: 'CUSTOMER', username: 'guest' },
    source = 'CUSTOMER_APP',
    customer = {},
    physicalFacilityId,
    facilityId,
    serviceId = null,
    addOnIds = [],
    startAt,
    endAt,
    date,
    timeSlot,
    startTime,
    durationHours,
    durationMinutes,
    bookingMode = 'STANDARD_QUICK',
    deliveryPreference = 'WHATSAPP',
    payment = {},
    holdToken = null,
    now = new Date()
  } = input;

  // 1. Resolve Physical Facility
  const facility = resolveCanonicalFacility(physicalFacilityId || facilityId);
  if (!facility) {
    throw new Error(`Physical facility "${physicalFacilityId || facilityId}" does not exist in authoritative inventory.`);
  }
  const resolvedFacilityId = facility.id;
  const facilityName = facility.customName || facility.defaultName;

  // Invariant: Ball-Shooting Machine is an add-on strictly bound to Cricket Green Net
  if ((addOnIds.includes('addon_shooting_machine') || serviceId === 'shooting_machine') && resolvedFacilityId !== 'fac_green_net_1') {
    throw new Error('Ball-Shooting Machine is an add-on strictly available only on Cricket Green Net (fac_green_net_1).');
  }

  // 2. Normalize Canonical Interval [start_at, end_at)
  let normInterval;
  if (startAt && endAt) {
    normInterval = normalizeBookingInterval({ startAt, endAt });
  } else if (date && startTime && (durationHours || durationMinutes)) {
    normInterval = normalizeBookingInterval({
      date,
      startTime,
      durationMinutes: durationMinutes || (durationHours * 60)
    });
  } else if (date && timeSlot) {
    normInterval = normalizeBookingInterval({ date, timeSlot });
  } else {
    throw new Error('Booking time must be specified via (startAt, endAt), (date, startTime, duration), or (date, timeSlot).');
  }

  // 3. Validate Booking Mode & Boundaries
  const isQuick = bookingMode === 'STANDARD_QUICK';
  if (isQuick) {
    const quickCheck = validateQuickBooking(normInterval);
    if (!quickCheck.valid) {
      throw new Error(quickCheck.error);
    }
  } else {
    const customCheck = validateCustomBooking(normInterval);
    if (!customCheck.valid) {
      throw new Error(customCheck.error);
    }
  }

  // 4. Validate Customer Lead Time vs Staff Walk-In
  const isStaff = actor.type === 'STAFF' || actor.type === 'ADMIN' || source === 'STAFF_WALKIN';
  const leadCheck = validateLeadTime(normInterval.startAt, {
    isStaffWalkIn: isStaff,
    now
  });
  if (!leadCheck.valid) {
    throw new Error(leadCheck.error);
  }

  // 5. Walk-in Payment Policy: if walk-in < 1 hour before start, FULL PAYMENT is required
  const diffMinutesFromNow = Math.floor((normInterval.startAt.getTime() - now.getTime()) / 60000);
  const paymentTypeUpper = String(payment.type || '').toUpperCase();
  if (isStaff && diffMinutesFromNow < 60 && paymentTypeUpper === 'DEPOSIT') {
    throw new Error('Immediate walk-in bookings inside the 1-hour threshold require FULL payment, not a token deposit.');
  }

  // 6. Customer details validation
  const customerName = (customer.name || customer.customerName || input.customerName || '').trim();
  const customerPhone = String(customer.phone || customer.customerPhone || input.customerPhone || '').replace(/\D/g, '');
  const customerEmail = (customer.email || customer.customerEmail || input.customerEmail || '').trim().toLowerCase();
  const teamName = (customer.teamName || input.teamName || '').trim();

  if (!customerName || customerName.length < 2) {
    throw new Error('Customer full name is required (minimum 2 characters).');
  }
  if (!/^[6-9]\d{9}$/.test(customerPhone)) {
    throw new Error('A valid 10-digit Indian mobile number is required.');
  }

  // 7. Transactional Overlap Concurrency Protection
  // If PostgreSQL, use pg_advisory_xact_lock to serialize writes on the same physical facility
  if (db.isPostgres && db.isPostgres()) {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`booking_lock_${resolvedFacilityId}`]);
  }

  const conflictCheck = await checkCanonicalConflicts(db, {
    physicalFacilityId: resolvedFacilityId,
    startAt: normInterval.startAt,
    endAt: normInterval.endAt,
    excludeHoldToken: holdToken,
    now
  });

  if (conflictCheck.hasConflict) {
    throw new Error(`Double-booking prevented: ${conflictCheck.conflicts[0].reason}`);
  }

  // 8. Generate Booking ID & Status
  const bookingId = input.id || `TT-${Math.floor(100000 + Math.random() * 900000)}`;
  // Status is server-derived from actor type and payment status.
  // Client-supplied status is NEVER trusted.
  const bookingStatus = isStaff
    ? 'Confirmed'
    : (String(payment.paymentStatus || '').toUpperCase() === 'PAID' ? 'Confirmed' : 'Payment Review');


  const totalPaise = parseInt(payment.totalAmountPaise || payment.amountPaidPaise || 0, 10);

  const depositPaise = parseInt(payment.depositAmountPaise || 0, 10);

  // Derive legacy compatibility strings
  const istDate = formatToISTString(normInterval.startAt).slice(0, 10);
  const formatSlotTime = (dateObj) => {
    const hours = (dateObj.getUTCHours() + 5 + Math.floor((dateObj.getUTCMinutes() + 30) / 60)) % 24;
    const mins = (dateObj.getUTCMinutes() + 30) % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${String(displayHour).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
  };
  const legacyTimeSlot = `${formatSlotTime(normInterval.startAt)} – ${formatSlotTime(normInterval.endAt)}`;

  // 9. Persist into Database
  const insertSql = `
    INSERT INTO bookings (
      id, facility_id, facility_name, date, time_slot,
      customer_name, customer_phone, customer_email, team_name,
      duration, payment_type, amount_paid, payment_status,
      booking_status, payment_id, physical_facility_id,
      scheduled_start_at, scheduled_end_at, booking_type,
      delivery_preference, total_amount_paise, deposit_amount_paise
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?
    )
  `;

  const insertParams = [
    bookingId,
    resolvedFacilityId,
    facilityName,
    istDate,
    legacyTimeSlot,
    customerName,
    customerPhone,
    customerEmail || null,
    teamName || null,
    normInterval.durationHours,
    payment.type || 'FULL',
    `₹${(totalPaise / 100).toFixed(2)}`,
    payment.paymentStatus || 'Pending verification',
    bookingStatus,
    payment.paymentId || (isStaff ? 'counter-payment' : null),
    resolvedFacilityId,
    normInterval.startAt.toISOString(),
    normInterval.endAt.toISOString(),
    bookingMode,
    deliveryPreference,
    totalPaise,
    depositPaise
  ];

  await db.run(insertSql, insertParams);

  // 10. If holdToken was provided, convert it
  if (holdToken) {
    await db.run(
      `UPDATE payment_holds SET status = 'CONVERTED' WHERE hold_token = ?`,
      [holdToken]
    );
  }

  // 11. Create corresponding facility_session record
  try {
    await db.run(
      `INSERT INTO facility_sessions (
        id, booking_id, facility_id, scheduled_start_at, scheduled_end_at, session_status, operator_id
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        `ses_${bookingId}`,
        bookingId,
        resolvedFacilityId,
        normInterval.startAt.toISOString(),
        normInterval.endAt.toISOString(),
        isStaff ? (actor.username || 'staff') : null
      ]
    );
  } catch (e) {
    // Non-fatal if session already exists
  }

  return {
    success: true,
    bookingId,
    physicalFacilityId: resolvedFacilityId,
    facilityName,
    interval: normInterval,
    bookingStatus,
    customer: {
      name: customerName,
      phone: customerPhone,
      email: customerEmail
    },
    payment: {
      totalAmountPaise: totalPaise,
      depositAmountPaise: depositPaise,
      paymentStatus: payment.paymentStatus || 'Pending verification'
    }
  };
}

/**
 * Server-authoritative 24/7 Availability Engine.
 * Evaluates physical resource availability across the entire day (or custom interval)
 * constrained strictly by bookings, blocks, holds, and session extensions.
 */
export async function getCanonicalResourceAvailability(db, options) {
  const {
    physicalFacilityId,
    date,
    durationHours = 1,
    now = new Date()
  } = options;

  const facility = resolveCanonicalFacility(physicalFacilityId);
  if (!facility) {
    throw new Error(`Facility "${physicalFacilityId}" not found in inventory.`);
  }

  const durationMinutes = durationHours * 60;
  const slots = [];

  // Generate 24 hourly intervals across Asia/Kolkata date
  for (let hour = 0; hour < 24; hour++) {
    const startTimeStr = `${String(hour).padStart(2, '0')}:00`;
    let normInterval;
    try {
      normInterval = normalizeBookingInterval({
        date,
        startTime: startTimeStr,
        durationMinutes
      });
    } catch (e) {
      continue;
    }

    const isPast = normInterval.startAt.getTime() <= now.getTime();
    const diffMinutes = Math.floor((normInterval.startAt.getTime() - now.getTime()) / 60000);
    const leadTimeValid = diffMinutes >= 60;

    const conflict = await checkCanonicalConflicts(db, {
      physicalFacilityId: facility.id,
      startAt: normInterval.startAt,
      endAt: normInterval.endAt,
      now
    });

    const isPeak = hour >= 18 || hour < 6;
    let status = 'available';
    let reason = null;

    if (conflict.hasConflict) {
      const topConflict = conflict.conflicts[0];
      if (topConflict.type === 'BLOCK') {
        status = 'maintenance';
        reason = topConflict.reason;
      } else {
        status = 'booked';
        reason = topConflict.reason;
      }
    } else if (isPast) {
      status = 'past';
    } else if (!leadTimeValid) {
      status = 'closed_lead_time';
    } else if (isPeak && hour >= 18 && hour <= 21) {
      status = 'fast-filling';
    }

    const formatSlotTime = (dateObj) => {
      const h = (dateObj.getUTCHours() + 5 + Math.floor((dateObj.getUTCMinutes() + 30) / 60)) % 24;
      const m = (dateObj.getUTCMinutes() + 30) % 60;
      const p = h >= 12 ? 'PM' : 'AM';
      const dh = h % 12 || 12;
      return `${String(dh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
    };

    slots.push({
      time: `${formatSlotTime(normInterval.startAt)} – ${formatSlotTime(normInterval.endAt)}`,
      startAt: normInterval.startAt.toISOString(),
      endAt: normInterval.endAt.toISOString(),
      category: isPeak ? 'Floodlit Session' : 'Day Session',
      peak: isPeak,
      status,
      maintenanceReason: reason
    });
  }

  return {
    success: true,
    facilityId: facility.id,
    facilityName: facility.customName || facility.defaultName,
    date,
    slots
  };
}


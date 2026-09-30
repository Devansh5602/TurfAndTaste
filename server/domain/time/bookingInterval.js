/**
 * Canonical Booking Interval Engine
 * 
 * Enforces unambiguous timezone-aware intervals in Asia/Kolkata (IST, UTC+05:30).
 * Interval Semantics: Half-open [start_at, end_at)
 * - start_at is INCLUSIVE
 * - end_at is EXCLUSIVE
 * Cross-midnight bookings (e.g. 23:00 to 01:00 next day) are fully supported and preserve date rollover.
 */

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET_MINUTES = 330; // +05:30

/**
 * Format a Date object to an ISO 8601 string with explicit +05:30 offset.
 */
export function formatToISTString(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid Date passed to formatToISTString');
  }
  // Convert UTC time to IST by adding offset
  const istTime = new Date(d.getTime() + IST_OFFSET_MINUTES * 60000);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  const hours = String(istTime.getUTCHours()).padStart(2, '0');
  const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
}

/**
 * Parses a civil date string (YYYY-MM-DD) and civil time (HH:MM or HH:MM AM/PM)
 * into a canonical Date object (UTC instant) assuming Asia/Kolkata context.
 */
export function parseCivilTimeToInstant(dateStr, timeStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format (expected YYYY-MM-DD): "${dateStr}"`);
  }

  let hours = 0;
  let minutes = 0;

  const match12 = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const match24 = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})$/);

  if (match12) {
    hours = parseInt(match12[1], 10);
    minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  } else if (match24) {
    hours = parseInt(match24[1], 10);
    minutes = parseInt(match24[2], 10);
  } else {
    throw new Error(`Invalid time format (expected "HH:MM" or "HH:MM AM/PM"): "${timeStr}"`);
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Time values out of bounds: ${hours}:${minutes}`);
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  // Construct UTC timestamp by subtracting IST offset (5h 30m)
  const utcMillis = Date.UTC(y, m - 1, d, hours, minutes, 0) - (IST_OFFSET_MINUTES * 60000);
  return new Date(utcMillis);
}

/**
 * Normalizes a booking request into a canonical interval [start_at, end_at).
 * Supports:
 * 1) Explicit ISO timestamps: { startAt, endAt }
 * 2) Date + start time + duration in minutes: { date, startTime, durationMinutes }
 * 3) Date + legacy slot string (e.g. "11:00 PM – 01:00 AM"): { date, timeSlot }
 */
export function normalizeBookingInterval(input) {
  if (!input) throw new Error('normalizeBookingInterval requires input options');

  let startDate;
  let endDate;

  if (input.startAt && input.endAt) {
    startDate = new Date(input.startAt);
    endDate = new Date(input.endAt);
  } else if (input.date && input.startTime && input.durationMinutes) {
    startDate = parseCivilTimeToInstant(input.date, input.startTime);
    endDate = new Date(startDate.getTime() + input.durationMinutes * 60000);
  } else if (input.date && input.timeSlot) {
    const parts = String(input.timeSlot).split(/[–—-]/).map(s => s.trim());
    if (parts.length !== 2) {
      throw new Error(`Invalid timeSlot range format: "${input.timeSlot}"`);
    }
    startDate = parseCivilTimeToInstant(input.date, parts[0]);
    // Parse end time on same date first
    const provisionalEnd = parseCivilTimeToInstant(input.date, parts[1]);
    if (provisionalEnd.getTime() <= startDate.getTime()) {
      // Midnight rollover: end time is on the next calendar day
      endDate = new Date(provisionalEnd.getTime() + 24 * 3600 * 1000);
    } else {
      endDate = provisionalEnd;
    }
  } else {
    throw new Error('Unsupported interval specification for normalizeBookingInterval');
  }

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid dates generated in interval normalization');
  }

  if (startDate.getTime() >= endDate.getTime()) {
    throw new Error(`Invalid interval: start_at (${startDate.toISOString()}) must be strictly earlier than end_at (${endDate.toISOString()})`);
  }

  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

  return {
    startAt: startDate,
    endAt: endDate,
    startAtISO: formatToISTString(startDate),
    endAtISO: formatToISTString(endDate),
    durationMinutes,
    durationHours: durationMinutes / 60,
    isCrossMidnight: new Date(startDate.getTime() + IST_OFFSET_MINUTES * 60000).getUTCDate() !==
                     new Date(endDate.getTime() - 1 + IST_OFFSET_MINUTES * 60000).getUTCDate()
  };
}

/**
 * Checks if two half-open intervals [a.start, a.end) and [b.start, b.end) overlap.
 * Touching boundaries (e.g. 18:00–19:00 and 19:00–20:00) do NOT overlap.
 */
export function intervalsOverlap(intervalA, intervalB) {
  const aStart = new Date(intervalA.startAt || intervalA.start).getTime();
  const aEnd = new Date(intervalA.endAt || intervalA.end).getTime();
  const bStart = new Date(intervalB.startAt || intervalB.start).getTime();
  const bEnd = new Date(intervalB.endAt || intervalB.end).getTime();

  return aStart < bEnd && aEnd > bStart;
}

/**
 * Extracts the IST minute of the hour (0, 15, 30, 45, etc.) from an instant.
 */
export function getISTMinutes(date) {
  const istTime = new Date(new Date(date).getTime() + IST_OFFSET_MINUTES * 60000);
  return istTime.getUTCMinutes();
}

/**
 * Extracts the IST hour (0-23) from an instant.
 */
export function getISTHours(date) {
  const istTime = new Date(new Date(date).getTime() + IST_OFFSET_MINUTES * 60000);
  return istTime.getUTCHours();
}

/**
 * Turf & Taste — Server-Authoritative Pricing Resolver
 *
 * Resolves a canonical pricing quote for a given facility + time interval.
 * Called by the Admin walk-in booking route; the resolved quote is the only
 * authoritative source of amount for walk-in bookings. Client-supplied amounts
 * are NOT accepted.
 *
 * Business rules (from docs/domain/PRICING_ENGINE.md):
 *  - Day rate applies from 06:00 AM to the configured floodlight_start time.
 *  - Night (floodlit) rate applies from floodlight_start to 06:00 AM.
 *  - Weekend surge is applied as a percentage on top of the base rate.
 *  - Token deposit is the lesser of the configured deposit amount or deposit_pct of total.
 *  - All monetary values are returned in paise (1/100 ₹).
 */

import { normalizeBookingInterval, getISTMinutes } from '../time/bookingInterval.js';

const IST_OFFSET_MINUTES = 330; // UTC+5:30

/** Convert a UTC Date to Asia/Kolkata minutes-since-midnight. */
const toISTMinutesOfDay = (date) => {
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (utcMin + IST_OFFSET_MINUTES) % 1440;
};

/** Parse "HH:MM AM/PM" string to minutes-since-midnight. */
const parseTime12h = (str) => {
  const match = String(str || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2]);
  if (match[3].toUpperCase() === 'PM' && h < 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

/** Returns 0 (Sun) – 6 (Sat) for a YYYY-MM-DD date in IST. */
const istDayOfWeek = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  // Advance by IST offset to get the correct calendar date in IST
  const istMs = d.getTime() + IST_OFFSET_MINUTES * 60000;
  return new Date(istMs).getUTCDay();
};

/**
 * Resolve a server-authoritative pricing quote for a walk-in booking.
 *
 * @param {object} db - dbAsync or transaction client
 * @param {object} opts
 * @param {string} opts.facilityId - canonical physical facility id
 * @param {string} opts.date       - YYYY-MM-DD booking date (IST)
 * @param {string} opts.timeSlot   - "HH:MM AM – HH:MM PM" legacy slot string
 * @param {number} opts.durationHours - booking duration in whole hours
 * @param {string} opts.paymentType   - 'full' | 'deposit'
 *
 * @returns {object} { totalAmountPaise, depositAmountPaise, dayRate, nightRate,
 *                     weekendSurgePercent, isNight, isWeekend,
 *                     facilityId, durationHours, breakdown }
 */
export async function resolveAdminWalkInPricing(db, opts) {
  const { facilityId, date, timeSlot, durationHours = 1, paymentType = 'full' } = opts;

  // 1. Load persisted pricing tier for this facility
  const tier = await db.get(
    'SELECT * FROM pricing_tiers WHERE facility_id = ?',
    [facilityId]
  );

  // 2. Load floodlight start from timings table (default 06:00 PM = 1080 min)
  const timings = await db.get('SELECT floodlight_start FROM timings WHERE id = 1');
  const floodlightStartMinutes = parseTime12h(timings?.floodlight_start) ?? 1080;

  // 3. Base rates (from tier or canonical defaults)
  const dayRatePer1h = tier ? Math.round(Number(tier.day_rate) || 800) : 800;
  const nightRatePer1h = tier ? Math.round(Number(tier.night_rate) || 1200) : 1200;
  const weekendSurgePercent = tier ? Math.round(Number(tier.weekend_surge) || 0) : 0;
  const depositFixedAmount = tier ? Math.round(Number(tier.deposit_pct) || 400) : 400;

  // 4. Determine whether slot is Day or Night (Floodlit)
  //    Use start time of the slot to determine the rate tier.
  let slotStartIST = null;
  if (timeSlot) {
    const norm = normalizeBookingInterval({ date, timeSlot });
    slotStartIST = toISTMinutesOfDay(norm.startAt);
  }
  const isNight = slotStartIST !== null
    ? (slotStartIST >= floodlightStartMinutes || slotStartIST < 360) // 06:00 PM – 06:00 AM
    : false;

  // 5. Determine weekend
  const dayOfWeek = istDayOfWeek(date);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // 6. Calculate base hourly rate
  const baseRatePer1h = isNight ? nightRatePer1h : dayRatePer1h;

  // 7. Apply weekend surge
  const surgedRatePer1h = isWeekend
    ? Math.round(baseRatePer1h * (1 + weekendSurgePercent / 100))
    : baseRatePer1h;

  // 8. Total for duration
  const totalAmount = surgedRatePer1h * Math.max(1, Math.round(durationHours));
  const totalAmountPaise = totalAmount * 100;

  // 9. Deposit calculation
  //    depositFixedAmount stored in pricing_tiers.deposit_pct column holds the ₹ amount.
  //    Use the configured fixed deposit or fall back to 50% of total, whichever is less.
  const configuredDeposit = depositFixedAmount;
  const halfTotal = Math.round(totalAmount / 2);
  const depositAmount = Math.min(configuredDeposit, halfTotal);
  const depositAmountPaise = depositAmount * 100;

  return {
    facilityId,
    durationHours,
    isNight,
    isWeekend,
    dayRate: dayRatePer1h,
    nightRate: nightRatePer1h,
    weekendSurgePercent,
    baseRatePer1h,
    surgedRatePer1h,
    totalAmountPaise,
    depositAmountPaise,
    paymentType,
    chargedAmountPaise: paymentType === 'full' ? totalAmountPaise : depositAmountPaise,
    breakdown: {
      hours: durationHours,
      ratePerHour: surgedRatePer1h,
      surgeApplied: isWeekend ? weekendSurgePercent : 0,
      sessionType: isNight ? 'Floodlit (Night)' : 'Day Session',
      depositAmount,
      totalAmount,
    },
  };
}

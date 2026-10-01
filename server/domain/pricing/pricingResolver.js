/**
 * Turf & Taste — Canonical Pricing Resolver
 *
 * Resolves a server-authoritative pricing quote from configurable database rules.
 * All monetary amounts are returned in paise (integer). Display conversion is
 * the client's responsibility and must never be reparsed as an authoritative amount.
 *
 * Precedence (highest → lowest, from PRICING_ENGINE.md §2):
 *   [1] special_date_prices  — date-specific override (replacement or modifier)
 *   [2] pricing_rules PACKAGE — multi-hour discounted package (replaces subtotal)
 *   [3] pricing_rules BASE_RATE — per-segment day/night/weekend hourly rate
 *   [4] add_on_prices — surcharges per selected add-on
 *   [5] pricing_tiers — legacy flat-rate fallback (used only if no rule rows exist)
 *
 * Interval-boundary pricing:
 *   When a booking crosses the floodlight start boundary, the resolver prices
 *   each segment (day portion + night portion) independently before combining.
 *   A single start-time does not determine the rate for the entire duration.
 *
 * All functions accept a `db` that may be a transaction client (from
 * dbAsync.withTransaction) or the top-level dbAsync singleton.
 */

import { normalizeBookingInterval } from '../time/bookingInterval.js';

const IST_OFFSET_MINUTES = 330; // UTC+5:30

/** Convert a UTC ISO string or Date to Asia/Kolkata minutes-since-midnight. */
function toISTMinutesOfDay(dateOrIso) {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (utcMin + IST_OFFSET_MINUTES) % 1440;
}

/** Parse "HH:MM AM/PM" string to minutes-since-midnight. Returns null if unparseable. */
function parseTime12h(str) {
  const match = String(str || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2]);
  if (match[3].toUpperCase() === 'PM' && h < 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

/** Returns 0 (Sun) – 6 (Sat) for a YYYY-MM-DD date resolved in IST. */
function istDayOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return new Date(d.getTime() + IST_OFFSET_MINUTES * 60000).getUTCDay();
}

/** Returns true if the day is Saturday (6) or Sunday (0). */
function isWeekendDate(dateStr) {
  const dow = istDayOfWeek(dateStr);
  return dow === 0 || dow === 6;
}

/**
 * Resolve the applicable period_type for a given IST minute-of-day.
 * Returns 'NIGHT' or 'WEEKEND_NIGHT' when past the floodlight boundary.
 */
function resolvePeriodType(istMinutes, isWeekend, floodlightStart) {
  // Night: from floodlight start through 06:00 AM (minutes 0–360)
  const isNight = istMinutes >= floodlightStart || istMinutes < 360;
  if (isWeekend) return isNight ? 'WEEKEND_NIGHT' : 'WEEKEND_DAY';
  return isNight ? 'NIGHT' : 'DAY';
}

/**
 * Split a booking interval [startIST, endIST] (in minutes-since-midnight)
 * at the floodlight boundary. Returns an array of {periodType, minutes} segments.
 *
 * Handles cross-midnight bookings via modular arithmetic.
 */
function segmentByPeriod(startIST, totalMinutes, isWeekend, floodlightStart) {
  const segments = [];
  let remaining = totalMinutes;
  let cursor = startIST;

  while (remaining > 0) {
    const periodType = resolvePeriodType(cursor % 1440, isWeekend, floodlightStart);

    // How many minutes until the next period boundary?
    const isNight = (cursor % 1440) >= floodlightStart || (cursor % 1440) < 360;
    let minutesUntilBoundary;
    if (isNight) {
      // Night ends at 06:00 AM (360 min)
      const dawn = 360;
      const cursorMod = cursor % 1440;
      minutesUntilBoundary = cursorMod < dawn
        ? dawn - cursorMod
        : 1440 - cursorMod + dawn;
    } else {
      // Day ends at floodlightStart
      const cursorMod = cursor % 1440;
      minutesUntilBoundary = floodlightStart - cursorMod;
    }

    const segmentMinutes = Math.min(remaining, minutesUntilBoundary);
    segments.push({ periodType, minutes: segmentMinutes });
    cursor += segmentMinutes;
    remaining -= segmentMinutes;
  }

  return segments;
}

/**
 * Load all active pricing_rules for a facility from the database.
 * Indexed by rule_type:period_type for fast lookup.
 */
async function loadPricingRules(db, facilityId, serviceId) {
  try {
    const rows = await db.all(
      `SELECT * FROM pricing_rules
       WHERE facility_id = ?
         AND (service_id IS NULL OR service_id = ?)
         AND is_active = ${db.isPostgres ? 'TRUE' : '1'}
       ORDER BY service_id DESC`,
      [facilityId, serviceId || '']
    );
    return rows || [];
  } catch {
    return [];
  }
}

/**
 * Load the special-date price for a specific calendar_date, if any.
 */
async function loadSpecialDatePrice(db, facilityId, date, serviceId) {
  try {
    const row = await db.get(
      `SELECT * FROM special_date_prices
       WHERE facility_id = ?
         AND calendar_date = ?
         AND (service_id IS NULL OR service_id = ?)
         AND is_active = ${db.isPostgres ? 'TRUE' : '1'}
       LIMIT 1`,
      [facilityId, date, serviceId || '']
    );
    return row || null;
  } catch {
    return null;
  }
}

/**
 * Load the legacy pricing tier for a facility (fallback only).
 */
async function loadLegacyTier(db, facilityId) {
  try {
    return await db.get(
      'SELECT * FROM pricing_tiers WHERE facility_id = ?',
      [facilityId]
    ) || null;
  } catch {
    return null;
  }
}

/**
 * Load add-on prices for the specified add-on IDs.
 * Returns an array of { add_on_id, rate_paise_per_hour, rate_paise_flat }.
 */
async function loadAddOnPrices(db, facilityId, addOnIds) {
  if (!Array.isArray(addOnIds) || addOnIds.length === 0) return [];
  try {
    const rows = await db.all(
      `SELECT * FROM add_on_prices
       WHERE add_on_id IN (${addOnIds.map(() => '?').join(',')})
         AND (facility_id IS NULL OR facility_id = ?)
         AND is_active = ${db.isPostgres ? 'TRUE' : '1'}`,
      [...addOnIds, facilityId]
    );
    return rows || [];
  } catch {
    return [];
  }
}

/**
 * Find the applicable BASE_RATE rule for a period type.
 * Falls back through: service-specific → facility-generic.
 */
function findBaseRuleForPeriod(rules, periodType) {
  return rules.find(r => r.rule_type === 'BASE_RATE' && r.period_type === periodType) || null;
}

/**
 * Find the best applicable PACKAGE rule for the total duration.
 * Returns the package that covers exactly or all matching durations,
 * choosing the one with the lowest total price (best for customer).
 */
function findPackageRule(rules, totalHours) {
  const candidates = rules.filter(r =>
    r.rule_type === 'PACKAGE' &&
    r.min_hours <= totalHours &&
    (r.max_hours === 0 || r.max_hours >= totalHours)
  );
  if (candidates.length === 0) return null;
  // Pick the package with the lowest configured total rate (most generous)
  return candidates.reduce((best, c) =>
    c.rate_paise_total < best.rate_paise_total ? c : best
  );
}

/**
 * Find the EXTENSION_RATE rule applicable to a period type.
 */
function findExtensionRateRule(rules, periodType) {
  return rules.find(r => r.rule_type === 'EXTENSION_RATE' && r.period_type === periodType) || null;
}

/**
 * Resolve the deposit amount from rules or legacy tier.
 *
 * Precedence:
 *   [1] If applicable BASE_RATE rule has deposit_fixed_paise > 0, use it.
 *   [2] If applicable rule has deposit_pct_of_total > 0, compute percent of total.
 *   [3] If legacy tier exists, deposit_pct column is treated as a fixed ₹ amount (→ paise).
 *   [4] Fallback: 30% of total.
 *
 * Deposit is always ≤ total amount.
 */
function resolveDeposit(totalAmountPaise, applicableRule, legacyTier) {
  if (applicableRule) {
    if (applicableRule.deposit_fixed_paise > 0) {
      return Math.min(applicableRule.deposit_fixed_paise, totalAmountPaise);
    }
    if (applicableRule.deposit_pct_of_total > 0) {
      return Math.min(
        Math.round(totalAmountPaise * applicableRule.deposit_pct_of_total / 100),
        totalAmountPaise
      );
    }
  }
  if (legacyTier) {
    // deposit_pct column is historically stored as a fixed ₹ rupee amount
    const depositRupees = Math.round(Number(legacyTier.deposit_pct) || 0);
    if (depositRupees > 0) {
      return Math.min(depositRupees * 100, totalAmountPaise);
    }
  }
  // Fallback: 30% of total
  return Math.min(Math.round(totalAmountPaise * 0.30), totalAmountPaise);
}

/**
 * Main entry point: resolve a canonical pricing quote.
 *
 * @param {object} db - dbAsync or withTransaction client
 * @param {object} opts
 * @param {string}   opts.facilityId     - physical facility ID
 * @param {string|null} opts.serviceId   - service ID (optional)
 * @param {string[]}  opts.addOnIds      - selected add-on IDs (default [])
 * @param {string}   opts.date           - YYYY-MM-DD in IST
 * @param {string}   opts.timeSlot       - "HH:MM AM – HH:MM PM" or null
 * @param {string|null} opts.startAt     - ISO UTC start (alternative to timeSlot)
 * @param {string|null} opts.endAt       - ISO UTC end (alternative to timeSlot)
 * @param {number}   opts.durationHours  - booking duration in whole hours
 * @param {string}   opts.paymentType    - 'full' | 'deposit'
 *
 * @returns {object} canonical quote with breakdown
 */
export async function resolvePricing(db, opts) {
  const {
    facilityId,
    serviceId = null,
    addOnIds = [],
    date,
    timeSlot = null,
    startAt = null,
    endAt = null,
    durationHours = 1,
    paymentType = 'full',
  } = opts;

  if (!facilityId || !date) {
    throw new Error('facilityId and date are required for pricing resolution.');
  }

  const hours = Math.max(1, Math.round(Number(durationHours)));

  // ── Resolve start time in IST minutes ──────────────────────────────────────
  let startIST = null;
  let normStartAt = null;
  let normEndAt = null;

  if (timeSlot) {
    const norm = normalizeBookingInterval({ date, timeSlot });
    normStartAt = norm.startAt;
    normEndAt = norm.endAt;
    startIST = toISTMinutesOfDay(norm.startAt);
  } else if (startAt) {
    normStartAt = new Date(startAt);
    normEndAt = endAt ? new Date(endAt) : new Date(normStartAt.getTime() + hours * 3600000);
    startIST = toISTMinutesOfDay(normStartAt);
  }

  const isWeekend = isWeekendDate(date);

  // ── Load config from DB ─────────────────────────────────────────────────────
  const timings = await db.get('SELECT floodlight_start FROM timings WHERE id = 1');
  const floodlightStart = parseTime12h(timings?.floodlight_start) ?? 1080; // default 06:00 PM

  const [rules, specialDate, legacyTier, addOnPrices] = await Promise.all([
    loadPricingRules(db, facilityId, serviceId),
    loadSpecialDatePrice(db, facilityId, date, serviceId),
    loadLegacyTier(db, facilityId),
    loadAddOnPrices(db, facilityId, addOnIds),
  ]);

  // ── Applied rules log (for transparent breakdown) ─────────────────────────
  const appliedRules = [];
  let baseAmountPaise = 0;
  let packageUsed = false;
  let primaryRule = null;

  // ── [1] Special-date override (highest precedence) ─────────────────────────
  if (specialDate && specialDate.rate_paise_per_hour > 0) {
    const rate = specialDate.rate_paise_per_hour;
    baseAmountPaise = rate * hours;
    primaryRule = { type: 'SPECIAL_DATE', rate, label: specialDate.label || 'Special Date' };
    appliedRules.push({
      type: 'SPECIAL_DATE',
      label: specialDate.label || 'Special Date',
      ratePerHour: rate,
      hours,
      amountPaise: baseAmountPaise,
    });
  }

  // ── [2] Package rule (replaces per-segment subtotal) ──────────────────────
  if (!specialDate || !specialDate.is_replacement) {
    const packageRule = findPackageRule(rules, hours);
    if (packageRule) {
      const packageTotal = packageRule.rate_paise_total;
      if (packageTotal > 0) {
        baseAmountPaise = packageTotal;
        packageUsed = true;
        primaryRule = { type: 'PACKAGE', rule: packageRule };
        appliedRules.push({
          type: 'PACKAGE',
          ruleId: packageRule.id,
          hours,
          amountPaise: packageTotal,
        });
      }
    }
  }

  // ── [3] Segment-based hourly pricing ──────────────────────────────────────
  // Used when no special-date or package applies.
  if (!specialDate && !packageUsed) {
    if (startIST !== null && rules.length > 0) {
      // Price each segment (day/night, crossing boundary if needed)
      const segments = segmentByPeriod(startIST, hours * 60, isWeekend, floodlightStart);
      for (const seg of segments) {
        const rule = findBaseRuleForPeriod(rules, seg.periodType);
        if (rule && rule.rate_paise_per_hour > 0) {
          const segAmountPaise = Math.round(rule.rate_paise_per_hour * seg.minutes / 60);
          baseAmountPaise += segAmountPaise;
          appliedRules.push({
            type: 'BASE_RATE',
            ruleId: rule.id,
            periodType: seg.periodType,
            ratePerHour: rule.rate_paise_per_hour,
            minutes: seg.minutes,
            amountPaise: segAmountPaise,
          });
          if (!primaryRule) primaryRule = { type: 'BASE_RATE', rule };
        } else {
          // No rule for this segment — fall through to legacy tier below
          baseAmountPaise = 0;
          appliedRules.length = 0;
          break;
        }
      }
    }

    // Legacy tier fallback when no rules configured or segment had no rule
    if (rules.length === 0 || (appliedRules.length === 0 && baseAmountPaise === 0)) {
      if (legacyTier) {
        const dayRate = Math.round(Number(legacyTier.day_rate) || 0);
        const nightRate = Math.round(Number(legacyTier.night_rate) || 0);
        const weekendSurge = Math.round(Number(legacyTier.weekend_surge) || 0);

        // Use start-time period as simplified fallback (legacy behavior)
        const isNightFallback = startIST !== null
          ? (startIST >= floodlightStart || startIST < 360)
          : false;
        let baseRate = isNightFallback ? nightRate : dayRate;
        if (isWeekend && weekendSurge > 0) {
          baseRate = Math.round(baseRate * (1 + weekendSurge / 100));
        }
        baseAmountPaise = baseRate * 100 * hours;
        appliedRules.push({
          type: 'LEGACY_TIER',
          facilityId,
          ratePerHour: baseRate * 100,
          hours,
          amountPaise: baseAmountPaise,
        });
        primaryRule = { type: 'LEGACY_TIER', tier: legacyTier };
      }
    }
  }

  // ── [4] Add-on surcharges ──────────────────────────────────────────────────
  let addOnAmountPaise = 0;
  for (const aop of addOnPrices) {
    const addOnAmount = aop.rate_paise_flat > 0
      ? aop.rate_paise_flat
      : Math.round(aop.rate_paise_per_hour * hours);
    addOnAmountPaise += addOnAmount;
    appliedRules.push({
      type: 'ADD_ON',
      addOnId: aop.add_on_id,
      ratePerHour: aop.rate_paise_per_hour,
      flat: aop.rate_paise_flat,
      hours,
      amountPaise: addOnAmount,
    });
  }

  const totalAmountPaise = baseAmountPaise + addOnAmountPaise;

  // ── [5] Deposit calculation ────────────────────────────────────────────────
  const depositAmountPaise = resolveDeposit(totalAmountPaise, primaryRule?.rule || null, legacyTier);

  // ── [6] Token cutoff: inside-1-hour walk-in requires full payment ──────────
  // Checked at the call site; paymentType is passed in as resolved by caller.

  const chargedAmountPaise = paymentType === 'full' ? totalAmountPaise : depositAmountPaise;

  // ── Determine display context ──────────────────────────────────────────────
  const activePeriodType = startIST !== null
    ? resolvePeriodType(startIST, isWeekend, floodlightStart)
    : (isWeekend ? 'WEEKEND_DAY' : 'DAY');
  const isNight = activePeriodType === 'NIGHT' || activePeriodType === 'WEEKEND_NIGHT';

  return {
    facilityId,
    serviceId,
    addOnIds,
    date,
    durationHours: hours,
    isNight,
    isWeekend,
    paymentType,
    totalAmountPaise,
    depositAmountPaise,
    chargedAmountPaise,
    appliedRules,
    resolverVersion: '2.0',
    breakdown: {
      baseAmountPaise,
      addOnAmountPaise,
      totalAmountPaise,
      depositAmountPaise,
      chargedAmountPaise,
      periodType: activePeriodType,
      packageUsed,
      specialDateApplied: Boolean(specialDate),
    },
  };
}

/**
 * Resolve extension pricing for a specific session.
 *
 * Precedence:
 *   [1] EXTENSION_RATE rule for the applicable period type
 *   [2] Pro-rated BASE_RATE (15-min slice of the applicable hourly rate)
 *   [3] Legacy tier day/night fallback
 *
 * Returns { chargePaise, rateSource, periodType, minutes }.
 * Staff may still convert a paid extension to a free extension explicitly,
 * which must be persisted with isFree=true and chargePaise=0.
 */
export async function resolveExtensionPricing(db, opts) {
  const {
    facilityId,
    serviceId = null,
    addOnIds = [],
    extensionStartAt,
    extensionMinutes = 15,
  } = opts;

  if (!facilityId || !extensionStartAt) {
    throw new Error('facilityId and extensionStartAt are required for extension pricing.');
  }

  const timings = await db.get('SELECT floodlight_start FROM timings WHERE id = 1');
  const floodlightStart = parseTime12h(timings?.floodlight_start) ?? 1080;

  const extStart = new Date(extensionStartAt);
  const extStartIST = toISTMinutesOfDay(extStart);
  const date = extStart.toISOString().slice(0, 10);
  const isWeekend = isWeekendDate(date);
  const periodType = resolvePeriodType(extStartIST, isWeekend, floodlightStart);

  const [rules, legacyTier] = await Promise.all([
    loadPricingRules(db, facilityId, serviceId),
    loadLegacyTier(db, facilityId),
  ]);

  // [1] Explicit EXTENSION_RATE rule
  const extRule = findExtensionRateRule(rules, periodType)
    || findExtensionRateRule(rules, periodType === 'WEEKEND_NIGHT' ? 'NIGHT' : 'DAY');

  if (extRule && extRule.rate_paise_per_15min > 0) {
    const increments = Math.round(extensionMinutes / 15);
    return {
      chargePaise: extRule.rate_paise_per_15min * increments,
      rateSource: 'EXTENSION_RULE',
      periodType,
      minutes: extensionMinutes,
      ruleId: extRule.id,
    };
  }

  // [2] Pro-rate BASE_RATE rule (15-min slice)
  const baseRule = findBaseRuleForPeriod(rules, periodType);
  if (baseRule && baseRule.rate_paise_per_hour > 0) {
    const increments = Math.round(extensionMinutes / 15);
    const chargePaise = Math.round(baseRule.rate_paise_per_hour * 15 / 60) * increments;
    return {
      chargePaise,
      rateSource: 'BASE_RATE_PRORATED',
      periodType,
      minutes: extensionMinutes,
      ruleId: baseRule.id,
    };
  }

  // [3] Legacy tier fallback
  if (legacyTier) {
    const isNight = periodType === 'NIGHT' || periodType === 'WEEKEND_NIGHT';
    let baseRate = isNight
      ? Math.round(Number(legacyTier.night_rate) || 0)
      : Math.round(Number(legacyTier.day_rate) || 0);
    if (isWeekend) {
      const surge = Math.round(Number(legacyTier.weekend_surge) || 0);
      if (surge > 0) baseRate = Math.round(baseRate * (1 + surge / 100));
    }
    const increments = Math.round(extensionMinutes / 15);
    const chargePaise = Math.round(baseRate * 100 * 15 / 60) * increments;
    return {
      chargePaise,
      rateSource: 'LEGACY_TIER',
      periodType,
      minutes: extensionMinutes,
    };
  }

  return { chargePaise: 0, rateSource: 'NO_RULE', periodType, minutes: extensionMinutes };
}

/**
 * Backward-compatible alias used by Admin walk-in and quote routes.
 * Delegates to the canonical resolvePricing function.
 */
export async function resolveAdminWalkInPricing(db, opts) {
  const result = await resolvePricing(db, {
    facilityId: opts.facilityId,
    serviceId: opts.serviceId || null,
    addOnIds: opts.addOnIds || [],
    date: opts.date,
    timeSlot: opts.timeSlot || null,
    startAt: opts.startAt || null,
    endAt: opts.endAt || null,
    durationHours: opts.durationHours || 1,
    paymentType: opts.paymentType || 'full',
  });

  // Surface the display fields the Admin UI reads directly
  const primaryBaseRule = result.appliedRules.find(r => r.type === 'BASE_RATE' || r.type === 'LEGACY_TIER');
  const surgedRatePer1h = primaryBaseRule
    ? Math.round(primaryBaseRule.ratePerHour / 100)
    : 0;

  return {
    ...result,
    dayRate: 0,
    nightRate: 0,
    weekendSurgePercent: 0,
    baseRatePer1h: surgedRatePer1h,
    surgedRatePer1h,
    breakdown: {
      ...result.breakdown,
      hours: result.durationHours,
      ratePerHour: surgedRatePer1h,
      surgeApplied: result.isWeekend ? 1 : 0,
      sessionType: result.isNight ? 'Floodlit (Night)' : 'Day Session',
      depositAmount: Math.round(result.depositAmountPaise / 100),
      totalAmount: Math.round(result.totalAmountPaise / 100),
    },
  };
}

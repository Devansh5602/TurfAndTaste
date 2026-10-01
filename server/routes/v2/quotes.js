import express from 'express';
import dbAsync from '../../db.js';
import { sendError, sendSuccess } from '../../utils/api.js';
import { createQuoteToken } from '../../utils/quoteToken.js';
import { dayOfWeekForVenueDate, normalizeScheduleClose, slotHasStarted } from '../../utils/venueTime.js';
import { normalizeBookingInterval } from '../../domain/time/bookingInterval.js';
import { checkCanonicalConflicts, resolveCanonicalFacility } from '../../domain/booking/canonicalBookingCommand.js';
import { resolvePricing } from '../../domain/pricing/pricingResolver.js';

const router = express.Router();

const parseTime = (value) => {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hours = Number(match[1]);
  if (match[3].toUpperCase() === 'PM' && hours < 12) hours += 12;
  if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
  return hours * 60 + Number(match[2]);
};

const parseRange = (value) => {
  const parts = String(value || '').split(/[–—-]/).map((part) => part.trim());
  if (parts.length < 2) return null;
  const start = parseTime(parts[0]);
  let end = parseTime(parts[1]);
  if (start === null || end === null) return null;
  if (end <= start) end += 1440;
  return { start, end };
};

router.post('/', async (req, res) => {
  const { facilityId, date, timeSlot, serviceId = null, addOnIds = [] } = req.body || {};
  const requested = parseRange(timeSlot);
  if (!facilityId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || !requested) {
    return sendError(res, 400, 'facilityId, a valid date, and a valid timeSlot are required.');
  }
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return sendError(res, 400, 'Use a real calendar date.');
  }

  let normInterval;
  try {
    normInterval = normalizeBookingInterval({ date, timeSlot });
  } catch (_e) {
    return sendError(res, 400, 'Invalid time slot format.');
  }

  try {
    if (slotHasStarted(date, requested.start)) {
      return sendError(res, 409, 'This time slot has already started or passed at the venue. Please choose a future slot.');
    }

    const canonicalFacility = resolveCanonicalFacility(facilityId);
    const physicalFacilityId = canonicalFacility ? canonicalFacility.id : facilityId;

    let facility = await dbAsync.get(
      "SELECT * FROM facility_profiles WHERE id = ? AND status = 'active' AND booking_enabled = ?",
      [facilityId, dbAsync.isPostgres() ? true : 1],
    );
    if (!facility && canonicalFacility) {
      facility = {
        id: canonicalFacility.id,
        name: canonicalFacility.customName || canonicalFacility.defaultName
      };
    }
    if (!facility) return sendError(res, 404, 'This facility is not currently bookable.');

    const dayOfWeek = dayOfWeekForVenueDate(date);
    let schedule = await dbAsync.get(
      'SELECT * FROM facility_schedules WHERE facility_id = ? AND day_of_week = ? AND is_bookable = ?',
      [facilityId, dayOfWeek, dbAsync.isPostgres() ? true : 1],
    );
    if (!schedule && canonicalFacility) {
      schedule = await dbAsync.get(
        'SELECT * FROM facility_schedules WHERE facility_id = ? AND day_of_week = ? AND is_bookable = ?',
        [canonicalFacility.code, dayOfWeek, dbAsync.isPostgres() ? true : 1]
      ).catch(() => null);
    }
    if (schedule) {
      const scheduleClose = normalizeScheduleClose(schedule.opens_at_minutes, schedule.closes_at_minutes);
      if (requested.start < schedule.opens_at_minutes || requested.end > scheduleClose) {
        return sendError(res, 409, 'The selected time is outside this facility’s operating schedule.');
      }
    }

    // Canonical occupancy & conflict evaluation (confirmed bookings, facility_blocks, session extensions, payment holds)
    const conflictResult = await checkCanonicalConflicts(dbAsync, {
      physicalFacilityId,
      startAt: normInterval.startAt,
      endAt: normInterval.endAt
    });

    if (conflictResult.hasConflict) {
      const blockConflict = conflictResult.conflicts.find(c => c.type === 'BLOCK');
      if (blockConflict) {
        return sendError(res, 409, `This time is unavailable${blockConflict.reason ? `: ${blockConflict.reason}` : '.'}`);
      }
      return sendError(res, 409, 'This time slot has just been reserved. Please choose another slot.');
    }

    // Server-authoritative canonical pricing resolution
    const durationHours = normInterval.durationHours;
    const pricing = await resolvePricing(dbAsync, {
      facilityId: physicalFacilityId,
      serviceId,
      addOnIds,
      date,
      timeSlot,
      startAt: normInterval.startAt,
      endAt: normInterval.endAt,
      durationHours,
      paymentType: 'deposit',
    });

    const total = Math.round(pricing.totalAmountPaise / 100);
    const deposit = Math.round(pricing.depositAmountPaise / 100);

    const quote = {
      quoteId: pricing.quoteId,
      facilityId,
      physicalFacilityId,
      facilityName: facility.name || facility.facilityName || canonicalFacility?.customName || facilityId,
      date,
      timeSlot,
      durationHours,
      ratePeriod: pricing.isNight ? 'peak' : 'day',
      hourlyRate: pricing.appliedRules?.[0]?.ratePerHour ? Math.round(pricing.appliedRules[0].ratePerHour / 100) : 0,
      weekendSurgePercent: pricing.isWeekend ? 20 : 0,
      total,
      deposit,
      totalAmountPaise: pricing.totalAmountPaise,
      depositAmountPaise: pricing.depositAmountPaise,
      chargedAmountPaise: pricing.chargedAmountPaise,
      fullPaymentRequired: pricing.fullPaymentRequired,
      depositAllowed: pricing.depositAllowed,
      appliedRules: pricing.appliedRules,
      breakdown: pricing.breakdown,
      pricingSnapshot: pricing,
      currency: 'INR',
    };

    return sendSuccess(res, { ...quote, quoteToken: createQuoteToken(quote) });
  } catch (error) {
    console.error('[Quote API Error]:', error);
    return sendError(res, 500, 'Unable to calculate a booking quote.');
  }
});

export default router;

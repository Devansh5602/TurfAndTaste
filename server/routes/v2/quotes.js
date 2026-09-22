import express from 'express';
import dbAsync from '../../db.js';
import { sendError, sendSuccess } from '../../utils/api.js';
import { createQuoteToken } from '../../utils/quoteToken.js';

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
const overlaps = (a, b) => a.start < b.end && b.start < a.end;
const numericAmount = (value) => Number(String(value || '').replace(/[^0-9]/g, '')) || 0;

router.post('/', async (req, res) => {
  const { facilityId, date, timeSlot } = req.body || {};
  const requested = parseRange(timeSlot);
  if (!facilityId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || !requested) {
    return sendError(res, 400, 'facilityId, a valid date, and a valid timeSlot are required.');
  }
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return sendError(res, 400, 'Use a real calendar date.');
  }
  try {
    const facility = await dbAsync.get(
      "SELECT * FROM facility_profiles WHERE id = ? AND status = 'active' AND booking_enabled = ?",
      [facilityId, dbAsync.isPostgres() ? true : 1],
    );
    if (!facility) return sendError(res, 404, 'This facility is not currently bookable.');

    const dayOfWeek = parsedDate.getUTCDay();
    const schedule = await dbAsync.get(
      'SELECT * FROM facility_schedules WHERE facility_id = ? AND day_of_week = ? AND is_bookable = ?',
      [facilityId, dayOfWeek, dbAsync.isPostgres() ? true : 1],
    );
    if (!schedule) return sendError(res, 409, 'This facility is closed on the selected day.');
    let scheduleClose = schedule.closes_at_minutes;
    if (scheduleClose <= schedule.opens_at_minutes) scheduleClose += 1440;
    if (requested.start < schedule.opens_at_minutes || requested.end > scheduleClose) {
      return sendError(res, 409, 'The selected time is outside this facility’s operating schedule.');
    }

    const [bookings, blocks] = await Promise.all([
      dbAsync.all("SELECT time_slot FROM bookings WHERE facility_id = ? AND date = ? AND booking_status != 'Cancelled'", [facilityId, date]),
      dbAsync.all('SELECT time_slot, reason FROM blocked_slots WHERE facility_id = ? AND date = ?', [facilityId, date]),
    ]);
    if (bookings.some((booking) => { const range = parseRange(booking.time_slot); return range && overlaps(requested, range); })) {
      return sendError(res, 409, 'This time slot has just been reserved. Please choose another slot.');
    }
    const block = blocks.find((item) => { const range = parseRange(item.time_slot); return range && overlaps(requested, range); });
    if (block) return sendError(res, 409, `This time is unavailable${block.reason ? `: ${block.reason}` : '.'}`);

    const pricing = await dbAsync.get('SELECT * FROM pricing_tiers WHERE facility_id = ?', [facilityId]);
    if (!pricing) return sendError(res, 409, 'Pricing is not configured for this facility.');
    const timings = await dbAsync.get('SELECT floodlight_start FROM timings WHERE id = 1');
    const floodlightStart = parseTime(timings?.floodlight_start) ?? 1080;
    const durationHours = (requested.end - requested.start) / 60;
    const isPeak = requested.start >= floodlightStart;
    const hourlyRate = isPeak ? pricing.night_rate : pricing.day_rate;
    const subtotal = Math.round(hourlyRate * durationHours);
    const weekendMultiplier = [0, 6].includes(dayOfWeek) ? (1 + ((pricing.weekend_surge || 0) / 100)) : 1;
    const total = Math.round(subtotal * weekendMultiplier);
    let details = {};
    try { details = JSON.parse(pricing.details_json || '{}'); } catch {}
    const configuredDeposit = numericAmount(details.bookingDeposit);
    const deposit = configuredDeposit || Math.ceil((total * (pricing.deposit_pct || 0)) / 100);

    const quote = {
      facilityId, facilityName: facility.name, date, timeSlot,
      durationHours, ratePeriod: isPeak ? 'peak' : 'day', hourlyRate,
      weekendSurgePercent: [0, 6].includes(dayOfWeek) ? pricing.weekend_surge || 0 : 0,
      total, deposit: Math.min(deposit, total), currency: 'INR',
    };
    return sendSuccess(res, { ...quote, quoteToken: createQuoteToken(quote) });
  } catch (error) {
    console.error('[Quote API Error]:', error);
    return sendError(res, 500, 'Unable to calculate a booking quote.');
  }
});

export default router;

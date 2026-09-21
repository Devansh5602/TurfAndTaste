/**
 * Turf & Taste - Booking Service
 * Express API & SQLite Database integration for slot availability & reservation submission
 */

import { api } from './api';
import { adminStore } from './adminStore';

// Helper to convert time strings ("06:00 AM", "06:00 PM", "11:30 PM") to minutes from midnight
export const parseTimeToMinutes = (timeStr, fallback = 360) => {
  if (!timeStr) return fallback;
  const cleaned = String(timeStr).trim();
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return fallback;
  let [_, h, m, period] = match;
  let hours = parseInt(h, 10);
  const minutes = parseInt(m, 10);
  if (period.toUpperCase() === 'PM' && hours < 12) hours += 12;
  if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Helper to format minutes from midnight to 12-hour format ("06:00 AM", "09:00 PM")
export const formatMinutesToTime = (totalMinutes) => {
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  let displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;
  const hh = String(displayHours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm} ${period}`;
};

export const generateTimeSlots = (facilityId, selectedDate, duration = 1) => {
  const pricing = adminStore.getFacilityPricing(facilityId);
  const globalTimings = adminStore.getTimings();

  const dayRateNum = pricing.hourlyRateDayNum || 600;
  const nightRateNum = pricing.hourlyRateNightNum || 800;

  // Extract facility-specific assigned timing boundaries
  const daySchedule = pricing.dayHours || '6:00 AM – 6:00 PM';
  const nightSchedule = pricing.nightHours || '6:00 PM – 6:00 AM (Floodlights)';

  // Helper to safely split time ranges by hyphen, en-dash, or em-dash
  const splitRange = (str) => (str || '').split(/[–—-]/).map(s => s.trim());
  const dayParts = splitRange(daySchedule);
  const nightParts = splitRange(nightSchedule);

  // Facility opening time (e.g., 6:00 AM)
  const openTimeMins = parseTimeToMinutes(dayParts[0], parseTimeToMinutes(globalTimings.arenaOpen, 360));

  // Determine transition between Day and Night/Floodlight:
  // First priority: read dayParts[1] (e.g. 6:00 PM in "6:00 AM – 6:00 PM")
  // Second priority: read nightParts[0] (e.g. 6:00 PM in "6:00 PM – 6:00 AM")
  // Fallback: globalTimings.floodlightStart (default 6:00 PM = 1080)
  let dayEndMins = parseTimeToMinutes(dayParts[1], null);
  let nightStartMins = parseTimeToMinutes(nightParts[0], null);

  if (dayEndMins === null && nightStartMins === null) {
    const globalFlood = parseTimeToMinutes(globalTimings.floodlightStart, 1080);
    dayEndMins = globalFlood;
    nightStartMins = globalFlood;
  } else if (dayEndMins === null) {
    dayEndMins = nightStartMins;
  } else if (nightStartMins === null) {
    nightStartMins = dayEndMins;
  }

  // Determine Night End / Facility Close:
  // Read nightParts[1] (e.g. "6:00 AM (Floodlights)" or "11:30 PM")
  const rawNightEnd = parseTimeToMinutes(nightParts[1], parseTimeToMinutes(globalTimings.arenaClose, 360));
  let nightEndMins = rawNightEnd;

  // If night close time is numerically <= night start (e.g. 6:00 AM <= 6:00 PM),
  // it means the venue operates overnight / 24 hours into the next morning (+1440 mins)!
  if (nightEndMins <= nightStartMins) {
    nightEndMins += 1440;
  }

  const durationHours = Math.max(1, Math.min(6, Number(duration) || 1));
  const durationMins = durationHours * 60;

  // Existing reservations for this facility and date
  const existingBookings = (adminStore.getBookings() || []).filter(b => {
    const matchFac = b.facilityId === facilityId || (b.facilitySlug && b.facilitySlug === facilityId);
    const matchDate = b.date === selectedDate;
    const notCancelled = b.status !== 'Cancelled';
    return matchFac && matchDate && notCancelled;
  });

  // Helper to test if a candidate interval overlaps with any existing booking
  const checkIsBooked = (startM, endM) => {
    return existingBookings.some(b => {
      const bTime = b.time || '';
      const parts = splitRange(bTime);
      if (parts.length >= 2) {
        let bStart = parseTimeToMinutes(parts[0]);
        let bEnd = parseTimeToMinutes(parts[1]);
        if (bEnd <= bStart) bEnd += 1440;
        const overlapSameDay = startM < bEnd && endM > bStart;
        const overlapNextDay = (startM >= 1440) && ((startM - 1440) < bEnd && (endM - 1440) > bStart);
        return overlapSameDay || overlapNextDay;
      }
      return false;
    });
  };

  // Build candidate slot start times using an hourly base structure strictly aligned with assigned timings
  const startTimes = [];

  // 1. DAY SESSIONS: Hourly intervals from openTimeMins up to dayEndMins
  // Each slot finishes within the assigned day hours (e.g. 6:00 AM - 6:00 PM)
  for (let t = openTimeMins; t + durationMins <= dayEndMins; t += 60) {
    startTimes.push(t);
  }

  // 2. NIGHT / FLOODLIGHT SESSIONS: Hourly intervals starting at nightStartMins up to nightEndMins (supports overnight / 24hr!)
  for (let t = nightStartMins; t + durationMins <= nightEndMins; t += 60) {
    if (!startTimes.includes(t)) {
      startTimes.push(t);
    }
  }

  // 3. Final Closing Session: If arena closes on a half-hour (e.g., 11:30 PM or 10:30 PM),
  // include the session ending right at closing time so the entire operational window is usable
  const finalStart = nightEndMins - durationMins;
  if (finalStart >= nightStartMins && !startTimes.includes(finalStart)) {
    startTimes.push(finalStart);
  }

  // Sort start times chronologically
  startTimes.sort((a, b) => a - b);

  // Generate slot objects
  return startTimes.map((startM) => {
    const endM = startM + durationMins;
    const timeLabel = `${formatMinutesToTime(startM)} – ${formatMinutesToTime(endM)}`;
    
    // Determine whether this slot is floodlit / night
    const isPeak = startM >= nightStartMins;
    const ratePerHour = isPeak ? nightRateNum : dayRateNum;
    const totalSlotPrice = ratePerHour * durationHours;

    // Categorization
    let category = 'Day Session';
    if (!isPeak) {
      if (startM < 540) { // before 9:00 AM
        category = 'Morning Early';
      } else if (startM < 720) { // 9 AM to 12 PM
        category = 'Morning Prime';
      } else {
        category = 'Afternoon Match';
      }
    } else {
      if (startM >= 1440) { // 12:00 AM to 6:00 AM next day
        category = 'Overnight Floodlit';
      } else if (startM >= 1260) { // 9:00 PM to 12:00 AM
        category = 'Late Night Floodlit';
      } else { // 6:00 PM to 9:00 PM
        category = 'Prime Floodlit';
      }
    }

    const isBooked = checkIsBooked(startM, endM);
    // Dynamic status indicator: fast-filling for prime evening slots (6 PM to 9 PM)
    const isPrimeEvening = isPeak && startM >= 1080 && startM < 1260;
    const status = isBooked ? 'booked' : isPrimeEvening ? 'fast-filling' : 'available';

    return {
      time: timeLabel,
      startMinutes: startM,
      endMinutes: endM,
      category,
      duration: durationHours,
      price: `₹${totalSlotPrice}`,
      totalPriceNum: totalSlotPrice,
      hourlyRateStr: `₹${ratePerHour}`,
      hourlyRateNum: ratePerHour,
      peak: isPeak,
      status
    };
  });
};

export const fetchRealTimeSlots = async (facilityId, selectedDate, duration = 1) => {
  const generatedSlots = generateTimeSlots(facilityId, selectedDate, duration);
  try {
    const res = await api.getSlotAvailability(facilityId, selectedDate, duration);
    if (res.success && res.slots) {
      const serverSlots = new Map(res.slots.map(slot => [slot.time, slot]));
      const slots = generatedSlots.map(slot => {
        const serverSlot = serverSlots.get(slot.time);
        return serverSlot
          ? { ...slot, status: serverSlot.status, maintenanceReason: serverSlot.maintenanceReason }
          : slot;
      });
      return { slots, isLive: true };
    }
  } catch (e) {
    console.warn('Using offline slots generator:', e);
  }
  return { slots: generatedSlots, isLive: false };
};

export const submitBookingReservation = async (bookingPayload) => {
  const bookingReference = bookingPayload.id || `TT-${Math.floor(100000 + Math.random() * 900000)}`;

  const formattedPayload = {
    id: bookingReference,
    facilityId: bookingPayload.facilityId,
    facilityName: bookingPayload.facilityName || bookingPayload.facilityId,
    date: bookingPayload.date,
    time: bookingPayload.slot?.time || 'Custom Slot',
    customerName: bookingPayload.customer?.name || 'Guest Player',
    customerPhone: bookingPayload.customer?.phone || 'N/A',
    customerEmail: bookingPayload.customer?.email || 'N/A',
    teamName: bookingPayload.customer?.teamName || '',
    duration: bookingPayload.duration || 1,
    paymentType: bookingPayload.paymentType || 'deposit',
    amount: bookingPayload.amount || (bookingPayload.paymentType === 'full' ? 'Full Paid' : 'Token Deposit'),
    paymentStatus: bookingPayload.paymentStatus || 'Pending',
    paymentId: bookingPayload.paymentId || '',
    status: bookingPayload.status || 'Confirmed',
    createdAt: new Date().toISOString()
  };

  const apiRes = await api.createBooking(formattedPayload);
  if (!apiRes.success) {
    throw new Error(apiRes.error || 'The reservation could not be saved. Please try again.');
  }

  return {
    success: true,
    bookingReference: apiRes.bookingReference || bookingReference,
    timestamp: new Date().toISOString(),
    details: bookingPayload,
    message: 'Slot reservation recorded in the arena database.'
  };
};

export const fetchCustomerBookingHistory = async (phoneOrEmail) => {
  try {
    const isEmail = phoneOrEmail.includes('@');
    const res = await api.getBookingHistory({
      phone: isEmail ? '' : phoneOrEmail,
      email: isEmail ? phoneOrEmail : ''
    });
    if (res.success && res.history) {
      return res.history;
    }
  } catch (e) {
    console.warn('Could not fetch online booking history:', e);
  }
  
  // Local fallback filter
  const allBookings = adminStore.getBookings();
  const search = phoneOrEmail.trim().toLowerCase();
  return allBookings.filter(b => 
    (b.customerPhone && b.customerPhone.includes(search)) ||
    (b.customerEmail && b.customerEmail.toLowerCase().includes(search))
  );
};

// Dynamic server-authoritative and client-synchronized time scheduler
// Uses Asia/Kolkata (IST) civil time for all booking evaluations.

export const VENUE_TIME_ZONE = 'Asia/Kolkata';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VENUE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const CANONICAL_BOTTOM_NAV = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'facilities', label: 'Venues', path: '/facilities' },
  { id: 'dining', label: 'Dining', path: '/dining' },
  { id: 'events', label: 'Events', path: '/events' },
  { id: 'profile', label: 'Profile', path: '/profile' },
];

export function getVenueNow(now = new Date()) {
  const parts = Object.fromEntries(
    formatter.formatToParts(now)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value])
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const monthIdx = Number(parts.month) - 1;
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;

  return {
    date: dateStr,
    dateString: dateStr,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    dayOfWeek: weekday < 0 ? 0 : weekday,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dayName: parts.weekday,
    monthName: monthNames[monthIdx] || 'Sep',
  };
}

export function generateBookingDays(count = 5, now = new Date()) {
  const current = getVenueNow(now);
  const baseMidnight = new Date(`${current.date}T12:00:00+05:30`);
  const days = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(baseMidnight.getTime() + i * 24 * 60 * 60 * 1000);
    const parts = Object.fromEntries(
      formatter.formatToParts(d)
        .filter(({ type }) => type !== 'literal')
        .map(({ type, value }) => [type, value])
    );
    const dateString = `${parts.year}-${parts.month}-${parts.day}`;
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    const monthIdx = Number(parts.month) - 1;
    const dayNum = String(Number(parts.day));

    days.push({
      index: i,
      dateString,
      short: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : parts.weekday,
      day: parts.weekday,
      num: dayNum,
      dayName: parts.weekday,
      dayNum,
      monthName: monthNames[monthIdx] || 'Sep',
      displayShort: `${parts.weekday} ${dayNum}`,
      displayFull: `${fullDayNames[dayOfWeek]}, ${dayNum} ${monthNames[monthIdx]} ${parts.year}`,
      isToday: i === 0,
      isTomorrow: i === 1,
    });
  }
  return days;
}

export function parseSlotMinutes(slotString) {
  // e.g. "6:00 AM", "12:30 PM", "6:00 PM"
  const [time, period] = slotString.trim().split(/\s+/);
  const [hStr, mStr] = time.split(':');
  let h = Number(hStr);
  const m = Number(mStr || 0);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

export const parseSlotStartMinutes = parseSlotMinutes;

export function formatSlotEnd(startSlot, durationHours) {
  const startM = parseSlotMinutes(startSlot);
  const endM = startM + Math.round(durationHours * 60);
  let h = Math.floor(endM / 60) % 24;
  const m = endM % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  let displayH = h % 12;
  if (displayH === 0) displayH = 12;
  const displayM = m === 0 ? '00' : String(m).padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
}

export function formatSlotLabel(startSlot, durationHours) {
  if (!startSlot) return '';
  const end = formatSlotEnd(startSlot, durationHours);
  const durLabel = `${durationHours} ${durationHours === 1 ? 'hr' : 'hrs'}`;
  return `${startSlot} – ${end} (${durLabel})`;
}

export const MORNING_SLOTS = ['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM'];
export const EVENING_SLOTS = ['4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'];

export function getSlotState(slot, dateString, durationHours = 1, now = new Date()) {
  const current = getVenueNow(now);
  const startMinutes = parseSlotMinutes(slot);
  const durationMinutes = Math.round(durationHours * 60);
  const endMinutes = startMinutes + durationMinutes;

  // Past time check
  const isPast = dateString < current.date || (dateString === current.date && startMinutes <= current.minutes);
  if (isPast) return { state: 'past', selectable: false, label: 'Past' };

  // Closing check (Facility operating hours 06:00 to 23:00 / 1380m)
  if (endMinutes > 1380) {
    return { state: 'unavailable', selectable: false, label: 'Closes 11 PM' };
  }

  // Booked slot check (simulate booked slot on peak evening)
  if (slot === '7:00 PM') {
    return { state: 'booked', selectable: false, label: 'Booked' };
  }

  // Filling fast check
  if (slot === '8:00 AM' || slot === '6:00 PM') {
    return { state: 'filling', selectable: true, label: 'Filling' };
  }

  return { state: 'available', selectable: true, label: 'Available' };
}

export function calculateBookingPricing(facility, durationHours = 1) {
  const hourlyMap = {
    fac_box_cricket: 900,
    fac_skating: 800,
    fac_pickleball: 700,
    fac_cricket_nets: 600,
    fac_shooting_machine: 900,
  };
  let hourlyRate = 900;
  if (facility) {
    if (facility.id && hourlyMap[facility.id]) {
      hourlyRate = hourlyMap[facility.id];
    } else if (facility.tariff) {
      const match = String(facility.tariff).replace(/[^\d]/g, '');
      if (match) hourlyRate = Number(match);
    }
  }

  const courtTotal = Math.round(hourlyRate * durationHours);
  const deposit = Math.round(courtTotal * (1 / 3));
  const gstAmount = Math.round(courtTotal * 0.18);
  const totalPayable = courtTotal + gstAmount;

  return {
    hourlyRate,
    baseRate: hourlyRate,
    durationHours,
    courtTotal,
    deposit,
    gstAmount,
    totalPayable,
    formattedCourtTotal: `₹${courtTotal.toLocaleString('en-IN')}`,
    formattedDeposit: `₹${deposit.toLocaleString('en-IN')}`,
    formattedTotal: `₹${totalPayable.toLocaleString('en-IN')}`,
  };
}

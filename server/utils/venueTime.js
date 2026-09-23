// Booking time must be evaluated in the venue's civil time, not the device or
// server timezone. This module deliberately contains no browser-derived time.
export const VENUE_TIME_ZONE = process.env.VENUE_TIME_ZONE || 'Asia/Kolkata';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VENUE_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  hourCycle: 'h23', weekday: 'short',
});

export const venueNow = (now = new Date()) => {
  const parts = Object.fromEntries(formatter.formatToParts(now)
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    dayOfWeek: weekday < 0 ? null : weekday,
  };
};

export const dayOfWeekForVenueDate = (date) => new Date(`${date}T12:00:00.000Z`).getUTCDay();

export const slotHasStarted = (date, startMinutes, now = new Date()) => {
  const current = venueNow(now);
  return date < current.date || (date === current.date && startMinutes <= current.minutes);
};

export const normalizeScheduleClose = (opensAtMinutes, closesAtMinutes) =>
  closesAtMinutes <= opensAtMinutes ? closesAtMinutes + 1440 : closesAtMinutes;

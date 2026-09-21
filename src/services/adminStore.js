/**
 * Turf & Taste - Admin Store & Persistence Layer
 * Synchronizes Bookings, Dynamic Pricing, and Arena Timings across Express API / SQLite DB with localStorage fallback
 */

import { api } from './api';
import { pricingTiers as defaultPricing } from '../data/pricingData';

const STORAGE_KEYS = {
  BOOKINGS: 'tt_bookings_v1',
  PRICING: 'tt_pricing_v1',
  TIMINGS: 'tt_timings_v1',
};

const INITIAL_BOOKINGS = [];

const DEFAULT_TIMINGS = {
  arenaOpen: '06:00 AM',
  arenaClose: '06:00 AM',
  floodlightStart: '06:00 PM',
  slotIntervalMins: 60,
  notes: '24-Hour continuous sports operations: Day Sessions 6:00 AM – 6:00 PM, Night Floodlit Sessions 6:00 PM – 6:00 AM.',
  blockedSlots: []
};

// Admin Store APIs
export const adminStore = {
  // Async Backend Login
  loginAdmin: async (username, password) => {
    try {
      const result = await api.adminLogin(username, password);
      if (result.success) return result;
      return { success: false, error: result.error || 'Unable to verify management credentials.' };
    } catch {
      return { success: false, error: 'The management service is unavailable. Please try again shortly.' };
    }
  },

  setAdminPassword: async (newPassword, currentPassword) => {
    try {
      const res = await api.changeAdminPassword(currentPassword, newPassword);
      return res;
    } catch {
      return { success: false, error: 'The management service is unavailable. Password was not changed.' };
    }
  },

  // Bookings - browser cache is only a read fallback. Privileged mutations must
  // succeed on the server before the local view is changed.
  fetchBookingsAsync: async (filters = {}) => {
    try {
      const res = await api.getBookings(filters);
      if (res.success && res.bookings) {
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(res.bookings));
        return res.bookings;
      }
    } catch (e) {
      console.warn('Backend API offline, loading local bookings:', e);
    }
    return adminStore.getBookings();
  },

  getBookings: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
      return stored ? JSON.parse(stored) : INITIAL_BOOKINGS;
    } catch {
      return INITIAL_BOOKINGS;
    }
  },

  saveBooking: async (booking) => {
    const res = await api.createBooking(booking);
    if (!res.success) throw new Error(res.error || 'Booking could not be created.');
    const list = adminStore.getBookings();
    const savedBooking = res.booking || booking;
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify([savedBooking, ...list]));
    return savedBooking;
  },

  updateBookingStatus: async (bookingId, newStatus) => {
    const res = await api.updateBookingStatus(bookingId, newStatus);
    if (!res.success) throw new Error(res.error || 'Booking status could not be updated.');
    const list = adminStore.getBookings();
    const updated = list.map(b => b.id === bookingId ? { ...b, status: newStatus } : b);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updated));
    return updated;
  },

  deleteBooking: async (bookingId) => {
    const res = await api.deleteBooking(bookingId);
    if (!res.success) throw new Error(res.error || 'Booking could not be deleted.');
    const list = adminStore.getBookings();
    const updated = list.filter(b => b.id !== bookingId);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updated));
    return updated;
  },

  // Parse numeric amount safely from formatted string (e.g. "₹1200" -> 1200)
  parsePrice: (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9]/g, '');
    return parseInt(cleaned, 10) || 0;
  },

  // Pricing
  fetchPricingAsync: async () => {
    try {
      const res = await api.getPricing();
      if (res.success && res.pricing && res.pricing.length > 0) {
        // Merge API pricing with default rich properties so nothing is lost
        const merged = defaultPricing.map(def => {
          const apiMatch = res.pricing.find(p => p.facilityId === def.facilityId);
          return apiMatch ? { ...def, ...apiMatch } : def;
        });
        localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(merged));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tt_pricing_updated', { detail: merged }));
        }
        return merged;
      }
    } catch (e) {
      console.warn('Backend API offline, loading local pricing:', e);
    }
    return adminStore.getPricing();
  },

  getPricing: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PRICING);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge to guarantee all facilities exist and sanitize legacy timings
          return defaultPricing.map(def => {
            const found = parsed.find(p => p.facilityId === def.facilityId);
            if (!found) return def;
            const dayHours = (found.dayHours && !found.dayHours.includes('4:00 PM')) ? found.dayHours : def.dayHours;
            const nightHours = (found.nightHours && !found.nightHours.includes('11:30 PM')) ? found.nightHours : def.nightHours;
            return { ...def, ...found, dayHours, nightHours };
          });
        }
      }
      return defaultPricing;
    } catch {
      return defaultPricing;
    }
  },

  getFacilityPricing: (facilityId) => {
    const list = adminStore.getPricing();
    const cleanId = String(facilityId || '').toLowerCase().trim();
    const item = list.find(p => p.facilityId === cleanId) || 
                 list.find(p => p.facilityId.includes(cleanId) || cleanId.includes(p.facilityId)) || {};
    
    const dayNum = adminStore.parsePrice(item.dayRate) || 800;
    const nightNum = adminStore.parsePrice(item.nightRate) || 1200;
    const depositNum = adminStore.parsePrice(item.bookingDeposit) || 400;

    return {
      facilityId: item.facilityId || cleanId,
      facilityName: item.facilityName || 'Arena Facility',
      dayRate: `₹${dayNum}`,
      nightRate: `₹${nightNum}`,
      bookingDeposit: `₹${depositNum}`,
      dayHours: (item.dayHours && !item.dayHours.includes('4:00 PM')) ? item.dayHours : '6:00 AM – 6:00 PM',
      nightHours: (item.nightHours && !item.nightHours.includes('11:30 PM')) ? item.nightHours : '6:00 PM – 6:00 AM (Floodlights)',
      hourlyRateDayNum: dayNum,
      hourlyRateNightNum: nightNum,
      depositNum: depositNum
    };
  },

  savePricing: async (pricingArray) => {
    const normalized = pricingArray.map(item => {
      const dayNum = adminStore.parsePrice(item.dayRate) || 800;
      const nightNum = adminStore.parsePrice(item.nightRate) || 1200;
      const depositNum = adminStore.parsePrice(item.bookingDeposit) || 400;
      return {
        ...item,
        dayRate: `₹${dayNum}`,
        nightRate: `₹${nightNum}`,
        bookingDeposit: `₹${depositNum}`
      };
    });

    const res = await api.savePricing(normalized);
    if (!res.success) throw new Error(res.error || 'Pricing could not be saved.');
    localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(normalized));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tt_pricing_updated', { detail: normalized }));
    return normalized;
  },

  // Timings
  fetchTimingsAsync: async () => {
    try {
      const res = await api.getTimings();
      if (res.success && res.timings) {
        localStorage.setItem(STORAGE_KEYS.TIMINGS, JSON.stringify(res.timings));
        return res.timings;
      }
    } catch (e) {
      console.warn('Backend API offline, loading local timings:', e);
    }
    return adminStore.getTimings();
  },

  getTimings: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TIMINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.floodlightStart === '04:00 PM' || parsed.arenaClose === '11:30 PM') {
          return DEFAULT_TIMINGS;
        }
        return parsed;
      }
      return DEFAULT_TIMINGS;
    } catch {
      return DEFAULT_TIMINGS;
    }
  },

  saveTimings: async (timingsObj) => {
    const res = await api.saveTimings(timingsObj);
    if (!res.success) throw new Error(res.error || 'Operating schedule could not be saved.');
    localStorage.setItem(STORAGE_KEYS.TIMINGS, JSON.stringify(timingsObj));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tt_timings_updated', { detail: timingsObj }));
    }
    return timingsObj;
  },

  // Reset
  resetAll: () => {
    localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
    localStorage.removeItem(STORAGE_KEYS.PRICING);
    localStorage.removeItem(STORAGE_KEYS.TIMINGS);
    sessionStorage.removeItem('tt_admin_jwt');
    sessionStorage.removeItem('tt_admin_authenticated');
    return true;
  }
};

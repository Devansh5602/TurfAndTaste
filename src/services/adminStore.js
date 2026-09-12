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
  PASSWORD: 'tt_admin_password_v2'
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
    } catch {
      // Fallback local check
    }

    const localPassword = adminStore.getAdminPassword();
    if (password === localPassword) {
      sessionStorage.setItem('tt_admin_authenticated', 'true');
      return { success: true, message: 'Authenticated locally' };
    }
    return { success: false, error: 'Invalid admin password' };
  },

  // Authentication Password helpers
  getAdminPassword: () => {
    return localStorage.getItem(STORAGE_KEYS.PASSWORD) || 'Turfandtaste2026';
  },

  setAdminPassword: async (newPassword, currentPassword) => {
    try {
      const res = await api.changeAdminPassword(currentPassword, newPassword);
      if (res.success) {
        localStorage.setItem(STORAGE_KEYS.PASSWORD, newPassword);
        return res;
      }
    } catch {
      // Fallback local save
    }
    localStorage.setItem(STORAGE_KEYS.PASSWORD, newPassword);
    return { success: true, message: 'Password updated locally' };
  },

  // Bookings - Async with Local Storage Fallback
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
    try {
      const res = await api.createBooking(booking);
      if (res.success) {
        const list = adminStore.getBookings();
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify([booking, ...list]));
        return res.booking || booking;
      }
    } catch (e) {
      console.warn('Could not post booking to backend API:', e);
    }
    const list = adminStore.getBookings();
    const updated = [booking, ...list];
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updated));
    return booking;
  },

  updateBookingStatus: async (bookingId, newStatus) => {
    try {
      await api.updateBookingStatus(bookingId, newStatus);
    } catch (e) {
      console.warn('Could not update booking status on server:', e);
    }
    const list = adminStore.getBookings();
    const updated = list.map(b => b.id === bookingId ? { ...b, status: newStatus } : b);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updated));
    return updated;
  },

  deleteBooking: async (bookingId) => {
    try {
      await api.deleteBooking(bookingId);
    } catch (e) {
      console.warn('Could not delete booking on server:', e);
    }
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

    localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(normalized));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tt_pricing_updated', { detail: normalized }));
    }
    try {
      await api.savePricing(normalized);
    } catch (e) {
      console.warn('Could not sync pricing to API:', e);
    }
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
    try {
      await api.saveTimings(timingsObj);
    } catch (e) {
      console.warn('Could not sync timings to API:', e);
    }
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
    localStorage.removeItem(STORAGE_KEYS.PASSWORD);
    sessionStorage.removeItem('tt_admin_jwt');
    sessionStorage.removeItem('tt_admin_authenticated');
    return true;
  }
};

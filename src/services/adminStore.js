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
  arenaClose: '11:30 PM',
  floodlightStart: '04:00 PM',
  slotIntervalMins: 60,
  notes: 'Regular operating schedule across all 7 open-air and indoor sports arenas in Patan, Gujarat.',
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

  // Pricing
  fetchPricingAsync: async () => {
    try {
      const res = await api.getPricing();
      if (res.success && res.pricing && res.pricing.length > 0) {
        localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(res.pricing));
        return res.pricing;
      }
    } catch (e) {
      console.warn('Backend API offline, loading local pricing:', e);
    }
    return adminStore.getPricing();
  },

  getPricing: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PRICING);
      return stored ? JSON.parse(stored) : defaultPricing;
    } catch {
      return defaultPricing;
    }
  },

  savePricing: async (pricingArray) => {
    try {
      await api.savePricing(pricingArray);
    } catch (e) {
      console.warn('Could not sync pricing to API:', e);
    }
    localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(pricingArray));
    return pricingArray;
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
      return stored ? JSON.parse(stored) : DEFAULT_TIMINGS;
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

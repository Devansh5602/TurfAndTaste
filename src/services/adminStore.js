/**
 * Turf & Taste - Admin Store & Persistence Layer
 * Synchronizes Bookings, Dynamic Pricing, and Arena Timings across localStorage
 */

import { pricingTiers as defaultPricing } from '../data/pricingData';
import { facilitiesData as defaultFacilities } from '../data/facilitiesData';

const STORAGE_KEYS = {
  BOOKINGS: 'tt_bookings_v1',
  PRICING: 'tt_pricing_v1',
  TIMINGS: 'tt_timings_v1',
  PIN: 'tt_admin_pin_v1'
};

const INITIAL_BOOKINGS = [
  {
    id: 'TT-849102',
    facilityId: 'box-cricket',
    facilityName: 'Box Cricket Arena',
    date: new Date().toISOString().split('T')[0],
    time: '06:00 PM – 07:00 PM',
    customerName: 'Rahul Patel',
    customerPhone: '+91 98250 12345',
    customerEmail: 'rahul.patel@gmail.com',
    teamName: 'Patan Super Kings',
    duration: 1,
    paymentType: 'deposit',
    amount: '₹500 (Token Deposit)',
    status: 'Confirmed',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'TT-621904',
    facilityId: 'pickleball',
    facilityName: 'Pickleball Courts',
    date: new Date().toISOString().split('T')[0],
    time: '07:00 AM – 08:00 AM',
    customerName: 'Ananya Sharma',
    customerPhone: '+91 97241 67890',
    customerEmail: 'ananya.s@outlook.com',
    teamName: 'Smash Squad',
    duration: 1,
    paymentType: 'full',
    amount: '₹600 (Full Paid)',
    status: 'Checked-in',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
  },
  {
    id: 'TT-392811',
    facilityId: 'ball-machine',
    facilityName: 'Ball-Shooting Machine Lane',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '05:00 PM – 06:00 PM',
    customerName: 'Meet Thakor',
    customerPhone: '+91 99092 34567',
    customerEmail: 'meet.cricket@yahoo.com',
    teamName: 'Solo Batting Drill',
    duration: 1,
    paymentType: 'deposit',
    amount: '₹300 (Token Deposit)',
    status: 'Confirmed',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'TT-154930',
    facilityId: 'skating',
    facilityName: 'Skating Rink',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    time: '04:00 PM – 05:00 PM',
    customerName: 'Pooja Dave',
    customerPhone: '+91 98980 98765',
    customerEmail: 'pooja.dave@gmail.com',
    teamName: 'Weekend Rollers',
    duration: 1,
    paymentType: 'full',
    amount: '₹250 (Full Paid)',
    status: 'Completed',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];

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
  // Authentication
  getAdminPin: () => {
    return localStorage.getItem(STORAGE_KEYS.PIN) || '1234';
  },

  setAdminPin: (newPin) => {
    localStorage.setItem(STORAGE_KEYS.PIN, newPin);
    return true;
  },

  // Bookings
  getBookings: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
      return stored ? JSON.parse(stored) : INITIAL_BOOKINGS;
    } catch {
      return INITIAL_BOOKINGS;
    }
  },

  saveBooking: (booking) => {
    const list = adminStore.getBookings();
    const updated = [booking, ...list];
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updated));
    return booking;
  },

  updateBookingStatus: (bookingId, newStatus) => {
    const list = adminStore.getBookings();
    const updated = list.map(b => b.id === bookingId ? { ...b, status: newStatus } : b);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updated));
    return updated;
  },

  deleteBooking: (bookingId) => {
    const list = adminStore.getBookings();
    const updated = list.filter(b => b.id !== bookingId);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updated));
    return updated;
  },

  // Pricing
  getPricing: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PRICING);
      return stored ? JSON.parse(stored) : defaultPricing;
    } catch {
      return defaultPricing;
    }
  },

  savePricing: (pricingArray) => {
    localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(pricingArray));
    return pricingArray;
  },

  updateSingleFacilityPricing: (facilityId, updates) => {
    const list = adminStore.getPricing();
    const updated = list.map(p => p.facilityId === facilityId ? { ...p, ...updates } : p);
    localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(updated));
    return updated;
  },

  // Timings
  getTimings: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TIMINGS);
      return stored ? JSON.parse(stored) : DEFAULT_TIMINGS;
    } catch {
      return DEFAULT_TIMINGS;
    }
  },

  saveTimings: (timingsObj) => {
    localStorage.setItem(STORAGE_KEYS.TIMINGS, JSON.stringify(timingsObj));
    return timingsObj;
  },

  // Reset all to defaults
  resetAll: () => {
    localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
    localStorage.removeItem(STORAGE_KEYS.PRICING);
    localStorage.removeItem(STORAGE_KEYS.TIMINGS);
    localStorage.removeItem(STORAGE_KEYS.PIN);
    return true;
  }
};

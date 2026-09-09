/**
 * Turf & Taste - Booking Service
 * Express API & SQLite Database integration for slot availability & reservation submission
 */

import { api } from './api';
import { adminStore } from './adminStore';

export const generateTimeSlots = (facilityId, selectedDate) => {
  const slots = [
    { time: '06:00 AM – 07:00 AM', category: 'Morning Early', price: '₹___', status: 'available', peak: false },
    { time: '07:00 AM – 08:00 AM', category: 'Morning Early', price: '₹___', status: 'available', peak: false },
    { time: '08:00 AM – 09:00 AM', category: 'Morning Prime', price: '₹___', status: 'fast-filling', peak: false },
    { time: '09:00 AM – 10:00 AM', category: 'Morning', price: '₹___', status: 'available', peak: false },
    { time: '10:00 AM – 11:00 AM', category: 'Morning', price: '₹___', status: 'available', peak: false },
    { time: '11:00 AM – 12:00 PM', category: 'Afternoon', price: '₹___', status: 'available', peak: false },
    { time: '02:00 PM – 03:00 PM', category: 'Afternoon', price: '₹___', status: 'available', peak: false },
    { time: '03:00 PM – 04:00 PM', category: 'Afternoon', price: '₹___', status: 'available', peak: false },
    { time: '04:00 PM – 05:00 PM', category: 'Evening Floodlit', price: '₹___', status: 'fast-filling', peak: true },
    { time: '05:00 PM – 06:00 PM', category: 'Evening Floodlit', price: '₹___', status: 'booked', peak: true },
    { time: '06:00 PM – 07:00 PM', category: 'Prime Floodlit', price: '₹___', status: 'booked', peak: true },
    { time: '07:00 PM – 08:00 PM', category: 'Prime Floodlit', price: '₹___', status: 'booked', peak: true },
    { time: '08:00 PM – 09:00 PM', category: 'Prime Floodlit', price: '₹___', status: 'fast-filling', peak: true },
    { time: '09:00 PM – 10:00 PM', category: 'Night Floodlit', price: '₹___', status: 'available', peak: true },
    { time: '10:00 PM – 11:00 PM', category: 'Night Floodlit', price: '₹___', status: 'available', peak: true }
  ];

  return slots;
};

export const fetchRealTimeSlots = async (facilityId, selectedDate) => {
  try {
    const res = await api.getSlotAvailability(facilityId, selectedDate);
    if (res.success && res.slots) {
      return res.slots;
    }
  } catch (e) {
    console.warn('Using offline slots generator:', e);
  }
  return generateTimeSlots(facilityId, selectedDate);
};

export const submitBookingReservation = async (bookingPayload) => {
  const bookingReference = `TT-${Math.floor(100000 + Math.random() * 900000)}`;

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
    amount: bookingPayload.paymentType === 'full' ? '₹1200 (Full Paid)' : '₹500 (Token Deposit)',
    status: 'Confirmed',
    createdAt: new Date().toISOString()
  };

  try {
    const apiRes = await api.createBooking(formattedPayload);
    if (apiRes.success) {
      adminStore.saveBooking(formattedPayload);
      return {
        success: true,
        bookingReference: apiRes.bookingReference || bookingReference,
        timestamp: new Date().toISOString(),
        details: bookingPayload,
        message: 'Slot reservation recorded and saved to database!'
      };
    }
  } catch (err) {
    console.warn('API error during booking, persisting locally:', err);
  }

  // Fallback local save
  await adminStore.saveBooking(formattedPayload);

  return {
    success: true,
    bookingReference,
    timestamp: new Date().toISOString(),
    details: bookingPayload,
    message: 'Slot preview recorded! Saved to browser cache.'
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

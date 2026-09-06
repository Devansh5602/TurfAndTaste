/**
 * Turf & Taste - Booking Service
 * 
 * Architecture Layer:
 * Prepares the slot availability and booking submission pipeline.
 * Persists demo bookings into adminStore (localStorage).
 * Ready to connect to real backend API (Node.js/Express, Supabase, or Firebase) in Phase 2.
 */

import { adminStore } from './adminStore';

export const generateTimeSlots = (facilityId, selectedDate) => {
  // Returns structured slots with status (available, fast-filling, booked)
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

export const submitBookingReservation = async (bookingPayload) => {
  // Simulates network latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Generates reference code (e.g. TT-XXXXXX)
  const bookingReference = `TT-${Math.floor(100000 + Math.random() * 900000)}`;

  // Save to local storage for Admin dashboard
  try {
    adminStore.saveBooking({
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
      amount: bookingPayload.paymentType === 'full' ? '100% Full Payment' : 'Token Deposit',
      status: 'Confirmed',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Could not persist booking to admin store:', err);
  }

  return {
    success: true,
    bookingReference,
    timestamp: new Date().toISOString(),
    details: bookingPayload,
    isPhase1Demo: true,
    message: 'Slot preview recorded! You will receive priority reservation status for grand opening.'
  };
};

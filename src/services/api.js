/**
 * Turf & Taste - Central API Gateway Client
 * Handles communication with Express API server & SQLite database (http://localhost:5000/api)
 */

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
  ? '/api' 
  : 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = sessionStorage.getItem('tt_admin_jwt');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const api = {
  // Health Check
  checkHealth: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      return await res.json();
    } catch {
      return { status: 'offline' };
    }
  },

  // Auth
  adminLogin: async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) {
      sessionStorage.setItem('tt_admin_jwt', data.token);
    }
    return data;
  },

  verifyAdminToken: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/verify`, {
        headers: getAuthHeaders()
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  changeAdminPassword: async (currentPassword, newPassword) => {
    const res = await fetch(`${API_BASE_URL}/admin/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    return await res.json();
  },

  // Bookings
  getBookings: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const res = await fetch(`${API_BASE_URL}/bookings?${params}`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  getBookingHistory: async ({ phone, email }) => {
    const params = new URLSearchParams({ phone: phone || '', email: email || '' }).toString();
    const res = await fetch(`${API_BASE_URL}/bookings/history?${params}`);
    return await res.json();
  },

  getSlotAvailability: async (facilityId, date) => {
    const res = await fetch(`${API_BASE_URL}/bookings/slots?facilityId=${facilityId}&date=${date}`);
    return await res.json();
  },

  createBooking: async (bookingPayload) => {
    const res = await fetch(`${API_BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingPayload)
    });
    return await res.json();
  },

  updateBookingStatus: async (bookingId, status) => {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ status })
    });
    return await res.json();
  },

  deleteBooking: async (bookingId) => {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  // Payments
  createPaymentOrder: async (paymentDetails) => {
    const res = await fetch(`${API_BASE_URL}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentDetails)
    });
    return await res.json();
  },

  verifyPaymentSignature: async (paymentData) => {
    const res = await fetch(`${API_BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    return await res.json();
  },

  getPaymentHistory: async () => {
    const res = await fetch(`${API_BASE_URL}/payments/history`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  // Inquiries
  sendInquiry: async (inquiryData) => {
    const res = await fetch(`${API_BASE_URL}/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inquiryData)
    });
    return await res.json();
  },

  getInquiries: async () => {
    const res = await fetch(`${API_BASE_URL}/inquiries`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  // Pricing & Timings
  getPricing: async () => {
    const res = await fetch(`${API_BASE_URL}/pricing`);
    return await res.json();
  },

  savePricing: async (pricingList) => {
    const res = await fetch(`${API_BASE_URL}/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(pricingList)
    });
    return await res.json();
  },

  getTimings: async () => {
    const res = await fetch(`${API_BASE_URL}/pricing/timings`);
    return await res.json();
  },

  saveTimings: async (timingsObj) => {
    const res = await fetch(`${API_BASE_URL}/pricing/timings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(timingsObj)
    });
    return await res.json();
  }
};

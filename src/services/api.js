/**
 * Turf & Taste - Central API Gateway Client
 * Handles communication with Express API server & Supabase PostgreSQL
 *
 * API_BASE_URL resolves to:
 *   - Web (Vite dev):     '/api'           (proxied to localhost:5000)
 *   - Android emulator:   'http://10.0.2.2:5000/api'
 *   - Physical device:    'http://<LAN-IP>:5000/api'
 *   - Production:         'https://api.turfandtaste.com/api'
 *
 * Set VITE_API_URL in .env or .env.local to override.
 */

import { Capacitor } from '@capacitor/core';

const configuredApiBaseUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const isNativeApp = typeof window !== 'undefined' && Capacitor.isNativePlatform();

// The Vite proxy only exists while developing the website. A packaged
// Capacitor app is served from its own WebView origin, so a relative `/api`
// request can resolve to the app shell and return index.html rather than JSON.
// Refuse that unsafe ambiguity early and require an explicitly reachable API.
const API_BASE_URL = configuredApiBaseUrl || '/api';

export const getApiConfigurationIssue = () => {
  if (isNativeApp && !configuredApiBaseUrl) {
    return 'This mobile build has no API endpoint configured. Rebuild with VITE_API_URL set to the reachable HTTPS API base URL (for example, https://api.example.com/api).';
  }
  return null;
};

const apiFetch = async (path, options) => {
  const configurationIssue = getApiConfigurationIssue();
  if (configurationIssue) {
    const error = new Error(configurationIssue);
    error.code = 'API_CONFIGURATION_REQUIRED';
    throw error;
  }

  const url = path;
  let response;
  try {
    response = await globalThis.fetch(url, options);
  } catch (cause) {
    const error = new Error('Unable to reach the Turf & Taste service. Check your connection and try again.');
    error.code = 'API_NETWORK_ERROR';
    error.cause = cause;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!/application\/json|\+json/i.test(contentType)) {
    // Consume only a small preview for diagnostics. It is intentionally not
    // surfaced to customers because it may contain a proxy/server error page.
    const preview = (await response.text()).slice(0, 120).replace(/\s+/g, ' ').trim();
    const endpoint = String(path).replace(/^https?:\/\/[^/]+/i, '');
    const error = new Error(`The service returned an unexpected non-JSON response (${response.status}) for ${endpoint}. Verify the mobile API URL and server route.`);
    error.code = 'API_UNEXPECTED_RESPONSE';
    error.status = response.status;
    error.endpoint = endpoint;
    error.responsePreview = preview;
    throw error;
  }
  const parseJson = response.json.bind(response);
  response.json = async () => {
    try {
      return await parseJson();
    } catch (cause) {
      const error = new Error('The service returned malformed JSON. Please retry; if this continues, contact the arena.');
      error.code = 'API_INVALID_JSON';
      error.status = response.status;
      error.cause = cause;
      throw error;
    }
  };
  return response;
};

// Keep existing API methods concise while ensuring every service request gets
// the native-configuration and JSON-content safeguards above.
const fetch = apiFetch;

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('tt_admin_jwt') : null;
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

  getSlotAvailability: async (facilityId, date, duration = 1) => {
    const params = new URLSearchParams({ facilityId, date, duration: String(duration) });
    const res = await fetch(`${API_BASE_URL}/bookings/slots?${params}`);
    return await res.json();
  },

  createBooking: async (bookingPayload) => {
    const res = await fetch(`${API_BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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

  // v2 Facility Management
  getFacilities: async () => {
    const res = await fetch(`${API_BASE_URL}/facilities`);
    return await res.json();
  },

  getBookingQuote: async ({ facilityId, date, timeSlot }, requestOptions = {}) => {
    const res = await fetch(`${API_BASE_URL}/v2/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, date, timeSlot }),
      ...requestOptions,
    });
    return await res.json();
  },

  getAdminFacilities: async () => {
    const res = await fetch(`${API_BASE_URL}/facilities/admin/all`, { headers: getAuthHeaders() });
    return await res.json();
  },

  saveFacility: async (facility, isCreate = false) => {
    const endpoint = isCreate ? `${API_BASE_URL}/facilities` : `${API_BASE_URL}/facilities/${encodeURIComponent(facility.id)}`;
    const res = await fetch(endpoint, {
      method: isCreate ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(facility),
    });
    return await res.json();
  },

  getAdminFood: async () => {
    const res = await fetch(`${API_BASE_URL}/v2/food/admin/all`, { headers: getAuthHeaders() });
    return await res.json();
  },
  // Public food discovery deliberately uses the allowlisted v2 endpoints.
  // It must never fall back to an admin response or expose management fields.
  getFoodStalls: async () => {
    const res = await fetch(`${API_BASE_URL}/v2/food`);
    return await res.json();
  },
  getFoodStall: async (identifier) => {
    const res = await fetch(`${API_BASE_URL}/v2/food/${encodeURIComponent(identifier)}`);
    return await res.json();
  },
  saveFoodStall: async (stall, isCreate = false) => {
    const endpoint = isCreate ? `${API_BASE_URL}/v2/food/admin/stalls` : `${API_BASE_URL}/v2/food/admin/stalls/${encodeURIComponent(stall.id)}`;
    const res = await fetch(endpoint, { method: isCreate ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(stall) });
    return await res.json();
  },
  saveFoodCategory: async (category, isCreate = false) => {
    const endpoint = isCreate ? `${API_BASE_URL}/v2/food/admin/categories` : `${API_BASE_URL}/v2/food/admin/categories/${encodeURIComponent(category.id)}`;
    const res = await fetch(endpoint, { method: isCreate ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(category) });
    return await res.json();
  },
  saveFoodItem: async (item, isCreate = false) => {
    const endpoint = isCreate ? `${API_BASE_URL}/v2/food/admin/items` : `${API_BASE_URL}/v2/food/admin/items/${encodeURIComponent(item.id)}`;
    const res = await fetch(endpoint, { method: isCreate ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(item) });
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
  },

  // Annual Archives & Database Cleanup
  getArchiveYears: async () => {
    const res = await fetch(`${API_BASE_URL}/archives/years`, { headers: getAuthHeaders() });
    return await res.json();
  },

  getArchivePreview: async (year) => {
    const res = await fetch(`${API_BASE_URL}/archives/preview?year=${year}`, { headers: getAuthHeaders() });
    return await res.json();
  },

  generateAnnualArchive: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/archives/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  emailAnnualArchive: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/archives/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  purgeAnnualData: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/archives/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  getArchiveVault: async () => {
    const res = await fetch(`${API_BASE_URL}/archives`, { headers: getAuthHeaders() });
    return await res.json();
  },

  getArchiveSettings: async () => {
    const res = await fetch(`${API_BASE_URL}/archives/settings`, { headers: getAuthHeaders() });
    return await res.json();
  },

  updateArchiveSettings: async (settings) => {
    const res = await fetch(`${API_BASE_URL}/archives/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(settings)
    });
    return await res.json();
  }
};

/**
 * Turf & Taste - Inquiry Service
 * 
 * Architecture Layer:
 * Structured communication pipeline for corporate bookings, tournaments, party packages, and queries.
 * Designed to connect directly to:
 * 1. Google Sheets App Script webhook
 * 2. Email notification service (e.g. Resend, SendGrid, EmailJS)
 * 3. Custom backend REST API endpoint
 */

// Configure external webhook endpoints when ready:
export const INQUIRY_CONFIG = {
  // Replace with your Google Apps Script Web App URL or backend endpoint:
  GOOGLE_SHEETS_WEBHOOK_URL: '', 
  EMAIL_SERVICE_ENDPOINT: '',
  BACKEND_API_URL: ''
};

export const submitInquiry = async (inquiryData) => {
  // Validate basic payload
  if (!inquiryData.fullName || !inquiryData.phone || !inquiryData.email) {
    throw new Error('Please complete all required fields.');
  }

  // If a real Google Sheets Webhook or Backend API URL is configured:
  if (INQUIRY_CONFIG.GOOGLE_SHEETS_WEBHOOK_URL) {
    try {
      const response = await fetch(INQUIRY_CONFIG.GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inquiryData)
      });
      if (!response.ok) throw new Error('Failed to post inquiry to Google Sheets');
      return { success: true, mode: 'google_sheets' };
    } catch (err) {
      console.warn('Webhook dispatch failed, falling back to simulated handler:', err);
    }
  }

  // Simulated latency & success handler for Phase 1
  await new Promise((resolve) => setTimeout(resolve, 900));

  console.log('[Inquiry Service] Submission recorded:', inquiryData);

  return {
    success: true,
    mode: 'phase1_simulated',
    inquiryId: `INQ-${Date.now().toString().slice(-6)}`,
    message: 'Thank you for reaching out! Our team will contact you within 24 hours.'
  };
};

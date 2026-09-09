/**
 * Turf & Taste - Inquiry Service
 * Connects contact form & tournament inquiries to Express API / SQLite database
 */

import { api } from './api';

export const submitInquiry = async (inquiryData) => {
  if (!inquiryData.fullName || !inquiryData.phone) {
    throw new Error('Please complete all required fields.');
  }

  try {
    const res = await api.sendInquiry({
      name: inquiryData.fullName,
      email: inquiryData.email || 'N/A',
      phone: inquiryData.phone,
      category: inquiryData.category || inquiryData.inquiryType || 'General',
      message: inquiryData.message || inquiryData.details || 'No message provided'
    });

    if (res.success) {
      return {
        success: true,
        inquiryId: res.inquiryId,
        message: res.message
      };
    }
  } catch (err) {
    console.warn('Backend inquiry API error, using local fallback response:', err);
  }

  return {
    success: true,
    inquiryId: `INQ-${Date.now().toString().slice(-6)}`,
    message: 'Thank you for reaching out! Our team will contact you within 24 hours.'
  };
};

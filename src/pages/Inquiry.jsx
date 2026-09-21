import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { submitInquiry } from '../services/inquiryService';
import { facilitiesData } from '../data/facilitiesData';
import SectionHeading from '../components/SectionHeading';
import CourtBackground from '../components/CourtBackground';
import Toast from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Calendar, 
  Users, 
  Clock, 
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function Inquiry() {
  const { queryParams } = useRouter();
  const rawPreselected = queryParams.get('facility');
  const validSportsSlugs = facilitiesData.filter(f => f.category !== 'dining').map(f => f.slug);
  const preselectedFacility = validSportsSlugs.includes(rawPreselected) ? rawPreselected : 'box-cricket';

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    inquiryType: 'group',
    facility: preselectedFacility,
    preferredDate: '',
    preferredTime: 'evening',
    groupSize: '12',
    services: ['floodlights'],
    message: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [inquiryErrorMessage, setInquiryErrorMessage] = useState('');

  const inquiryTypes = [
    { value: 'group', label: 'Group Booking / Squad Match' },
    { value: 'corporate', label: 'Corporate Event & Tournament' },
    { value: 'birthday', label: 'Birthday & Sports Arena Celebration' },
    { value: 'practice', label: 'Cricket Practice / Net Batches' },
    { value: 'general', label: 'General Availability & Pricing' }
  ];

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!formData.phone.trim()) {
      errs.phone = 'Phone number is required.';
    } else if (!/^[6-9]\d{9}$/.test(formData.phone.replace(/\s+/g, ''))) {
      errs.phone = 'Please enter a valid 10-digit Indian phone number.';
    }
    if (!formData.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!formData.message.trim()) {
      errs.message = 'Please provide brief details about your inquiry or event.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setShowConfirmModal(true);
  };

  const executeInquirySubmit = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    try {
      const result = await submitInquiry(formData);
      setSubmissionSuccess(result);
      setFormData({
        fullName: '',
        phone: '',
        email: '',
        inquiryType: 'group',
        facility: 'box-cricket',
        preferredDate: '',
        preferredTime: 'evening',
        groupSize: '12',
        services: ['floodlights'],
        message: ''
      });
    } catch (err) {
      setInquiryErrorMessage(err.message || 'Submission could not be completed. Please verify your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-inquiry">
      {/* Header */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden', paddingBottom: '2.5rem' }}>
        <CourtBackground />
        <div className="container" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <span className="badge badge-orange" style={{ marginBottom: '1rem' }}>
            Tailored Experiences
          </span>
          <h1 style={{ marginBottom: '1rem' }}>
            Submit an <span className="text-olive">Inquiry</span>
          </h1>
          <p style={{ maxWidth: '680px', margin: '0 auto', fontSize: '1.2rem', lineHeight: '1.6' }}>
            Planning a tournament, corporate outing, birthday celebration, or ongoing practice batch? Tell us your vision and we will customize the perfect package.
          </p>
        </div>
      </section>

      {/* Main Inquiry Form Section */}
      <section className="section" style={{ paddingTop: '1rem' }}>
        <div className="container container-narrow">
          <div className="card-arena highlight" style={{ padding: 'clamp(2rem, 5vw, 3rem)' }}>
            {submissionSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--brand-olive-dim)',
                  border: '2px solid var(--brand-olive)',
                  color: 'var(--brand-olive-bright)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem'
                }}>
                  <CheckCircle2 size={36} />
                </div>
                <span className="badge badge-olive" style={{ marginBottom: '0.75rem' }}>
                  Inquiry Received
                </span>
                <h2 style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>
                  Thank You for Reaching Out!
                </h2>
                <p style={{ fontSize: '1.05rem', maxWidth: '540px', margin: '0 auto 1.5rem', color: 'var(--text-secondary)' }}>
                  {submissionSuccess.message}
                </p>
                <div style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  maxWidth: '420px',
                  margin: '0 auto 2rem',
                  fontSize: '0.88rem'
                }}>
                  <span>Tracking Reference: </span>
                  <strong style={{ color: 'var(--brand-cream)' }}>{submissionSuccess.inquiryId}</strong>
                </div>
                <button
                  onClick={() => setSubmissionSuccess(null)}
                  className="btn btn-outline"
                >
                  Submit Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.6rem', margin: 0 }}>
                    Event &amp; Custom Booking Details
                  </h3>
                  <span className="badge badge-olive">
                    Plan Ahead
                  </span>
                </div>

                {/* Name & Phone */}
                <div className="grid grid-2" style={{ gap: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">
                      Full Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      required
                      minLength={2}
                      placeholder="e.g. Amit Dave"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Phone Number (WhatsApp) <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      pattern="[6-9][0-9]{9}"
                      title="Enter a valid 10-digit mobile number starting with 6-9"
                      placeholder="10-digit mobile number"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Email & Inquiry Type */}
                <div className="grid grid-2" style={{ gap: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">
                      Email Address <span className="required">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="e.g. amit@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Inquiry Category</label>
                    <select
                      value={formData.inquiryType}
                      onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value })}
                      className="form-select"
                    >
                      {inquiryTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Facility & Approximate Group Size */}
                <div className="grid grid-2" style={{ gap: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">Facility of Interest</label>
                    <select
                      value={formData.facility}
                      onChange={(e) => setFormData({ ...formData, facility: e.target.value })}
                      className="form-select"
                    >
                      {facilitiesData.filter(f => f.category !== 'dining').map(f => (
                        <option key={f.slug} value={f.slug}>{f.name}</option>
                      ))}
                      <option value="multi-facility">Multiple Sports Facilities / Entire Arena</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Approximate Group Size</label>
                    <select
                      value={formData.groupSize}
                      onChange={(e) => setFormData({ ...formData, groupSize: e.target.value })}
                      className="form-select"
                    >
                      <option value="1-5">1 – 5 Players</option>
                      <option value="6-12">6 – 12 Players (Standard Squad)</option>
                      <option value="13-25">13 – 25 People (Two Teams / Party)</option>
                      <option value="25-50">25 – 50 People (Tournament / Corporate)</option>
                      <option value="50+">50+ People (Full Venue Buyout)</option>
                    </select>
                  </div>
                </div>

                {/* Preferred Date & Time Window */}
                <div className="grid grid-2" style={{ gap: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">Target Date (Tentative)</label>
                    <input
                      type="date"
                      value={formData.preferredDate}
                      onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Preferred Time Window</label>
                    <select
                      value={formData.preferredTime}
                      onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                      className="form-select"
                    >
                      <option value="morning">Morning (6:00 AM – 11:00 AM)</option>
                      <option value="afternoon">Afternoon (11:00 AM – 4:00 PM)</option>
                      <option value="evening">Prime Evening Floodlights (6:00 PM – 9:00 PM)</option>
                      <option value="night">Late Night (9:00 PM – 6:00 AM)</option>
                      <option value="full_day">Full Day Event</option>
                    </select>
                  </div>
                </div>

                {/* Event Requirements & Services Requested Checkboxes */}
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.65rem' }}>
                    Requested Services &amp; Arena Add-ons (Optional)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
                    {[
                      { id: 'floodlights', label: 'Floodlit Arena Lighting' },
                      { id: 'officials', label: 'Match Officials / Umpire Support' },
                      { id: 'sound', label: 'PA Sound System & Announcer Mic' },
                      { id: 'catering', label: 'Café Refreshments & Beverage Station' },
                      { id: 'photo', label: 'Match Photography & Highlights' }
                    ].map(item => {
                      const isChecked = (formData.services || []).includes(item.id);
                      return (
                        <label 
                          key={item.id} 
                          className="checkbox-card"
                          style={{ padding: '0.75rem 0.9rem', fontSize: '0.86rem' }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const curr = formData.services || [];
                              const updated = e.target.checked
                                ? [...curr, item.id]
                                : curr.filter(x => x !== item.id);
                              setFormData({ ...formData, services: updated });
                            }}
                          />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Message */}
                <div className="form-group">
                  <label className="form-label">
                    Event Details &amp; Requirements <span className="required">*</span>
                  </label>
                  <textarea
                    rows="4"
                    name="message"
                    required
                    minLength={5}
                    placeholder="Tell us about your event, tournament format, equipment needs, or café catering requirements..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="form-textarea"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary btn-block btn-lg btn-submit"
                >
                  {isSubmitting ? (
                    'Submitting Inquiry...'
                  ) : (
                    <>
                      <Send size={18} /> Submit Inquiry Request
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* INQUIRY SUBMISSION CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={executeInquirySubmit}
        title="Review & Confirm Inquiry"
        type="info"
        message="Please verify your group or event inquiry details before submitting to our arena management team."
        details={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Event Type:</span>
              <strong style={{ color: 'var(--brand-cream)' }}>
                {inquiryTypes.find(t => t.value === formData.inquiryType)?.label || formData.inquiryType}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Target Arena:</span>
              <strong style={{ color: 'var(--brand-olive-bright)', textTransform: 'capitalize' }}>
                {formData.facility.replace(/-/g, ' ')}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Contact Person:</span>
              <strong style={{ color: 'var(--brand-cream)' }}>{formData.fullName} ({formData.phone})</strong>
            </div>
            {formData.preferredDate && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Date &amp; Time Window:</span>
                <span style={{ color: 'var(--brand-cream-muted)' }}>{formData.preferredDate} ({formData.preferredTime})</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.2rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Expected Squad Size:</span>
              <span style={{ color: 'var(--brand-orange)', fontWeight: 600 }}>{formData.groupSize} Guests / Players</span>
            </div>
          </div>
        }
        confirmText="Confirm & Send Request"
        cancelText="Edit Details"
        isLoading={isSubmitting}
      />

      {/* ERROR NOTICE MODAL */}
      <ConfirmationModal
        isOpen={!!inquiryErrorMessage}
        onClose={() => setInquiryErrorMessage('')}
        onConfirm={() => setInquiryErrorMessage('')}
        title="Inquiry Notice"
        type="danger"
        message={inquiryErrorMessage}
        confirmText="Understood"
        cancelText="Close"
      />
    </div>
  );
}

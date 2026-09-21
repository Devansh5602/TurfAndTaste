import React, { useState } from 'react';
import { contactData } from '../data/contactData';
import { api } from '../services/api';
import SectionHeading from '../components/SectionHeading';
import CourtBackground from '../components/CourtBackground';
import Toast from '../components/Toast';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Send, 
  CheckCircle2, 
  MessageSquare, 
  AlertCircle,
  Car,
  Compass,
  ArrowRight
} from 'lucide-react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subject: '',
    message: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Full name is required.';
    if (!formData.phone.trim()) {
      errs.phone = 'Phone number is required.';
    } else if (!/^[6-9]\d{9}$/.test(formData.phone.replace(/\s+/g, ''))) {
      errs.phone = 'Enter a valid 10-digit mobile number.';
    }
    if (!formData.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errs.email = 'Enter a valid email address.';
    }
    if (!formData.message.trim()) errs.message = 'Please enter your message.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await api.sendInquiry({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        category: formData.subject ? `Contact: ${formData.subject}` : 'General Contact',
        message: formData.message
      });
      if (!result.success) {
        throw new Error(result.error || 'We could not send your message. Please try again.');
      }
      setToastType('success');
      setToastMessage('Message received! Our Patan team will respond shortly.');
      setFormData({ name: '', phone: '', email: '', subject: '', message: '' });
    } catch (err) {
      setToastType('error');
      setToastMessage(err.message || 'We could not send your message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-contact">
      {toastMessage && (
        <Toast 
          message={toastMessage} 
          type={toastType}
          onClose={() => setToastMessage(null)} 
        />
      )}

      {/* Header */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden', paddingBottom: '2.5rem' }}>
        <CourtBackground />
        <div className="container" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <span className="badge badge-olive" style={{ marginBottom: '1rem' }}>
            Get in Touch
          </span>
          <h1 style={{ marginBottom: '1rem' }}>
            Contact <span className="text-olive">Turf &amp; Taste</span>
          </h1>
          <p style={{ maxWidth: '680px', margin: '0 auto', fontSize: '1.2rem', lineHeight: '1.6' }}>
            Have questions about court bookings, tournament scheduling, or our Patan arena location? We are here to assist.
          </p>
        </div>
      </section>

      {/* Contact Grid & Map */}
      <section className="section" style={{ paddingTop: '1rem' }}>
        <div className="container">
          <div className="grid grid-2" style={{ gap: '3rem' }}>
            {/* Left Column: Direct Info & Location */}
            <div>
              <h3 style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>
                Visit Us in <span className="text-olive">Patan, Gujarat</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>
                <div className="card-arena" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <MapPin size={24} className="text-orange" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>Arena Location</h4>
                    <p style={{ fontSize: '0.94rem', color: 'var(--brand-cream)' }}>{contactData.address}</p>
                    <span style={{ fontSize: '0.82rem', color: 'var(--brand-olive-bright)', marginTop: '0.25rem', display: 'block' }}>
                      Landmark: {contactData.landmark}
                    </span>
                  </div>
                </div>

                <div className="card-arena" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <Clock size={24} className="text-olive" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>Operating Hours</h4>
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                      <strong>Sports &amp; Nets:</strong> {contactData.hours.sportsArenas}
                    </p>
                    <p style={{ fontSize: '0.9rem' }}>
                      <strong>Café &amp; Dining:</strong> {contactData.hours.cafeAndDining}
                    </p>
                  </div>
                </div>

                <div className="card-arena" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <Phone size={24} className="text-orange" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>Phone &amp; WhatsApp</h4>
                    <p style={{ fontSize: '0.92rem' }}>
                      Calling: <a href="tel:+919876543210">{contactData.phone}</a>
                    </p>
                    <p style={{ fontSize: '0.92rem' }}>
                      WhatsApp Chat: <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer">{contactData.whatsapp}</a>
                    </p>
                  </div>
                </div>

                <div className="card-arena" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <Mail size={24} className="text-olive" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>Email Inquiries</h4>
                    <p style={{ fontSize: '0.92rem' }}>
                      General: <a href={`mailto:${contactData.email}`}>{contactData.email}</a>
                    </p>
                    <p style={{ fontSize: '0.92rem' }}>
                      Bookings: <a href={`mailto:${contactData.inquiriesEmail}`}>{contactData.inquiriesEmail}</a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Driving Directions card */}
              <div className="card-arena highlight">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Car size={20} className="text-olive" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>How to Reach</h4>
                </div>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                  Easily accessible from Patan Bypass Road. Approximately 5 minutes drive from Patan Railway Station and 8 minutes from Rani Ki Vav heritage road. Dedicated free on-site parking available for two-wheelers and four-wheelers.
                </p>
              </div>
            </div>

            {/* Right Column: General Contact Form */}
            <div>
              <div className="card-arena highlight" style={{ padding: 'clamp(1.75rem, 4vw, 2.5rem)' }}>
                <span className="badge badge-olive" style={{ marginBottom: '1rem' }}>
                  Send a Message
                </span>
                <h3 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
                  Drop Us a Note
                </h3>
                <p style={{ fontSize: '0.92rem', marginBottom: '1.75rem' }}>
                  Have feedback or general questions? Fill in the details below and we will get back to you promptly.
                </p>

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">
                      Your Full Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      minLength={2}
                      placeholder="e.g. Vikram Patel"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="grid grid-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">
                        Phone Number <span className="required">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        required
                        pattern="[6-9][0-9]{9}"
                        title="Please enter a valid 10-digit mobile number starting with 6-9"
                        placeholder="10-digit mobile"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Email Address <span className="required">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="e.g. vikram@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <input
                      type="text"
                      name="subject"
                      placeholder="e.g. Inquiry about upcoming cricket tournament"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Your Message <span className="required">*</span>
                    </label>
                    <textarea
                      rows="4"
                      name="message"
                      required
                      minLength={5}
                      placeholder="Type your question or query here..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="form-textarea"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary btn-block btn-lg btn-submit"
                    style={{ marginTop: '0.5rem' }}
                  >
                    {isSubmitting ? (
                      'Sending Message...'
                    ) : (
                      <>
                        <Send size={18} /> Send Message
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Amenities On-Site */}
      <section className="section" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <SectionHeading
            badge="Arena Comforts"
            title="Everyday Amenities"
            highlight="At The Venue"
            subtitle="Everything needed for a hassle-free sporting experience in Patan."
            center
          />

          <div className="grid grid-4" style={{ marginTop: '2.5rem' }}>
            {contactData.amenitiesList.map((amenity, idx) => (
              <div key={idx} className="card-arena" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem' }}>
                <CheckCircle2 size={20} className="text-olive" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.92rem', color: 'var(--brand-cream)', fontWeight: 500 }}>
                  {amenity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

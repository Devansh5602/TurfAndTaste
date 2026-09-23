import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { verifyQuoteToken } from '../utils/quoteToken.js';

const router = express.Router();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (keyId && keySecret) {
    try {
      return new Razorpay({ key_id: keyId, key_secret: keySecret });
    } catch (e) {
      console.warn('[Razorpay Integration] Could not initialize SDK:', e.message);
    }
  }
  return null;
};

/**
 * POST /api/payments/create-order
 * Initialize Razorpay Payment Order
 */
router.post('/create-order', async (req, res) => {
  try {
    const { bookingReference, customerName, customerPhone, paymentType, quoteToken } = req.body;
    const verification = verifyQuoteToken(quoteToken);
    if (verification.error) return res.status(400).json({ success: false, error: verification.error });
    const quote = verification.quote;
    const requestedPaymentType = paymentType === 'full' ? 'full' : 'deposit';
    const numericAmount = requestedPaymentType === 'full' ? quote.total : quote.deposit;
    const amountInPaise = numericAmount * 100;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const razorpayInstance = getRazorpayInstance();

    if (razorpayInstance && keyId) {
      const order = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${bookingReference || Date.now()}`,
        notes: {
          customerName: customerName || 'Guest',
          customerPhone: customerPhone || '',
          quoteId: quote.quoteId,
          bookingReference: bookingReference || ''
        }
      });

      await dbAsync.run(
        'INSERT INTO payment_orders (order_id, quote_id, booking_reference, expected_amount, payment_type, quote_context) VALUES (?, ?, ?, ?, ?, ?)',
        [order.id, quote.quoteId, bookingReference || quote.quoteId, numericAmount, requestedPaymentType, JSON.stringify(quote)],
      );
      return res.json({
        success: true,
        isLiveRazorpay: true,
        orderId: order.id,
        amount: numericAmount,
        currency: 'INR',
        keyId
      });
    }

    // A browser must never receive a fake order/key and attempt a gateway
    // checkout. Manual UPI remains a separate, staff-reviewed flow.
    return res.status(503).json({
      success: false,
      error: 'Online payments are not configured for this environment. Please use UPI review or contact the arena.'
    });
  } catch (err) {
    console.error('[Payment Order Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payments/verify
 * Cryptographic Signature Verification & Atomic Booking Creation
 */
router.post('/verify', async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      bookingId, 
      bookingPayload,
    } = req.body;

    const orderContext = await dbAsync.get('SELECT * FROM payment_orders WHERE order_id = ?', [razorpay_order_id]);
    if (!orderContext) return res.status(404).json({ success: false, error: 'Payment order was not found.' });
    if (orderContext.status !== 'created') return res.status(409).json({ success: false, error: 'This payment order has already been processed.' });
    if (bookingId && bookingId !== orderContext.booking_reference) return res.status(409).json({ success: false, error: 'Payment order does not match this booking.' });
    let quote;
    try { quote = JSON.parse(orderContext.quote_context); } catch { return res.status(500).json({ success: false, error: 'Payment order context is invalid.' }); }
    if (quote.exp < Math.floor(Date.now() / 1000)) return res.status(409).json({ success: false, error: 'Payment quote expired before verification. Please contact support if payment was captured.' });

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    let isVerified = false;

    if (keySecret && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body.toString())
        .digest('hex');

      isVerified = razorpay_signature.length === expectedSignature.length
        && crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature));
    } else {
      return res.status(503).json({ success: false, error: 'Online payment verification is unavailable. Please use a configured gateway or submit a UPI reference for staff review.' });
    }

    if (!isVerified) {
      return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
    }

    const razorpayInstance = getRazorpayInstance();
    if (!razorpayInstance) return res.status(503).json({ success: false, error: 'Online payment verification is unavailable.' });
    const providerPayment = await razorpayInstance.payments.fetch(razorpay_payment_id);
    if (providerPayment.order_id !== razorpay_order_id || Number(providerPayment.amount) !== Number(orderContext.expected_amount) * 100) {
      return res.status(409).json({ success: false, error: 'Provider payment does not match the expected order amount.' });
    }
    const finalPaymentId = razorpay_payment_id;
    const targetBookingId = orderContext.booking_reference;

    // 1. Audit Log Payment in payments table
    let confirmedBooking = null;

    // Atomically record the provider payment, consume the quote, and create
    // the booking from persisted server context (not browser amounts/status).
    if (bookingPayload) {
      const b = bookingPayload;
      const bId = targetBookingId;
      const facilityId = quote.facilityId;
      const facilityName = quote.facilityName;
      const date = quote.date;
      const timeSlot = quote.timeSlot;
      const customerName = String(b.customer?.name || b.customerName || '').trim();
      const customerPhone = String(b.customer?.phone || b.customerPhone || '').replace(/\D/g, '');
      const customerEmail = String(b.customer?.email || b.customerEmail || '').trim();
      if (customerName.length < 2 || !/^[6-9]\d{9}$/.test(customerPhone)) {
        return res.status(400).json({ success: false, error: 'A valid customer name and 10-digit mobile number are required to confirm payment.' });
      }
      const teamName = b.customer?.teamName || b.teamName || '';
      const duration = quote.durationHours;
      const bPaymentType = orderContext.payment_type;
      const amountPaid = `₹${orderContext.expected_amount} (${bPaymentType === 'full' ? 'Full Payment' : 'Token Deposit'})`;
      const bookingInsert = {
        sql: `INSERT INTO bookings (
            id, facility_id, facility_name, date, time_slot, customer_name,
            customer_phone, customer_email, team_name, duration, payment_type,
            amount_paid, payment_status, booking_status, payment_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', 'Confirmed', ?)`,
        params: [
            bId, facilityId, facilityName, date, timeSlot, customerName,
            customerPhone, customerEmail, teamName, duration, bPaymentType,
            amountPaid, finalPaymentId
        ],
      };
      await dbAsync.transaction([
        { sql: 'INSERT INTO quote_redemptions (quote_id, booking_id, expires_at) VALUES (?, ?, ?)', params: [quote.quoteId, bId, new Date(quote.exp * 1000).toISOString()] },
        { sql: `INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_type, status) VALUES (?, ?, ?, ?, ?, ?, 'captured')`, params: [bId, razorpay_order_id, finalPaymentId, razorpay_signature, orderContext.expected_amount, bPaymentType] },
        { sql: "UPDATE payment_orders SET status = 'verified', payment_id = ?, verified_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status = 'created'", params: [finalPaymentId, razorpay_order_id] },
        bookingInsert,
      ]);

      confirmedBooking = {
        id: bId,
        facilityId,
        facilityName,
        date,
        time: timeSlot,
        customerName,
        customerPhone,
        customerEmail,
        teamName,
        duration,
        paymentType: bPaymentType,
        amount: amountPaid,
        status: 'Confirmed',
        paymentId: finalPaymentId
      };
    } else return res.status(400).json({ success: false, error: 'Booking details are required to confirm this payment.' });

    res.json({
      success: true,
      verified: true,
      paymentId: finalPaymentId,
      booking: confirmedBooking,
      message: 'Payment verified and booking confirmed in Cloud Database'
    });
  } catch (err) {
    console.error('[Payment Verification Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/payments/history
 * Get payment logs
 */
router.get('/history', authenticateAdminToken, async (req, res) => {
  try {
    const payments = await dbAsync.all('SELECT * FROM payments ORDER BY created_at DESC');
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

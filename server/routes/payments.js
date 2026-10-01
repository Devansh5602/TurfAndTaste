import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import dbAsync from '../db.js';
import { authenticateAdminToken } from '../middleware/auth.js';
import { verifyQuoteToken } from '../utils/quoteToken.js';
import { requirePermission } from '../domain/rbac/rbacEngine.js';
import { finalizeBookingFromPayment } from '../domain/booking/paymentFinalization.js';

const router = express.Router();

export function resolveSignedQuotePayableAmount(quote, paymentType) {
  const requestedPaymentType = paymentType === 'full' ? 'full' : 'deposit';
  if (quote.fullPaymentRequired && requestedPaymentType !== 'full') {
    const error = new Error('This reservation requires full payment.');
    error.httpStatus = 409;
    throw error;
  }
  const amountInPaise = Number(
    requestedPaymentType === 'full' ? quote.totalAmountPaise : quote.depositAmountPaise
  );
  if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
    const error = new Error('The signed quote does not contain a valid payable amount.');
    error.httpStatus = 400;
    throw error;
  }
  return { requestedPaymentType, amountInPaise };
}

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
    let payable;
    try {
      payable = resolveSignedQuotePayableAmount(quote, paymentType);
    } catch (error) {
      return res.status(error.httpStatus || 400).json({ success: false, error: error.message });
    }
    const { requestedPaymentType, amountInPaise } = payable;
    const numericAmount = amountInPaise / 100;
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
        `INSERT INTO payment_orders (
           order_id, quote_id, booking_reference, expected_amount,
           expected_amount_paise, payment_type, quote_context
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          quote.quoteId,
          bookingReference || quote.quoteId,
          Math.round(numericAmount),
          amountInPaise,
          requestedPaymentType,
          JSON.stringify(quote)
        ],
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
 * Cryptographic Signature Verification & Canonical Booking Finalization
 *
 * This is the ONLY authoritative path for confirming a Razorpay-backed booking.
 * All booking creation is delegated to finalizeBookingFromPayment() which:
 * - Uses server-persisted quote context (never client-submitted prices/status)
 * - Acquires a per-facility resource lock within a single database transaction
 * - Checks conflicts, creates booking + session + payment records atomically
 * - Is idempotent: duplicate callbacks return the existing confirmed booking
 */
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingPayload,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Payment gateway credentials are required.' });
    }

    // 1. Cryptographic signature verification (HMAC-SHA256)
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(503).json({ success: false, error: 'Online payment verification is unavailable. Please use UPI review or contact the arena.' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    const isVerified = razorpay_signature.length === expectedSignature.length
      && crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature));

    if (!isVerified) {
      return res.status(400).json({ success: false, error: 'Payment signature verification failed.' });
    }

    // 2. Load persisted order context for provider cross-check
    const orderContext = await dbAsync.get(
      'SELECT * FROM payment_orders WHERE order_id = ?',
      [razorpay_order_id]
    );
    if (!orderContext) {
      return res.status(404).json({ success: false, error: 'Payment order not found.' });
    }

    // 3. Idempotency: if already verified and finalized, return existing booking
    if (orderContext.status === 'verified' && orderContext.finalized_booking_id) {
      const existingBooking = await dbAsync.get(
        'SELECT * FROM bookings WHERE id = ?',
        [orderContext.finalized_booking_id]
      );
      if (existingBooking) {
        return res.json({
          success: true,
          verified: true,
          idempotent: true,
          paymentId: razorpay_payment_id,
          booking: {
            id: existingBooking.id,
            facilityName: existingBooking.facility_name,
            date: existingBooking.date,
            time: existingBooking.time_slot,
            customerName: existingBooking.customer_name,
            status: existingBooking.booking_status,
            paymentId: razorpay_payment_id
          },
          message: 'Payment already verified and booking confirmed.'
        });
      }
    }

    // 4. Provider payment cross-check (amount & order binding)
    const razorpayInstance = getRazorpayInstance();
    if (!razorpayInstance) {
      return res.status(503).json({ success: false, error: 'Online payment verification is unavailable.' });
    }
    const providerPayment = await razorpayInstance.payments.fetch(razorpay_payment_id);
    if (
      providerPayment.order_id !== razorpay_order_id ||
      Number(providerPayment.amount) !== Number(
        orderContext.expected_amount_paise ?? Number(orderContext.expected_amount) * 100
      )
    ) {
      return res.status(409).json({
        success: false,
        error: 'Provider payment does not match the expected order amount.'
      });
    }

    // 5. Extract customer details from bookingPayload (name/phone/email only)
    //    ALL pricing, facility, date, time, status come from server-persisted quote.
    const b = bookingPayload || {};
    const customerDetails = {
      name: String(b.customer?.name || b.customerName || '').trim(),
      phone: String(b.customer?.phone || b.customerPhone || '').replace(/\D/g, ''),
      email: String(b.customer?.email || b.customerEmail || '').trim(),
      teamName: String(b.customer?.teamName || b.teamName || '').trim()
    };

    if (customerDetails.name.length < 2 || !/^[6-9]\d{9}$/.test(customerDetails.phone)) {
      return res.status(400).json({
        success: false,
        error: 'A valid customer name and 10-digit mobile number are required to confirm the booking.'
      });
    }

    // 6. Delegate ALL booking finalization to the canonical service
    const result = await finalizeBookingFromPayment(dbAsync, {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      customerDetails,
      holdToken: b.holdToken || null
    });

    const legacyTime = result.interval
      ? (() => {
          const fmtTime = (d) => {
            const h = (d.getUTCHours() + 5 + Math.floor((d.getUTCMinutes() + 30) / 60)) % 24;
            const m = (d.getUTCMinutes() + 30) % 60;
            const p = h >= 12 ? 'PM' : 'AM'; const dh = h % 12 || 12;
            return `${String(dh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
          };
          return `${fmtTime(result.interval.startAt)} – ${fmtTime(result.interval.endAt)}`;
        })()
      : '';

    res.json({
      success: true,
      verified: true,
      idempotent: result.idempotent || false,
      paymentId: razorpay_payment_id,
      booking: {
        id: result.bookingId,
        facilityId: result.physicalFacilityId,
        facilityName: result.facilityName,
        date: result.date,
        time: legacyTime,
        customerName: result.customerName,
        customerPhone: result.customerPhone,
        customerEmail: result.customerEmail,
        teamName: result.teamName,
        paymentType: result.paymentType,
        status: result.bookingStatus,
        paymentId: razorpay_payment_id
      },
      message: result.idempotent
        ? 'Payment already verified. Booking confirmed.'
        : 'Payment verified and booking confirmed.'
    });
  } catch (err) {
    console.error('[Payment Verification Error]:', err);
    const status = err.httpStatus || 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/payments/history
 * Get payment logs (Requires payment.read)
 */
router.get('/history', authenticateAdminToken, requirePermission('payment.read'), async (req, res) => {
  try {
    const payments = await dbAsync.all('SELECT * FROM payments ORDER BY created_at DESC');
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import dbAsync from '../db.js';

const router = express.Router();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

let razorpayInstance = null;
if (keyId && keySecret) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    console.log('[Razorpay Integration] Initialized with Key ID:', keyId);
  } catch (e) {
    console.warn('[Razorpay Integration] Could not initialize SDK:', e.message);
  }
}

/**
 * POST /api/payments/create-order
 * Initialize Razorpay Payment Order
 */
router.post('/create-order', async (req, res) => {
  try {
    const { amount, bookingReference, customerName, customerPhone } = req.body;

    const numericAmount = parseInt(amount, 10) || 500;
    const amountInPaise = numericAmount * 100;

    if (razorpayInstance) {
      const order = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${bookingReference || Date.now()}`,
        notes: {
          customerName: customerName || 'Guest',
          customerPhone: customerPhone || ''
        }
      });

      return res.json({
        success: true,
        isLiveRazorpay: true,
        orderId: order.id,
        amount: numericAmount,
        currency: 'INR',
        keyId
      });
    }

    // Fallback mode if Razorpay API keys are not set in .env
    const mockOrderId = `order_sim_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    res.json({
      success: true,
      isLiveRazorpay: false,
      orderId: mockOrderId,
      amount: numericAmount,
      currency: 'INR',
      keyId: 'rzp_test_simulated_key',
      message: 'Simulated Payment Order initialized'
    });
  } catch (err) {
    console.error('[Payment Order Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payments/verify
 * Cryptographic Signature Verification & Payment Log DB Record
 */
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId, amount, paymentType } = req.body;

    let isVerified = false;

    if (keySecret && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body.toString())
        .digest('hex');

      isVerified = expectedSignature === razorpay_signature;
    } else {
      isVerified = true;
    }

    if (!isVerified) {
      return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
    }

    const finalPaymentId = razorpay_payment_id || `pay_sim_${Date.now()}`;

    await dbAsync.run(
      `INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_type, status)
       VALUES (?, ?, ?, ?, ?, ?, 'captured')`,
      [
        bookingId || 'UNKNOWN',
        razorpay_order_id || 'N/A',
        finalPaymentId,
        razorpay_signature || 'simulated_sig',
        amount || 500,
        paymentType || 'deposit'
      ]
    );

    if (bookingId) {
      await dbAsync.run(
        'UPDATE bookings SET payment_id = ?, payment_status = ? WHERE id = ?',
        [finalPaymentId, 'Paid', bookingId]
      );
    }

    res.json({
      success: true,
      verified: true,
      paymentId: finalPaymentId,
      message: 'Payment verified and audit logged in Cloud Database'
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
router.get('/history', async (req, res) => {
  try {
    const payments = await dbAsync.all('SELECT * FROM payments ORDER BY created_at DESC');
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

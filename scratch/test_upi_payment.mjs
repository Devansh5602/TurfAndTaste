const BASE_URL = 'http://localhost:5000/api';

async function testUpiVerification() {
  const targetBookingId = `TT-UPI-${Math.floor(100000 + Math.random() * 900000)}`;
  const payload = {
    bookingId: targetBookingId,
    bookingPayload: {
      id: targetBookingId,
      facilitySlug: 'box-cricket',
      facilityName: 'Box Cricket Arena',
      date: new Date().toISOString().split('T')[0],
      time: '08:00 PM – 09:00 PM',
      customer: {
        name: 'Rahul UPI Tester',
        phone: '9876543210',
        email: 'rahul.upi@example.com',
        teamName: 'Patan Kings'
      },
      duration: 1,
      paymentType: 'deposit',
      amount: '₹500 (Token Deposit)'
    },
    razorpay_order_id: `order_upi_${Date.now()}`,
    razorpay_payment_id: `pay_upi_utr_123456789012`,
    razorpay_signature: 'direct_upi_verified',
    amount: 500,
    paymentType: 'deposit'
  };

  const res = await fetch(`${BASE_URL}/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log('UPI Verification Response:', data);

  if (data.success && data.paymentId) {
    console.log('✅ Direct UPI verification test passed successfully!');
  } else {
    throw new Error('Failed to verify direct UPI');
  }
}

testUpiVerification().catch(console.error);

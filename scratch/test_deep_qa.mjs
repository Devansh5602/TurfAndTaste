// Automated Deep QA Test Suite for Turf & Taste APIs and Logic
// Using native global fetch (Node 22)

const BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING TURF & TASTE DEEP QA AUDIT ---');
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failCount++;
    }
  }

  // 1. Health
  try {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    assert(res.status === 200 && data.status === 'online', 'Health endpoint returns 200 OK & online');
  } catch (e) {
    assert(false, `Health endpoint failed: ${e.message}`);
  }

  // 2. Facilities & Pricing
  let facilities = [];
  try {
    const res = await fetch(`${BASE}/pricing`);
    const data = await res.json();
    assert(res.status === 200 && data.success && Array.isArray(data.pricing), 'Pricing endpoint returns facility list');
    facilities = data.pricing || [];
    assert(facilities.length >= 5, `Found ${facilities.length} active sports facilities`);
  } catch (e) {
    assert(false, `Pricing endpoint failed: ${e.message}`);
  }

  // 3. Timings
  try {
    const res = await fetch(`${BASE}/timings`);
    const data = await res.json();
    assert(res.status === 200 && data.success, 'Operating timings endpoint returns active timings');
  } catch (e) {
    assert(false, `Timings endpoint failed: ${e.message}`);
  }

  // 4. Slot Availability for Box Cricket
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  let availableSlot = null;
  try {
    const res = await fetch(`${BASE}/bookings/slots?facilityId=box-cricket&date=${dateStr}`);
    const data = await res.json();
    assert(res.status === 200 && data.success, `Slot availability returned for box-cricket on ${dateStr}`);
    assert(Array.isArray(data.slots) && data.slots.length > 0, `Returned ${data.slots?.length} total slots`);
    availableSlot = data.slots.find(s => s.status === 'available');
    assert(!!availableSlot, `Found available slot: ${availableSlot?.time}`);
  } catch (e) {
    assert(false, `Slot availability failed: ${e.message}`);
  }

  // 5. Booking Creation - Validation Checks
  try {
    // Missing required fields
    const res = await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId: 'box-cricket' })
    });
    assert(res.status === 400 || res.status === 422, 'Invalid booking request rejected with 400/422 status');
  } catch (e) {
    assert(false, `Validation check failed: ${e.message}`);
  }

  // 6. Booking Creation - Happy Path
  let testBookingId = null;
  if (availableSlot) {
    try {
      const payload = {
        facilityId: 'box-cricket',
        facilityName: 'Box Cricket Arena',
        date: dateStr,
        time: availableSlot.time,
        customerName: 'QA Test User',
        customerPhone: '9876543210',
        customerEmail: 'qa.tester@turfandtaste.com',
        price: availableSlot.price || 1200,
        paymentMethod: 'Venue',
        paymentStatus: 'Pending',
        bookingStatus: 'Confirmed'
      };

      const res = await fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      assert(res.status === 201 || (res.status === 200 && data.success), `Booking created successfully, ID: ${data.booking?.id || data.id}`);
      testBookingId = data.booking?.id || data.id;

      // 7. Double-Booking Prevention: Attempting to book the SAME slot again
      const dupRes = await fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const dupData = await dupRes.json();
      assert(!dupData.success || dupRes.status === 409 || dupRes.status === 400, 'Double-booking prevention: duplicate slot request blocked');
    } catch (e) {
      assert(false, `Booking creation failed: ${e.message}`);
    }
  }

  // 8. Admin Authentication - Invalid Password
  try {
    const res = await fetch(`${BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    assert(res.status === 401 || res.status === 400, 'Admin login rejects incorrect credentials');
  } catch (e) {
    assert(false, `Admin invalid login test failed: ${e.message}`);
  }

  // 9. Admin Authentication - Valid Password & JWT
  let adminToken = null;
  try {
    const res = await fetch(`${BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Turfandtaste2026' })
    });
    const data = await res.json();
    if (data.token) {
      adminToken = data.token;
      assert(true, 'Admin login succeeds and returns JWT token');
    } else {
      assert(false, `Admin login failed: ${data.error}`);
    }
  } catch (e) {
    assert(false, `Admin login test failed: ${e.message}`);
  }

  // 10. Admin Protected Endpoint with Token
  if (adminToken) {
    try {
      const res = await fetch(`${BASE}/admin/verify`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200 && data.success, 'Admin token verification returns authenticated session');
    } catch (e) {
      assert(false, `Admin token verification failed: ${e.message}`);
    }
  }

  // 11. Customer Inquiry Submission
  try {
    const inqPayload = {
      name: 'Corporate Tournament Lead',
      phone: '9988776655',
      email: 'events@company.com',
      facility: 'Box Cricket Arena',
      date: dateStr,
      guestCount: 50,
      message: 'Looking for whole-day arena booking with catering.'
    };
    const res = await fetch(`${BASE}/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inqPayload)
    });
    const data = await res.json();
    const inqId = data.inquiry?.id || data.id;
    assert(res.status === 201 || (res.status === 200 && data.success), 'Inquiry form submission saved successfully');

    // 12. Admin Inquiries Fetch & Status Update
    if (adminToken) {
      const inqListRes = await fetch(`${BASE}/inquiries`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const inqListData = await inqListRes.json();
      assert(inqListRes.status === 200 && inqListData.success, 'Admin can retrieve customer inquiries inbox');

      if (inqId) {
        const updateInqRes = await fetch(`${BASE}/inquiries/${inqId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({ status: 'contacted' })
        });
        const updateInqData = await updateInqRes.json();
        assert(updateInqRes.status === 200 && updateInqData.success, 'Admin can update customer inquiry status');
      }
    }
  } catch (e) {
    assert(false, `Inquiry submission failed: ${e.message}`);
  }

  // 13. Admin Slot Blocking Lifecycle
  if (adminToken) {
    const testBlockTime = '10:00 PM – 11:00 PM';
    try {
      // Admin blocks a slot
      const blockRes = await fetch(`${BASE}/bookings/block-slot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          facilityId: 'box-cricket',
          date: dateStr,
          timeSlot: testBlockTime,
          reason: 'Floodlight Bulb Replacement'
        })
      });
      const blockData = await blockRes.json();
      assert(blockRes.status === 200 && blockData.success, 'Admin can block slot for facility maintenance');

      // Verify slot shows as maintenance in public slot listing
      const checkRes = await fetch(`${BASE}/bookings/slots?facilityId=box-cricket&date=${dateStr}`);
      const checkData = await checkRes.json();
      const blockedSlotItem = checkData.slots?.find(s => s.time === testBlockTime);
      assert(blockedSlotItem?.status === 'maintenance', 'Customer slot listing displays blocked slot as maintenance');

      // Customer attempt to book blocked slot must be rejected
      const bookBlockedRes = await fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: 'box-cricket',
          facilityName: 'Box Cricket Arena',
          date: dateStr,
          time: testBlockTime,
          customerName: 'Denied Customer',
          customerPhone: '9988776655'
        })
      });
      const bookBlockedData = await bookBlockedRes.json();
      assert(bookBlockedRes.status === 409 && !bookBlockedData.success, 'Booking attempt on blocked maintenance slot rejected with 409 Conflict');

      // Admin unblocks the slot
      const unblockRes = await fetch(`${BASE}/bookings/unblock-slot`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          facilityId: 'box-cricket',
          date: dateStr,
          timeSlot: testBlockTime
        })
      });
      const unblockData = await unblockRes.json();
      assert(unblockRes.status === 200 && unblockData.success, 'Admin can unblock and release slot back to availability');

      // Verify slot is available again
      const recheckRes = await fetch(`${BASE}/bookings/slots?facilityId=box-cricket&date=${dateStr}`);
      const recheckData = await recheckRes.json();
      const releasedSlot = recheckData.slots?.find(s => s.time === testBlockTime);
      assert(releasedSlot?.status === 'available' || releasedSlot?.status === 'fast-filling', 'Released slot is now available for public booking');
    } catch (e) {
      assert(false, `Slot blocking lifecycle failed: ${e.message}`);
    }
  }

  // 14. Customer Booking History Lookup
  try {
    const historyRes = await fetch(`${BASE}/bookings/history?phone=9876543210`);
    const historyData = await historyRes.json();
    assert(historyRes.status === 200 && historyData.success, 'Customer booking history lookup by phone returns 200 OK');
    assert(Array.isArray(historyData.history) && historyData.history.length > 0, `History contains ${historyData.history?.length} user bookings`);
  } catch (e) {
    assert(false, `Booking history lookup failed: ${e.message}`);
  }

  console.log(`\n--- DEEP QA AUDIT SUMMARY: ${passCount} PASSED, ${failCount} FAILED ---`);
}

runTests();

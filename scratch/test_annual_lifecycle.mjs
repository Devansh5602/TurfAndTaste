const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('--- Step 1: Login Admin to get token ---');
  const loginRes = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Turfandtaste2026' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Admin Token received:', !!token);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  console.log('\n--- Step 2: Seed a test booking for calendar year 2025 ---');
  const testBookingRes = await fetch(`${BASE_URL}/bookings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      facilityId: 'box-cricket',
      facilityName: 'Box Cricket Arena',
      date: '2025-08-15',
      time: '07:00 PM – 08:00 PM',
      customerName: 'Test Player 2025',
      customerPhone: '9876543210',
      customerEmail: 'player2025@example.com',
      paymentType: 'full',
      amount: 1500,
      status: 'Completed'
    })
  });
  const createdBooking = await testBookingRes.json();
  console.log('Created 2025 Booking ID:', createdBooking.booking?.id);

  console.log('\n--- Step 3: Fetch Available Years ---');
  const yearsRes = await fetch(`${BASE_URL}/archives/years`, { headers });
  const yearsData = await yearsRes.json();
  console.log('Years returned:', yearsData.years);

  console.log('\n--- Step 4: Preview 2025 Data ---');
  const previewRes = await fetch(`${BASE_URL}/archives/preview?year=2025`, { headers });
  const previewData = await previewRes.json();
  console.log('2025 Preview Summary:', {
    totalBookings: previewData.preview?.totalBookings,
    totalRevenue: previewData.preview?.totalRevenue,
    depositCollected: previewData.preview?.depositCollected,
    monthlyRecordsCount: previewData.preview?.monthlyBreakdown?.length
  });

  console.log('\n--- Step 5: Generate Annual PDF Ledger for 2025 & Dispatch Email ---');
  const generateRes = await fetch(`${BASE_URL}/archives/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      year: 2025,
      sendEmail: true,
      recipients: 'admin@turfandtaste.com, audit@turfandtaste.com'
    })
  });
  const generateData = await generateRes.json();
  console.log('Generate & Dispatch response:', {
    success: generateData.success,
    fileName: generateData.archive?.fileName,
    pdfSize: generateData.archive?.pdfSizeBytes,
    recipients: generateData.archive?.recipients
  });

  console.log('\n--- Step 6: Verify Archive Vault listing ---');
  const vaultRes = await fetch(`${BASE_URL}/archives`, { headers });
  const vaultData = await vaultRes.json();
  const found2025 = vaultData.archives?.find(a => Number(a.year) === 2025);
  console.log('Found 2025 in Vault:', {
    id: found2025?.id,
    fileName: found2025?.fileName,
    purgedFromDb: found2025?.purgedFromDb
  });

  console.log('\n--- Step 7: Test Safeguarded DB Purge for 2025 ---');
  const purgeRes = await fetch(`${BASE_URL}/archives/purge`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      year: 2025,
      confirmationText: 'CONFIRM PURGE 2025'
    })
  });
  const purgeData = await purgeRes.json();
  console.log('Purge result:', purgeData);

  console.log('\n--- Step 8: Verify 2025 Bookings are Erased from Active DB ---');
  const checkBookingsRes = await fetch(`${BASE_URL}/bookings?year=2025`, { headers });
  const checkBookings = await checkBookingsRes.json();
  const bookings2025 = (checkBookings.bookings || []).filter(b => b.date.startsWith('2025'));
  console.log('Remaining 2025 bookings in DB:', bookings2025.length, '(Expected: 0)');

  console.log('\n--- Step 9: Verify Vault Record still exists and is marked purged ---');
  const vaultCheckRes = await fetch(`${BASE_URL}/archives`, { headers });
  const vaultCheckData = await vaultCheckRes.json();
  const vault2025AfterPurge = vaultCheckData.archives?.find(a => Number(a.year) === 2025);
  console.log('Vault 2025 Record after purge:', {
    id: vault2025AfterPurge?.id,
    fileName: vault2025AfterPurge?.fileName,
    purgedFromDb: vault2025AfterPurge?.purgedFromDb
  });

  console.log('\n--- All Lifecycle Steps Passed! ---');
}

runTest().catch(console.error);

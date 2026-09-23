import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import inquiryRoutes from './routes/inquiries.js';
import pricingRoutes from './routes/pricing.js';
import archiveRoutes from './routes/archives.js';
import facilityRoutes from './routes/facilities.js';
import v2SettingsRoutes from './routes/v2/settings.js';
import v2QuoteRoutes from './routes/v2/quotes.js';
import v2FoodRoutes from './routes/v2/food.js';
import v2EventRoutes from './routes/v2/events.js';
import { sendError } from './utils/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env configuration
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:3000',
  'http://localhost:5000',
  'https://turf-and-taste.vercel.app'
];

// Enable CORS and JSON parsing
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/turf-and-taste.*\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Database safely
try {
  initDatabase().catch(err => {
    console.error('[Database Init Error]:', err?.message || err);
  });
} catch (err) {
  console.error('[Database Bootstrap Error]:', err?.message || err);
}

// API Health Check
app.get('/api/health', (req, res) => {
  const envKeys = Object.keys(process.env).sort();
  res.json({
    status: 'online',
    service: 'Turf & Taste Backend API',
    timestamp: new Date().toISOString(),
    environment: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      hasRazorpayKey: Boolean(process.env.RAZORPAY_KEY_ID),
      razorpayKeyPrefix: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.slice(0, 8) : null,
      vercelEnv: process.env.VERCEL_ENV || null,
      vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
      allKeysSample: envKeys.filter(k => !k.toLowerCase().includes('secret') && !k.toLowerCase().includes('pass') && !k.toLowerCase().includes('key') && !k.toLowerCase().includes('token') && !k.toLowerCase().includes('url'))
    }
  });
});

// Route Mounting
app.use('/api/admin', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/archives', archiveRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/v2/settings', v2SettingsRoutes);
app.use('/api/v2/quotes', v2QuoteRoutes);
app.use('/api/v2/food', v2FoodRoutes);
app.use('/api/v2/events', v2EventRoutes);
app.use('/api', pricingRoutes); // Alias for /api/timings

// 404 Handler for undefined API routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// New routes should use explicit `sendError` responses. This final boundary
// still protects every legacy route from leaking an unexpected internal error.
app.use((error, _req, res, _next) => {
  console.error('[Unhandled API Error]:', error);
  if (error?.type === 'entity.parse.failed') {
    return sendError(res, 400, 'Invalid JSON request body.');
  }
  return sendError(res, 500, 'An unexpected server error occurred.');
});

// Start Express Server when not on Vercel serverless
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
  ======================================================
  🏟️  Turf & Taste - Backend Server Running!
  ======================================================
  🚀 Server URL : http://localhost:${PORT}
  📁 Database   : Supabase Cloud PostgreSQL
  🔐 Admin Login: POST http://localhost:${PORT}/api/admin/login
  📅 Bookings   : GET  http://localhost:${PORT}/api/bookings
  💳 Payments   : POST http://localhost:${PORT}/api/payments/create-order
  ======================================================
    `);
  });
}

export default app;

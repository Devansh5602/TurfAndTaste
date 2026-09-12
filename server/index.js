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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env configuration
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite Database
initDatabase();

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Turf & Taste Backend API',
    timestamp: new Date().toISOString()
  });
});

// Route Mounting
app.use('/api/admin', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/archives', archiveRoutes);
app.use('/api', pricingRoutes); // Alias for /api/timings

// 404 Handler for undefined API routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
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

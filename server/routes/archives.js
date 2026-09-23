/**
 * Turf & Taste - Annual Archive, PDF Ledger & Database Cleanup Routes
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dbAsync from '../db.js';
import { generateAnnualLedgerPDF } from '../services/pdfReportGenerator.js';
import { sendAnnualArchiveEmail } from '../services/emailService.js';
import { authenticateAdminToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARCHIVES_DIR = process.env.VERCEL
  ? path.join('/tmp', 'archives')
  : path.join(__dirname, '..', 'data', 'archives');

try {
  if (!fs.existsSync(ARCHIVES_DIR)) {
    fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem in serverless environments; will create lazily in writable /tmp if needed
}


const router = express.Router();

// Annual reports, recipient lists, and purge operations are management-only data.
router.use(authenticateAdminToken);

/**
 * GET /api/archives/settings
 * Get the configured email distribution list
 */
router.get('/settings', async (req, res) => {
  try {
    const row = await dbAsync.get("SELECT value FROM system_settings WHERE key = 'archive_email_list'");
    const emailListStr = row?.value || process.env.DEFAULT_ARCHIVE_EMAILS || 'admin@turfandtaste.com, accounts@turfandtaste.com';
    const emailList = emailListStr.split(',').map(e => e.trim()).filter(Boolean);

    res.json({
      success: true,
      emailList,
      emailListStr
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/archives/settings
 * Update the configured email distribution list
 */
router.post('/settings', async (req, res) => {
  try {
    const { emailList, emailListStr } = req.body;
    let finalStr = '';

    if (Array.isArray(emailList)) {
      finalStr = emailList.map(e => String(e).trim()).filter(Boolean).join(', ');
    } else if (typeof emailListStr === 'string') {
      finalStr = emailListStr.split(',').map(e => e.trim()).filter(Boolean).join(', ');
    }

    if (!finalStr) {
      return res.status(400).json({ success: false, error: 'Please provide at least one valid recipient email.' });
    }

    if (dbAsync.isPostgres()) {
      await dbAsync.run(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('archive_email_list', ?, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [finalStr]
      );
    } else {
      await dbAsync.run(
        `INSERT OR REPLACE INTO system_settings (key, value, updated_at)
         VALUES ('archive_email_list', ?, CURRENT_TIMESTAMP)`,
        [finalStr]
      );
    }

    res.json({
      success: true,
      emailListStr: finalStr,
      emailList: finalStr.split(', ').filter(Boolean),
      message: 'Email distribution list updated successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/archives/years
 * Get available calendar years with booking metrics and archive status
 */
router.get('/years', async (req, res) => {
  try {
    // 1. Get all distinct years in bookings
    const bookings = await dbAsync.all("SELECT date, amount_paid, booking_status FROM bookings WHERE date IS NOT NULL");
    
    // 2. Get all existing archive records
    const archives = await dbAsync.all("SELECT * FROM annual_archives ORDER BY year DESC, archived_at DESC");

    const yearsMap = {};

    bookings.forEach(b => {
      const match = String(b.date).match(/^(\d{4})/);
      if (match) {
        const y = parseInt(match[1], 10);
        if (!yearsMap[y]) {
          yearsMap[y] = {
            year: y,
            bookingsCount: 0,
            revenue: 0,
            isArchived: false,
            isPurged: false,
            archiveDetails: null
          };
        }
        yearsMap[y].bookingsCount++;
        const amt = parseInt(String(b.amount_paid || 0).replace(/[^0-9]/g, ''), 10) || 0;
        yearsMap[y].revenue += amt;
      }
    });

    // Merge with archived years that may already be purged from live bookings
    archives.forEach(arc => {
      const y = arc.year;
      if (!yearsMap[y]) {
        yearsMap[y] = {
          year: y,
          bookingsCount: arc.total_bookings,
          revenue: arc.total_revenue,
          isArchived: true,
          isPurged: !!arc.purged_from_db,
          archiveDetails: arc
        };
      } else {
        yearsMap[y].isArchived = true;
        yearsMap[y].isPurged = !!arc.purged_from_db;
        yearsMap[y].archiveDetails = arc;
      }
    });

    // Ensure current and previous year are present even if empty
    const currentYear = new Date().getFullYear();
    [currentYear, currentYear - 1].forEach(y => {
      if (!yearsMap[y]) {
        yearsMap[y] = {
          year: y,
          bookingsCount: 0,
          revenue: 0,
          isArchived: false,
          isPurged: false,
          archiveDetails: null
        };
      }
    });

    const yearsList = Object.values(yearsMap).sort((a, b) => b.year - a.year);

    res.json({
      success: true,
      years: yearsList
    });
  } catch (err) {
    console.error('[Archive Years Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/archives/preview
 * Get preview summary of records for a specific year
 */
router.get('/preview', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const rawBookings = await dbAsync.all(
      "SELECT * FROM bookings WHERE date >= ? AND date <= ? ORDER BY date ASC, time_slot ASC",
      [startDate, endDate]
    );

    // Existing archive for this year
    const existingArchive = await dbAsync.get(
      "SELECT * FROM annual_archives WHERE year = ? ORDER BY archived_at DESC LIMIT 1",
      [year]
    );

    let grossRevenue = 0;
    let depositsCollected = 0;
    let fullPayments = 0;
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i, 1).toLocaleString('en-US', { month: 'short' }),
      bookings: 0,
      revenue: 0
    }));

    const facilityBreakdown = {};

    rawBookings.forEach(b => {
      const amt = parseInt(String(b.amount_paid || 0).replace(/[^0-9]/g, ''), 10) || 0;
      grossRevenue += amt;

      if (b.payment_type === 'deposit') {
        depositsCollected += amt;
      } else {
        fullPayments += amt;
      }

      if (b.date) {
        const m = new Date(b.date).getMonth();
        if (m >= 0 && m < 12) {
          monthlyStats[m].bookings++;
          monthlyStats[m].revenue += amt;
        }
      }

      const fName = b.facility_name || 'Arena';
      if (!facilityBreakdown[fName]) {
        facilityBreakdown[fName] = { name: fName, count: 0, revenue: 0 };
      }
      facilityBreakdown[fName].count++;
      facilityBreakdown[fName].revenue += amt;
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const monthlyBreakdown = Array.from({ length: 12 }, (_, idx) => {
      const monthBookings = rawBookings.filter(b => b.date && new Date(b.date).getMonth() === idx);
      const mRev = monthBookings.reduce((sum, b) => sum + (parseInt(String(b.amount_paid || 0).replace(/[^0-9]/g, ''), 10) || 0), 0);
      const fullCount = monthBookings.filter(b => b.payment_type !== 'deposit').length;
      const depositCount = monthBookings.filter(b => b.payment_type === 'deposit').length;

      const sports = {};
      monthBookings.forEach(b => {
        const s = b.facility_name || 'Arena';
        sports[s] = (sports[s] || 0) + 1;
      });
      const topSportEntry = Object.entries(sports).sort((a, b) => b[1] - a[1])[0];

      return {
        monthNum: idx + 1,
        monthShort: monthNames[idx],
        monthName: fullMonthNames[idx],
        count: monthBookings.length,
        revenue: mRev,
        fullPaid: fullCount,
        deposit: depositCount,
        topSport: topSportEntry ? topSportEntry[0] : '—'
      };
    });

    const fullPaidCount = rawBookings.filter(b => b.payment_type !== 'deposit').length;
    const depositCount = rawBookings.filter(b => b.payment_type === 'deposit').length;

    const previewData = {
      year,
      startDate,
      endDate,
      totalBookings: rawBookings.length,
      grossRevenue,
      totalRevenue: grossRevenue,
      depositsCollected,
      depositCollected: depositsCollected,
      fullPayments,
      fullPaidCount,
      depositCount,
      monthlyStats,
      monthlyBreakdown,
      facilityBreakdown: Object.values(facilityBreakdown),
      isArchived: !!existingArchive,
      isPurged: !!existingArchive?.purged_from_db,
      alreadyPurged: !!existingArchive?.purged_from_db,
      purgedFromDb: !!existingArchive?.purged_from_db,
      archiveRecord: existingArchive ? {
        id: existingArchive.id,
        year: existingArchive.year,
        fileName: existingArchive.file_name,
        file_name: existingArchive.file_name,
        pdfSizeBytes: existingArchive.pdf_size_bytes,
        pdf_size_bytes: existingArchive.pdf_size_bytes,
        recipients: existingArchive.recipients,
        purgedFromDb: !!existingArchive.purged_from_db,
        archivedAt: existingArchive.archived_at
      } : null,
      existingArchive,
      sampleRecords: rawBookings.slice(0, 50)
    };

    res.json({
      success: true,
      preview: previewData,
      ...previewData
    });
  } catch (err) {
    console.error('[Archive Preview Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/archives/generate
 * Generate PDF Ledger, save to archive vault, and optionally email to distribution list
 */
router.post('/generate', async (req, res) => {
  try {
    const year = parseInt(req.body.year, 10);
    if (!year || isNaN(year)) {
      return res.status(400).json({ success: false, error: 'Valid calendar year is required.' });
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Fetch all bookings for this year
    const bookings = await dbAsync.all(
      "SELECT * FROM bookings WHERE date >= ? AND date <= ? ORDER BY date ASC, time_slot ASC",
      [startDate, endDate]
    );

    const payments = await dbAsync.all(
      `SELECT p.* FROM payments p 
       JOIN bookings b ON p.booking_id = b.id 
       WHERE b.date >= ? AND b.date <= ? 
       ORDER BY p.created_at ASC`,
      [startDate, endDate]
    );

    const timestamp = Date.now();
    const fileName = `Turf_Taste_Annual_Ledger_${year}_${timestamp}.pdf`;
    const outputPath = path.join(ARCHIVES_DIR, fileName);

    // 1. Generate PDF
    const pdfResult = await generateAnnualLedgerPDF({
      year,
      bookings,
      payments,
      outputPath
    });

    // 2. Fetch configured email list
    const settingsRow = await dbAsync.get("SELECT value FROM system_settings WHERE key = 'archive_email_list'");
    const defaultList = settingsRow?.value || 'admin@turfandtaste.com, accounts@turfandtaste.com';
    const finalRecipients = req.body.customRecipients || defaultList;

    // 3. Save entry to annual_archives table
    const archiveId = `ARC-${year}-${timestamp}`;
    const depositSum = bookings.reduce((sum, b) => b.payment_type === 'deposit' ? sum + (parseInt(b.amount_paid, 10) || 0) : sum, 0);

    await dbAsync.run(
      `INSERT INTO annual_archives 
       (id, year, start_date, end_date, total_bookings, total_revenue, deposit_collected, file_name, file_path, pdf_size_bytes, recipients, purged_from_db, archived_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, ?)`,
      [
        archiveId,
        year,
        startDate,
        endDate,
        bookings.length,
        pdfResult.totalRevenue,
        depositSum,
        fileName,
        outputPath,
        pdfResult.sizeBytes,
        finalRecipients,
        req.body.archivedBy || 'admin'
      ]
    );

    // 4. Send Email if requested (default: true)
    let emailResult = null;
    if (req.body.sendEmail !== false) {
      emailResult = await sendAnnualArchiveEmail({
        recipients: finalRecipients,
        year,
        pdfPath: outputPath,
        totalRevenue: pdfResult.totalRevenue,
        totalBookings: bookings.length
      });
    }

    const archiveObj = {
      id: archiveId,
      year,
      fileName,
      file_name: fileName,
      fileSizeBytes: pdfResult.sizeBytes,
      pdfSizeBytes: pdfResult.sizeBytes,
      pdf_size_bytes: pdfResult.sizeBytes,
      totalBookings: bookings.length,
      total_bookings: bookings.length,
      totalRevenue: pdfResult.totalRevenue,
      total_revenue: pdfResult.totalRevenue,
      depositCollected: depositSum,
      recipients: finalRecipients,
      purgedFromDb: false,
      isPurged: false,
      archivedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      archiveId,
      year,
      fileName,
      downloadUrl: `/api/archives/${archiveId}/download`,
      fileSizeBytes: pdfResult.sizeBytes,
      pdfSizeBytes: pdfResult.sizeBytes,
      totalBookings: bookings.length,
      totalRevenue: pdfResult.totalRevenue,
      archive: archiveObj,
      emailResult,
      message: `Annual PDF report for ${year} successfully created, stored in Archive Vault, and dispatched to ${finalRecipients}.`
    });
  } catch (err) {
    console.error('[Archive Generate Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/archives/email
 * Resend an existing annual archive PDF to email recipients
 */
router.post('/email', async (req, res) => {
  try {
    const { archiveId, customRecipients } = req.body;
    const archive = await dbAsync.get("SELECT * FROM annual_archives WHERE id = ?", [archiveId]);

    if (!archive) {
      return res.status(404).json({ success: false, error: 'Archive record not found.' });
    }

    const settingsRow = await dbAsync.get("SELECT value FROM system_settings WHERE key = 'archive_email_list'");
    const recipients = customRecipients || archive.recipients || settingsRow?.value || 'admin@turfandtaste.com';

    const emailResult = await sendAnnualArchiveEmail({
      recipients,
      year: archive.year,
      pdfPath: archive.file_path,
      totalRevenue: archive.total_revenue,
      totalBookings: archive.total_bookings
    });

    res.json({
      success: true,
      emailResult,
      message: `Annual report for ${archive.year} resent successfully to ${recipients}.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
/**
 * POST /api/archives/purge
 * Securely erase booking & payment records of an archived year to free database space
 */
router.post('/purge', async (req, res) => {
  try {
    const { year, confirmKey, confirmationText } = req.body;
    const parsedYear = parseInt(year, 10);

    if (!parsedYear || isNaN(parsedYear)) {
      return res.status(400).json({ success: false, error: 'Valid calendar year is required.' });
    }

    // Double-safeguard confirmation key
    const submittedKey = confirmKey || confirmationText || '';
    const expectedKey = `CONFIRM PURGE ${parsedYear}`;
    if (String(submittedKey).trim() !== expectedKey) {
      return res.status(400).json({
        success: false,
        error: `Safety check failed. You must enter exact confirmation key: "${expectedKey}"`
      });
    }

    // Ensure a validated archive PDF exists first
    const existingArchive = await dbAsync.get(
      "SELECT * FROM annual_archives WHERE year = ? ORDER BY archived_at DESC LIMIT 1",
      [parsedYear]
    );

    if (!existingArchive) {
      return res.status(400).json({
        success: false,
        error: `Cannot purge database records for ${parsedYear}: No verified PDF archive found. Please click "Generate & Save PDF Archive" first.`
      });
    }

    const startDate = `${parsedYear}-01-01`;
    const endDate = `${parsedYear}-12-31`;

    // 1. Count records to be deleted
    const bookingsToDelete = await dbAsync.all(
      "SELECT id FROM bookings WHERE date >= ? AND date <= ?",
      [startDate, endDate]
    );

    const bookingIds = bookingsToDelete.map(b => b.id);
    const count = bookingIds.length;

    // 2. Delete associated payment logs
    if (bookingIds.length > 0) {
      for (const bId of bookingIds) {
        await dbAsync.run("DELETE FROM payments WHERE booking_id = ?", [bId]);
      }
    }

    // 3. Delete booking rows
    await dbAsync.run(
      "DELETE FROM bookings WHERE date >= ? AND date <= ?",
      [startDate, endDate]
    );

    // 4. Update annual_archives table
    await dbAsync.run(
      "UPDATE annual_archives SET purged_from_db = true WHERE year = ?",
      [parsedYear]
    );

    res.json({
      success: true,
      year: parsedYear,
      purgedBookingsCount: count,
      message: `Successfully purged ${count} operational booking records and associated transaction logs for calendar year ${parsedYear}. Database storage has been successfully freed!`
    });
  } catch (err) {
    console.error('[Archive Purge Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/archives
 * List all historical archives in the vault
 */
router.get('/', async (req, res) => {
  try {
    const archives = await dbAsync.all("SELECT * FROM annual_archives ORDER BY year DESC, archived_at DESC");
    const formatted = archives.map(a => ({
      id: a.id,
      year: a.year,
      startDate: a.start_date,
      endDate: a.end_date,
      totalBookings: a.total_bookings,
      totalRevenue: a.total_revenue,
      depositCollected: a.deposit_collected,
      fileName: a.file_name,
      fileSizeBytes: a.pdf_size_bytes,
      pdfSizeBytes: a.pdf_size_bytes,
      recipients: a.recipients,
      isPurged: !!a.purged_from_db,
      purgedFromDb: !!a.purged_from_db,
      archivedAt: a.archived_at,
      archivedBy: a.archived_by,
      downloadUrl: `/api/archives/${a.id}/download`
    }));

    res.json({
      success: true,
      count: formatted.length,
      archives: formatted
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/archives/:id/download
 * Download or stream the stored PDF file
 */
router.get('/:id/download', async (req, res) => {
  try {
    const archive = await dbAsync.get("SELECT * FROM annual_archives WHERE id = ?", [req.params.id]);
    if (!archive) {
      return res.status(404).json({ success: false, error: 'Archive record not found in vault.' });
    }

    const filePath = archive.file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Archived PDF file not found on server disk.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${archive.file_name}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

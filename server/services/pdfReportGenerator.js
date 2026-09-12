/**
 * Turf & Taste - Annual PDF Report & Audit Ledger Generator
 * Generates comprehensive, multi-page, branded annual financial & reservation statements using PDFKit
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to format currency
const formatINR = (val) => {
  const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0;
  return `Rs. ${num.toLocaleString('en-IN')}`;
};

/**
 * Generate Multi-Page Annual Financial & Booking Ledger PDF
 * @param {Object} reportData
 * @param {number} reportData.year - e.g. 2025 or 2026
 * @param {Array} reportData.bookings - array of booking records
 * @param {Array} reportData.payments - array of payment transactions
 * @param {string} reportData.outputPath - target destination on disk
 * @returns {Promise<{ filePath: string, fileName: string, sizeBytes: number }>}
 */
export async function generateAnnualLedgerPDF({ year, bookings = [], payments = [], outputPath }) {
  return new Promise((resolve, reject) => {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(outputPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        bufferPages: true,
        info: {
          Title: `Turf & Taste - Annual Audit Ledger ${year}`,
          Author: 'Turf & Taste Sports Arena (Patan, Gujarat)',
          Subject: `Annual Financial & Reservation Audit Report for ${year}`,
          Keywords: 'Turf & Taste, Annual Report, Bookings, Payments, Audit Ledger'
        }
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // Financial Calculations
      let totalGrossRevenue = 0;
      let totalDepositRevenue = 0;
      let totalFullPaymentRevenue = 0;
      let completedBookingsCount = 0;
      let cancelledBookingsCount = 0;

      // Monthly buckets (1-12)
      const monthlyData = Array.from({ length: 12 }, (_, i) => ({
        monthIndex: i,
        monthName: new Date(year, i, 1).toLocaleString('en-US', { month: 'short' }),
        bookingsCount: 0,
        revenue: 0
      }));

      // Facility buckets
      const facilityStats = {};

      bookings.forEach((b) => {
        const rawAmt = parseInt(String(b.amount_paid || b.amount || 0).replace(/[^0-9]/g, ''), 10) || 0;
        totalGrossRevenue += rawAmt;

        if (b.payment_type === 'deposit') {
          totalDepositRevenue += rawAmt;
        } else {
          totalFullPaymentRevenue += rawAmt;
        }

        const bStatus = String(b.booking_status || b.status || 'Confirmed').toLowerCase();
        if (bStatus === 'cancelled') {
          cancelledBookingsCount++;
        } else {
          completedBookingsCount++;
        }

        // Parse month
        if (b.date) {
          const dateObj = new Date(b.date);
          if (!isNaN(dateObj.getTime())) {
            const m = dateObj.getMonth();
            if (m >= 0 && m < 12) {
              monthlyData[m].bookingsCount++;
              monthlyData[m].revenue += rawAmt;
            }
          }
        }

        // Facility tracking
        const fName = b.facility_name || b.facilityName || b.facility_id || 'Arena Sport';
        if (!facilityStats[fName]) {
          facilityStats[fName] = { name: fName, count: 0, revenue: 0 };
        }
        facilityStats[fName].count++;
        facilityStats[fName].revenue += rawAmt;
      });

      // --- COLOR PALETTE ---
      const COLOR_DARK = '#090C09';
      const COLOR_OLIVE = '#6B8F49';
      const COLOR_OLIVE_DARK = '#3A5223';
      const COLOR_ORANGE = '#E86726';
      const COLOR_CREAM = '#F4EDE0';
      const COLOR_GRAY_BG = '#F6F8F5';
      const COLOR_BORDER = '#D6DDD2';
      const COLOR_MUTED = '#666666';

      // =========================================================================
      // PAGE 1: COVER & EXECUTIVE AUDIT SUMMARY
      // =========================================================================

      // Top Brand Bar
      doc.rect(0, 0, doc.page.width, 14).fill(COLOR_OLIVE);
      doc.rect(0, 14, doc.page.width, 4).fill(COLOR_ORANGE);

      doc.moveDown(1.5);

      // Main Header Block
      doc.fillColor(COLOR_DARK)
         .fontSize(22)
         .font('Helvetica-Bold')
         .text('TURF & TASTE SPORTS ARENA', { align: 'center', characterSpacing: 1.5 });

      doc.fillColor(COLOR_MUTED)
         .fontSize(8.5)
         .font('Helvetica')
         .text('State-of-the-Art Multi-Sport Facility & Open-Air Cafe  |  Patan, Gujarat - 384265', { align: 'center' });

      doc.moveDown(0.8);

      // Audit Ledger Title Banner
      doc.rect(36, doc.y, doc.page.width - 72, 34).fill(COLOR_DARK);
      doc.fillColor(COLOR_CREAM)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(`ANNUAL FINANCIAL & BOOKING AUDIT LEDGER — CALENDAR YEAR ${year}`, 46, doc.y - 25, {
           width: doc.page.width - 92,
           align: 'center'
         });

      doc.moveDown(1.2);

      // Metadata Strip
      const metadataY = doc.y;
      doc.rect(36, metadataY, doc.page.width - 72, 28).fill(COLOR_GRAY_BG);
      doc.rect(36, metadataY, doc.page.width - 72, 28).stroke(COLOR_BORDER);

      doc.fillColor(COLOR_DARK).fontSize(8).font('Helvetica-Bold');
      doc.text(`AUDIT PERIOD: Jan 01, ${year} – Dec 31, ${year}`, 46, metadataY + 9);
      doc.text(`RECORD COUNT: ${bookings.length} reservations`, 230, metadataY + 9);
      doc.text(`GENERATED ON: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 380, metadataY + 9);

      doc.moveDown(2);

      // Section 1: Executive KPI Cards
      doc.fillColor(COLOR_OLIVE_DARK).fontSize(11).font('Helvetica-Bold').text('1. EXECUTIVE ANNUAL FINANCIAL SUMMARY', 36, doc.y);
      doc.moveDown(0.4);

      const kpiY = doc.y;
      const cardWidth = (doc.page.width - 72 - 24) / 4;
      const cardHeight = 54;

      const kpiCards = [
        { label: 'GROSS ANNUAL REVENUE', val: formatINR(totalGrossRevenue), color: COLOR_OLIVE_DARK },
        { label: 'TOTAL BOOKINGS', val: `${bookings.length}`, color: COLOR_DARK },
        { label: 'TOKEN DEPOSITS PAID', val: formatINR(totalDepositRevenue), color: COLOR_ORANGE },
        { label: 'COMPLETED SESSIONS', val: `${completedBookingsCount} (${bookings.length > 0 ? Math.round((completedBookingsCount / bookings.length) * 100) : 100}%)`, color: COLOR_OLIVE }
      ];

      kpiCards.forEach((card, idx) => {
        const x = 36 + idx * (cardWidth + 8);
        doc.rect(x, kpiY, cardWidth, cardHeight).fill(COLOR_GRAY_BG);
        doc.rect(x, kpiY, cardWidth, cardHeight).stroke(COLOR_BORDER);

        doc.fillColor(COLOR_MUTED).fontSize(6.5).font('Helvetica-Bold').text(card.label, x + 8, kpiY + 8, { width: cardWidth - 16, align: 'center' });
        doc.fillColor(card.color).fontSize(12).font('Helvetica-Bold').text(card.val, x + 8, kpiY + 24, { width: cardWidth - 16, align: 'center' });
      });

      doc.y = kpiY + cardHeight + 14;

      // Section 2: Monthly Breakdown Table
      doc.fillColor(COLOR_OLIVE_DARK).fontSize(11).font('Helvetica-Bold').text(`2. MONTHLY REVENUE & BOOKING DISTRIBUTION (${year})`, 36, doc.y);
      doc.moveDown(0.4);

      const tableX = 36;
      let currentY = doc.y;
      const tableWidth = doc.page.width - 72;
      const colWidths = [80, 100, 120, 120, 102];

      // Table Header
      doc.rect(tableX, currentY, tableWidth, 20).fill(COLOR_OLIVE);
      doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
      doc.text('MONTH', tableX + 8, currentY + 6);
      doc.text('CALENDAR DATES', tableX + colWidths[0] + 8, currentY + 6);
      doc.text('BOOKINGS LOGGED', tableX + colWidths[0] + colWidths[1] + 8, currentY + 6);
      doc.text('REVENUE (INR)', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, currentY + 6);
      doc.text('% OF ANNUAL', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 8, currentY + 6);

      currentY += 20;

      monthlyData.forEach((m, idx) => {
        const isEven = idx % 2 === 0;
        doc.rect(tableX, currentY, tableWidth, 16).fill(isEven ? '#FFFFFF' : COLOR_GRAY_BG);
        doc.rect(tableX, currentY, tableWidth, 16).stroke(COLOR_BORDER);

        const pct = totalGrossRevenue > 0 ? ((m.revenue / totalGrossRevenue) * 100).toFixed(1) : '0.0';

        doc.fillColor(COLOR_DARK).fontSize(7).font('Helvetica-Bold').text(m.monthName.toUpperCase(), tableX + 8, currentY + 4);
        doc.font('Helvetica').fillColor(COLOR_MUTED).text(`${m.monthName} 01 - ${m.monthName} ${new Date(year, m.monthIndex + 1, 0).getDate()}`, tableX + colWidths[0] + 8, currentY + 4);
        doc.font('Helvetica').fillColor(COLOR_DARK).text(`${m.bookingsCount} slots`, tableX + colWidths[0] + colWidths[1] + 8, currentY + 4);
        doc.font('Helvetica-Bold').fillColor(COLOR_OLIVE_DARK).text(formatINR(m.revenue), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, currentY + 4);
        doc.font('Helvetica').fillColor(COLOR_MUTED).text(`${pct}%`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 8, currentY + 4);

        currentY += 16;
      });

      // Total Row
      doc.rect(tableX, currentY, tableWidth, 18).fill('#EAEFE8');
      doc.rect(tableX, currentY, tableWidth, 18).stroke(COLOR_OLIVE);
      doc.fillColor(COLOR_DARK).fontSize(7.5).font('Helvetica-Bold');
      doc.text('ANNUAL TOTAL', tableX + 8, currentY + 5);
      doc.text(`Full Year ${year}`, tableX + colWidths[0] + 8, currentY + 5);
      doc.text(`${bookings.length} reservations`, tableX + colWidths[0] + colWidths[1] + 8, currentY + 5);
      doc.text(formatINR(totalGrossRevenue), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, currentY + 5);
      doc.text('100.0%', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 8, currentY + 5);

      currentY += 28;

      // Section 3: Facility Summary Table
      doc.y = currentY;
      doc.fillColor(COLOR_OLIVE_DARK).fontSize(11).font('Helvetica-Bold').text('3. ARENA REVENUE CONTRIBUTION BY SPORT', 36, doc.y);
      doc.moveDown(0.4);

      currentY = doc.y;
      const fColWidths = [180, 110, 120, 112];

      doc.rect(tableX, currentY, tableWidth, 18).fill(COLOR_DARK);
      doc.fillColor(COLOR_CREAM).fontSize(7.5).font('Helvetica-Bold');
      doc.text('SPORT / FACILITY ARENA', tableX + 8, currentY + 5);
      doc.text('SESSIONS PLAYED', tableX + fColWidths[0] + 8, currentY + 5);
      doc.text('GROSS EARNINGS', tableX + fColWidths[0] + fColWidths[1] + 8, currentY + 5);
      doc.text('CONTRIBUTION', tableX + fColWidths[0] + fColWidths[1] + fColWidths[2] + 8, currentY + 5);

      currentY += 18;

      const facilityList = Object.values(facilityStats);
      if (facilityList.length === 0) {
        facilityList.push({ name: 'General Arena Facilities', count: 0, revenue: 0 });
      }

      facilityList.forEach((fac, idx) => {
        const isEven = idx % 2 === 0;
        doc.rect(tableX, currentY, tableWidth, 16).fill(isEven ? '#FFFFFF' : COLOR_GRAY_BG);
        doc.rect(tableX, currentY, tableWidth, 16).stroke(COLOR_BORDER);

        const contrib = totalGrossRevenue > 0 ? ((fac.revenue / totalGrossRevenue) * 100).toFixed(1) : '0.0';

        doc.fillColor(COLOR_DARK).fontSize(7.5).font('Helvetica-Bold').text(fac.name, tableX + 8, currentY + 4);
        doc.font('Helvetica').fillColor(COLOR_MUTED).text(`${fac.count} reservations`, tableX + fColWidths[0] + 8, currentY + 4);
        doc.font('Helvetica-Bold').fillColor(COLOR_OLIVE_DARK).text(formatINR(fac.revenue), tableX + fColWidths[0] + fColWidths[1] + 8, currentY + 4);
        doc.font('Helvetica').fillColor(COLOR_ORANGE).text(`${contrib}%`, tableX + fColWidths[0] + fColWidths[1] + fColWidths[2] + 8, currentY + 4);

        currentY += 16;
      });

      // =========================================================================
      // PAGE 2+: ITEMIZED BOOKING & PAYMENT LEDGER TABLE
      // =========================================================================

      doc.addPage();

      // Top Mini Header for Ledger Pages
      const renderPageHeader = (pageTitle = '4. ITEMIZED ANNUAL RESERVATION & PAYMENT AUDIT LEDGER') => {
        doc.rect(0, 0, doc.page.width, 6).fill(COLOR_OLIVE);
        doc.fillColor(COLOR_DARK).fontSize(11).font('Helvetica-Bold').text(pageTitle, 36, 18);
        doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica').text(`Official Audit Records — Calendar Year ${year} (Jan 01 – Dec 31)`, 36, 32);
        doc.strokeColor(COLOR_BORDER).lineWidth(0.5).moveTo(36, 42).lineTo(doc.page.width - 36, 42).stroke();
      };

      renderPageHeader();

      const ledgerCols = [60, 65, 85, 95, 75, 45, 55, 42];
      // 0: Booking ID (60)
      // 1: Date (65)
      // 2: Time Slot (85)
      // 3: Customer / Team (95)
      // 4: Arena Facility (75)
      // 5: Type (45)
      // 6: Paid (55)
      // 7: Status (42)
      // Total: 522 (fits within 595.28 - 72 = 523.28 A4 width)

      let ledgerY = 48;

      const renderLedgerTableHeader = (yPos) => {
        doc.rect(36, yPos, tableWidth, 16).fill(COLOR_OLIVE_DARK);
        doc.fillColor('#FFFFFF').fontSize(6.5).font('Helvetica-Bold');
        doc.text('REF ID', 36 + 4, yPos + 5);
        doc.text('DATE', 36 + ledgerCols[0] + 4, yPos + 5);
        doc.text('TIME SLOT', 36 + ledgerCols[0] + ledgerCols[1] + 4, yPos + 5);
        doc.text('PLAYER / TEAM', 36 + ledgerCols[0] + ledgerCols[1] + ledgerCols[2] + 4, yPos + 5);
        doc.text('ARENA', 36 + ledgerCols[0] + ledgerCols[1] + ledgerCols[2] + ledgerCols[3] + 4, yPos + 5);
        doc.text('PLAN', 36 + ledgerCols[0] + ledgerCols[1] + ledgerCols[2] + ledgerCols[3] + ledgerCols[4] + 4, yPos + 5);
        doc.text('PAID (INR)', 36 + ledgerCols[0] + ledgerCols[1] + ledgerCols[2] + ledgerCols[3] + ledgerCols[4] + ledgerCols[5] + 4, yPos + 5);
        doc.text('STATUS', 36 + ledgerCols[0] + ledgerCols[1] + ledgerCols[2] + ledgerCols[3] + ledgerCols[4] + ledgerCols[5] + ledgerCols[6] + 4, yPos + 5);
        return yPos + 16;
      };

      ledgerY = renderLedgerTableHeader(ledgerY);

      if (bookings.length === 0) {
        doc.rect(36, ledgerY, tableWidth, 30).fill(COLOR_GRAY_BG);
        doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica').text(`No reservations recorded in calendar year ${year}.`, 36, ledgerY + 10, {
          width: tableWidth,
          align: 'center'
        });
      } else {
        bookings.forEach((b, idx) => {
          // Check if page overflow
          if (ledgerY + 18 > doc.page.height - 40) {
            doc.addPage();
            renderPageHeader('4. ITEMIZED ANNUAL RESERVATION & PAYMENT AUDIT LEDGER (CONTINUED)');
            ledgerY = renderLedgerTableHeader(48);
          }

          const isEven = idx % 2 === 0;
          doc.rect(36, ledgerY, tableWidth, 16).fill(isEven ? '#FFFFFF' : COLOR_GRAY_BG);
          doc.rect(36, ledgerY, tableWidth, 16).stroke(COLOR_BORDER);

          const bId = String(b.id || `TT-${idx + 1}`).substring(0, 11);
          const bDate = String(b.date || '').substring(0, 10);
          const bTime = String(b.time_slot || b.time || '').substring(0, 18);
          const bCustomer = String(b.customer_name || b.customerName || 'Guest').substring(0, 16);
          const bFacility = String(b.facility_name || b.facilityName || 'Arena').substring(0, 14);
          const bType = b.payment_type === 'full' ? 'Full Pay' : 'Deposit';
          const bAmt = formatINR(b.amount_paid || b.amount || 0);
          const bStatus = String(b.booking_status || b.status || 'Confirmed').substring(0, 9);

          doc.fillColor(COLOR_DARK).fontSize(6.5).font('Helvetica-Bold');
          doc.text(bId, 36 + 4, ledgerY + 4.5);

          doc.font('Helvetica').fillColor(COLOR_MUTED);
          doc.text(bDate, 36 + ledgerCols[0] + 4, ledgerY + 4.5);
          doc.text(bTime, 36 + ledgerCols[0] + ledgerCols[1] + 4, ledgerY + 4.5);

          doc.fillColor(COLOR_DARK).font('Helvetica');
          doc.text(bCustomer, 36 + ledgerCols[0] + ledgerCols[1] + ledgerCols[2] + 4, ledgerY + 4.5);
          doc.text(bFacility, 36 + ledgerCols[0] + ledgerCols[1] + ledgerCols[2] + ledgerCols[3] + 4, ledgerY + 4.5);

          doc.fillColor(bType === 'Full Pay' ? COLOR_OLIVE_DARK : COLOR_ORANGE).font('Helvetica-Bold');
          doc.text(bType, 36 + ledgerCols[0] + ledgerCols[1] + ledgerCols[2] + ledgerCols[3] + ledgerCols[4] + 4, ledgerY + 4.5);

          doc.fillColor(COLOR_DARK).font('Helvetica-Bold');
          doc.text(bAmt, 36 + ledgerCols[0] + ledgerCols[1] + ledgerCols[2] + ledgerCols[3] + ledgerCols[4] + ledgerCols[5] + 4, ledgerY + 4.5);

          doc.fillColor(bStatus.toLowerCase() === 'cancelled' ? '#C62828' : COLOR_OLIVE_DARK).font('Helvetica-Bold');
          doc.text(bStatus, 36 + ledgerCols[0] + ledgerCols[1] + ledgerCols[2] + ledgerCols[3] + ledgerCols[4] + ledgerCols[5] + ledgerCols[6] + 4, ledgerY + 4.5);

          ledgerY += 16;
        });
      }

      // =========================================================================
      // FOOTERS & NUMBERING ON ALL PAGES
      // =========================================================================
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);

        // Footer Bar
        const footerY = doc.page.height - 24;
        doc.rect(36, footerY, doc.page.width - 72, 0.5).fill(COLOR_BORDER);

        doc.fillColor(COLOR_MUTED)
           .fontSize(6.5)
           .font('Helvetica')
           .text('Turf & Taste Sports Arena — Official Archival & Financial Statement. Strictly Confidential.', 36, footerY + 5, {
             width: 380
           });

        doc.fillColor(COLOR_MUTED)
           .fontSize(6.5)
           .font('Helvetica-Bold')
           .text(`Page ${i + 1} of ${range.count}`, doc.page.width - 36 - 80, footerY + 5, {
             width: 80,
             align: 'right'
           });
      }

      doc.end();

      writeStream.on('finish', () => {
        const stats = fs.statSync(outputPath);
        resolve({
          filePath: outputPath,
          fileName: path.basename(outputPath),
          sizeBytes: stats.size,
          totalPages: range.count,
          totalRevenue: totalGrossRevenue,
          totalBookings: bookings.length
        });
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export default { generateAnnualLedgerPDF };

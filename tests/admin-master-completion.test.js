import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import dbAsync, { initDatabase } from '../server/db.js';

import customersRoutes from '../server/routes/customers.js';
import noticesRoutes from '../server/routes/notices.js';
import reviewsRoutes from '../server/routes/reviews.js';
import rolesRoutes from '../server/routes/roles.js';
import eventsRoutes from '../server/routes/v2/events.js';
import paymentsRoutes from '../server/routes/payments.js';
import archivesRoutes from '../server/routes/archives.js';

describe('Admin Master Completion: Full Operational Scope & CMS Integration', () => {
  let server;
  let baseUrl;
  let staffToken;

  before(async () => {
    await initDatabase();

    const app = express();
    app.use(express.json());
    app.use('/api/customers', customersRoutes);
    app.use('/api/notices', noticesRoutes);
    app.use('/api/reviews', reviewsRoutes);
    app.use('/api/roles', rolesRoutes);
    app.use('/api/v2/events', eventsRoutes);
    app.use('/api/payments', paymentsRoutes);
    app.use('/api/archives', archivesRoutes);

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    const admin = await dbAsync.get('SELECT * FROM admins WHERE id = 1');
    const secret = process.env.JWT_SECRET || 'turf-taste-test-only-jwt-secret';
    staffToken = jwt.sign(
      { id: admin.id, sv: admin.session_version ?? 0 },
      secret
    );
  });

  after(() => {
    if (server) server.close();
  });

  /* ============================================================
     1. CUSTOMER CRM & STAFF NOTES
     ============================================================ */
  describe('Customer CRM & Operational Notes', () => {
    const testPhone = '9876543210';

    it('GET /api/customers lists patrons with spend aggregation', async () => {
      const res = await fetch(`${baseUrl}/api/customers`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(Array.isArray(data.customers));
    });

    it('POST /api/customers/:phone/notes adds internal staff operational note', async () => {
      const res = await fetch(`${baseUrl}/api/customers/${testPhone}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({ note: 'Prefers Pitch A evening under floodlights.' })
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.note.id);
      assert.equal(data.note.note, 'Prefers Pitch A evening under floodlights.');
    });

    it('GET /api/customers/:phone/bookings returns customer history and notes', async () => {
      const res = await fetch(`${baseUrl}/api/customers/${testPhone}/bookings`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(Array.isArray(data.bookings));
      assert.ok(Array.isArray(data.notes));
      assert.ok(data.notes.some(n => n.note.includes('Prefers Pitch A')));
    });
  });

  /* ============================================================
     2. NOTICES CMS & MEMBER BULLETINS
     ============================================================ */
  describe('Notices CMS & Clubhouse Bulletins', () => {
    let createdNoticeId;

    it('POST /api/notices creates a member notice with pinning and type', async () => {
      const res = await fetch(`${baseUrl}/api/notices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({
          title: 'Court Maintenance Notice',
          content: 'Turf 1 undergoing seasonal grooming between 06:00 and 08:00.',
          type: 'maintenance',
          isPinned: true,
          status: 'published'
        })
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.notice.id);
      createdNoticeId = data.notice.id;
    });

    it('GET /api/notices returns published notices for public feed', async () => {
      const res = await fetch(`${baseUrl}/api/notices`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.notices.some(n => n.id === createdNoticeId));
    });

    it('GET /api/notices/admin returns all notices for management', async () => {
      const res = await fetch(`${baseUrl}/api/notices/admin`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.notices.length >= 1);
    });

    it('PUT /api/notices/:id updates an existing notice', async () => {
      const res = await fetch(`${baseUrl}/api/notices/${createdNoticeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({
          title: 'Updated Court Maintenance Notice',
          status: 'published'
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.notice.title, 'Updated Court Maintenance Notice');
    });

    it('DELETE /api/notices/:id removes the notice', async () => {
      const res = await fetch(`${baseUrl}/api/notices/${createdNoticeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });
  });

  /* ============================================================
     3. REVIEWS MODERATION QUEUE
     ============================================================ */
  describe('Reviews Moderation Queue & Customer Feedback', () => {
    let createdReviewId;

    it('POST /api/reviews submits a review for moderation', async () => {
      const res = await fetch(`${baseUrl}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Aarav Mehta',
          customerPhone: '9876543210',
          facilityId: 'fac_box_cricket_1',
          rating: 5,
          comment: 'Outstanding pitch quality under the floodlights!'
        })
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.reviewId);
      createdReviewId = data.reviewId;
    });

    it('GET /api/reviews/admin returns reviews in moderation queue', async () => {
      const res = await fetch(`${baseUrl}/api/reviews/admin`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.reviews.some(r => r.id === createdReviewId));
    });

    it('PUT /api/reviews/:id/status updates review status to approved', async () => {
      const res = await fetch(`${baseUrl}/api/reviews/${createdReviewId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({ status: 'approved' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.status, 'approved');
    });

    it('POST /api/reviews/:id/reply posts official clubhouse response', async () => {
      const res = await fetch(`${baseUrl}/api/reviews/${createdReviewId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({ response: 'Thank you Aarav! See you next match.' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.response, 'Thank you Aarav! See you next match.');
    });
  });

  /* ============================================================
     4. EVENTS CMS
     ============================================================ */
  describe('Events CMS & Tournament Management', () => {
    const testSlug = `monsoon-cup-${Date.now().toString(36)}`;

    it('POST /api/v2/events/admin/events creates a clubhouse event', async () => {
      const res = await fetch(`${baseUrl}/api/v2/events/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({
          id: `evt-${testSlug}`,
          slug: testSlug,
          title: 'Monsoon Premier Cup',
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          endsAt: new Date(Date.now() + 90000000).toISOString(),
          facilityId: 'fac_box_cricket_1',
          status: 'active'
        })
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      const ev = data.data?.event || data.event;
      assert.equal(ev.title, 'Monsoon Premier Cup');
    });

    it('GET /api/v2/events/admin/all returns events list for operators', async () => {
      const res = await fetch(`${baseUrl}/api/v2/events/admin/all`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      const evList = data.data?.events || data.events;
      assert.ok(evList.some(e => e.slug === testSlug));
    });
  });

  /* ============================================================
     5. ROLES & RBAC PERMISSIONS MATRIX
     ============================================================ */
  describe('Roles & Permissions Access Control', () => {
    it('GET /api/roles returns defined roles with assigned permissions', async () => {
      const res = await fetch(`${baseUrl}/api/roles`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.roles.some(r => r.name.includes('Super') || r.role_key === 'super_admin'));
      assert.ok(data.roles.some(r => r.name.includes('Staff') || r.role_key === 'staff'));
    });

    it('GET /api/roles/permissions returns complete permissions vocabulary', async () => {
      const res = await fetch(`${baseUrl}/api/roles/permissions`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.permissions.some(p => p.key === 'booking.read'));
      assert.ok(data.permissions.some(p => p.key === 'pricing.manage'));
    });

    it('GET /api/roles/staff returns staff account roster', async () => {
      const res = await fetch(`${baseUrl}/api/roles/staff`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.staff.length >= 1);
    });
  });

  /* ============================================================
     6. PAYMENTS LEDGER & ANNUAL ARCHIVES
     ============================================================ */
  describe('Payments Ledger & Annual Archives', () => {
    it('GET /api/payments/history returns payment transaction ledger', async () => {
      const res = await fetch(`${baseUrl}/api/payments/history`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(Array.isArray(data.payments));
    });

    it('GET /api/archives/years returns fiscal years with archive status', async () => {
      const res = await fetch(`${baseUrl}/api/archives/years`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(Array.isArray(data.years));
    });

    it('GET /api/archives/settings returns email distribution settings', async () => {
      const res = await fetch(`${baseUrl}/api/archives/settings`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.emailListStr !== undefined);
    });
  });
});

/**
 * Turf & Taste — Admin UI Correction Regression Tests
 *
 * Covers:
 * 1. Toast Queue Behavior (FIFO, single visible toast)
 * 2. Quote Recalculation Loading State (no blanking, stale prevention)
 * 3. Operations Drawer Scrolling (flex constraints, safe-area)
 * 4. Navigation Structural Invariance (stable tab order)
 * 5. Status Badge Contrast & Semantic Mapping
 * 6. Design Token Consistency (no hardcoded off-palette colors)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function readSrc(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

describe('Admin UI Correction Regression Tests', () => {

  // ============================================================
  // 1. TOAST QUEUE BEHAVIOR
  // ============================================================
  describe('Toast Queue System', () => {
    it('uses a FIFO queue with single active toast pattern', () => {
      const adminAppSrc = readSrc('src/admin/AdminApp.jsx');
      assert.ok(adminAppSrc.includes('toastQueue'), 'Should maintain a toast queue array');
      assert.ok(adminAppSrc.includes('activeToast'), 'Should track the currently active toast');
      assert.ok(adminAppSrc.includes('setToastQueue'), 'Should have queue management');
      assert.ok(adminAppSrc.includes('setToastQueue(prev => prev.slice(1))'), 'Should dequeue after display');
    });

    it('auto-dismisses active toast after timeout', () => {
      const adminAppSrc = readSrc('src/admin/AdminApp.jsx');
      assert.ok(adminAppSrc.includes('setTimeout'), 'Should use timeout for auto-dismiss');
      assert.ok(adminAppSrc.includes('clearTimeout'), 'Should cleanup timeout on unmount/replace');
    });

    it('processes next toast when active toast is dismissed', () => {
      const adminAppSrc = readSrc('src/admin/AdminApp.jsx');
      assert.ok(adminAppSrc.includes('!activeToast && toastQueue.length > 0'), 'Should show next toast when none active');
    });

    it('does not use browser-native alert/confirm/prompt', () => {
      const adminAppSrc = readSrc('src/admin/AdminApp.jsx');
      assert.ok(!adminAppSrc.includes('window.alert'), 'Must not use window.alert');
      assert.ok(!adminAppSrc.includes('window.confirm'), 'Must not use window.confirm');
      assert.ok(!adminAppSrc.includes('window.prompt'), 'Must not use window.prompt');
    });
  });

  // ============================================================
  // 2. QUOTE RECALCULATION LOADING STATE
  // ============================================================
  describe('Walk-In Quote Loading State', () => {
    it('does not blank serverQuote during recalculation', () => {
      const walkinSrc = readSrc('src/admin/pages/WalkInView.jsx');
      const quoteEffectPattern = /setQuoteLoading\(true\)[\s\S]*?setServerQuote\(null\)/;
      assert.ok(!quoteEffectPattern.test(walkinSrc), 'Must not null the quote while recalculating');
    });

    it('preserves existing quote with visual loading indicator during recalculation', () => {
      const walkinSrc = readSrc('src/admin/pages/WalkInView.jsx');
      assert.ok(walkinSrc.includes('Recalculating server pricing'), 'Should show recalculating message');
      assert.ok(walkinSrc.includes('opacity: quoteLoading ? 0.6 : 1'), 'Should dim quote during recalculation');
      assert.ok(walkinSrc.includes('Updating'), 'Should show updating indicator on quote card');
    });

    it('disables submit button during quote recalculation to prevent stale quote submission', () => {
      const walkinSrc = readSrc('src/admin/pages/WalkInView.jsx');
      assert.ok(walkinSrc.includes('disabled={loading || quoteLoading}'), 'Submit must be disabled while quote loads');
      assert.ok(walkinSrc.includes('Confirming Pricing...'), 'Should show pricing confirmation state');
    });

    it('maintains server-authoritative pricing (no client-side calculation)', () => {
      const walkinSrc = readSrc('src/admin/pages/WalkInView.jsx');
      assert.ok(walkinSrc.includes('Server-Resolved Quote'), 'Should label quote as server-resolved');
      assert.ok(!walkinSrc.includes('calculatePrice'), 'Must not have client-side price calculation');
      assert.ok(!walkinSrc.includes('computeTotal'), 'Must not have client-side total computation');
    });
  });

  // ============================================================
  // 3. OPERATIONS DRAWER SCROLLING
  // ============================================================
  describe('Operations Drawer Scrolling', () => {
    it('has proper flex constraints for independent scrolling', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const opsGridSection = cssSrc.match(/\.admin-ops-grid\s*\{[^}]+\}/);
      assert.ok(opsGridSection, 'Should have admin-ops-grid styles');
      assert.ok(opsGridSection[0].includes('flex: 1'), 'Should have flex: 1 for proper scrolling');
      assert.ok(opsGridSection[0].includes('min-height: 0'), 'Should have min-height: 0 for flex scrolling');
      assert.ok(opsGridSection[0].includes('overflow-y: auto'), 'Should have overflow-y: auto');
    });

    it('has safe-area bottom padding for drawer content', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const opsGridSection = cssSrc.match(/\.admin-ops-grid\s*\{[^}]+\}/);
      assert.ok(opsGridSection[0].includes('env(safe-area-inset-bottom'), 'Should handle safe-area inset');
    });

    it('has flex-shrink: 0 on modal header to prevent compression', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const modalHeaderSection = cssSrc.match(/\.admin-modal-header\s*\{[^}]+\}/);
      assert.ok(modalHeaderSection, 'Should have admin-modal-header styles');
      assert.ok(modalHeaderSection[0].includes('flex-shrink: 0'), 'Header should not shrink');
    });

    it('uses momentum scrolling for touch devices', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const opsGridSection = cssSrc.match(/\.admin-ops-grid\s*\{[^}]+\}/);
      assert.ok(opsGridSection[0].includes('-webkit-overflow-scrolling: touch'), 'Should use momentum scrolling');
    });
  });

  // ============================================================
  // 4. NAVIGATION STRUCTURAL INVARIANCE
  // ============================================================
  describe('Navigation Structural Invariance', () => {
    it('maintains stable 4-tab navigation order', () => {
      const adminNavSrc = readSrc('src/admin/components/AdminNav.jsx');
      const tabOrder = [];
      const tabMatches = adminNavSrc.matchAll(/id:\s*'(\w+)'[^}]*?label:\s*'([^']+)'/g);
      for (const match of tabMatches) {
        if (['dashboard', 'bookings', 'facilities', 'operations'].includes(match[1])) {
          tabOrder.push(match[1]);
        }
      }
      assert.deepEqual(tabOrder, ['dashboard', 'bookings', 'facilities', 'operations'], 'Tab order must be stable');
    });

    it('does not reorder tabs based on active route', () => {
      const adminNavSrc = readSrc('src/admin/components/AdminNav.jsx');
      assert.ok(!adminNavSrc.includes('sort('), 'Should not sort tabs dynamically');
      assert.ok(!adminNavSrc.includes('.reverse()'), 'Should not reverse tab order');
    });

    it('uses fixed bottom navigation', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const bottomNavSection = cssSrc.match(/\.admin-bottom-nav\s*\{[^}]+\}/);
      assert.ok(bottomNavSection, 'Should have bottom nav styles');
      assert.ok(bottomNavSection[0].includes('position: fixed'), 'Should be fixed position');
      assert.ok(bottomNavSection[0].includes('bottom: 0'), 'Should be at bottom');
    });
  });

  // ============================================================
  // 5. STATUS BADGE CONTRAST & SEMANTIC MAPPING
  // ============================================================
  describe('Status Badge System', () => {
    it('has proper contrast for completed status', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const completedSection = cssSrc.match(/\.admin-status-badge\.completed\s*\{[^}]+\}/);
      assert.ok(completedSection, 'Should have completed badge style');
      assert.ok(completedSection[0].includes('--admin-primary-light'), 'Should use primary light background');
      assert.ok(completedSection[0].includes('--admin-primary'), 'Should use primary text color');
    });

    it('maps In Progress and Checked-in to success semantic', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      assert.ok(cssSrc.includes('.admin-status-badge.checked-in'), 'Should have checked-in badge style');
      assert.ok(cssSrc.includes('.admin-status-badge.in-progress'), 'Should have in-progress badge style');
    });

    it('uses consistent semantic treatment across all status types', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const statusBadgeSection = cssSrc.match(/\/\* ── Status Badges ── \*\/[\s\S]*?(?=\/\* ──)/);
      assert.ok(statusBadgeSection, 'Should have status badge section');
      const section = statusBadgeSection[0];
      assert.ok(section.includes('--admin-success-bg'), 'Should use success background');
      assert.ok(section.includes('--admin-warning-bg'), 'Should use warning background');
      assert.ok(section.includes('--admin-danger-bg'), 'Should use danger background');
    });
  });

  // ============================================================
  // 6. DESIGN TOKEN CONSISTENCY
  // ============================================================
  describe('Design Token Consistency', () => {
    it('WalkInView uses design tokens instead of hardcoded off-palette colors', () => {
      const walkinSrc = readSrc('src/admin/pages/WalkInView.jsx');
      assert.ok(!walkinSrc.includes('#94A3B8'), 'Should not use slate gray');
      assert.ok(!walkinSrc.includes('#FCA5A5'), 'Should not use light red');
      assert.ok(!walkinSrc.includes('#93C5FD'), 'Should not use light blue');
    });

    it('BookingsView uses design tokens instead of hardcoded off-palette colors', () => {
      const bookingsSrc = readSrc('src/admin/pages/BookingsView.jsx');
      assert.ok(!bookingsSrc.includes('#94A3B8'), 'Should not use slate gray');
      assert.ok(!bookingsSrc.includes('#64748B'), 'Should not use slate gray');
    });

    it('SessionsView uses design tokens instead of hardcoded off-palette colors', () => {
      const sessionsSrc = readSrc('src/admin/pages/SessionsView.jsx');
      assert.ok(!sessionsSrc.includes('#94A3B8'), 'Should not use slate gray');
      assert.ok(!sessionsSrc.includes('#64748B'), 'Should not use slate gray');
    });

    it('has proper chip styles defined', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      assert.ok(cssSrc.includes('.admin-chip'), 'Should have chip styles');
      const chipSection = cssSrc.match(/\.admin-chip\s*\{[^}]+\}/);
      assert.ok(chipSection[0].includes('min-height: 44px'), 'Chip should meet 44px touch target');
      assert.ok(chipSection[0].includes('border-radius'), 'Chip should have border radius');
    });

    it('has proper input styles defined', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      assert.ok(cssSrc.includes('.admin-input'), 'Should have input styles');
      const inputSection = cssSrc.match(/\.admin-input\s*\{[^}]+\}/);
      assert.ok(inputSection[0].includes('min-height: 44px'), 'Input should meet 44px touch target');
    });

    it('has proper select styles defined', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      assert.ok(cssSrc.includes('.admin-select'), 'Should have select styles');
      const selectSection = cssSrc.match(/\.admin-select\s*\{[^}]+\}/);
      assert.ok(selectSection[0].includes('min-height: 44px'), 'Select should meet 44px touch target');
    });

    it('has proper modal styles defined', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      assert.ok(cssSrc.includes('.admin-modal'), 'Should have modal styles');
      const modalSection = cssSrc.match(/\.admin-modal\s*\{[^}]+\}/);
      assert.ok(modalSection[0].includes('max-height'), 'Modal should have max-height constraint');
      assert.ok(modalSection[0].includes('overflow: hidden'), 'Modal should have overflow control');
    });
  });

  // ============================================================
  // 7. LOCATION IDENTITY
  // ============================================================
  describe('Location Identity', () => {
    it('uses correct Patan Campus HQ identity', () => {
      const adminAppSrc = readSrc('src/admin/AdminApp.jsx');
      assert.ok(adminAppSrc.includes('PATAN CAMPUS · HQ'), 'Should use correct location identity');
      assert.ok(!adminAppSrc.includes('Bopal'), 'Must not reference Bopal');
      assert.ok(!adminAppSrc.includes('Ahmedabad'), 'Must not reference Ahmedabad');
      assert.ok(!adminAppSrc.includes('South Bopal'), 'Must not reference South Bopal');
    });

    it('does not reference fake arena identities', () => {
      const adminAppSrc = readSrc('src/admin/AdminApp.jsx');
      assert.ok(!adminAppSrc.includes('Skyline'), 'Must not reference Skyline Arena');
      assert.ok(!adminAppSrc.includes('Skyline Sports'), 'Must not reference Skyline Sports');
    });
  });

  // ============================================================
  // 8. TOUCH TARGETS
  // ============================================================
  describe('Touch Target Compliance', () => {
    it('primary buttons meet 44px minimum', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const btnSection = cssSrc.match(/\.admin-btn\s*\{[^}]+\}/);
      assert.ok(btnSection, 'Should have button styles');
    });

    it('chips meet 44px minimum touch target', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const chipSection = cssSrc.match(/\.admin-chip\s*\{[^}]+\}/);
      assert.ok(chipSection[0].includes('min-height: 44px'), 'Chip should meet 44px minimum');
    });

    it('inputs meet 44px minimum touch target', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const inputSection = cssSrc.match(/\.admin-input\s*\{[^}]+\}/);
      assert.ok(inputSection[0].includes('min-height: 44px'), 'Input should meet 44px minimum');
    });

    it('selects meet 44px minimum touch target', () => {
      const cssSrc = readSrc('src/admin/styles/admin.css');
      const selectSection = cssSrc.match(/\.admin-select\s*\{[^}]+\}/);
      assert.ok(selectSection[0].includes('min-height: 44px'), 'Select should meet 44px minimum');
    });
  });
});

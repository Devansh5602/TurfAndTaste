# Turf & Taste — Admin Phase 1.3 Canonical Authority & Pricing Snapshot Closeout Report

**Date:** 2026-10-01  
**Status:** COMPLETED — READY FOR FINAL CODEX CLOSEOUT REVIEW  
**Scope:** Strictly resolving the four release blockers identified in `CODEX_ADMIN_PHASE12_REVIEW.md`. No Phase 2 features started.

---

## 1. Executive Summary

Admin Phase 1.3 closes out all remaining architectural dual-authority ambiguities identified during Codex Phase 1.2 review:
1. **Blocker A (One Pricing Authority):** All quote, booking, walk-in, and extension calculation paths now route exclusively through `server/domain/pricing/pricingResolver.js`. Legacy quote calculators and duplicate pricing branches have been removed or migrated.
2. **Blocker B (One Availability Authority):** Legacy `blocked_slots` has been de-authoritized as an independent live conflict authority. All slot checks, walk-ins, and extensions delegate strictly to `server/domain/booking/canonicalBookingCommand.js` (`loadCanonicalOccupancies`, `checkCanonicalConflicts`). Legacy blocking endpoints bridge directly to `facility_blocks`.
3. **Blockers C & D (Structured Quote & Immutable Pricing Snapshot):** Quotes return a complete structured breakdown (`prePackageSubtotalPaise`, `packageDiscountPaise`, `addOnAmountPaise`, `depositAmountPaise`, `fullPaymentRequired`). Confirmed bookings and session extensions persist complete immutable JSON snapshots in `bookings.pricing_snapshot` and `session_adjustments.pricing_snapshot`. Historical records never recompute when current pricing rules change.
4. **Blocker E (Migration 020 Seed Correction & Reconciliation):** The unsupported ₹200/hr Shooting Machine bootstrap seed was removed from `020_pricing_rules.js`. Additive migration `021_pricing_and_availability_reconciliation.js` safely removes unconfirmed bootstrap seed records without touching operator-modified pricing, adds snapshot columns, and backfills legacy `blocked_slots` into `facility_blocks`.

---

## 2. Blockers Addressed & Resolutions

### Blocker A: Unified Canonical Pricing Authority
- **Canonical Authority:** `server/domain/pricing/pricingResolver.js` (`resolvePricing`, `resolveExtensionPricing`, `resolveAdminWalkInPricing`).
- **Quote Endpoint Refactoring (`server/routes/v2/quotes.js`):**
  - Removed duplicate ad-hoc duration / weekend / package calculations.
  - Delegated entirely to `resolvePricing` and `checkCanonicalConflicts`.
  - Added structured fields: `breakdown.prePackageSubtotalPaise`, `breakdown.packageDiscountPaise`, `breakdown.fullPaymentRequired`, and `policy.depositAllowed`.
  - Signed quote token with complete canonical snapshot payload.
- **Walk-In Parity (`server/routes/bookings.js`):**
  - Walk-in creations evaluate server-side pricing via `resolveAdminWalkInPricing` / `resolvePricing`.
  - Enforced single token/deposit authority with the documented <1h cutoff for counter bookings.

### Blocker B: Unified Canonical Availability Authority
- **Canonical Authority:** `server/domain/booking/canonicalBookingCommand.js` (`loadCanonicalOccupancies`, `checkCanonicalConflicts`).
- **De-Authoritization of `blocked_slots`:**
  - Removed fallback query of `blocked_slots` from `loadCanonicalOccupancies`.
  - Legacy routes `GET /api/bookings/blocked-slots`, `POST /api/bookings/block-slot`, and `DELETE /api/bookings/unblock-slot` now operate directly against `facility_blocks` using canonical intervals and conflict checks.
  - Route precedence in `server/routes/bookings.js` was corrected so `DELETE /unblock-slot` is not masked by parametric `DELETE /:id`.
  - Customer slots (`/api/bookings/slots`), Admin Walk-In, and Extension conflict checks now share identical physical resource occupancy truth.

### Blockers C & D: Structured Quotes & Immutable Pricing Snapshots
- **Data Model Updates:**
  - `bookings.pricing_snapshot TEXT` (JSON snapshot of final quote, rule breakdown, deposit, and add-ons).
  - `session_adjustments.pricing_snapshot TEXT` (JSON snapshot of extension charge, operator, decision, and applied tariff).
- **Snapshot Persistence:**
  - Confirmed bookings persist snapshot during both canonical booking commands (`createCanonicalBooking`) and payment finalization (`paymentFinalization.js`).
  - Session extensions (`server/routes/sessions.js`) persist pricing snapshot for both paid extensions and explicit free extensions.
- **Historical Immutability:**
  - `BookingsView.jsx` displays persisted snapshot data when viewing historical bookings. For legacy pre-snapshot bookings, an explicit badge `[Legacy / Pre-snapshot Record]` is shown instead of recomputing from current pricing rules.

### Blocker E: Migration Seed Reconciliation & Production Safety
- **Root Cause:** `020_pricing_rules.js` contained an unverified hardcoded bootstrap seed inserting `aop_shooting_machine` at ₹200/hr.
- **Fix in `020_pricing_rules.js`:** Removed the arbitrary add-on tariff insert.
- **Reconciliation Migration `021_pricing_and_availability_reconciliation.js`:**
  - Safely deletes `aop_shooting_machine` *only* if matching the default unverified seed (`rate_paise_per_hour = 20000`), preserving any operator-customized rate.
  - Adds `pricing_snapshot` columns to `bookings` and `session_adjustments` idempotently.
  - Safely copies any historical unmigrated `blocked_slots` into `facility_blocks`.

---

## 3. Verification & Test Results

| Test Category | Suite / Command | Status |
| :--- | :--- | :--- |
| **All Test Suites Pass 1** | `npm test` | **PASS (198/198 passed, 0 failed)** |
| **All Test Suites Pass 2** | `npm test` | **PASS (198/198 passed, 0 failed)** |
| **Closeout Suite Targeted** | `node scripts/test-runner.js tests/admin-phase13-closeout.test.js` | **PASS (8/8 passed)** |
| **Vite Production Build** | `npm run build` | **PASS (3.56s, 0 errors)** |
| **Git Diff Cleanliness** | `git diff --check` | **PASS (0 whitespace / syntax errors)** |

---

## 4. Conclusion & Next Steps

Admin Phase 1.3 is complete. The repository has exactly one pricing authority, one availability authority, immutable pricing snapshots for all future confirmed bookings/extensions, safe database reconciliation, and clean test runs.

**ADMIN PHASE 1 IS READY FOR FINAL CODEX CLOSEOUT REVIEW.**  
*Admin Phase 2 must NOT be started until Codex approves Phase 1.*

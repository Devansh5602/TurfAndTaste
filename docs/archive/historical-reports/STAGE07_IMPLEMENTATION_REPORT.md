# Stage 0.7 Implementation Report — Final Foundation Blocker Remediation

**Date:** 2026-09-30  
**Starting Commit:** `c3522fb`  
**Target Branch:** `feature/customer-mobile-curated`  
**Status:** ✅ ALL BLOCKERS RESOLVED — READY FOR FINAL CODEX RELEASE REVIEW  

---

## Executive Summary

Stage 0.7 resolves all 5 blockers identified in `docs/domain/CODEX_STAGE06_REVIEW.md`:
1. **Historical Timestamp Provenance & Double-Shift Safety:** Implemented a deterministic reconciliation engine (`server/domain/time/timestampAudit.js`) classifying every record as `SAFE_NO_CHANGE`, `SAFE_CORRECTION`, `MANUAL_REVIEW`, or `UNRESOLVABLE`. Preserves explicitly UTC & offset values, corrects double-shifted IST wall-clock timestamps deterministically, and strictly quarantines ambiguous discrepancies.
2. **Concurrency & Double-Booking Prevention (SQLite & PostgreSQL):** Fixed the SQLite double-booking race by implementing an async transaction mutex (`acquireSqliteLock`) chained with `BEGIN IMMEDIATE`. Unified the entire conflict-check and booking-insertion lifecycle under a single transaction across both engines. Verified with concurrent real-race tests on identical physical resources (`fac_box_cricket_1`).
3. **RBAC Hardening & Manager Bypass Removal:** Completely eliminated all `role === 'manager'` bypasses from `requirePermission` middleware and domain commands. Unified canonical permission vocabulary across PostgreSQL and SQLite, added `stall_id` scoping to admin accounts, and verified real identity-to-permission mapping for Admin, Staff, Stall Staff, and Custom Roles.
4. **Dining Customer Order Lookup Privacy & Ownership:** Rewrote `GET /api/v2/food/orders/:id` to use `attachOptionalAdmin` (active account & session verification). Enforced unguessable 48-hex character `accessToken` for guest lookups (401/403 on missing/invalid token), sanitized response payloads (omitting `access_token` and customer phone), and enforced stall-level tenant isolation for stall staff.
5. **Independent Testing & Validation:** 117 tests across 5 test suites pass cleanly with 0 failures on both Cloud Supabase PostgreSQL and local SQLite. Production build succeeds with 0 errors.

---

## 1. Blocker Remediation Verification Matrix

| Area / Blocker | Previous Status | Stage 0.7 Status | Concrete Evidence |
| :--- | :--- | :--- | :--- |
| **1. Historical Timestamp Safety** | PARTIAL | **RESOLVED** | `timestampAudit.js` evaluates raw source, canonical value, and expected IST/UTC instant. Explicit UTC & offset preserved as `SAFE_NO_CHANGE`. +5:30 double shifts deterministically corrected to `SAFE_CORRECTION`. Ambiguous/missing slot mappings strictly quarantined as `MANUAL_REVIEW`. |
| **2. Concurrency Protection (SQLite)** | UNRESOLVED | **RESOLVED** | `server/db.js` `withTransaction` wraps SQLite in `acquireSqliteLock` mutex and executes `BEGIN IMMEDIATE`. Conflict check reads and inserts are atomic within transaction. |
| **3. Concurrency Protection (Postgres)** | RESOLVED | **VERIFIED** | PostgreSQL maintains `BEGIN` → `pg_advisory_xact_lock(physical_facility_id)` → hold verification → full occupancy check (bookings + active blocks + approved session extensions + active holds) → payment order verification → booking insertion → hold consumption → `COMMIT`. All under single connection. |
| **4. Payment Finalization Concurrency** | NOT TESTED | **RESOLVED** | `tests/stage07-release-gate.test.js` tests concurrent execution of `finalizeBookingFromPayment` with two independent payment orders on the same facility and interval: exactly 1 succeeds, 1 rejects with `BOOKING_CONFLICT`. |
| **5. Different-Resource Concurrency** | NOT TESTED | **RESOLVED** | Concurrent finalization for Turf 1 (`fac_box_cricket_1`) and Turf 2 (`fac_box_cricket_2`) simultaneously succeeds for both without global platform serialization. |
| **6. Idempotent Payment Retry** | RESOLVED | **VERIFIED** | Replay of same `razorpay_order_id` in `finalizeBookingFromPayment` returns existing booking with `idempotent: true`, creating 0 duplicate records. |
| **7. Cross-Facility Add-on Overlap** | VERIFIED | **RESOLVED** | Booking Cricket Green Net (`fac_green_net_1`) directly collides with and rejects simultaneous booking of Ball-Shooting Machine (`addon_shooting_machine`) on `fac_green_net_1`. |
| **8. Fail-Closed Occupancy Checks** | PARTIAL | **RESOLVED** | `paymentFinalization.js` and `canonicalBookingCommand.js` fail closed: query errors on blocks, extensions, or holds throw and abort finalization immediately instead of being swallowed. |
| **9. Canonical RBAC Vocabulary Parity** | PARTIAL | **RESOLVED** | Migration `017_stage07_remediation.js` seeds identical canonical keys (`booking.walkin`, `booking.create_walkin`, `booking.update`, `dining.order.manage`, `dining.order.update`, `dining.stall.read`) in both PostgreSQL and SQLite. Tests un-skipped and validated against DB. |
| **10. Manager Bypass Removal** | UNRESOLVED | **RESOLVED** | Removed all hardcoded `role === 'manager'` bypasses in `server/domain/rbac/rbacEngine.js`, `server/middleware/auth.js`, and `server/domain/dining/diningOrderCommand.js`. Authorization is 100% permission-driven. |
| **11. Stall Identity & Scoping** | PARTIAL | **RESOLVED** | `admins.stall_id` column added. `getActiveAdmin` extracts `stallId`. Stall staff can only view and mutate orders belonging to their assigned stall. |
| **12. Dining Order Lookup Privacy** | PARTIAL | **RESOLVED** | `GET /orders/:id` uses `attachOptionalAdmin` with active admin/session verification. Unauthenticated lookups require `accessToken`. Invalid token returns 403. Response sanitization excludes `access_token` and `customer_phone`. |

---

## 2. Technical Architecture & Fix Details

### A. Concurrency Engine & Mutex
- **The SQLite Race Condition:** In Node.js, `async` transaction callbacks yielded execution to the event loop during async database calls. While SQLite serializes disk writes, two concurrent async requests could interleave their `SELECT` conflict queries before either executed an `INSERT`, allowing double-booking.
- **The Fix:**
  1. Implemented a transaction mutex queue `sqliteTxMutex` in `server/db.js` (`acquireSqliteLock()`) ensuring only one async transaction callback executes at a time within the Node process.
  2. Issued `BEGIN IMMEDIATE` at the start of SQLite transactions to lock the database file immediately against other connections/processes.
  3. Placed the complete conflict check (bookings, blocks, session extensions, and holds) inside `_sqliteTransaction` / `_pgTransaction` inside `withTransaction`.

### B. Historical Timestamp Reconciliation Engine
- **Strategy:** Built `server/domain/time/timestampAudit.js` with deterministic provenance evaluation:
  - If source column has ISO `Z` or explicit offset, it was stored in UTC (`SAFE_NO_CHANGE`).
  - If source column was derived from local `date` + `time_slot` in IST and shifted by +5:30 (e.g. 18:00 IST stored as 18:00 UTC instead of 12:30 UTC), it is safely corrected back to the canonical UTC instant (`SAFE_CORRECTION`).
  - If legacy date/time_slot conflicts with stored timestamp or is missing, it is quarantined as `MANUAL_REVIEW` or `UNRESOLVABLE` and never modified automatically.
- **Audit Table Migration:** `017_stage07_remediation.js` expanded `timestamp_classification_audit` with `raw_source`, `canonical_current_value`, `expected_interpretation`, `conversion_occurred`, `correction_required`, and `reason`.

### C. RBAC Authorization & Identity Resolution
- **Unified Permission Registry:**
  - Standard permissions populated identically in PostgreSQL `permissions` and SQLite `permissions`.
  - Roles (`super_admin`, `staff`, `stall_staff`, `customer`) mapped in `role_permissions`.
  - Removed `manager` role bypasses across all middlewares and domain commands.
  - Active admin validation via `getActiveAdmin()` checks `is_active`, `session_version`, and attaches `stallId`.

### D. Dining Order Privacy & Response Sanitization
- `GET /api/v2/food/orders/:id` verified through `attachOptionalAdmin`:
  - Valid authenticated Admin/Staff -> full management view.
  - Authenticated Stall Staff -> view restricted to `order.stall_id === admin.stallId`.
  - Guest Customer -> requires query param `?accessToken=<token>`. Must match stored `access_token`.
  - Output sanitized via `sanitizeCustomerOrder()`: excludes `access_token`, `customer_phone`, and internal metadata.

---

## 3. Test & Verification Results

### Test Suite Execution Summary
- **Total Test Files:** 5 (`stage0-platform-foundation`, `stage05-canonical-operationalization`, `stage06-hardening`, `stage07-release-gate`, `customer-mobile-regression`)
- **Total Tests:** 117
- **Total Suites:** 41
- **Pass:** 117 (100%)
- **Fail:** 0
- **Skipped:** 0

### Test Execution by Environment:
1. **Cloud Supabase PostgreSQL:**
   - 117 / 117 tests passed (duration: ~18.5s).
   - Concurrency, hold locking, RBAC DB sync, and timestamp reconciliation fully passing.
2. **Local SQLite (`turf_and_taste.db` and disposable `/tmp/*.db`):**
   - 117 / 117 tests passed (duration: ~0.44s).
   - Same-resource concurrency race prevented (1 success, 1 conflict).
3. **Production Web Build:**
   - `vite build` completed cleanly in 3.39s.
4. **Git Diff Check:**
   - `git diff --check` clean (no whitespace or conflict artifacts).

---

## 4. Release-Gate Checklist

- [x] Concurrent same-resource finalization yields exactly ONE booking
- [x] Concurrency test uses actual payment-finalization path (`finalizeBookingFromPayment`)
- [x] Duplicate same-payment callback remains idempotent
- [x] Different-resource concurrency succeeds without cross-blocking
- [x] SQLite concurrency race is fixed via transaction mutex + `BEGIN IMMEDIATE`
- [x] PostgreSQL advisory lock transaction remains correct and atomic
- [x] Green Net vs Shooting Machine resource conflict passes
- [x] UTC timestamps are never double-shifted
- [x] Local Asia/Kolkata timestamps converted exactly once
- [x] Ambiguous timestamps remain manual-review / quarantined
- [x] Permission vocabulary is canonical across PostgreSQL, SQLite, and code
- [x] Manager / role-name bypass removed completely
- [x] Staff identity resolves through authentication + RBAC
- [x] Stall identity resolves through authentication + RBAC with stall scoping
- [x] Existing Admin identity safely maps to RBAC
- [x] Custom role evaluates strictly on assigned permissions
- [x] Arbitrary Dining order lookup is blocked (401/403)
- [x] Guest order access requires unguessable access token
- [x] Authenticated order ownership / stall scoping enforced
- [x] Dining atomic creation and server-authoritative paise pricing preserved
- [x] Customer mobile regression tests pass
- [x] Build passes
- [x] Working tree clean and pushed to `origin/feature/customer-mobile-curated`

---

## 5. Verdict

**Stage 0.7 is COMPLETE and READY FOR FINAL CODEX RELEASE REVIEW.**  
All foundation blockers are remediated. The codebase is prepared for Admin UI implementation.

# Stage 0 — Platform Foundation Implementation Report

**Date:** 2026-09-30  
**Repository:** `/home/pc/www/POC/TurfAndTaste`  
**Branch:** `feature/customer-mobile-curated`  
**Base Commit Reviewed:** `183596b` (`docs(domain): review and harden platform foundation` by Codex)  
**Implementation Stage:** Stage 0 — Non-Destructive Schema Preflight + Canonical Physical-Resource / Booking-Interval Foundation  

---

## 1. Executive Summary

In response to Codex's independent architecture review and foundation blockers, Stage 0 has established the server-authoritative primitives, canonical interval rules, physical resource conflict engine, fine-grained RBAC matrix, campus dining ordering models, and non-destructive additive schema evolution required before Admin UI development can safely proceed.

Zero destructive operations were performed. Legacy tables and booking histories remain intact.

---

## 2. Database Preflight & Reality Findings

The preflight audit (`server/scripts/preflightCheck.js`) resolved the migration authority ambiguity:
- **Supabase Cloud PostgreSQL (`db.ufntsapkczixvbjzwfvn.supabase.co:5432`):** Primary active database; already possessed all 13 v2 migrations.
- **Local SQLite (`server/data/turf_and_taste.db`):** Kept as a fallback development snapshot.
- **Migration `014_stage0_foundation`** was successfully executed against Supabase PostgreSQL and validated for dual SQLite compatibility.
- **Legacy Bookings Audit:** Discovered historical concurrent bookings on `box-cricket` on `2026-09-19` (`TT-512005` and `TT-222332`), demonstrating why physical facility modeling (`fac_box_cricket_1` and `fac_box_cricket_2`) is necessary.

---

## 3. Schema & Migration Architecture (`014_stage0_foundation.js`)

Stage 0 added the following normalized tables additively without dropping or renaming existing tables:
1. `properties` — Single campus in Patan, Gujarat (`prop_patan`, `Asia/Kolkata`).
2. `sections` — `sec_sports` (Sports & Recreational Arena), `sec_dining` (Campus Dining).
3. `physical_facilities` — 6 stable physical assets (`fac_box_cricket_1`, `fac_box_cricket_2`, `fac_pickleball_1`, `fac_pickleball_2`, `fac_skating_1`, `fac_green_net_1`).
4. `services` — Supported sports disciplines (`srv_box_cricket`, `srv_pickleball`, `srv_skating`, `srv_green_net`).
5. `facility_services` — Mapping physical facilities to services.
6. `add_ons` — Reclassified `addon_shooting_machine` as a service/add-on.
7. `facility_add_ons` — Mapped `addon_shooting_machine` strictly to `fac_green_net_1`.
8. `facility_blocks` — Interval-based maintenance and private event blocks with reason codes and customer messages.
9. `facility_sessions` — Real-world ground operations tracking `scheduled_start_at`/`scheduled_end_at` vs `actual_start_at`/`actual_end_at`.
10. `session_adjustments` — 15-minute extensions and staff delay adjustment records.
11. `payment_holds` — Ephemeral 10-minute reservation holds with automatic release.
12. `roles`, `permissions`, `role_permissions`, `user_roles` — Dynamic RBAC with 24 granular permissions.
13. `dining_tables` — Table number identifiers (`T1`, `T2`, etc.) with QR tokens.
14. `dining_orders`, `dining_order_items` — Table-number ordering model with non-negative paise pricing.
15. **Additive columns on `bookings`:**
    - `physical_facility_id` VARCHAR(100)
    - `scheduled_start_at` TIMESTAMP
    - `scheduled_end_at` TIMESTAMP
    - `booking_type` VARCHAR(50) DEFAULT 'STANDARD_QUICK'
    - `delivery_preference` VARCHAR(50) DEFAULT 'WHATSAPP'
    - `total_amount_paise` INTEGER
    - `deposit_amount_paise` INTEGER
    - `cancellation_actor` VARCHAR(100)
    - `cancelled_at` TIMESTAMP

---

## 4. Canonical Domain Engines (`server/domain/`)

### A. Time & Interval Engine (`server/domain/time/bookingInterval.js`)
- Explicit `Asia/Kolkata` (IST, UTC+05:30) offset handling.
- Interval Semantics: Half-open `[start_at, end_at)` (touching boundaries like 18:00–19:00 and 19:00–20:00 do not overlap).
- Cross-midnight safety: Bookings crossing midnight (e.g. 23:00 to 01:00 next day, or 23:45 to 00:45 next day) preserve day rollover and exact timestamps.

### B. Booking Rules Engine (`server/domain/booking/bookingRules.js`)
- **Standard Quick Booking:** Whole-hour starts only (`:00`); durations strictly 1 Hour (60m) or 2 Hours (120m). 1.5h / 90m is rejected.
- **Custom Booking:** Quarter-hour starts (`:00`, `:15`, `:30`, `:45`); whole-hour multiples only ($\ge$ 60m). Fractional hours are rejected.
- **Lead Time:** Minimum 60 minutes for customer self-service; immediate walk-ins permitted for authorized staff.
- **Next Quick Start Rounding:** If physical occupancy ends at a partial hour (e.g. 20:30), next quick start rounds up to 21:00, while custom booking may start at 20:30.

### C. Physical Resource Conflict Engine (`server/domain/booking/conflictEngine.js`)
- Evaluates overlap against physical resource ID (`facility_id`), active facility blocks, and active payment holds.
- Multi-turf concurrency: Turf 1 and Turf 2 can be booked simultaneously.
- Same-court collision: Turf 1 cannot overlap Turf 1.
- Cricket Green Net with Shooting Machine conflicts with regular Green Net practice because both occupy `fac_green_net_1`.

### D. State Machine & Terminal Cancellation (`server/domain/booking/bookingStateMachine.js`)
- `CANCELLED` is strictly **TERMINAL**. Any attempt to resurrect a cancelled booking to `CONFIRMED` returns HTTP 409.
- Status update logs `cancellation_actor` and `cancelled_at`.
- Cancelling releases physical resource occupancy immediately.

### E. Ground Session Operations (`server/domain/session/sessionOperations.js`)
- Preserves `scheduled_start_at`/`scheduled_end_at` distinctly from `actual_start_at`/`actual_end_at`.
- Extensions require staff approval, must use 15-minute increments, and check collision with the next scheduled reservation.

### F. Safe Guest Identity & Privacy Engine (`server/domain/guest/guestPrivacy.js`)
- Hardened `GET /api/bookings/history`: Unauthenticated access using arbitrary phone or email is strictly blocked (HTTP 401).
- Requires an authenticated staff session or a cryptographic single-use guest access token.

### G. RBAC Engine (`server/domain/rbac/rbacEngine.js`)
- 24 granular permission keys across `facilities`, `bookings`, `pricing`, `payments`, `customers`, `events`, `reviews`, `dining`, and `maintenance`.
- Default-deny authorization middleware `requirePermission(key)`.

### H. Campus Dining Engine (`server/domain/dining/diningEngine.js`)
- Table number validation (`validateTableNumber`).
- Order totals computed strictly in paise with itemized tax.
- Formal dining state machine: `PLACED` → `ACCEPTED` → `PREPARING` → `READY` → `SERVED` → `COMPLETED` (with terminal cancellation).

---

## 5. Automated Regression Test Suite

A dedicated server test suite (`tests/stage0-platform-foundation.test.js`) was created with 33 tests verifying all critical domain invariants:
- **Intervals & Cross-Midnight:** 5 tests passing
- **Standard Quick Booking:** 3 tests passing
- **Custom Booking:** 3 tests passing
- **Lead Time:** 3 tests passing
- **State Machine & Terminal Cancellation:** 4 tests passing
- **Physical Inventory & Conflict Model:** 4 tests passing
- **Session Extensions & Rounding:** 4 tests passing
- **RBAC Permissions:** 2 tests passing
- **Guest Identity Privacy:** 2 tests passing
- **Campus Dining:** 3 tests passing

**Combined Test Results (`npm test`):**
- **55 / 55 tests passing** across 19 test suites in 186ms.
- **Vite production web build (`npm run build`):** Built cleanly in 3.69s (0 errors).

---

## 6. Preflight Tooling & Legacy Reconciliation

A reusable preflight script was created at `server/scripts/preflightCheck.js`:
- Inspects connected database engine (PostgreSQL or SQLite).
- Inventories tables, columns, indexes, and migrations.
- Audits legacy booking records for ambiguous formats and overlaps.
- Verifies that all 18 Stage 0 target tables exist.
- Reports status cleanly without modifying data.

---

## 7. Residual Risks & Next Steps Before Admin UI

1. **Legacy Booking Interval Backfill:** Legacy rows have `date` + `time_slot` strings. Additive columns `scheduled_start_at` and `scheduled_end_at` are nullable; backfill should be executed during a maintenance window using `normalizeBookingInterval`.
2. **Table QR Authentication:** In Stage 0, table numbers are validated for format. Future customer dining ordering should link table QR tokens with stall verification.
3. **Stage 0 Readiness:** The technical platform foundation is now sound, fully tested, and ready for independent Codex review before beginning Admin UI generation.

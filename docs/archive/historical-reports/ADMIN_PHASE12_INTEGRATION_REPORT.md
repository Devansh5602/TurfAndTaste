# Turf & Taste — Admin Phase 1.2 Integration Report

**Date:** 2026-10-01
**Branch:** `feature/turf-and-taste-admin-platform`
**Starting Commit:** `8fb1091` ("docs(admin): record phase 1.1 concurrency QA")
**Scope:** Admin Phase 1.2 — Final Domain Integration Fixes (Blockers A, B, C)

---

## 1. Executive Summary

This continuation successfully resolved all three domain blockers identified during the Codex Phase 1.1 review without introducing invented data, discarding prior work, or touching the Android/Gradle toolchain.

1. **Blocker A (Configurable Pricing):** Implemented normalized pricing tables in Migration 020 (`pricing_rules`, `special_date_prices`, `add_on_prices`) and upgraded `server/domain/pricing/pricingResolver.js` to enforce deterministic precedence, interval boundary pro-rating across floodlight transitions, multi-hour packages, and server-authoritative paise calculation.
2. **Blocker B (Authoritative Extension Pricing):** Updated `server/routes/sessions.js` to compute session extension charges strictly server-side via `resolveExtensionPricing` inside the concurrency-locked transaction. Client-manipulated price submissions are completely ignored. Explicit free extensions persist `is_free = 1` and `charge_paise = 0`.
3. **Blocker C (Canonical Slot Availability):** Migrated `GET /api/bookings/slots` in `server/routes/bookings.js` from legacy `blocked_slots` to canonical resource occupancies via `loadCanonicalOccupancies`. The endpoint evaluates active `facility_blocks`, confirmed bookings, approved session extensions, and active `payment_holds` on the physical resource identity (`physical_facility_id`).

---

## 2. Continuation Inventory & Preserved Work

At continuation start, the following partial changes were inspected:
- `server/migrations/020_pricing_rules.js`: Schema for configurable pricing rules. Preserved and fixed migration context signature `{ isPostgres, exec, db }` to support both SQLite and PostgreSQL without runtime errors. Cleaned AI narration comments.
- `server/domain/pricing/pricingResolver.js`: Canonical pricing engine. Preserved and verified for multi-tier, interval pro-rating, packages, add-ons, and deposit calculations.
- `server/routes/sessions.js`: Session extension route. Preserved transactional lock and server price computation.
- `server/db.js`: Migration registration for `020_pricing_rules.js`. Preserved.

Additional work completed during continuation:
- `server/domain/booking/canonicalBookingCommand.js`: Enhanced `resolveCanonicalFacility` to recognize `ball-machine`, `shooting-machine`, and service/add-on IDs; added `loadCanonicalOccupancies` helper.
- `server/routes/bookings.js`: Rewrote `/api/bookings/slots` to query canonical physical resource occupancies instead of legacy `blocked_slots`.
- `scripts/test-runner.js`: Registered `tests/admin-phase12-integration.test.js` in the isolated test runner.
- `tests/admin-phase12-integration.test.js`: Created 21 automated integration tests covering all pricing precedence rules, extension manipulation defenses, and slot blocking/unblocking/cross-midnight semantics.

---

## 3. Migration 020 & Pricing Engine Architecture

### Database Tables (paise-only integer amounts)
1. `pricing_rules`:
   - `id`, `facility_id`, `service_id`, `rule_type` (`BASE_RATE` | `PACKAGE` | `EXTENSION_RATE`), `period_type` (`DAY` | `NIGHT` | `WEEKEND_DAY` | `WEEKEND_NIGHT`), `rate_paise_per_hour`, `rate_paise_total`, `rate_paise_per_15min`, `min_hours`, `max_hours`, `deposit_fixed_paise`, `deposit_pct_of_total`, `is_active`.
2. `special_date_prices`:
   - `id`, `facility_id`, `calendar_date`, `label`, `rate_paise_per_hour`, `is_replacement`, `is_active`.
3. `add_on_prices`:
   - `id`, `add_on_id`, `facility_id`, `rate_paise_per_hour`, `rate_paise_flat`, `is_active`.

### Precedence Strategy
`[1] special_date_prices` ➔ `[2] pricing_rules` (`PACKAGE`) ➔ `[3] pricing_rules` (`BASE_RATE` segments) ➔ `[4] add_on_prices` ➔ `[5] pricing_tiers` (legacy fallback).

### Interval-Boundary Pro-Rating
Bookings intersecting the floodlight start boundary (e.g. 05:00 PM – 07:00 PM) are segmented into day and night intervals, priced with their respective rules, and combined. Start time alone never dictates the entire booking rate.

---

## 4. Session Extension Pricing Architecture

- **Decision Flow:** Staff chooses whether an extension is free or paid.
- **Paid Extension:** Server invokes `resolveExtensionPricing(client, { facilityId, extensionStartAt, extensionMinutes })` inside `dbAsync.withTransaction`. Resolves from `EXTENSION_RATE` rule or pro-rated `BASE_RATE`.
- **Tampering Defense:** Client-submitted `chargePaise` in request body is intentionally not read. A client submitting `chargePaise: 1` receives the server-calculated amount and the database persists only the server amount.
- **Free Extension:** Explicitly persists `is_free = 1` and `charge_paise = 0`.
- **Duration Granularity:** Supports arbitrary positive multiples of 15 minutes (15, 30, 45, 60, 75, 90+).

---

## 5. Canonical Slot Availability Integration

- **Resource Resolution:** `resolveCanonicalFacility` maps legacy slugs, service codes, and add-ons (`ball-machine`, `cricket-nets`, `srv_green_net`) to authoritative physical facilities (`fac_box_cricket_1`, `fac_green_net_1`, etc.).
- **Single Source of Truth:** `loadCanonicalOccupancies` fetches all active bookings, active `facility_blocks`, session extensions, and payment holds in unified queries.
- **Boundary Semantics:** Half-open intervals $[S, E)$ using UTC Date instants.
- **Cross-Midnight:** Blocks spanning 23:00 to 01:00 correctly flag overlapping slots on both calendar dates without leaking into adjacent intervals.
- **Green Net & Ball-Shooting Machine:** A block on `fac_green_net_1` renders both Net Practice and Shooting Machine unavailable, enforcing physical resource identity.
- **Block Release:** Releasing a block immediately restores the slot to `available` only if no booking, hold, or extension occupies that interval.

---

## 6. Verification & Test Execution

### Automated Test Runs
1. **First Run:** `186/186 pass`, `0 fail`, `0 skipped`.
2. **Second Run:** `186/186 pass`, `0 fail`, `0 skipped`.
3. **Production Build:** `npm run build` succeeds (Vite dist bundle generated in 3.78s).
4. **Git Diff Check:** `git diff --check` clean, zero whitespace/merge errors.
5. **Secret Check:** Zero API keys, credentials, or production secrets in diff.

### Suite Breakdown
| Test Suite | Pass | Fail |
|---|---|---|
| `stage0-platform-foundation` | 12 | 0 |
| `stage05-canonical-operationalization` | 27 | 0 |
| `stage06-hardening` | 20 | 0 |
| `stage07-release-gate` | 15 | 0 |
| `stage08-release-gate` | 19 | 0 |
| `stage09-release-gate` | 10 | 0 |
| `admin-phase1` | 13 | 0 |
| `admin-phase12-integration` | 21 | 0 |
| `customer-mobile-regression` | 43 | 0 |
| **Total** | **186** | **0** |

---

## 7. Status & Handoff

Admin Phase 1.2 is **COMPLETE** and verified against all domain invariants.
Admin Phase 2 has **NOT** been started.
Repository is ready for final Codex review.

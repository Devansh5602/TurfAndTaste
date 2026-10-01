# Turf & Taste — Antigravity → Codex Handoff

## Checkpoint Date
2026-10-01

## Stage
**Admin Platform Implementation Phase 1.2 — Final Domain Integration Fixes**

## Branch
`feature/turf-and-taste-admin-platform` (created from verified foundation `1ffb5a0` on `feature/customer-mobile-curated`)

---

## Phase 1.2 Resolved Blockers

All three domain blockers identified in Codex review have been resolved and verified with automated test suites:

1. **Configurable Server-Authoritative Pricing Engine (Migration 020):**
   - Implemented schema in `server/migrations/020_pricing_rules.js` backing the documented precedence hierarchy:
     `[1] special_date_prices` ➔ `[2] pricing_rules` (PACKAGE) ➔ `[3] pricing_rules` (BASE_RATE: DAY, NIGHT, WEEKEND_DAY, WEEKEND_NIGHT) ➔ `[4] add_on_prices` ➔ `[5] pricing_tiers` (legacy fallback).
   - Paired with `server/domain/pricing/pricingResolver.js` for interval-boundary splitting across floodlight start (pro-rating day and night segments independently), multi-hour package evaluation, and add-on surcharges (e.g. Shooting Machine on Green Net).
   - All amounts resolved in integer paise; display formatting is client-only.
   - Preserves walk-in pricing authority and <1h full-payment rule.

2. **Server-Authoritative Session Extension Pricing:**
   - `POST /api/sessions/extend` calculates extension charges server-side using `resolveExtensionPricing` within the resource-locked transaction.
   - Client-submitted `chargePaise` is strictly ignored; client price manipulation cannot override server rules.
   - Staff may explicitly grant free extensions, persisting `is_free = 1` and `charge_paise = 0`.
   - Supports any valid multiple of 15 minutes (15, 30, 45, 60, 75, 90+).

3. **Canonical Slot Availability (`/api/bookings/slots`):**
   - Migrated from legacy `blocked_slots` and ad-hoc string comparisons to canonical physical resource occupancies (`loadCanonicalOccupancies`).
   - Evaluates confirmed bookings, active `facility_blocks`, approved session extensions, and active `payment_holds`.
   - Uses physical resource identity (`fac_box_cricket_1`, `fac_green_net_1`, etc.).
   - Blocking `fac_green_net_1` cascades availability state to both standard Net Practice and Ball-Shooting Machine sessions.
   - Unblocking immediately restores slot to `available` only when no other occupancy covers the interval.
   - Supports cross-midnight block intervals (e.g. 23:00 to 01:00) across calendar date boundaries.

---

## Test Status
| Suite | Pass | Fail |
|---|---|---|
| stage0-platform-foundation | **12/12** | 0 |
| stage05-canonical-operationalization | **27/27** | 0 |
| stage06-hardening | **20/20** | 0 |
| stage07-release-gate | **15/15** | 0 |
| stage08-release-gate | **19/19** | 0 |
| stage09-release-gate | **10/10** | 0 |
| admin-phase1 | **13/13** | 0 |
| admin-phase12-integration | **21/21** | 0 |
| customer-mobile-regression | **43/43** | 0 |
| **Total Tests** | **186/186** | **0** |
| Production build (Vite) | ✅ Passing (dist generated) | — |

---

## Next Tasks (Phase 2 Roadmap)
- Customer & Guest CRM
- Payment Reconciliation & Offline Payment Recording
- Roles & Granular Permission Management UI
- Events & Notices Publisher
- Dining Stalls & Menu Management
- Dining Kitchen Order Display (Table POS)
- Review Moderation Desk
- Reports & Annual PDF Archive Ledger

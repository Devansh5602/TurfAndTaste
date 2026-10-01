# Turf & Taste — Antigravity → Codex Handoff

## Checkpoint Date
2026-10-01

## Stage
**Admin Platform Implementation Phase 1.3 — Canonical Authority + Pricing Snapshot Closeout**

## Branch
`feature/turf-and-taste-admin-platform`

---

## Phase 1.3 Resolved Blockers

All four blockers identified in `CODEX_ADMIN_PHASE12_REVIEW.md` have been resolved and verified with automated test suites:

1. **One Canonical Pricing Authority:**
   - Single calculation engine: `server/domain/pricing/pricingResolver.js`.
   - Legacy quote caller `POST /api/v2/quotes` delegates strictly to canonical `resolvePricing`.
   - Returns structured quote breakdown: pre-package subtotal, explicit package discount, add-on amounts, deposit rules, and `fullPaymentRequired`.
   - No parallel legacy pricing calculators remain active.

2. **One Canonical Availability Authority:**
   - Unified conflict engine: `server/domain/booking/canonicalBookingCommand.js`.
   - `blocked_slots` is de-authoritized as an independent live conflict authority.
   - Legacy routes (`/api/bookings/blocked-slots`, `/block-slot`, `/unblock-slot`) bridge directly to `facility_blocks`.
   - Customer and Admin availability evaluate identical physical resource occupancies.

3. **Immutable Pricing Snapshots:**
   - Persisted in `bookings.pricing_snapshot` (for confirmed bookings) and `session_adjustments.pricing_snapshot` (for session extensions).
   - Historical bookings display persisted snapshots and do NOT recompute when current pricing rules change.
   - Legacy pre-snapshot bookings explicitly display a legacy record badge.

4. **Migration Seed Reconciliation & Safety:**
   - Removed unverified bootstrap tariff `aop_shooting_machine` from `020_pricing_rules.js`.
   - Added migration `021_pricing_and_availability_reconciliation.js` to safely reconcile existing databases without modifying human-configured tariffs.

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
| admin-phase13-closeout | **8/8** | 0 |
| customer-mobile-regression | **43/43** | 0 |
| **Total Tests** | **198/198** | **0** |
| Production build (Vite) | ✅ Passing (3.56s) | — |

---

## Important Notice on Admin Phase 2
**Admin Phase 2 has NOT started.** All work in this checkpoint is strictly limited to Phase 1.3 canonical authority unification, snapshot persistence, and migration reconciliation.

# Turf & Taste — Antigravity → Codex Handoff

## Checkpoint Date
2026-09-30

## Stage
**Stage 0.8: Final Identity & Historical Timestamp Release Blocker Remediation**

## Branch
`feature/customer-mobile-curated`

---

## Phase Completed
**Stage 0.8: Final Identity & Historical Timestamp Release Blocker Remediation**

All 6 blockers identified in `docs/domain/CODEX_STAGE07_REVIEW.md` have been fully resolved:
1. **Historical Timestamp Provenance & Operational Quarantine:** Explicit UTC (`Z`) and offset (`+05:30`) instants preserved without double shift; unannotated legacy strings converted once; ambiguous records quarantined as `MANUAL_REVIEW` and excluded from live booking occupancy.
2. **Elimination of Role-Name Authorization Bypasses:** Completely eliminated all `super_admin` / `manager` route shortcuts. Authorization is 100% permission-governed.
3. **Safe Legacy Manager Identity Mapping:** Non-destructive migration 018 safely maps legacy `manager` accounts to `staff` with audit records in `admin_role_migration_audit`.
4. **Dynamic Principal & Staff/Stall Effective Permissions:** `getActiveAdmin()` loads effective permissions dynamically from the database.
5. **Strict Stall Tenancy Scoping:** `stall_staff` accounts can only access/manage orders for their assigned stall. Cross-stall and unscoped requests are rejected with HTTP 403.
6. **100% Test Pass Rate:** 136/136 tests passing across all 6 test suites.

See full details in [`docs/domain/STAGE08_IMPLEMENTATION_REPORT.md`](docs/domain/STAGE08_IMPLEMENTATION_REPORT.md).

---

## Test Status
| Suite | Pass | Fail |
|---|---|---|
| stage0-platform-foundation | **12/12** | 0 |
| stage05-canonical-operationalization | **27/27** | 0 |
| stage06-hardening | **20/20** | 0 |
| stage07-release-gate | **15/15** | 0 |
| stage08-release-gate | **19/19** | 0 |
| customer-mobile-regression | **43/43** | 0 |
| **Total Tests** | **136/136** | **0** |
| Production build (Vite) | ✅ Passing | — |
| Static Bypass Scan | ✅ 0 shortcuts | — |

---

## Key Commits & Files Changed
- `server/domain/time/timestampAudit.js` — Provenance evaluation engine, explicit UTC/offset preservation, operational quarantine, and idempotent reconciliation runner
- `server/migrations/018_stage08_reconciliation_and_rbac.js` — Schema migration for `is_quarantined`, `reconciliation_status`, `admin_role_migration_audit`, manager -> staff mapping, and timestamp reconciliation invocation
- `server/middleware/auth.js` — Dynamic principal permission loading and role resolution in `getActiveAdmin()`
- `server/routes/bookings.js` — Removed `super_admin` role-name bypasses and excluded quarantined records from availability
- `server/routes/v2/food.js` — Removed role bypasses and enforced strict stall-scoping for `stall_staff`
- `server/domain/dining/diningOrderCommand.js` — Stall-scoping verification on order status mutations
- `server/domain/booking/canonicalBookingCommand.js`, `paymentFinalization.js`, `conflictEngine.js`, `quotes.js` — Exclusion of quarantined bookings from live conflict checks
- `tests/stage08-release-gate.test.js` — Pre-Admin Stage 0.8 release-gate test suite
- `docs/domain/STAGE08_IMPLEMENTATION_REPORT.md` — Detailed Stage 0.8 verification report

---

## Status for Codex Review
**READY FOR FINAL CODEX RELEASE REVIEW.**

Admin UI implementation can begin once this release gate is approved.

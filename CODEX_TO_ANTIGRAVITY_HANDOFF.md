# Turf & Taste — Antigravity → Codex Handoff

## Checkpoint Date
2026-09-30

## Stage
**Stage 0.7: Final Foundation Blocker Remediation**

## Branch
`feature/customer-mobile-curated`

---

## Phase Completed
**Stage 0.7: Final Foundation Blocker Remediation**

All 5 blockers identified in `docs/domain/CODEX_STAGE06_REVIEW.md` have been fully resolved:
1. Historical timestamp double-shift risk & provenance reconciliation.
2. Same-resource concurrent booking race (fixed on both SQLite and PostgreSQL).
3. RBAC manager bypass removed & unified canonical permission registry across all backends.
4. Dining customer order lookup ownership, unguessable token, & response sanitization.
5. 100% test pass rate across 117 tests on both PostgreSQL and SQLite.

See full details in [`docs/domain/STAGE07_IMPLEMENTATION_REPORT.md`](docs/domain/STAGE07_IMPLEMENTATION_REPORT.md).

---

## Test Status
| Suite | Pass | Fail |
|-------|------|------|
| stage0-platform-foundation | **12/12** | 0 |
| stage05-canonical-operationalization | **27/27** | 0 |
| stage06-hardening | **20/20** | 0 |
| stage07-release-gate | **15/15** | 0 |
| customer-mobile-regression | **43/43** | 0 |
| **Total Tests** | **117/117** | **0** |
| Production build (Vite) | ✅ Passing | — |
| Database Parity (Postgres & SQLite) | ✅ 100% | — |

---

## Key Commits & Files Changed
- `server/db.js` — SQLite transaction mutex (`acquireSqliteLock`) + `BEGIN IMMEDIATE` + migration 017 runner
- `server/domain/booking/paymentFinalization.js` — Fail-closed full occupancy conflict checking & unified single-transaction lifecycle
- `server/domain/time/timestampAudit.js` — Deterministic timestamp provenance evaluation & safe reconciliation engine
- `server/migrations/017_stage07_remediation.js` — DB schema hardening, full audit table columns, `stall_id` on admins, and unified permissions
- `server/domain/rbac/rbacEngine.js` — Complete removal of `manager` / role bypasses (100% permission-driven)
- `server/domain/dining/diningOrderCommand.js` — Removed raw role checks and enforced stall-level tenancy scoping
- `server/routes/v2/food.js` — `attachOptionalAdmin` with active admin/session check, unguessable guest token validation, and sanitized response
- `tests/stage07-release-gate.test.js` — Pre-Admin release-gate test suite covering concurrency, idempotency, timestamps, RBAC, and dining privacy
- `docs/domain/STAGE07_IMPLEMENTATION_REPORT.md` — Stage 0.7 implementation report

---

## Status for Codex Review
**READY FOR FINAL CODEX RELEASE REVIEW.**

Admin UI implementation can begin once this release gate is approved.

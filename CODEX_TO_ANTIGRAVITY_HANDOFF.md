# Turf & Taste — Antigravity → Codex Handoff

## Checkpoint Date
2026-09-30

## Commit
a9d92d1 — `stage 0.6: canonical transaction + authorization hardening`

## Branch
`feature/customer-mobile-curated`

---

## Phase Completed
**Stage 0.6: Canonical Transaction + Authorization Hardening**

All stage 0.6 blockers identified in `CODEX_STAGE05_REVIEW.md` have been resolved.

See full details in [`docs/domain/STAGE06_IMPLEMENTATION_REPORT.md`](docs/domain/STAGE06_IMPLEMENTATION_REPORT.md).

---

## Test Status
| Suite | Pass | Fail |
|-------|------|------|
| stage05-canonical-operationalization | **27/27** | 0 |
| stage06-hardening (new) | **20/20** | 0 |
| Production build (Vite) | ✅ | — |
| Migration 016 (PostgreSQL) | ✅ Applied | — |

---

## Key Files Changed
- `server/domain/booking/paymentFinalization.js` — NEW canonical atomic finalization
- `server/migrations/016_stage06_hardening.js` — NEW schema hardening migration
- `tests/stage06-hardening.test.js` — NEW test suite
- `server/db.js` — withTransaction() added; 016 imported & registered
- `server/middleware/auth.js` — staff + stall_staff now recognized roles
- `server/domain/rbac/rbacEngine.js` — alias resolution; correct defaults
- `server/routes/payments.js` — delegates to canonical finalizeBookingFromPayment
- `server/routes/bookings.js` — removed client-controlled status
- `server/domain/booking/canonicalBookingCommand.js` — status server-derived only
- `server/domain/dining/diningOrderCommand.js` — atomic; stall check; access_token
- `server/routes/v2/food.js` — dining GET requires auth or access_token

---

## Remaining Work (for Codex)
**NEXT PHASE: Admin UI Implementation**

Blockers for Admin UI are now CLEARED. The platform foundation is:
- Transaction-safe
- Idempotent payment finalization
- Correct RBAC vocabulary (staff/stall_staff can authenticate)
- Dining order privacy-safe
- Server-authoritative pricing and status

**Codex should now begin Admin UI screens in sequence:**
1. Admin login (staff role auth works now)
2. Booking dashboard (RBAC-gated, uses booking.read/update permissions)
3. Facility management (facility.read/update permissions)
4. Dining order management for stalls (dining.order.manage permission)
5. CMS/admin settings

**Read before implementing Admin UI:**
- `docs/domain/RBAC.md`
- `docs/domain/SESSION_OPERATIONS.md`
- `docs/domain/DINING_AND_ORDERS.md`
- `docs/domain/FACILITY_DOMAIN.md`
- `AGENTS.md` (inviolable guardrails)

---

## Do NOT modify
- `server/domain/booking/paymentFinalization.js` — do NOT add alternate booking creation paths
- `server/domain/booking/canonicalBookingCommand.js` — do NOT re-add input.status
- `server/migrations/016_stage06_hardening.js` — already applied to production PostgreSQL

# Stage 0.6 Implementation Report

**Date:** 2026-09-30  
**Commit:** a9d92d1  
**Status:** ✅ COMPLETE — All blockers resolved

---

## Blockers Addressed from Codex Stage 0.5 Review

### ✅ BLOCKER 1: Non-Atomic Payment Finalization
**Was:** `POST /api/payments/verify` performed signature verify → separate conflict check → separate booking INSERT (window for double-booking).

**Fixed:** New `server/domain/booking/paymentFinalization.js` is the ONLY path for Razorpay-confirmed bookings:
- Acquires per-facility `pg_advisory_xact_lock` INSIDE the transaction (not before)
- Conflict check (bookings + holds + blocks) while lock held
- Booking + session + payment + quote_redemption + order update in ONE atomic transaction
- Idempotent: duplicate `razorpay_order_id` returns existing booking without duplicate INSERT
- `db.withTransaction(callback)` added to expose single pg.Client for lock spanning

### ✅ BLOCKER 2: RBAC Vocabulary Drift
**Was:** Seeds had `booking.walkin`, but routes checked `booking.create_walkin`. Seeds had `dining.order.manage`, routes checked `dining.order.update`. Staff logged in with `manager` role got 403 on every route.

**Fixed:**
- `rbacEngine.js`: `hasPermission()` now resolves bidirectional aliases:
  - `booking.walkin` ↔ `booking.create_walkin`
  - `dining.order.manage` ↔ `dining.order.update`
  - `booking.update` implied by `booking.checkin || booking.cancel`
- All alias permission keys added to `STANDARD_PERMISSIONS`
- `DEFAULT_ROLE_PERMISSIONS` updated for all roles with correct alias sets
- `requirePermission`: `manager` now bypasses same as `super_admin`
- Migration `016` seeds new permission rows + role_permissions entries to DB

### ✅ BLOCKER 3: Auth Only Accepted super_admin and manager
**Was:** `auth.js` `activeAdminRoles = { super_admin, manager }` — `staff` and `stall_staff` role users couldn't authenticate at all.

**Fixed:** `ADMIN_ROLES` now includes `staff` and `stall_staff`. Both can authenticate and proceed to RBAC-gated routes.

### ✅ BLOCKER 4: Dining Order Data Leak
**Was:** `GET /api/v2/food/orders/:id` returned full order (including customer phone) to any unauthenticated caller who knew the order ID.

**Fixed:** Route now requires EITHER:
- Valid admin JWT in Authorization header, OR
- `?accessToken=<token>` matching the order's `access_token` column (generated on create)
- Customer phone is omitted from non-admin responses

### ✅ BLOCKER 5: Dining Order Not Atomic
**Was:** `createDiningOrder` wrote header row, then loop-wrote each item separately — any item write failure left orphaned header.

**Fixed:** `diningOrderCommand.js` rewritten:
- Validates all items upfront (DB lookup for price, availability, stall_id)
- Active stall check (stall.status = 'active')
- Single-stall constraint (all items must share one stall_id)
- `db.transaction([header, ...allItems])` — single all-or-nothing write
- Server-authoritative pricing (client-submitted item prices strictly ignored)
- `access_token` generated via `crypto.randomBytes(24).toString('hex')`

### ✅ BLOCKER 6: Client-Controlled Booking Status
**Was:** `canonicalBookingCommand.js` accepted `input.status` override, letting any caller bypass payment/actor-derived status.

**Fixed:** `input.status` removed. Status is server-derived:
- `STAFF` actor → `'Confirmed'`  
- `CUSTOMER` + `paymentStatus === 'PAID'` → `'Confirmed'`
- Otherwise → `'Payment Review'`

### ✅ BLOCKER 7: Timestamp Classification (Pre-015 Shift Risk)
**Was:** No audit trail for potentially double-shifted timestamps.

**Fixed:** Migration 016 creates `timestamp_classification_audit` table and classifies all existing bookings. Bookings created before migration 015 applied are flagged for `MANUAL_REVIEW` with LOW confidence.

---

## Migration 016 Summary

Applied to both PostgreSQL (Supabase) and SQLite:
- `dining_orders.access_token` — customer-safe order lookup token
- `payment_orders.idempotency_key` — future replay protection
- `payment_orders.finalized_booking_id` — booking binding for idempotency
- `admins.role` — supports staff/stall_staff roles
- `timestamp_classification_audit` — pre-015 timestamp audit table
- Permission vocabulary: `booking.create_walkin`, `booking.update`, `dining.order.update`, `dining.stall.read` in DB
- Role permission assignments for all alias keys

---

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| stage05-canonical-operationalization | 27 | **27** | 0 |
| stage06-hardening (new) | 20 | **20** | 0 |
| Production build | — | ✅ | — |

---

## Verdict

**Stage 0.6: COMPLETE.**  
All original Codex blockers have been resolved. The platform foundation is now:
- Transaction-safe (advisory lock + atomic operations)
- Idempotent (payment retry returns existing booking)
- Authorization-consistent (staff/stall_staff can authenticate and use RBAC)
- Privacy-safe (dining order lookup requires proof)
- Server-authoritative (prices and status from server context, not client)

**Next phase:** Admin UI implementation can begin.

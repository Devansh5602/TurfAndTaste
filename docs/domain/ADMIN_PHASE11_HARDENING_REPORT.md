# Turf & Taste — Admin Platform Phase 1.1 Hardening Report

**Stage:** Admin Platform Phase 1.1 Final Hardening  
**Branch:** `feature/turf-and-taste-admin-platform`  
**Base Commit:** `41acc7e` (Phase 1 Codex review HEAD)  
**Status:** **READY FOR CODEX REVIEW**

---

## 1. Blockers Resolved

### Blocker A — Server-Authoritative Pricing for Admin Walk-Ins (FIXED)

**Problem:** `WalkInView.jsx` submitted hardcoded `₹800 (Full Payment)` / `₹400 (Token Deposit)` strings.
`server/routes/bookings.js` trusted the client-supplied `payload.amount` as the booking total.

**Fix:** New `server/domain/pricing/pricingResolver.js` module:
- `resolveAdminWalkInPricing(db, opts)` reads `pricing_tiers` and `timings` from the database.
- Applies day/night rate (per floodlight start time), weekend surge percentage, and deposit calculation.
- Returns `totalAmountPaise`, `depositAmountPaise`, `chargedAmountPaise`, session type, and breakdown.

In `server/routes/bookings.js`:
- New `GET /api/bookings/admin-quote` endpoint (requires `booking.create_walkin` permission).
- `POST /api/bookings` for `STAFF_WALKIN` now calls `resolveAdminWalkInPricing` internally.
- **Client-supplied amounts are completely ignored for walk-ins.** The server-resolved amounts are the only authority.
- The response includes `"— Server Resolved"` tag in the amount string to make the source traceable.

In `src/admin/pages/WalkInView.jsx`:
- Removed hardcoded `₹800`/`₹400` button labels and `amountPaidPaise` state.
- Auto-fetches `/api/bookings/admin-quote` on every relevant form change (facility, date, slot, duration, payment type) via `src/services/api.js::getAdminWalkInQuote`.
- Displays server-resolved quote panel: session type (Day/Floodlit), rate/hour, weekend surge, duration, and the authoritative amount to collect.
- Does not send `amount` in the booking payload — the server re-resolves pricing independently.

### Blocker B — Transactional Serialization of Block and Extension Mutations (FIXED)

**Problem:**
- `POST /api/facilities/blocks`: conflict read → separate INSERT (race window between read and write).
- `POST /api/sessions/extend`: conflict read → separate INSERT + UPDATE (two writes could be out-of-sync under concurrency).

**Fix:**

**`server/routes/facilities.js` — Block Creation:**
- Wrapped conflict check + INSERT inside `dbAsync.withTransaction(async (client) => { ... })`.
- For PostgreSQL: `pg_advisory_xact_lock(hashtext('block_lock_<facilityId>'))` serializes concurrent block creation on the same resource.
- For SQLite: `BEGIN IMMEDIATE` + mutex provides equivalent serialization.
- Conflict error is signaled via `err.httpStatus = 409` (thrown inside transaction, caught and returned as HTTP 409 outside).

**`server/routes/sessions.js` — Session Extension:**
- Moved conflict check, `session_adjustments` INSERT, and `bookings` UPDATE all inside `dbAsync.withTransaction(async (client) => { ... })`.
- For PostgreSQL: `pg_advisory_xact_lock(hashtext('extend_lock_<facilityId>'))` serializes.
- All three writes are atomic: if the booking UPDATE fails, the adjustment row is also rolled back.
- Conflict error uses the same pattern (`err.httpStatus = 409` thrown, caught outside transaction).

---

## 2. New Files

| File | Purpose |
|------|---------|
| `server/domain/pricing/pricingResolver.js` | Server-authoritative pricing resolver (day/night, surge, deposit) |

---

## 3. Modified Files

| File | Change |
|------|--------|
| `server/routes/bookings.js` | Added `GET /admin-quote`; walk-in POST now calls `resolveAdminWalkInPricing` |
| `server/routes/facilities.js` | Block POST uses `dbAsync.withTransaction` with advisory lock |
| `server/routes/sessions.js` | Extension POST uses `dbAsync.withTransaction` with advisory lock; all three writes atomic |
| `src/services/api.js` | Added `getAdminWalkInQuote()` |
| `src/admin/pages/WalkInView.jsx` | Auto-fetches quote; displays server-resolved breakdown; removes hardcoded amounts |
| `tests/admin-phase1.test.js` | Added 4 Phase 1.1 hardening regression tests |

---

## 4. Automated Test Verification

All 165 tests pass across 59 test suites with zero failures:

```
✔ Admin Platform Phase 1 (now 17/17 including 4 new Phase 1.1 tests)
✔ Phase 1.1 Hardening Tests:
    - resolveAdminWalkInPricing returns server-authoritative paise amounts from DB
    - resolveAdminWalkInPricing applies night rate for slots at/after floodlight start
    - serialized block creation: second overlapping block on same resource is rejected atomically
    - serialized extension: extension that would conflict with next booking is rejected
✔ All prior Stage 0–09 regression suites: still passing

Total: 165/165 passing (0 failed, 0 skipped)
```

---

## 5. Scope Boundary

This hardening pass addresses ONLY the two required fixes from the Phase 1 Codex review.
No Phase 2 features were introduced.

Phase 2 remains pending:
- Customer & Guest CRM
- Offline Payment Recording & Accounting
- Roles & Custom Permission Management UI
- Clubhouse Events & Announcements Publisher
- Dining Stall CMS & Menu Editor
- Dining Kitchen Order POS
- Customer Review Moderation
- Annual Reports & PDF Ledger Vault

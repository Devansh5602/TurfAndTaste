# Codex Stage 0.7 Final Foundation Release Review

**Reviewed implementation head:** `65ca54a`
**Reviewed implementation commits:** `49445dd`, `c6de439`, `f18a6bd`, `1afd250`, `cd7c188`
**Branch:** `feature/customer-mobile-curated`
**Review date:** 2026-09-30
**Scope:** only the Stage 0.7 pre-Admin release blockers requested: finalization concurrency, timestamp safety, RBAC, Dining privacy/scoping, prior atomicity/privacy regressions, and non-destructive migration safety. No Admin UI, destructive migration, cleanup, or unrelated product work was performed.

## Final verdict

**NOT READY**

Stage 0.7 resolves the previously reproduced SQLite same-resource payment-finalization race. It does not yet satisfy the complete release gate: timestamp reconciliation can alter an explicitly UTC timestamp, is not invoked by a migration or runtime command, role-name bypasses remain on protected booking/Dining reads, and staff/stall Dining access is not consistently permission- and scope-driven in the real route path.

## Release-blocker verification

| # | Required verification | Status | Independent evidence |
| --- | --- | --- | --- |
| 1 | Same-resource concurrent payment finalization cannot create two confirmed bookings | **RESOLVED (SQLite)** | Fresh isolated SQLite Stage 0.7 tests passed. A separate two-Node-process reproduction against one SQLite file produced exactly one confirmed booking and one `BOOKING_CONFLICT` for the same physical facility/interval. |
| 2 | Different physical resources remain independently bookable | **RESOLVED (SQLite)** | The isolated Stage 0.7 suite passed its Turf 1/Turf 2 concurrent-finalization case. |
| 3 | Duplicate payment callbacks remain idempotent | **RESOLVED (SQLite)** | The isolated Stage 0.7 suite passed the exact-order replay test: the second finalization returned the existing booking. |
| 4 | PostgreSQL lock spans conflict check through write | **PARTIAL** | Source inspection confirms `withTransaction` uses one `pg.Client`, begins a transaction, acquires the facility advisory lock before conflict reads, then writes and commits on that same client. PostgreSQL execution could not be independently run because the configured Supabase pool hostname returned `EAI_AGAIN`. |
| 5 | SQLite concurrency equivalent is safe | **RESOLVED** | `withTransaction` now combines a process mutex with `BEGIN IMMEDIATE`, and the independent cross-process reproduction did not double-book. |
| 6 | UTC/offset timestamps cannot be double-shifted | **UNRESOLVED** | `evaluateTimestampProvenance()` does not inspect whether `scheduled_start_at` was explicitly `Z`/offset encoded. An explicit `2026-09-19T18:00:00.000Z` plus legacy `06:00 PM – 07:00 PM` is classified `SAFE_CORRECTION` and changed to `12:30:00Z`. An explicit UTC instant must never be silently reinterpreted from a possibly stale display slot. |
| 7 | Asia/Kolkata legacy timestamps are converted exactly once | **UNRESOLVED** | `reconcileAllTimestamps()` can calculate the intended IST instant, but it is referenced only by `tests/stage07-release-gate.test.js`; neither migration `017` nor runtime initialization invokes it. Existing legacy rows therefore are not reconciled by Stage 0.7. |
| 8 | Ambiguous legacy timestamps are quarantined | **PARTIAL** | The evaluator returns `MANUAL_REVIEW`, but the release migration never runs the evaluator and does not mark/quarantine the corresponding booking record. The test only tests an in-memory classification. |
| 9 | RBAC permission vocabulary matches DB seeds and middleware | **PARTIAL** | Migration `017` seeds reviewed keys in both SQLite and PostgreSQL and isolated SQLite tests pass. Protected routes still bypass or fail to load this vocabulary in material paths, so the end-to-end invariant is false. |
| 10 | No manager/admin role-name bypass remains for protected operations | **UNRESOLVED** | `server/routes/bookings.js` retains three `req.admin.role !== 'super_admin'` bypasses (walk-in create, status update, cancel). `GET /api/v2/food/orders/:id` grants `super_admin` by role name rather than resolved permission. |
| 11 | Staff/Stall authority derives from authenticated identity plus assigned permissions | **PARTIAL** | `getActiveAdmin()` validates enabled state and session version. The Dining order-read route receives no loaded permissions from `attachOptionalAdmin`; a valid staff identity with seeded permissions was independently rejected with `403`. `stall_staff` also falls back to role defaults in the command rather than always using assigned permissions. |
| 12 | Existing legitimate Admin access maps safely into RBAC | **PARTIAL** | A seeded `super_admin` maps to all permissions. Legacy `manager` values remain permitted by migration `008` but are rejected by `getActiveAdmin()` because only `super_admin`, `staff`, and `stall_staff` are active roles. No explicit, audited migration maps legitimate manager accounts to a chosen RBAC role. |
| 13 | Arbitrary Dining order lookup is blocked | **RESOLVED** | Disposable HTTP QA: no token returned `401`; a wrong possession token returned `403`. |
| 14 | Guest Dining access requires secure possession token | **RESOLVED** | `crypto.randomBytes(24).toString('hex')` creates a 48-hex-character token. Disposable HTTP QA verified a correct token returns a customer-safe response with neither `access_token` nor `customer_phone`. |
| 15 | Authenticated customer ownership is enforced | **UNRESOLVED** | There is no authenticated customer identity binding on Dining orders in this route. Current customer access is guest bearer-token possession only; no verified customer-account identity is stored/checked against an order. This cannot be claimed as customer ownership enforcement. |
| 16 | Staff/Stall management uses RBAC and scope | **UNRESOLVED** | Valid authenticated staff was rejected from order read because the route does not load permissions. A `stall_staff` actor without `stallId` is not denied before the scope comparison, so it can read/manage cross-stall orders through affected paths. |
| 17 | Atomic Dining pricing/order behavior still passes | **RESOLVED** | Fresh isolated SQLite Stage 0.5, 0.6, and 0.7 tests passed. The command continues to derive paise from persisted menu rows and writes header plus lines in one transaction. |
| 18 | Guest booking-history privacy still passes | **RESOLVED** | The existing Stage 0 foundation unit coverage passed on isolated SQLite: anonymous phone lookup is denied, and a guest token cannot substitute a different phone. |
| 19 | No destructive data cleanup occurred | **RESOLVED** | Stage 0.7 migrations are additive. No delete/truncate/purge was found, and this review did not alter shared data. |

## APPROVED

- The SQLite finalization change is materially effective. It places payment-order recheck, conflict determination, and writes inside `BEGIN IMMEDIATE`; the independent same-database, cross-process race yielded one success and one conflict.
- PostgreSQL finalization remains structurally sound: transaction-local advisory lock, payment-order row lock, occupancy checks, and writes use the same dedicated client. This still needs a disposable PostgreSQL execution test when DNS/network access is available.
- Duplicate payment replay remains idempotent in the canonical finalizer.
- The finalizer now checks active facility blocks, extensions, and holds inside its transaction and no longer swallows those query errors.
- Guest Dining possession-token lookup works over HTTP and removes the token and phone from the customer-safe response.
- Dining menu pricing remains server-authoritative integer paise and header/line persistence remains atomic.

## REQUIRED FIX

1. **Make timestamp provenance conservative and executable.** Explicit `Z` or offset-bearing source values must be preserved or quarantined on discrepancy, never automatically shifted from legacy display fields. Add a versioned, auditable reconciliation migration/command that runs exactly once, records its source evidence, applies only defensible corrections, and makes ambiguous rows operationally quarantined for manual review.
2. **Remove all protected-operation role-name bypasses.** Replace remaining `super_admin` checks in booking and Dining routes with resolved `requirePermission`/`hasPermission` results. Existing super-admin access must come from its persisted role permissions, not a string shortcut.
3. **Finish real Dining identity/scoping enforcement.** Load effective permissions after `attachOptionalAdmin`; deny a `stall_staff` identity without an assigned stall; enforce that scope for order read and updates. Use authenticated, assigned permissions rather than role-default fallback for management operations.
4. **Provide an explicit legacy-manager migration decision.** Map valid `manager` accounts to a documented RBAC role or quarantine/disable them with an operator migration report. Silently making an existing legitimate account unable to authenticate is not a safe access mapping.
5. **Do not claim authenticated customer ownership before it exists.** Bind future authenticated customer orders/history to a verified customer identity; until then, state accurately that the possession token is the guest access mechanism.
6. **Add true HTTP/integration coverage.** The Stage 0.7 test file does not exercise the order-read route, no-token/wrong-token behavior, staff permission loading, missing-stall scope, or the remaining booking route bypasses. Add tests for each path.

## MIGRATION / TIMESTAMP RESULT

- Fresh isolated SQLite migrations `001`–`017` applied successfully; the full five-file test set passed when pointed at that initialized disposable database.
- The configured PostgreSQL test run is **not verified**: `npm test` and the direct Stage 0.7 test hit `getaddrinfo EAI_AGAIN aws-0-ap-south-1.pooler.supabase.com`.
- No destructive schema/data cleanup was found.
- Timestamp history is not ready for release: the reconciliation routine is uninvoked and its explicit-UTC classification is unsafe.

## CONCURRENCY / PAYMENT FINALIZATION RESULT

- **SQLite:** verified safe for the critical same-resource finalization race, including a separate-process check.
- **Different resources:** verified independently bookable in isolated SQLite tests.
- **Duplicate payment callback:** verified idempotent in isolated SQLite tests.
- **PostgreSQL:** source structure supports the intended lock scope, but remote execution remains unverified due DNS/network failure.
- **Provider capture:** no real Razorpay provider capture was performed or claimed.

## RBAC / DINING / SECURITY RESULT

- Permission seed parity improved, but route-level bypasses and incomplete effective-permission loading mean RBAC is not release ready.
- Dining guest possession access is protected and sanitized.
- Staff read functionality is currently broken in the actual route, while unscoped stall staff can bypass tenant scope; this is both an authorization correctness and privacy issue.
- Guest booking-history privacy unit coverage remains passing.

## Exact next implementation step

Do **not** begin Admin UI. Complete a focused Stage 0.8 foundation hardening slice: conservative executable timestamp reconciliation/quarantine, all remaining permission-only booking/Dining route enforcement, required stall assignment scope, a documented legacy-manager RBAC migration, and disposable SQLite/PostgreSQL HTTP integration tests. Re-run the release gate after that slice.

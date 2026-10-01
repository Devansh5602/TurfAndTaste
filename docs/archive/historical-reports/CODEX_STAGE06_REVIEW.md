# Codex Stage 0.6 Final Pre-Admin Release-Gate Review

**Reviewed implementation commit:** `a9d92d1`  
**Reviewed report commit:** `df3d708`  
**Branch:** `feature/customer-mobile-curated`  
**Review date:** 2026-09-30  
**Scope:** only the remaining Stage 0.5 blockers: timestamp migration safety, payment finalization, conflict serialization, RBAC, Dining integrity, legacy reconciliation, and migration safety. No Admin UI, destructive migration, or shared-database cleanup was performed.

## Final verdict

**NOT READY**

Stage 0.6 materially improves the PostgreSQL payment-finalization path, but the release gate is still not satisfied across the supported SQLite/PostgreSQL backends. An isolated concurrent-finalization reproduction created **two confirmed bookings for the same physical facility and interval** on SQLite. The timestamp audit is also post-conversion classification rather than a proof/correction preventing an earlier UTC double shift. The Dining order lookup still accepts a raw signed JWT without the normal enabled-account/session-version checks.

## Blocker verification

| Remaining blocker | Status | Independent evidence |
| --- | --- | --- |
| 1. Legacy timestamp conversion cannot double-shift UTC/offset data | **PARTIAL** | PostgreSQL canonical columns are `TIMESTAMPTZ`, and `timestamp_classification_audit` exists. Migration `016` only records a post-`015` classification; it does not prove source representation before conversion or correct a shifted row. The configured database currently has 15 `EXPLICIT_UTC` / `NO_CHANGE` audit records and no `MANUAL_REVIEW` row, but this does not establish that the original `015` conversion was safe for every historical source value. |
| 2. Payment verification no longer directly inserts bookings | **RESOLVED** | `server/routes/payments.js` delegates verification to `finalizeBookingFromPayment`; the former route-level booking `INSERT` is absent. |
| 3. Canonical booking finalization is one atomic transaction | **PARTIAL** | PostgreSQL uses `db.withTransaction`, one `pg.Client`, and transaction-local inserts for booking, session, payment, quote redemption, hold conversion, and payment-order update. The SQLite path performs conflict checks **before** its transaction begins, so its complete finalization is not atomic with conflict determination. |
| 4. Resource lock is held across conflict check + booking write | **RESOLVED for PostgreSQL / PARTIAL overall** | `_pgTransaction` acquires `pg_advisory_xact_lock` inside `withTransaction` and checks/inserts through the same client. SQLite has no equivalent transaction-scoped conflict check. PostgreSQL conflict code also omits approved session-extension occupancy and catches block/hold query errors as non-fatal. |
| 5. Duplicate payment callbacks cannot duplicate bookings | **RESOLVED** | In isolated finalizer execution, a successful finalization followed by the same `razorpay_order_id` returned the existing booking with `idempotent: true`; no second booking was inserted. PostgreSQL additionally locks the payment order row `FOR UPDATE`. |
| 6. Same-resource concurrent finalization cannot double-book | **UNRESOLVED** | An isolated fresh SQLite database ran two concurrent finalizations for distinct payment orders, same `fac_box_cricket_1`, same `10:00–11:00 Asia/Kolkata` interval. Both fulfilled and two `Confirmed` bookings persisted. This is caused by `_sqliteTransaction` reading conflicts before `db.transaction(...)`. The supplied Stage 0.6 tests do not invoke `finalizeBookingFromPayment` or exercise this race. |
| 7. Permission registry matches route middleware | **PARTIAL** | PostgreSQL migration `016` now contains the reviewed alias keys. A fresh SQLite migration/reapply has **none** of `booking.create_walkin`, `booking.update`, `dining.order.update`, or `dining.stall.read` in persisted `permissions`; the Stage 0.6 test explicitly skips SQLite DB permission verification. Runtime defaults mask, rather than reconcile, this backend difference. |
| 8. Admin/Staff/Stall identities resolve to real permission sets | **PARTIAL** | `auth.js` accepts `staff` and `stall_staff`, and role fallbacks are defined. The configured PostgreSQL database has only one real management identity (`super_admin`) and one role assignment. No real staff/stall identity assignment was available to verify. `manager` still bypasses permission middleware by role string, contrary to the permission-first domain model. |
| 9. Management routes enforce permissions server-side | **PARTIAL** | Management routes use `authenticateAdminToken` and `requirePermission`. However `manager` bypasses every permission check, and Dining public order lookup implements its own JWT decoding rather than active-account/session-version verification. |
| 10. Dining customer lookup does not leak arbitrary orders | **PARTIAL** | A generated `access_token` is required for unauthenticated lookup, and phone is removed. But a signed JWT with any decoded `id` is treated as admin without checking account enablement, supported role, or session version; the returned public object also includes its `access_token`. |
| 11. Dining order creation/items/total are atomic | **RESOLVED** | The command validates all items, then passes header plus item inserts as one `db.transaction(...)` statement set. |
| 12. Server menu prices are authoritative | **RESOLVED** | The command loads `price_paise` from persisted active menu items and ignores caller price fields; the Stage 0.5 dining pricing test passes in an isolated database. |
| 13. Dining status updates are permission-controlled | **PARTIAL** | The management route requires `dining.order.manage`, matching the PostgreSQL registry. The domain command also accepts raw role names directly, and `manager` route bypass remains; a real non-super-admin identity was not available for end-to-end verification. |
| 14. Legacy/manual-review records remain safe | **RESOLVED** | PostgreSQL still contains exactly eight `MANUAL_REVIEW` / `QUARANTINED` reconciliation rows. No automatic Turf 1/Turf 2 assignment was introduced. |
| 15. No destructive shared-DB cleanup occurred | **RESOLVED** | Reviewed migrations are additive and contain no destructive cleanup. Existing shared PostgreSQL test records were left untouched by this review. |

## APPROVED

- `016_stage06_hardening` is additive and is registered in `server/db.js`; isolated SQLite fresh apply and reapply both complete.
- PostgreSQL `withTransaction` correctly keeps `BEGIN`, the facility advisory lock, conflict queries, booking/session/payment writes, and `COMMIT` on one dedicated client.
- Razorpay verification no longer makes a route-level booking insert. It verifies signature/provider order+amount, then delegates the booking conversion to the finalizer.
- The finalizer derives booking status and total/deposit values from persisted payment-order/quote context, not a browser status or total.
- Exact duplicate finalization of one payment order is idempotent in isolated execution.
- Dining creation validates an active table, active/available items, an active stall, one-stall-only item composition, and persists the header plus lines atomically. Menu prices remain integer paise server values.
- PostgreSQL contains all six reviewed permission keys and retains the eight quarantined legacy records. No destructive migration was found.

## REQUIRED FIX

1. **Move SQLite conflict checking inside the same transaction as finalization.** Rework `_sqliteTransaction` to use the `withTransaction` connection wrapper (or an equivalent `BEGIN IMMEDIATE` callback) for conflict reads, payment-order idempotency recheck, booking/session/payment inserts, hold conversion, and payment-order update. Add a non-skipped concurrent two-order/same-resource regression test; it must yield exactly one confirmed booking.
2. **Fail closed and include every occupancy source in finalization.** PostgreSQL finalization currently suppresses errors querying blocks/holds and omits approved session-extension conflicts. A required authority source being unreadable must abort finalization, and extensions must be evaluated in the same transaction under the facility lock.
3. **Make the timestamp migration audit actionable.** Classifying post-conversion values is not enough to establish that `015` did not double-shift a UTC/offset source. Add an audited source-evidence/preflight rule and a reversible reviewed correction path for any low-confidence row before declaring timestamp history safe.
4. **Use the normal active-admin middleware for Dining order read.** Replace the route-local JWT decode with optional authenticated-admin resolution so disabled accounts, revoked sessions, invalid roles, and stale tokens cannot read orders. Do not return `access_token` in the customer-safe response.
5. **Make persisted RBAC portable and permission-first.** Seed the alias permissions/role relationships on SQLite as well as PostgreSQL, remove the unconditional `manager` bypass or map manager to a persisted role, and add real staff/stall identity integration coverage. The existing default arrays are useful fallback, not proof of persisted authorization.
6. **Bind hold conversion to the finalization context.** Before excluding/converting a hold, verify it is active, on the resolved facility, matches the canonical interval, and belongs to the expected customer/order context. A client-supplied token must not exempt another customer’s hold.
7. **Isolate all integration tests from configured shared PostgreSQL.** The configured database now contains fifteen 2028/2029 `Payment Review` test bookings. This review did not delete them. The test command must provision a disposable database or refuse a shared production-style `DATABASE_URL`.

## RECOMMENDED

- Assert provider payment status is an allowed captured/settled state in addition to signature, order, and amount.
- Add a PostgreSQL integration test in a disposable database that races two independent payment orders under the advisory lock. Source inspection supports the intended lock scope, but no such execution test ran here.
- Add database constraints/indexes for recognized booking states, non-negative paise, and canonical physical interval integrity in the selected concurrency design.
- Keep public customer order proofs out of URL/referrer-sensitive contexts where practical; a bearer token should never be echoed beyond its initial creation response.

## MIGRATION / TIMESTAMP RESULT

- Fresh isolated SQLite migrations `001`–`016` and a reinitialize/reapply pass succeeded.
- With that freshly initialized disposable SQLite database, `tests/stage05-canonical-operationalization.test.js` and `tests/stage06-hardening.test.js` both passed. This is useful baseline coverage, but it does not change the concurrency finding below: the Stage 0.6 test file does not invoke `finalizeBookingFromPayment` or race two payment orders.
- The repository-wide `npm test` run against the configured PostgreSQL URL could not complete in this environment because its Supabase pool hostname returned `EAI_AGAIN`; that is an environment DNS/reachability limitation, not a passing PostgreSQL integration result. The production web build and relevant server syntax checks passed.
- PostgreSQL confirms migration `016`, `dining_orders.access_token`, and the new reviewed permission rows.
- The timestamp conversion is **not yet release-safe by proof**: migration `015` used an IST-wall-clock conversion, while the old canonical writer serialized UTC ISO values. Migration `016` identifies potential historical risk only after the fact and does not correct it. The currently observed audit rows are high-confidence/no-change, but that is not a conversion guarantee for legacy source data.

## CONCURRENCY / PAYMENT FINALIZATION RESULT

- **PostgreSQL structure:** improved and correctly uses a same-client transaction-local advisory lock.
- **Duplicate callback:** verified idempotent in isolated execution.
- **SQLite same-resource race:** failed; two distinct orders for the exact same physical resource and interval both persisted as confirmed bookings. This independently blocks the cross-backend release gate.
- **Provider-dependent Razorpay capture:** not executed; no real successful gateway transaction was used or claimed.

## RBAC / DINING / SECURITY RESULT

- PostgreSQL permission vocabulary is now populated, but SQLite persistence and real staff/stall identity assignment are incomplete.
- Server management route middleware exists, but broad manager bypass and route-local Dining JWT validation prevent approval as granular, session-aware authorization.
- Dining price authority and atomic persistence are approved.
- Dining order privacy is improved but not complete until active/revoked JWT validation is reused and the access token is removed from public output.

## Exact next implementation step

Do **not** begin Admin UI. First complete one focused Stage 0.7 backend hardening slice: transaction-scoped SQLite finalization/conflict checking with a concurrent-race regression test, fail-closed blocks/holds plus extension occupancy, and active-admin-protected Dining order lookup. Then run disposable SQLite and PostgreSQL integration tests before reconsidering this gate.

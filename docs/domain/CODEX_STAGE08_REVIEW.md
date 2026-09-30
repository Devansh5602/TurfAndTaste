# Codex Stage 0.8 Final Foundation Release Review

**Reviewed implementation head:** `326279a`  
**Reviewed implementation commits:** `4de574f`, `6824c4c`, `af59149`, `5b40039`, `326279a`  
**Branch:** `feature/customer-mobile-curated`  
**Review date:** 2026-09-30  
**Scope:** only the Stage 0.8 release blockers requested: timestamp provenance/reconciliation, permission-only administration and stall scope, Dining privacy/atomicity, booking concurrency/idempotency, and non-destructive migration safety. No Admin UI or unrelated product work was performed.

## Final verdict

**NOT READY**

Stage 0.8 materially fixes the SQLite route-level Dining authorization and scope failures found in Stage 0.7. It is not safe to release as the final pre-Admin foundation because the PostgreSQL timestamp migration path is not transaction-safe and PostgreSQL result values lose the lexical `Z`/offset provenance that the reconciler relies on. On a normal `pg` `TIMESTAMPTZ` read, an explicit UTC instant is returned as a JavaScript `Date`; converting that to a string makes it look like an unannotated local value, so the current evaluator can silently rewrite it from a legacy display slot. That directly violates the explicit-UTC/offset preservation gate.

The migration also invokes reconciliation through the global `dbAsync` connection while `018_stage08_reconciliation_and_rbac` is executing on a separate PostgreSQL migration transaction. The global connection cannot see the transaction's newly added quarantine columns. Quarantine writes are caught and discarded, while the migration can still be marked applied. This leaves a material PostgreSQL reconciliation/quarantine release blocker even though SQLite tests pass.

## Release-blocker verification

| # | Required verification | Status | Independent evidence |
| --- | --- | --- | --- |
| 1 | Explicit UTC timestamps cannot be shifted again | **UNRESOLVED (PostgreSQL path)** | `pg` returns `TIMESTAMPTZ` columns as `Date` objects. `String(new Date('2026-09-19T18:00:00Z'))` becomes an IST display string without an ending ISO offset, and `evaluateTimestampProvenance()` classifies it as `SAFE_CORRECTION`, proposing `12:30:00Z` from a conflicting legacy `06:00 PM` slot instead of preserving/quarantining it. String-only unit fixtures do not exercise this production representation. |
| 2 | Explicit offset timestamps preserve their instant | **UNRESOLVED (PostgreSQL path)** | The same `Date` coercion removes the original `+05:30` lexical provenance after a PostgreSQL read. The current evaluator can no longer distinguish an explicit offset instant from a legacy-local string. |
| 3 | Proven Asia/Kolkata legacy-local timestamps convert exactly once | **PARTIAL** | Fresh SQLite migration/reconciliation test passed for an unannotated local string with deterministic `date`/`time_slot`. PostgreSQL uses the unsafe global connection path described below, and already-converted values represented as `Date` objects are not provenance-safe. |
| 4 | Reconciliation is invoked and idempotent | **PARTIAL** | Migration `018` invokes `reconcileAllTimestamps()` and the fresh SQLite second-run test reported zero further corrections. In PostgreSQL, migration DDL runs on a dedicated `client` transaction but reconciliation imports global `dbAsync`/`pgPool`, so it executes outside that transaction and cannot reliably see the uncommitted columns. |
| 5 | Ambiguous timestamp records are operationally quarantined | **PARTIAL** | SQLite can mark `is_quarantined` and `reconciliation_status`. PostgreSQL quarantine updates use the global connection before the migration transaction commits; the update error is swallowed by `reconcileAllTimestamps()`, so rows can remain unquarantined while migration `018` is recorded. |
| 6 | Quarantined uncertain intervals do not corrupt live availability | **PARTIAL** | Canonical conflict, quote, booking route, and payment-finalization queries consistently filter `MANUAL_REVIEW`/`UNRESOLVABLE` rows. This is effective after a row is actually quarantined; the PostgreSQL migration defect means that prerequisite is not guaranteed. |
| 7 | No protected booking/Dining route has a `super_admin` role-name bypass | **RESOLVED** | Static scan of `server/routes/` and targeted source inspection found no `super_admin` role-name branch in booking or Dining routes. |
| 8 | No protected booking/Dining route has a legacy `manager` role-name bypass | **RESOLVED** | Static scan and targeted source inspection found no protected booking/Dining `manager` role-name branch. |
| 9 | Super Admin works through canonical permissions | **RESOLVED (SQLite)** | `getActiveAdmin()` resolves persisted role permissions and `requirePermission()` uses the resolved set. The disposable HTTP review authorized the seeded principal without a route-side role bypass. |
| 10 | Legacy management identities map safely into RBAC | **RESOLVED (migration design / SQLite)** | Migration `018` records manager-to-staff mapping in `admin_role_migration_audit` before updating legacy `manager` roles. The operation is additive and idempotent through the audit table's unique ID. PostgreSQL execution remains blocked by the timestamp transaction defect. |
| 11 | Staff effective permissions resolve from authenticated identity | **RESOLVED (SQLite HTTP)** | A disposable `staff` admin with persisted `role_staff` assignment received `200` from protected `GET /api/v2/food/orders/:id` using a signed admin token. |
| 12 | Stall effective permissions resolve from authenticated identity | **RESOLVED (SQLite HTTP)** | A disposable `stall_staff` account with persisted role assignment and `stall_id` received `200` for its assigned stall. |
| 13 | Stall/resource scope is enforced | **RESOLVED (SQLite HTTP)** | The authenticated `stall_staff` principal can access only the assigned `cafe` stall; `stall_staff` logic requires an assignment and compares it with the order's `stall_id`. |
| 14 | A Stall cannot manage another Stall without explicit scope | **RESOLVED (SQLite HTTP)** | A disposable `stall_staff` assigned to `snack-parlours` received `403` for a `cafe` order. |
| 15 | Custom roles remain permission-driven | **RESOLVED (source / isolated tests)** | Dynamic `roles`/`role_permissions` loading is used by `getActiveAdmin()` and `requirePermission()`; route grants do not branch on a named privileged role. |
| 16 | Authorized Staff Dining reads work | **RESOLVED (SQLite HTTP)** | Disposable staff identity with `dining.order.read` returned `200`. |
| 17 | Dining guest possession-token privacy works | **RESOLVED (SQLite HTTP)** | No token returned `401`, a wrong token returned `403`, and a correct 48-hex-character possession token returned a customer-safe `200` response without `access_token` or `customer_phone`. |
| 18 | Dining atomic/server-price behavior remains intact | **RESOLVED (isolated SQLite)** | The Stage 0.5–0.8 suites passed sequentially against a fresh initialized SQLite database. The command derives menu prices from `food_menu_items` and writes order header plus lines through one transaction. |
| 19 | Booking concurrency/idempotency regressions still pass | **RESOLVED (SQLite)** | Fresh isolated Stage 0.5–0.8 suites passed sequentially, including same-resource conflict, different-resource concurrency, and same-order replay cases. PostgreSQL execution was not possible because DNS to the configured pooler is unavailable. |
| 20 | Guest booking-history privacy still passes | **RESOLVED (isolated SQLite)** | The Stage 0 foundation suite passed against the fresh initialized SQLite database. |
| 21 | No destructive shared-data cleanup occurred | **RESOLVED (source migration review)** | No `DELETE`, `TRUNCATE`, `DROP`, purge, or cleanup operation exists in migration `018` or the Stage 0.8 reconciliation code. The committed mutable SQLite database artifact should not be treated as production migration evidence. |

## APPROVED

- Stage 0.8 removes the previously observed booking/Dining `super_admin` and `manager` role-name bypasses in the reviewed route paths.
- `getActiveAdmin()` now resolves enabled identity, session version, assigned stall, and effective permissions before protected route authorization.
- The independent disposable HTTP test verified real—not merely object-level—Dining behavior: guest token denial/sanitization, authorized staff reads, same-stall access, cross-stall denial, and scoped order list access.
- The Stage 0.5–0.8 release suites pass when run sequentially against a freshly initialized disposable SQLite database.
- The canonical finalization code still holds the SQLite transaction/mutex through conflict checking and write, preserving the earlier same-resource/idempotency coverage.
- No destructive operation was found in the reviewed Stage 0.8 migration/reconciliation source.

## REQUIRED FIX

1. **Use one transaction-scoped database adapter for migration reconciliation.** `runVersionedMigrations()` must pass the active PostgreSQL `client` (and the active SQLite transaction connection) into migration `018`; `reconcileAllTimestamps()` must use that adapter, not a dynamic import of global `dbAsync`. Do not swallow an inability to set quarantine state. The migration and its reconciliation/audit records must commit or roll back together.
2. **Preserve timestamp provenance before coercion, and fail closed when it is unavailable.** Do not run `/Z$/` or offset detection against `String(Date)`. For PostgreSQL, either select raw canonical values in an explicit ISO form with a persisted provenance marker established before conversion, or classify the lexical provenance as unavailable and quarantine rather than rewrite. Add PostgreSQL-shaped `Date` fixtures and a real PostgreSQL integration test when infrastructure permits.
3. **Add a follow-up additive migration/operational command for environments where `018` is already recorded.** A code-only correction to migration `018` will not repair databases that have already marked it applied. The follow-up must retry reconciliation transactionally, audit what it did, and not reapply a timezone conversion to records already reconciled.
4. **Make the standard test command self-contained.** `npm test` currently fails against the mutable repository-local SQLite database; the test files require prior initialization and interfere with persistent state. The documented isolated sequence passes, but the configured standard command cannot be used as a trustworthy release gate until it provisions/uses its own database.

## RECOMMENDED

- Keep mutable `server/data/turf_and_taste.db` and its WAL/SHM runtime files out of source-control release evidence. The Stage 0.8 commit changes the database binary, and the working tree contains pre-existing tracked WAL/SHM deletions. This review neither restored, removed, nor committed those artifacts.
- Replace broad exception swallowing around migration DDL and reconciliation writes with explicit duplicate-column handling and fail-closed reporting. Suppressed errors make it possible to record a completed migration without the required operational state.
- Add HTTP-level tests to the test suite itself for staff read, same-stall read/update, cross-stall denial, and unscoped stall denial; the present Stage 0.8 test file mostly verifies direct command objects for these cases.

## MIGRATION / TIMESTAMP RESULT

- A fresh isolated SQLite database applied migrations `001`–`018` successfully. Reconciliation performed expected SQLite backfill/quarantine state and re-running it was idempotent in the Stage 0.8 test.
- PostgreSQL is **not verified**. The configured Supabase pooler cannot be reached from this environment (`getaddrinfo EAI_AGAIN` in earlier release-gate runs), and source inspection found an independent transaction-boundary defect that must be fixed before a PostgreSQL migration can be trusted.
- PostgreSQL `TIMESTAMPTZ` values are represented by `pg` as `Date` objects. The current string-based provenance evaluator demonstrably treats such a value as unannotated legacy local time and can alter an explicit instant from a conflicting display slot.

## RBAC / STALL-SCOPE RESULT

- **RBAC:** route-side `super_admin`/`manager` bypasses in the reviewed booking/Dining paths are removed; effective permission lookup is now used for authenticated management principals.
- **Stall scope:** independently verified over HTTP for same-stall success and cross-stall denial.
- **Limit:** custom-role and PostgreSQL assertions are source/isolated-SQLite evidence only until a reachable PostgreSQL environment is available.

## DINING / BOOKING / SECURITY RESULT

- Dining guest possession-token privacy, server-side price derivation, atomic header/line persistence, and staff/stall route access are verified on isolated SQLite.
- Booking same-resource conflict/idempotency regressions are verified on isolated SQLite.
- The timestamp issue is a security and operational-integrity concern: an explicit booking instant can be silently rewritten and a PostgreSQL ambiguous row can bypass intended quarantine.

## Test evidence

| Check | Result |
| --- | --- |
| Fresh isolated SQLite initialization through migration `018` | **PASS** |
| Stage 0, 0.5, 0.6, 0.7, 0.8, and customer-mobile regression files sequentially on that DB | **PASS** |
| Disposable HTTP Dining authorization/privacy/scope exercise | **PASS** |
| `node --check` for changed Stage 0.8 server modules | **PASS** |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |
| `npm test` against mutable repository-local database | **FAIL**; tests are not self-initializing/isolation-safe |
| PostgreSQL/Supabase runtime test | **NOT RUN**; configured pooler DNS is unavailable and source inspection found a migration transaction defect |

## Exact next implementation step

Do **not** start Admin UI. Implement and review a narrowly scoped Stage 0.9 timestamp-reconciliation repair: transaction-scoped migration DB adapters, immutable/provenance-safe PostgreSQL timestamp handling, a versioned retry for already-applied Stage 0.8 databases, and isolated PostgreSQL integration coverage when connectivity is available. Then rerun this final foundation gate.

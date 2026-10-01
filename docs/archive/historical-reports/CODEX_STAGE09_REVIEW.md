# Codex Stage 0.9 Final Pre-Admin Review

**Reviewed implementation head:** `05a9700`  
**Reviewed implementation commits:** `8284c5a`, `f45a190`, `bf1f33d`, `b7cb2a6`, `05a9700`  
**Codex correction during review:** `7a15aa5`  
**Branch:** `feature/customer-mobile-curated`  
**Review date:** 2026-10-01  
**Scope:** only the final pre-Admin timestamp/reconciliation, transaction, test-isolation, booking/RBAC/Dining regression, and repository-cleanliness gate. No Admin UI or unrelated feature work was performed.

## Final verdict

**READY WITH MINOR NON-BLOCKING ISSUES**

Stage 0.9 resolves the two actual Stage 0.8 foundation blockers: PostgreSQL driver `Date` values are preserved as instants rather than converted through `String(Date)`, and reconciliation now receives the active migration transaction adapter. Migration `019` is additive and provides a safe repair path for installations that have already recorded migration `018`.

The remaining limitation is external: the configured Supabase PostgreSQL pooler is unavailable from this environment (`EAI_AGAIN`), so a disposable PostgreSQL execution test could not be performed. Source inspection confirms the transaction/client wiring and PostgreSQL placeholder conversion, but that is not a substitute for an eventual live disposable PostgreSQL migration test.

## Verification matrix

| # | Required verification | Result | Independent evidence |
| --- | --- | --- |
| 1 | PostgreSQL `TIMESTAMPTZ` JS `Date` is treated as a canonical instant | **RESOLVED** | The evaluator handles `Date` before any string conversion, compares milliseconds only, preserves a match, and quarantines a mismatch without rewriting it. Stage 0.9 `Date` fixtures pass. |
| 2 | Explicit UTC source preserves its instant | **RESOLVED** | Explicit `Z` inputs remain `SAFE_NO_CHANGE`; mismatch is quarantined, not shifted. |
| 3 | Explicit offset source preserves its instant | **RESOLVED** | Numeric offset inputs normalize to their equivalent UTC instant and are not reinterpreted as local wall-clock values. |
| 4 | Proven Asia/Kolkata-local values convert once | **RESOLVED** | Only strict unannotated `YYYY-MM-DD[ T]HH:mm[:ss]` values with a valid legacy slot are corrected; a repeat reconciliation applies no further correction. |
| 5 | Provenance is handled before driver normalization can cause reinterpretation | **RESOLVED (fail-closed)** | A driver `Date` is treated as an already-canonical instant before `String()` is ever used. Its original lexical offset is inherently unavailable after driver decoding, so a legacy conflict is quarantined rather than guessed or rewritten. |
| 6 | Reconciliation is invoked | **RESOLVED** | Migrations `018` and additive repair `019` both invoke `reconcileAllTimestamps(db)`. |
| 7 | Reconciliation shares migration DDL/data transaction | **RESOLVED (source + SQLite)** | `runVersionedMigrations()` passes a transaction-scoped adapter around the same PostgreSQL `client` or SQLite `BEGIN IMMEDIATE` connection; the reconciler no longer imports global `dbAsync`. |
| 8 | Already-applied 018 installations have an additive repair | **RESOLVED** | Fresh SQLite simulation removed only the `019` migration record after a Stage 0.8-equivalent row was inserted; reinitialization applied `019`, reconciled the row, and recorded one audit row. |
| 9 | Reconciliation is idempotent | **RESOLVED** | Stage 0.9 regression and the repair simulation showed no repeated mutation after reconciliation. |
| 10 | Ambiguous records remain quarantined | **RESOLVED** | Mismatch/unresolvable paths set `MANUAL_REVIEW`/`UNRESOLVABLE`; live conflict, quote, booking, and payment paths ignore the quarantine state consistently. |
| 11 | `npm test` does not depend on repository-local SQLite state | **RESOLVED** | `scripts/test-runner.js` now forces a new temp SQLite path and blank `DATABASE_URL` for every run. |
| 12 | `npm test` passes repeatedly on isolated state | **RESOLVED** | Two consecutive normal runs passed. A third run also passed while the parent supplied an invalid PostgreSQL URL and a caller SQLite path, proving they are not inherited. |
| 13 | Booking concurrency/idempotency remains passing | **RESOLVED (SQLite)** | Isolated Stage 0.5–0.9 suites passed, including same-resource finalization conflict and callback replay coverage. |
| 14 | RBAC remains permission-driven | **RESOLVED (SQLite/source)** | No reviewed booking/Dining `super_admin` or `manager` route-side bypass remains; effective permissions are loaded from persisted roles. |
| 15 | Stall cross-scope protection remains passing | **RESOLVED (SQLite HTTP)** | Disposable `stall_staff` assigned to `cafe` succeeded for its own order; a `snack-parlours` principal received `403`. |
| 16 | Dining guest/order privacy remains passing | **RESOLVED (SQLite HTTP)** | No token returned `401`, wrong possession token `403`, valid token `200` with neither `customer_phone` nor `access_token` exposed. |
| 17 | Guest booking-history privacy remains passing | **RESOLVED (SQLite)** | The isolated Stage 0 privacy regression file passed. |
| 18 | No destructive shared-data cleanup occurred | **RESOLVED** | Reviewed Stage 0.9 migrations/reconciliation contain no delete/truncate/drop/purge operation. Test cleanup is confined to the generated temporary database. |
| 19 | Repository cleanup is responsible | **RESOLVED WITH NOTE** | No WAL/SHM sidecars are tracked; `.gitignore` protects them; no temp/backup/debug files were found in the Stage 0.9 range; `AGENTS.md` contains the permanent pre-push cleanliness rule. The tracked SQLite fallback snapshot and archival reports predate Stage 0.9 and are documented project artifacts, not removed speculatively. |
| 20 | Final tree is clean and intentional | **RESOLVED** | `git status` is clean after the Codex test-isolation fix; `git diff --check` passes. |

## Codex correction

`7a15aa5 test(infra): force disposable database isolation`

The initial Stage 0.9 runner generated a temporary path only when the caller did not export `DATABASE_URL` or `SQLITE_DB_PATH`. In a shell/CI environment with those values already set, test fixtures could instead target that caller-selected database. The runner now always sets a generated SQLite path, blank `DATABASE_URL`, and non-production bootstrap/JWT values before the server loads dotenv. This prevents accidental test interaction with a development or production database.

## Test evidence

- `npm test` twice consecutively: **PASS**.
- `npm test` with an invalid inherited PostgreSQL URL and caller SQLite path: **PASS**, using the generated isolated SQLite database.
- Fresh SQLite migration through `019`: **PASS**.
- Additive `019` follow-up simulation for an already-recorded `018`: **PASS**; safe correction and audit occurred exactly once.
- Disposable HTTP Dining verification: **PASS** for guest token privacy, authorized Staff read, same-stall access, and cross-stall `403`.
- `npm run build`: **PASS**.
- `node --check` for Stage 0.9 database, timestamp, and migration modules: **PASS**.
- `git diff --check`: **PASS**.

## PostgreSQL verification limitation

A read-only `SELECT 1` using the configured database connection could not resolve `aws-0-ap-south-1.pooler.supabase.com` and returned `EAI_AGAIN`. No remote migration or mutation was attempted. PostgreSQL transaction behavior is therefore source-reviewed, not runtime-verified.

## Repository-cleanliness result

- `server/data/*.db-wal` and `server/data/*.db-shm` are ignored and no longer tracked.
- No secrets were found in committed Stage 0.9 changes; connection strings in `.env.example`/README are templates, not credentials.
- Reviewed production changes contain no debug logging or dead diagnostic path. The retained test-runner comment documents the non-obvious database-isolation safety invariant.
- Existing `server/data/turf_and_taste.db` and archive reports are referenced/documented fallback/archive artifacts. They were not deleted without evidence they are disposable.

## Remaining non-blocking issue

Run the Stage 0.9 migration and concurrency suite once against a disposable PostgreSQL instance when DNS/network access is available. This is an external verification gap, not a reason to change schema or add another foundation stage.

## Exact next implementation step

Begin the approved Admin foundation implementation; retain the deferred disposable PostgreSQL run as a mandatory deployment verification before applying these migrations to a shared remote database. No further pre-Admin architecture stage is required for the current codebase.

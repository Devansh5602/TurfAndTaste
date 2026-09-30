# Codex Stage 0 Implementation Review

**Reviewed implementation commits:**

- `02a4bb4` — Stage 0 schema preflight and migration `014_stage0_foundation`
- `52ea580` — canonical physical-resource, interval, RBAC, session, and dining helpers
- `fa25ad8` — Stage 0 foundation test suite
- `64a8ba1` — Stage 0 implementation report

**Review date:** 2026-09-30  
**Review scope:** current branch code, migration `014`, configured PostgreSQL schema (read-only), an isolated fresh SQLite migration/reapply run, the Stage 0 helper tests, and the existing booking route. No Admin UI, destructive migration, or production-data write was performed.

## Verdict

**NOT READY** for an Admin foundation UI. Stage 0 successfully introduces useful additive tables and pure domain helpers, but those helpers are not yet the authoritative booking/operations path. The live PostgreSQL schema still stores canonical timestamps as `timestamp without time zone`, all eight existing bookings remain legacy-only, and RBAC/dining/hold foundations are not yet enforced through server operations.

## Original blocker status

| Original blocker from `183596b` | Status | Evidence |
| --- | --- | --- |
| Physical resource identity / Green Net shooting-machine relationship | **PARTIAL** | `physical_facilities` contains the required six assets, including two Box Cricket turfs and two Pickleball courts. `addon_shooting_machine` maps to `fac_green_net_1`. However, no persistent legacy-to-physical identity bridge assigns existing bookings, and legacy routes still use flat `facility_id`. |
| Canonical Asia/Kolkata-safe booking intervals | **PARTIAL** | `bookingInterval.js` correctly models half-open IST intervals and cross-midnight rollover, and nullable canonical columns exist. The configured PostgreSQL columns are `timestamp without time zone`; all 8 existing bookings have null canonical interval/resource fields; current booking writes remain legacy-first. |
| Lead time, duration, state, hold, and overlap protections | **PARTIAL** | Pure helper tests cover these rules and status updates now check a transition helper. `/api/bookings/slots` and most creation/conflict checks still use date/time-slot strings; they do not use canonical resource conflicts, blocks, or holds, and do not enforce quick/custom duration rules. |
| Guest-history privacy | **PARTIAL** | The route now rejects unauthenticated raw phone/email lookup. This review additionally bound a signed guest token to its own queried contact. Tokens are still neither issued by a verified-contact flow nor persisted/redeemed as single-use proof. |
| Granular RBAC backend enforcement | **PARTIAL** | Roles, permissions, and a default-deny middleware helper exist. Read-only production inspection found `role_permissions = 0` and `user_roles = 0`; existing management routes do not call `requirePermission`. |
| Schema migration/preflight reconciliation | **PARTIAL** | Preflight correctly identifies 14 applied migrations and target tables on PostgreSQL; the SQLite preflight reader was repaired in this review. The preflight is not a reconciliation/cutover tool, and Stage 0’s real legacy booking data is still unassigned/unbackfilled. |

## APPROVED

- The configured production database is PostgreSQL and records `001` through `014`; the repository SQLite snapshot is separately migratable. The target table inventory exists in both the configured PostgreSQL database and an isolated fresh SQLite database.
- The physical target inventory is correctly representable: `fac_box_cricket_1`, `fac_box_cricket_2`, `fac_pickleball_1`, `fac_pickleball_2`, `fac_skating_1`, and `fac_green_net_1`. The shooting machine is mapped only as an add-on of `fac_green_net_1`.
- `bookingInterval.js` uses the fixed `Asia/Kolkata` offset appropriately for the venue, preserves cross-midnight rollover, and uses correct half-open overlap logic. Adjacent intervals do not collide.
- Pure booking helpers correctly reject 90-minute quick/custom durations, support quick 1h/2h whole-hour starts, support custom quarter-hour starts with whole-hour duration, apply the customer 60-minute lead time, and allow an immediate staff walk-in helper path.
- The session extension helper requires staff approval, validates 15-minute increments, checks the supplied next-booking boundary, and rounds the next quick booking start to the next whole hour after partial-hour occupancy.
- The Stage 0 migration is additive: it neither drops nor renames legacy tables. A fresh isolated SQLite database applied migrations `001`–`014`, reinitialized without duplicate migrations, and its preflight found all Stage 0 target tables.
- This review repaired two small but material foundation defects: SQLite `PRAGMA` reads now return actual rows for preflight, and a signed guest-history token is constrained to its signed contact rather than any phone/email passed in the query.
- This review also makes each **future** versioned migration transactional with its migration-tracking insert for both PostgreSQL and SQLite. A failed future migration will not be recorded as applied.

## REQUIRED FIX

1. **Make canonical physical interval booking the only new-write authority before exposing Admin booking controls.** `server/routes/bookings.js` continues to create and query reservations using legacy `facility_id`, `date`, and formatted `time_slot`. New POSTs do not set `physical_facility_id`, do not call `findResourceConflicts`, and do not validate quick/custom duration boundaries. Build one server-side booking command that resolves a physical facility/service/add-on, validates the canonical interval and caller type, checks blocks/holds/bookings atomically, then persists both canonical and compatibility fields.
2. **Use true instant columns in PostgreSQL.** `bookings.scheduled_start_at`, `scheduled_end_at`, `facility_blocks`, `facility_sessions`, `session_adjustments` related timing, and `payment_holds` currently use `timestamp without time zone`. Add a reviewed follow-up migration using `TIMESTAMPTZ` for canonical instants, with an explicit UTC conversion policy and a preflight asserting no ambiguous non-null rows before alteration. Editing already-applied migration `014` is insufficient.
3. **Persist the legacy identity bridge before booking reconciliation.** The code’s `mapLegacyFacilityToPhysical('box-cricket')` returns both turfs, which is useful for discovery but cannot assign an historical booking. Add an audited mapping/quarantine table and require a reviewed assignment for each ambiguous legacy record. Do not silently choose Turf 1 for legacy box-cricket or Pickleball rows.
4. **Implement unambiguous 24/7 schedule semantics.** Stage 0 adds no schedule table/flag to physical facilities. Existing `facility_schedules` still uses equal open/close minutes and legacy route normalization. Add an explicit `is_24x7` schedule contract (or validated next-day end) before a schedule editor or canonical slot generator is introduced.
5. **Integrate active blocks and holds into the authoritative write path.** `facility_blocks` and `payment_holds` are tables plus helper lookup only; `/api/bookings/slots` and POST booking use `blocked_slots` and ignore the new tables. There is no create/finalize/expire/reap lifecycle for payment holds. Hold creation, quote/payment finalization, expiry, and conflict checks need one transactionally safe workflow.
6. **Finish RBAC persistence and route enforcement.** The configured PostgreSQL database has zero `role_permissions` and zero `user_roles`. Seed role-permission assignments, backfill the enabled bootstrap administrator safely, load effective permissions from persistence, and apply `requirePermission` to each protected operational endpoint. Do not rely on `req.admin.role` plus hard-coded fallback arrays as the long-term dynamic model.
7. **Keep pending-payment expiry separate from cancellation.** `bookingStateMachine.js` still permits `PENDING_PAYMENT → CANCELLED`, conflicting with the product state machine that treats abandoned/declined payment as `EXPIRED` and does not create a cancelled confirmed reservation. Remove the pending-payment cancellation transition or document a distinct customer-requested cancellation event with no confirmed booking row.
8. **Constrain and wire dining persistence before dining Admin/customer work.** The schema lacks foreign keys from orders to the existing `food_stalls`/menu tables, non-negative/quantity checks, and a server command that derives prices from persisted menu data. `calculateDiningOrderTotals` accepts caller-provided unit prices; it must not become an order endpoint input contract. Validate an active table/QR proof, stall, menu availability, and server-side price snapshot in one transaction.

## RECOMMENDED

- Add PostgreSQL range exclusion protection (or a serializable transaction/advisory-lock design) for physical facility occupancy. The current `findResourceConflicts` read-then-write pattern alone is race-prone under concurrent requests; SQLite requires equivalent serialized write behavior.
- Add status and money `CHECK` constraints to new tables: end-after-start, non-negative paise, positive dining quantity, permitted adjustment increments, and status enumerations. Application helpers are not a substitute for persistence constraints.
- Make session adjustments append-only and connect their accepted interval to the same occupancy query used by booking/hold/block checks.
- Add a partial/indexed strategy suited to canonical interval lookups. The current composite B-tree is useful but not sufficient to guarantee overlap correctness in PostgreSQL.
- Make `dining_tables.qr_code_token` unique, opaque, rotatable, and expiry-aware; never accept a bare typed table number as the final proof for customer ordering without the documented staff-confirmation alternative.
- Make preflight report non-READY when required canonical columns, expected migration IDs, or target table invariants are missing. Table existence alone is not readiness.
- Add actual HTTP/database integration tests, including race/transaction cases, rather than only pure helper unit tests.

## MIGRATION RISK

- PostgreSQL confirms all 8 booking rows have null `physical_facility_id`, `scheduled_start_at`, `scheduled_end_at`, and paise total fields. A cutover cannot infer Turf 1 vs Turf 2 from a legacy `box-cricket` identifier; reconciliation must preserve/quarantine ambiguity.
- Migration `014` is already recorded in PostgreSQL. Its current timestamp-without-time-zone definitions cannot be repaired by modifying that file; a new additive migration and explicit conversion plan are required.
- The per-migration transaction correction made in this review protects subsequent fresh migrations, not any partially applied historical deployment. Validate it in a disposable PostgreSQL environment before the next production migration.
- SQLite's additive-column loop catches every `ALTER TABLE` error as though it means "column exists." It can hide a real malformed-schema error. Replace it in the next migration with a `PRAGMA table_info`-based explicit column check now that PRAGMA reads work.
- `CREATE TABLE IF NOT EXISTS` preserves incompatible existing table shapes; migrations for orders, blocks, or roles must inspect and evolve existing columns explicitly.

## SECURITY RISK

- The prior guest-history token cross-contact flaw is fixed in this review, and the insecure hard-coded signing fallback was removed. However, there is still no verified-contact issuance path, single-use redemption record, or binding to a specific booking reference.
- Any authenticated admin currently passes the history gate and management endpoints remain role-string authenticated. Until `customer.read` and related permissions are actually enforced, least privilege is not achieved.
- Role and permission rows without assignments provide a false sense of enforcement. Current hard-coded fallback permissions can drift from database roles.
- Dining table QR values have no uniqueness, hashing, rotation, expiry, or endpoint enforcement yet.
- Existing booking endpoints still accept client facility display names and legacy payment/status-adjacent fields. The future canonical command must derive all authority-sensitive data from server records and verified quote/payment context.

## OPEN DECISION

1. **Legacy physical assignment policy:** What evidence is acceptable to assign an existing flat `box-cricket`/`pickleball` booking to a specific physical unit? If evidence is insufficient, should rows remain historical/quarantined with no canonical occupancy rather than receiving a guessed assignment?
2. **Guest history proof delivery:** Which verified flow issues a history token—OTP to the submitted mobile/email, or a signed link delivered with each booking pass? The token is now safely scoped but no issuance/consumption product flow exists.
3. **Dining table proof:** Is a rotating signed table QR mandatory for customer orders, or is an explicit staff-confirmed typed table-number workflow acceptable? This must be decided before public dining ordering endpoints.

## Exact next implementation step

Do **not** build Admin UI. Implement one small, tested **canonical booking command and migration follow-up** first: safe `TIMESTAMPTZ`/UTC conversion preflight; a persisted legacy-to-physical reconciliation bridge; explicit 24/7 schedule semantics; and one transactional server path that applies physical-resource, duration, lead-time, block, hold, and terminal-state rules. Add database-backed HTTP tests before any management screen consumes it.

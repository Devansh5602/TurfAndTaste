# Codex Stage 0.5 Release-Gate Review

**Reviewed branch:** `feature/customer-mobile-curated`  
**Reviewed implementation range:** `c996b30` through `830261e`  
**Review date:** 2026-09-30  
**Scope:** Stage 0.5 migrations, canonical booking and dining commands, route integration, authorization middleware, supplied tests, an isolated fresh/reapply SQLite run, and a read-only configured PostgreSQL preflight. No Admin UI or destructive production operation was performed.

## Verdict

**NOT READY**

Stage 0.5 makes valuable additive progress, but it does not yet provide a safe release gate for Admin implementation. In particular, new payment-confirmed bookings bypass the canonical command, the advertised PostgreSQL advisory locking is not held across a conflict check and insert, and the persisted RBAC vocabulary is inconsistent with live route checks. These are release-blocking server-side integrity and authorization defects, not UI gaps.

## Previous blocker status

| Stage 0 blocker | Status | Evidence |
| --- | --- | --- |
| Physical resource identity / Green Net add-on model | **RESOLVED** | PostgreSQL has the required six physical resources: two Box Cricket turfs, two Pickleball courts, one Skating Rink, and one Green Net. `addon_shooting_machine` maps only to `fac_green_net_1`. |
| Canonical Asia/Kolkata-safe intervals | **PARTIAL** | The inspected PostgreSQL canonical interval columns are `timestamp with time zone`. However, migration `015` assumes all previous naive values are IST even though the pre-015 canonical command serializes instants with `toISOString()`. A populated pre-015 canonical row would be shifted by this conversion, and no conversion preflight/audit exists. |
| Lead time, duration, state, hold, and overlap protections | **PARTIAL** | The command validates quick/custom boundaries, customer lead time, cross-midnight intervals, and sequential conflicts. The transaction/race guarantee is not real, hold conversion is not bound to its intended booking context, and public payment confirmation takes another write path. |
| Guest history privacy | **PARTIAL** | The Stage 0 signed-history contact binding remains present. A verified issuance/redemption lifecycle is still absent; separately, public dining order lookup exposes raw order/customer data by identifier. |
| Granular RBAC backend enforcement | **PARTIAL** | `roles`, `permissions`, `role_permissions`, and `user_roles` are seeded in PostgreSQL (4, 24, 44, and 1 rows respectively). Several route permission keys do not exist in that seed, while `authenticateAdminToken` rejects the seeded `staff` and `stall_staff` roles. |
| Schema migration/preflight reconciliation | **PARTIAL** | Eight ambiguous legacy bookings are preserved in `legacy_booking_reconciliation` as `MANUAL_REVIEW` / `QUARANTINED`. Migration `015` originally failed on a clean SQLite database; this review repairs that portability defect. Preflight still calls a release `READY` despite unresolved route, data, and concurrency conditions. |
| Dining authoritative order foundation | **PARTIAL** | Menu item prices are loaded in integer paise and inactive tables/items are rejected. The command neither verifies the parent stall is active nor persists the order and its lines atomically; status middleware uses a nonexistent permission key. |

## APPROVED

- `015_stage05_operationalization` is additive: it creates reconciliation metadata, adds `is_24x7`, seeds role relationships, and does not drop or rewrite legacy booking rows.
- The configured PostgreSQL schema has `TIMESTAMPTZ` for the reviewed canonical booking, block, session, and hold interval columns. The single Patan property baseline, six physical facilities, explicit 24/7 flag, and Green Net/Shooting Machine mapping are present.
- The legacy eight bookings remain intact and are explicitly quarantined rather than guessed onto Turf 1 or Turf 2.
- `createCanonicalBooking` and its focused tests correctly apply half-open overlap semantics, 1h/2h quick starts at `:00`, custom whole-hour durations on quarter-hour starts, one-hour customer lead time, cross-midnight normalization, cancelled-slot release, and extension occupancy in sequential execution.
- `createDiningOrder` ignores caller pricing and derives price/tax totals from persisted menu item `price_paise` values.
- After the migration correction in this review, an isolated fresh SQLite database applied `001`–`015`, reinitialized without reapplying migrations, and the Stage 0 (33 tests) plus Stage 0.5 (27 tests) suites passed.

## REQUIRED FIX

1. **Make the booking mutation genuinely canonical and atomic.** `POST /api/payments/verify` still constructs a legacy booking `INSERT` directly in `server/routes/payments.js`; it bypasses `createCanonicalBooking`, its conflict/hold checks, lead-time validation, facility-state checks, and consistent state derivation. Route and payment verification must call one canonical transactional command with persisted quote/order context.
2. **Implement a real same-connection transaction for conflict, hold, booking, and session persistence.** `canonicalBookingCommand.js` calls `pg_advisory_xact_lock` using `db.query`, then runs conflicts/inserts through later pool queries. In PostgreSQL autocommit, the lock is released when that first query completes. SQLite follows the same read-then-write shape. The supplied tests are sequential and do not exercise concurrent writers. Use a transaction callback/client abstraction (or an equivalent database exclusion constraint plus a single transaction) for both holds and booking finalization.
3. **Remove public control of booking status and untrusted payment amounts.** The public booking route forwards `payload.status` to the command. The command persists `payment.totalAmountPaise` supplied by its caller. The payment verifier bypass also stores the deposit-sized expected amount into `total_amount_paise` for deposit payments. State and monetary values must be derived only from a verified quote/order/payment context.
4. **Resolve permission-vocabulary and authenticatable-role mismatches.** The database seeds `booking.walkin` and `dining.order.manage`, while live routes require `booking.create_walkin`, `booking.update`, `dining.stall.read`, and `dining.order.update`, none of which is seeded. In addition, auth accepts only `super_admin` and `manager`, despite the RBAC model seeding `staff` and `stall_staff`. Define one permission vocabulary, migrate/backfill it safely, and make authenticated staff roles compatible with the persisted role assignment model before relying on management enforcement.
5. **Close unsafe dining order paths.** Public `GET /api/v2/food/orders/:id` returns full order rows and customer phone data without authentication or proof. `createDiningOrder` permits menu items from inactive stalls, permits mixed-stall line items, and writes order/header and lines without a transaction. Protect order retrieval with a customer-safe proof or authenticated ownership model, validate active stall and single-stall composition, and persist the header/lines atomically.
6. **Make preflight a release gate rather than a table inventory.** Its current `READY` ignores legacy/canonical test contamination, unreviewed manual-reconciliation backlog, active booking overlap reports, missing valid route permissions, lack of staff role assignment, and mutation-path integrity. It must fail closed for these conditions once the source-of-truth cutover is complete.

## RECOMMENDED

- Add an integration test harness that always provisions a disposable SQLite/PostgreSQL database. The current Stage 0.5 test module imports the configured database and mutates it; the read-only PostgreSQL review found six 2028 canonical test bookings and sessions left in the shared database. Do not delete them without an approved data-cleanup decision.
- Add database checks/indexes appropriate to the chosen conflict strategy: non-negative paise, positive quantities, end-after-start, recognized statuses, and indexed canonical physical intervals. For PostgreSQL, evaluate an exclusion constraint or verified serializable/advisory-lock transaction.
- Bind a hold token to the resolved physical facility, interval, actor/customer proof, and `ACTIVE` status before excluding/converting it. A supplied token currently excludes a matching hold during conflict detection without first proving its ownership/context.
- Replace broad legacy aliases such as `box-cricket -> fac_box_cricket_1` and `pickleball -> fac_pickleball_1` in new-write resolution. A high-level service identifier must be selected through a physical-resource allocation decision, not silently routed to the first unit.
- Keep the public slot endpoint on a migration plan. `GET /api/bookings/slots` remains a legacy schedule/string implementation with a six-hour maximum and does not use canonical blocks, holds, or physical resource selection.

## MIGRATION RISK

- `ALTER ... TYPE TIMESTAMPTZ USING column AT TIME ZONE 'Asia/Kolkata'` is correct only for values that were originally stored as IST wall-clock values. It is unsafe for pre-015 values written as ISO UTC instants. Add a non-null/sample preflight and documented conversion classification before applying the migration to a database with such data.
- The clean SQLite run initially failed at `INSERT ... SELECT ... ON CONFLICT DO NOTHING` because SQLite parses the first UPSERT `ON` as a join. This review adds the required no-op `WHERE 1 = 1` delimiter. The fresh apply/reapply test now passes.
- Existing production history has eight intentionally unresolved records. They are safely isolated, not reconciled. Any future assignment must be operator-audited and must not silently alter historical occupancy or money.
- Migration `015` seeds only `user_id = '1'` as super admin. It is not a general safe backfill for future/multiple management identities.

## SECURITY RISK

- Public client input can set booking status on `POST /api/bookings`; this can bypass intended payment-review state handling.
- The legacy payment verification insert bypasses canonical booking validation and does not serialize payment order state, quote redemption, booking creation, and occupancy in one authoritative command.
- Public dining-order retrieval leaks customer/order fields. Random-looking IDs are not an authorization control.
- The current Stage 0.5 tests can use the configured PostgreSQL database and have already left test records there. Tests must refuse shared/production configuration or use a dedicated disposable environment.
- Role middleware can deny intended staff because route keys and assigned role keys differ, while super-admin bypass masks that defect in happy-path tests.

## BOOKING-ENGINE RISK

- PostgreSQL advisory locks are not held across the conflict query and insert, so concurrent booking/hold requests can race despite the Stage 0.5 report claiming transactional protection.
- Booking insert, hold conversion, and facility-session insert are independent statements. A session insertion error is swallowed, yielding a booking without an operational session record.
- `Payment Review` bookings are non-occupying by the state helper, but the legacy preflight still reports their matching intervals as overlaps. Availability and reporting have different definitions of occupancy.
- Facility block/session/hold query failures are caught as non-fatal in conflict checking. Once those tables are part of the required authority path, a read failure must fail closed rather than allow a booking.

## PRICING RISK

- The canonical command accepts a total from its caller rather than a persisted authoritative pricing snapshot. The public route derives one from a quote, but payment verification uses a separate legacy insert.
- For a deposit, `payments/verify` treats `payment_orders.expected_amount` (the amount collected) as `total_amount_paise`; the contracted total and deposit are therefore not preserved correctly.
- No test covers price changes, quote/order binding through the canonical command, or immutable stored rule snapshot/application precedence.

## RBAC RISK

- The implementation report and `docs/domain/RBAC.md` use a different permission vocabulary from `STANDARD_PERMISSIONS`, migration `015`, and live route middleware. This is an operational authorization failure, not merely documentation drift.
- `admins.role` authentication supports only `super_admin` and `manager`; the seeded `staff` and `stall_staff` roles cannot log in through the management token middleware.
- Custom roles can exist in persistence, but there is no verified role-assignment lifecycle for an authenticated management identity beyond the fixed bootstrap admin row.

## DINING RISK

- Active table and server price validation are present, but restaurant operational integrity is incomplete: no active-stall check, no same-stall constraint, no transactional header/line persistence, and no protected customer order lookup.
- The active status transition endpoint requires `dining.order.update`, which is not in the seeded permissions; the intended `dining.order.manage` key is present instead.
- Dining table proof is typed table number or optional QR comparison. If a QR is configured, an omitted token still passes. The required final proof policy (typed table number, QR, or staff confirmation) needs a product decision before customer ordering is exposed.

## OPEN DECISION

1. **Canonical timestamp conversion:** For any pre-015 non-null canonical timestamps, are they known to be IST wall-clock values or ISO UTC instants? This determines whether the existing conversion may be applied or must be replaced by an audited data migration.
2. **Customer dining table proof:** Is a typed active table number a sufficient customer proof, or must a rotating QR/staff confirmation be mandatory? The current implementation permits typed table number and only validates QR when supplied.
3. **Staff identity model:** Should operational staff/stall staff be rows in `admins` with supported roles, or a separate staff identity linked through `user_roles`? The answer must be fixed before Admin authorization is presented as permission-driven.

## Exact recommended next implementation step

Do **not** start Admin UI. First implement and test a single canonical booking/payment finalization transaction: load the persisted quote/payment order, validate active physical facility and interval, acquire a same-transaction resource lock, check bookings/blocks/extensions/holds, create the booking and facility session, consume the bound hold/quote/order, and commit or roll back together. In the same prerequisite slice, remove client-controlled booking status/amounts. Follow it with a versioned RBAC vocabulary/authentication-role reconciliation before any staff-facing management workflow.


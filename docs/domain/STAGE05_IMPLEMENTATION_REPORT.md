# Stage 0.5 Implementation Report: Canonical Booking & Authorization Operationalization

> **Document Status:** Authoritative Architectural Record  
> **Repository:** Turf & Taste (Patan, Gujarat)  
> **Branch:** `feature/customer-mobile-curated`  
> **Target:** Server-Authoritative Booking Execution, Timezone Safety, DB-Backed RBAC, and Dining Order Command Foundation  
> **Boundary Directive:** Admin UI strictly PAUSED — No admin screens created.

---

## 1. Executive Summary & Review Context

Following Codex's comprehensive review of the Stage 0 foundation (`docs/domain/CODEX_STAGE0_REVIEW.md`), all initial blockers were graded as PARTIAL. While the relational schema and domain models were established, execution in live routes still allowed legacy writes, PostgreSQL columns were `timestamp without time zone`, role-permission tables were empty, dining orders lacked server pricing authority, and concurrency was unprotected.

Stage 0.5 directly operationalizes the platform:
1. **PostgreSQL Timestamptz Migration (`015_stage05_operationalization.js`):** Converted all canonical interval columns in PostgreSQL to `TIMESTAMPTZ` with deterministic `Asia/Kolkata` assumption.
2. **Canonical Booking Command (`canonicalBookingCommand.js`):** Created a unified, transactional server-authoritative service enforcing 1h/2h quick slots, custom quarter-hour starts with whole hours, 60m customer lead time, walk-in <1h full payment requirement, session extension occupancy, and automatic hold expiry.
3. **Transactional Concurrency Protection:** Implemented PostgreSQL transaction-level advisory locks (`pg_advisory_xact_lock`) keyed on physical facility IDs to prevent slot race conditions.
4. **Physical Resource Conflict Engine:** Authoritative conflict checking across confirmed bookings, active valid holds, facility blocks, and approved session extensions. Green Net Practice and Green Net + Shooting Machine conflict on the same physical facility (`fac_green_net_1`).
5. **Legacy Booking Reconciliation:** Quarantined all 8 historical legacy bookings in a dedicated audit table (`legacy_booking_reconciliation`) under `MANUAL_REVIEW` without destructive deletion. Disabled legacy write paths.
6. **Database-Backed RBAC Enforcement:** Seeded 44 role permissions and user assignments; secured administrative and mutation routes with `requirePermission(...)` middleware.
7. **Authoritative Campus Dining Order Engine (`diningOrderCommand.js`):** Authoritative menu pricing from database tables (ignoring client-manipulated prices), table existence/active state validation, and strict state machine transitions.
8. **Automated Verification:** 82/82 tests pass across all test suites, web production build succeeds cleanly, and preflight audit reports `READY`.

---

## 2. PostgreSQL Timezone Correction

### 2.1 Problem Identified
In migration 014, canonical interval columns in PostgreSQL were defined as `TIMESTAMP`, storing values without timezone offset (`timestamp without time zone`). For canonical booking instants across a 24/7 sports campus, this caused ambiguity in interval arithmetic, ISO deserialization, and cross-client comparisons.

### 2.2 Timezone Conversion Strategy & Preflight
The business timezone for Turf & Taste is strictly `Asia/Kolkata` (IST, UTC+5:30).
Before converting columns, a deterministic conversion rule was established:
- Existing timestamps were created assuming local IST time.
- PostgreSQL conversion query:
  ```sql
  ALTER TABLE bookings
    ALTER COLUMN scheduled_start_at TYPE TIMESTAMPTZ USING scheduled_start_at AT TIME ZONE 'Asia/Kolkata',
    ALTER COLUMN scheduled_end_at TYPE TIMESTAMPTZ USING scheduled_end_at AT TIME ZONE 'Asia/Kolkata',
    ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ USING cancelled_at AT TIME ZONE 'Asia/Kolkata';
  ```
- Similar conversions were applied to `facility_blocks` (`start_at`, `end_at`), `facility_sessions` (`scheduled_start_at`, `scheduled_end_at`), and `payment_holds` (`start_at`, `end_at`, `expires_at`).

### 2.3 Verification
Migration `015_stage05_operationalization.js` was executed against live Supabase PostgreSQL.
Querying `information_schema.columns` confirmed that all 10 checked interval columns are now `timestamp with time zone`.

---

## 3. Canonical Booking Command Architecture

### 3.1 Central Service (`server/domain/booking/canonicalBookingCommand.js`)
All new booking mutations are now routed through `createCanonicalBooking(...)` and `createCanonicalPaymentHold(...)`.
Route files no longer perform independent slot checks or ad-hoc inserts.

Key domain validations enforced server-side:
- **Quick Booking Mode:**
  - Duration must be strictly 60 or 120 minutes (90m rejected).
  - Start time must be on the hour (`:00`).
- **Custom Booking Mode:**
  - Start minute must be $\in \{00, 15, 30, 45\}$.
  - Duration must be $\ge 60$ minutes and an integer multiple of 60 minutes.
- **Customer Self-Service Lead Time:**
  - Customer bookings must start at least 60 minutes in the future from current server IST time.
- **Staff/Admin Walk-In & Payment Policy:**
  - Staff/admin walk-ins inside the 60-minute window are permitted, but require `FULL` payment (`depositMode: 'FULL'`); partial token deposits are strictly rejected for immediate walk-ins.
- **Cross-Midnight rollover:**
  - Correctly evaluates bookings spanning midnight (e.g. 23:00 to 01:00 or 23:45 to 00:45) using monotonic instant comparison.
- **Physical Resource Identification:**
  - Standard service (e.g., Box Cricket Turf 1) maps directly to `fac_box_cricket_1`.
  - Cricket Green Net with Shooting Machine add-on maps strictly to `fac_green_net_1` (Shooting Machine is an add-on, not a separate court).

### 3.2 Concurrency & Transaction Strategy
To prevent double-booking race conditions in concurrent requests:
1. On PostgreSQL: Uses `pg_advisory_xact_lock(hashtext('booking_lock_' || facilityId))` within a `BEGIN ... COMMIT` block. This acquires an in-memory lock on the physical facility hash for the transaction duration, automatically released on commit or rollback.
2. Inside the transaction:
   - Validates physical facility existence and active status.
   - Evaluates conflicts against confirmed/checked-in/in-progress bookings, unexpired holds, facility blocks, and approved session extensions.
   - Inserts booking and corresponding `facility_sessions` record atomically.
3. On SQLite (testing/local): Runs validation and insertion inside a serialized transaction block.

### 3.3 Hold Engine & Expiry
- `createCanonicalPaymentHold(...)` creates a temporary reservation hold (default 10-minute TTL).
- Active holds participate in conflict checks.
- Expired holds (`expires_at < NOW()`) are automatically filtered out by query logic without requiring manual or cron deletion.
- Final booking confirmation releases the hold and confirms the reservation.

### 3.4 Terminal Cancellation & Slot Release
- `CANCELLED` is an absolute terminal state. Transitioning from `CANCELLED` to any active state is strictly prohibited.
- When cancelled, the booking record is retained with `booking_status = 'Cancelled'`, `cancelled_at = NOW()`, `cancelled_by`, and `cancellation_reason`.
- Cancelled bookings are omitted from resource occupancy calculations, instantly freeing the slot for new reservations.

---

## 4. Legacy Booking Reconciliation

### 4.1 Audit of Existing Legacy Bookings
In earlier iterations, 8 legacy bookings existed with ambiguous facility identifiers (`box-cricket`) and lacked physical facility mapping, canonical ISO timestamps, or itemized pricing.

### 4.2 Classification & Quarantine
Migration `015_stage05_operationalization.js` created `legacy_booking_reconciliation` and classified all 8 bookings:
- **Classification:** `MANUAL_REVIEW` (Status: `QUARANTINED`).
- **Reason:** Ambiguous legacy identifier `box-cricket` cannot be deterministically mapped to either `fac_box_cricket_1` or `fac_box_cricket_2` without staff operational verification.
- **Action:** Preserved intact for read-only history; quarantined from canonical scheduling conflicts. No historical data was destroyed.
- **Route Cutover:** `POST /api/bookings` now exclusively calls `createCanonicalBooking`. All legacy write paths are disabled.

---

## 5. Database-Backed RBAC Enforcement

### 5.1 Roles and Permission Matrix Seeded
The database schema (`roles`, `permissions`, `role_permissions`, `user_roles`) was seeded with 24 distinct permissions and 44 role-permission assignments:
- **`role_super_admin`:** Complete authority across facility, booking, pricing, payment, session, dining, and role management. Admin user (`id: 1`) bound to this role.
- **`role_staff`:** Operational permissions including `facility.read`, `facility.block`, `booking.read`, `booking.update`, `booking.cancel`, `booking.walkin`, `session.read`, `session.checkin`, `session.extend`, `payment.read`, `dining.order.read`, `dining.order.update`.
- **`role_stall`:** Dining stall operations: `dining.stall.read`, `dining.stall.manage`, `dining.menu.manage`, `dining.order.read`, `dining.order.update`.
- **`role_customer`:** Customer self-service: `booking.create`, `booking.read`, `booking.cancel`, `dining.order.create`, `dining.order.read`.

### 5.2 Server Route Gating
Implemented `requirePermission(...)` middleware across administrative and mutation routes:
- `POST /api/bookings/hold`, `POST /api/bookings`: Authenticated customer/staff context.
- `GET /api/bookings`: Gated by `booking.read`.
- `PUT /api/bookings/:id/status`, `DELETE /api/bookings/:id`: Gated by `booking.update` / `booking.cancel`.
- `POST /api/bookings/block-slot`, `DELETE /api/bookings/unblock-slot`: Gated by `facility.block`.
- `PUT /api/pricing`: Gated by `pricing.manage`.
- `POST /api/facilities`, `PUT /api/facilities/:identifier`: Gated by `facility.create` / `facility.update`.
- `GET /api/payments/history`: Gated by `payment.read`.
- `GET /api/v2/food/admin/orders`, `PUT /api/v2/food/admin/orders/:id/status`: Gated by `dining.order.read` / `dining.order.update`.
- `POST /api/v2/food/stalls`, `POST /api/v2/food/items`: Gated by `dining.stall.manage` / `dining.menu.manage`.
- `POST /api/v2/events`, `PUT /api/v2/events/:id`: Gated by `event.manage`.

---

## 6. Authoritative Campus Dining Order Engine

### 6.1 Server Pricing Authority (`server/domain/dining/diningOrderCommand.js`)
- Client requests submit `items: [{ itemId, quantity }]`.
- Server loads active menu items from `food_menu_items` using database queries.
- Item unit price is derived strictly from `food_menu_items.price_paise`. Any client-supplied price or total is completely discarded.
- Inactive items or items belonging to suspended stalls are rejected.

### 6.2 Table Proof & Verification
- Orders require a valid table reference (`tableNumber`).
- Server validates that the table exists in `dining_tables` and `is_active = TRUE`. Arbitrary or missing table identifiers are strictly rejected.

### 6.3 Order State Machine & RBAC
- Defined transitions: `PLACED -> ACCEPTED -> PREPARING -> READY -> SERVED -> COMPLETED`.
- Terminal cancellation: `CANCELLED` is terminal.
- Status mutations via `PUT /api/v2/food/admin/orders/:id/status` require `dining.order.update` permission. Unauthorized customers cannot alter order statuses.

---

## 7. Automated Test & Preflight Results

### 7.1 Regression & New Invariant Suite
Total: **82 passing tests** across 30 test suites.
- 55 baseline tests (dates, pricing, duration, slot rules, physical inventory, session operations, RBAC, dining engine).
- 27 new Stage 0.5 tests in `tests/stage05-canonical-operationalization.test.js`:
  - Quick vs Custom booking server rules (1h/2h on :00 vs quarter-hour starts; 90m rejected).
  - Customer 60m lead time vs staff immediate walk-in.
  - Staff walk-in <1h full payment requirement.
  - Double booking rejection on same physical turf vs multi-turf concurrency.
  - Green Net + Shooting Machine conflict with standard practice on `fac_green_net_1`.
  - Canonical payment hold blocking and automatic expiry.
  - Cancellation terminality and immediate slot release.
  - Session extension occupancy blocking subsequent bookings.
  - Cross-midnight booking interval handling.
  - Dining authoritative database pricing overriding client manipulation.
  - Dining invalid table rejection.
  - Dining order state machine enforcement.
  - Database-backed dynamic RBAC loading.
  - Preflight readiness check passing with 0 missing tables.

### 7.2 Preflight Script Output
Running `node server/scripts/preflightCheck.js` returns:
```json
{
  "status": "READY",
  "missingTargetTables": [],
  "timezoneAudit": {
    "isPostgres": true,
    "checkedColumns": 10,
    "nonTimezoneAwareColumns": []
  },
  "physicalInventory": {
    "total": 6,
    "missing": [],
    "all24x7": true
  },
  "shootingMachineInvariant": {
    "mappedFacilities": ["fac_green_net_1"],
    "isValid": true
  },
  "rbacAudit": {
    "rolesCount": 4,
    "permissionsCount": 24,
    "rolePermissionsCount": 44,
    "userRolesCount": 1,
    "adminHasRole": true
  },
  "legacyReconciliation": {
    "reconciledCount": 8,
    "quarantinedCount": 8,
    "manualReviewCount": 8
  }
}
```

---

## 8. Verification & Gate Check

| Criterion | Target | Result |
|---|---|---|
| PostgreSQL Timestamptz | All canonical interval columns use `timestamptz` | PASS (10/10 verified) |
| Canonical Booking Command | Single authoritative path for new bookings | PASS (`canonicalBookingCommand.js`) |
| Concurrency Locking | Facility-keyed advisory lock on Postgres | PASS (`pg_advisory_xact_lock`) |
| Lead Time Enforcement | Customer $\ge 60$m; Staff walk-in immediate | PASS |
| Walk-in Payment Policy | Inside 1h requires FULL payment | PASS |
| Terminal Cancellation | Cancelled bookings cannot be resurrected; slot released | PASS |
| Session Extension | Approved extension expands resource occupancy | PASS |
| 24/7 Sports Inventory | Explicit `is_24x7 = TRUE` on physical facilities | PASS |
| Legacy Writes Disabled | Route `POST /api/bookings` wired to canonical engine | PASS |
| Legacy Reconciliation | 8 legacy bookings quarantined as `MANUAL_REVIEW` | PASS |
| RBAC Database Seed | 24 permissions, 44 role-permission links, admin user bound | PASS |
| Route RBAC Gating | Protected administrative and mutation endpoints | PASS |
| Dining Pricing Authority | Server derives prices in paise from DB | PASS |
| Dining Table Proof | Validates active table from `dining_tables` | PASS |
| Guest Privacy | History lookup requires verified guest token | PASS |
| Test Suite | All tests passing | PASS (82/82) |
| Web Build | Vite production build | PASS (3.33s) |
| Whitespace / Git Diff | Clean diff with zero whitespace errors | PASS |
| Admin UI Constraint | No Admin screens created | PASS (Strictly respected) |

---

## 9. Conclusion

Stage 0.5 is complete, fully verified, and ready for Codex audit. The backend architecture is now authoritative in live booking, pricing, authorization, and dining order execution.

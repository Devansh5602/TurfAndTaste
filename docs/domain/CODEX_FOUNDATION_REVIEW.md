# Codex Foundation Review

**Reviewed commit:** `8ab8eb1` — `docs(domain): establish authoritative Turf and Taste platform model`  
**Review date:** 2026-09-30  
**Scope:** documentation, migration plan, current server schema/routes, and checked-in SQLite fallback. No Admin UI, schema migration, or destructive operation was performed.

## Verdict

**NOT READY** for Admin implementation. The product truth is a strong direction, but several P0/P1 migration, interval, state, and authorization gaps make an Admin UI unsafe: it would administer a model that the current schema and server cannot yet enforce.

## APPROVED decisions

- One Turf & Taste property in **Patan, Gujarat**, using `Asia/Kolkata`; no branch/aggregator model.
- Correct conceptual hierarchy: property → section → physical facility → service/add-on.
- Baseline physical inventory: two Box Cricket turfs, two Pickleball courts, one Skating Rink, and one Cricket Green Net. The shooting machine is a paid add-on, not a facility.
- Sports are 24/7 by default; explicit facility blocks and maintenance are the correct availability controls.
- Customer lead time is one hour; authorized counter staff may create immediate walk-ins, with full payment required inside that lead-time window.
- Quick booking boundaries (one/two hours on `:00`) and custom booking boundaries (quarter-hour starts with whole-hour durations) are conceptually sound.
- Separate booking, payment, session, and dining-order state machines; token/full-payment verification must remain server-authoritative.
- Additive migration, guest booking, WhatsApp/SMS preference, QR check-in, scheduled-vs-actual timestamps, table-number dining orders, and permission-oriented RBAC are all appropriate target decisions.

## REQUIRED corrections

1. **Create one canonical physical-resource bridge before new CMS screens.** Current legacy `facilities` and v2 `facility_profiles` are parallel concepts, not a normalized section/facility/service model. Seeded legacy records include one `box-cricket`, one `pickleball`, and a separate `ball-machine`, which cannot represent the required two turfs/two courts/one-net-with-add-on inventory.
2. **Migrate availability to timezone-aware intervals.** Legacy `bookings.date` plus formatted `time_slot` cannot safely model 24/7 cross-midnight reservations or extensions. New writes need `scheduled_start_at` and `scheduled_end_at` on a physical facility; legacy strings remain read-only compatibility data until reconciled.
3. **Make 24/7 explicit.** Existing schedules use equal open/close values (for example `360 → 360`) and rely on route normalization. Define and migrate an explicit `is_24x7` / next-day-end contract before any schedule editor is shipped.
4. **Enforce the documented booking constraints server-side.** Current slot/quote paths accept arbitrary minute starts, allow a 1.5-hour duration, cap duration at six hours, and only reject already-started slots—not the one-hour customer lead time. These disagree with the new domain rules.
5. **Separate hold expiry from booking cancellation.** A failed or abandoned payment hold is not a cancelled confirmed booking. It must release its hold without creating a cancellable booking row. `Cancelled` remains terminal and preserves history.
6. **Canonicalize state names and transitions.** The initial documents disagreed on dining (`ReadyForService`/`Settled`/`Rejected` vs `Ready`/`Completed`/`Cancelled`) and cancellation timing. This review corrected the documentation; implementation must use the same finite transition maps and reject terminal-state rewrites.
7. **Define money and pricing snapshots in paise.** Existing legacy amounts are strings or rupee-oriented integers. New quotes, deposits, extensions, payments, and dining totals need non-negative integer paise plus immutable applied-rule snapshots.
8. **Add actual permissions before privileged management modules.** Current server middleware recognizes only `super_admin` and `manager`; protected food/events writes require authentication but no granular permission. Do not surface role management or operational Admin controls until permission rows, assignments, and default-deny enforcement exist.

## RECOMMENDED improvements

- Use a stable `physical_facility_id` identity map rather than renaming/dropping legacy records. Preserve source IDs and add a mapping/audit table for backfill decisions.
- On PostgreSQL, enforce non-overlap with an exclusion constraint over a `tstzrange` for occupancy-bearing booking states, plus indexed range queries. SQLite needs a transactionally serialized overlap check with the same canonical interval semantics.
- Replace per-slot `blocked_slots(date, time_slot)` with interval-based `facility_blocks` containing start/end instants, reason, public message, internal note, creator, and lifecycle state.
- Make extensions append-only records with approval actor, increment, charge in paise, and original/approved interval. Compute next quick/custom starts from the resulting occupied interval.
- Version pricing rules and capture quote inputs/results. A booking that crosses day/night boundaries must price each intersecting interval, then apply the documented package/override policy.
- Store a verified guest-contact proof/link audit rather than automatically attaching a new customer account based on matching email or phone text.
- Add foreign keys/checks for event facility association, food-stall section association, add-on eligibility, status enumerations, non-negative totals, and end-after-start interval validity.
- Add indexes for `bookings(facility_id, scheduled_start_at, scheduled_end_at, booking_status)`, `facility_blocks(facility_id, starts_at, ends_at, status)`, guest-history lookup plus proof record, payment quote/order uniqueness, and dining order stall/status/created time.

## MIGRATION risks

- The checked-in `server/data/turf_and_taste.db` has no `schema_migrations` table or v2 tables even though the review document initially described 13 recorded migrations. A remote Supabase environment may differ. Every target database needs a preflight inventory; never rely on documentation as migration evidence.
- `runVersionedMigrations` records a migration only after `up` completes but does not wrap each migration in a transaction. A partial failure—especially SQLite `ALTER TABLE` or a seeded backfill—can leave schema changes applied without a migration record and make retry unsafe.
- Existing `food_stalls` / `events` may already exist with older columns. `CREATE TABLE IF NOT EXISTS` does not evolve an incompatible table; migration stages require column-shape validation and additive `ALTER`/bridge steps.
- Migration `005` backfills rich facility content from legacy static content and migration `012` does the same for dining. These legacy sources contain obsolete location/identity assumptions, so they must not be promoted to Patan production data without an approved identity/content cleanup map.
- The current backfill plan incorrectly carries `ball-machine` forward as a facility. Reclassification to the Green Net add-on must be deliberate, idempotent, and preserve legacy booking/audit references.
- Do not add non-null target interval columns to populated bookings in one step. Backfill only unambiguous historical rows, quarantine ambiguous formatted slots, and run count/overlap/reconciliation reports before cutover.

## SECURITY risks

- `GET /api/bookings/history` returns booking history from a phone number or email alone. This leaks personal bookings to anyone who knows a contact value. Require an OTP, a signed history link, or an authenticated verified identity before returning history or linking a guest record.
- The booking endpoint accepts `facilityName`, `id`, and legacy payment/status fields from clients. The server should derive facility display data, references, pricing, and permitted transitions from trusted records; client input must not establish them.
- `amount_paid` is a formatted legacy string, which weakens amount validation/auditability. New payment records must compare provider amount to persisted expected paise and retain no gateway secrets in public responses.
- Authenticated food/event management routes currently do not apply the promised granular permission checks. The default posture for future roles must be deny, including unsupported role values and cross-stall access.
- Public food serializers expose arbitrary `metadata`. Because metadata may contain internal notes or seed provenance, public API allowlists should expose only deliberately public fields.

## BOOKING-engine risks

- Current availability reads bookings and blocks only for the selected calendar date. A reservation or block that begins before midnight and ends after midnight can conflict with the next day without being queried.
- Current quote pricing applies the rate for the start minute to the complete duration, so a day-to-floodlit reservation is mispriced. It has no package/add-on/rule-version implementation despite the proposed precedence hierarchy.
- The current one-hour self-service lead-time policy is absent from quote/slot acceptance. `slotHasStarted` only prevents past/current-started slots.
- Customer and Admin paths do not share a single validation contract. The Admin reservation path bypasses schedule, lead-time/payment policy, and canonical interval validation; it therefore cannot safely support immediate walk-ins yet.
- Status update currently accepts broad target statuses without checking the existing status. A cancelled booking can be changed again, violating terminal cancellation and potentially reopening availability incorrectly.
- Payment holds are not included in current availability queries even though the domain specification says active holds occupy a temporary interval.

## PRICING risks

- Legacy `pricing_tiers` has only day/night rate, weekend percent, deposit percent, and JSON details. It cannot express rule ownership (section/facility/service/add-on), effective intervals, precedence mode, package eligibility, tax/rounding policy, or versioned snapshots.
- Parsing formatted `bookingDeposit` text from JSON is not a reliable money contract. Deposits must be stored/validated in paise with explicit fixed/percentage type.
- The documentation now resolves package/special-rate composition, but no code or schema enforces it yet. Do not expose an Admin pricing editor until that rule model and quote regression coverage exist.

## RBAC risks

- The current `admins.role` migration is a temporary two-role allowlist, not the documented dynamic RBAC model. It cannot support staff, stall staff, custom roles, ownership-scoped menu permissions, or permission audit queries.
- `requireAdminRole` is role-string based. Introduce permissions and `role_permissions` before adding management UI actions; retain a carefully backfilled `super_admin` bootstrap role and prevent removal of the final enabled super administrator.
- Privileged operational actions—block creation, walk-in creation, session start/end, extension approval, cancellation, price changes, and refunds—need explicit permission checks and audit events, not only a valid JWT.

## DINING risks

- Dining ordering is specified but no `dining_orders`/`dining_order_items` migration or server implementation exists. Do not build dining Admin UI until server-calculated line-item totals, table identity validation, menu availability checks, and the canonical order state machine exist.
- Food-stall persistence has no `section_id` and relies on JSON schedules. Add the parent Dining section relation and structured schedule validation.
- A table number by itself is guessable. Table QR flow needs a signed/rotating table token or an explicit staff-validated table-number policy before customer orders are accepted.
- Food menu/public response metadata must be split into public and internal fields before a customer ordering API is exposed.

## OPEN questions only if genuinely unresolved

1. **Deployment migration authority:** Which Supabase environment, if any, is the authoritative production database and what is its real migration/table inventory? The checked-in SQLite database demonstrably differs; this must be established by a read-only preflight before migrations are authored.
2. **Table identity proof:** Should customer table orders require a signed/rotating table QR, or is typed table number intentionally acceptable with a staff confirmation step? This determines abuse controls and order placement API design.

## Exact recommended next Admin implementation step

Do **not** start Admin UI. First implement and test a non-destructive **Stage 0 migration preflight plus canonical physical-resource/interval foundation**: schema inventory report; explicit `sections`, physical-facility bridge, service/add-on mappings, `is_24x7` schedule semantics, and canonical timestamp interval fields. Include a reviewed identity mapping that turns legacy `ball-machine` into the Green Net add-on without deleting or rewriting legacy booking history. Only after reconciliation and overlap/lead-time/cancellation tests pass should the facility-management API be built.

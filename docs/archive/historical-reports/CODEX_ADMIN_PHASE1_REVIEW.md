# Codex — Admin Platform Phase 1 Independent Review

**Reviewed implementation:** `5857ce1 feat(admin): implement admin platform phase 1 operational modules and rbac shell`  
**Foundation base:** `1ffb5a0`  
**Review date:** 2026-10-01  
**Scope:** Phase 1 Admin Platform only. No Phase 2/Admin expansion was performed.

## APPROVED

- The Phase 1 dashboard and authenticated Facility, Block, Bookings, Walk-In, Sessions and Pricing navigation are present and route through the existing Admin shell.
- The six required physical resources are represented in the disposable SQLite verification database: two Box Cricket turfs, two Pickleball courts, one Skating Rink, and one Cricket Green Net. The Ball-Shooting Machine is presented as an add-on on `fac_green_net_1`, not a separate resource.
- Admin inventory reads are now permission-protected. Anonymous requests to physical facilities, sections, services and add-ons return `401`; authenticated `facility.read` access returns the six-resource inventory.
- The browser Admin CMS initially exposed an empty facility list after the read endpoints were protected because its GET calls omitted the bearer token. The client now uses the authenticated header for those reads and the live disposable browser session correctly renders all six resources.
- Facility block create/delete behavior, same-resource conflicts, different-resource independence, and release-after-delete passed isolated HTTP verification against a disposable SQLite database.
- The session routes now enforce the persisted booking lifecycle: Confirmed -> Checked-in -> In Progress -> Completed. Premature start/end, invalid zero-minute extension, and post-completion check-in were rejected in isolated HTTP verification.
- Session Extension UI actions now only appear in a relevant In Progress state; delay actions only appear after check-in/in progress. The server remains the enforcement point.
- Canonical extension occupancy no longer double-counts an already-advanced booking end plus its immutable extension adjustment. A regression test covers the case.
- Admin UI permission gating no longer grants UI access solely by the `super_admin` role name; it uses the effective permission set returned by the authenticated identity.
- Facility-block date/time input now treats values as Asia/Kolkata civil time and displays persisted blocks in that timezone rather than using the administrator device timezone.
- The test runner now explicitly forces isolated SQLite mode even when a developer `.env` contains `DATABASE_URL`; `npm test` no longer silently selects mutable/developer database configuration.
- Loopback CORS is allowed only for local `localhost`/`127.0.0.1` development origins. This fixed authenticated local browser QA without broadening production CORS policy.

## REQUIRED FIX

### Server-authoritative pricing is not implemented for Admin walk-ins

`src/admin/pages/WalkInView.jsx` submits fixed display amounts (₹800 full / ₹400 token). `server/routes/bookings.js` converts the staff-supplied `payload.amount` to `totalAmountPaise` for `STAFF_WALKIN`; it does not resolve an authoritative rate, package/add-on, deposit rule, or pricing-window result on the server. The legacy pricing route also supplies default numeric rates when values are missing.

This is a pricing-integrity and data-integrity blocker. The next implementation slice must introduce one server pricing resolver used by all new Admin walk-in/counter bookings, retain a traceable pricing snapshot, and reject a client amount as the booking total. The Admin UI should display the returned quote/charge breakdown rather than select or manufacture the amount.

### Block and extension mutations are not transactionally serialized with the resource occupancy check

`POST /api/facilities/blocks` performs a conflict read then a separate insert. `POST /api/sessions/extend` performs a conflict read followed by separate adjustment and booking writes. Neither path holds the existing database transaction/resource lock across read and write. Concurrent operations can therefore pass their separate reads and leave a block/extension conflicting with a simultaneously finalized booking, or leave an extension adjustment and booking interval out of sync if one write fails.

Use the existing `dbAsync.withTransaction` plus the same physical-resource locking convention as canonical finalization, with the conflict check and all writes inside that transaction. Add same-resource concurrent block/finalization and extension/finalization regression tests for SQLite and PostgreSQL.

## RECOMMENDED

- The current Facility UI is a useful operational inventory editor, but it does not expose managed creation/editing for sections, services, or add-ons despite the route surface and the Phase 1 report’s broader CMS wording. Keep the fixed property inventory protected until a complete, validation-backed physical-resource CMS is designed; do not expose arbitrary resource creation while canonical resource resolution remains the fixed six-resource model.
- Validate `facilityId`, section/service/add-on relationships, and the Green Net-only Shooting Machine mapping in the facility mutation API. Current physical upsert endpoints can accept arbitrary IDs/mappings that the canonical inventory/booking resolver cannot necessarily represent.
- Surface API load failures in Facility and Block views instead of silently replacing a failed response with a zero-count/empty state.
- Use the shared venue-time helpers for all Admin “today” and quick-slot calculations, including dashboard/session dates and walk-ins, rather than browser-local `Date` logic.
- Replace inline Admin colors with semantic theme tokens before expanding the module; current dark-only inline styling makes a later intentional light theme harder.

## UX ISSUE

- Authenticated browser QA passed for login, dashboard, six-resource Facility CMS, configure/save/reload, and Blocks empty state. The configured automation browser has a minimum CSS width of 480px, so it cannot provide a genuine 360px/390px Admin viewport result. Source inspection shows horizontal-scroll navigation is intentional; a physical/device 360–430px admin pass remains required.
- The Facility/Block views use long lists and compact cards appropriately for operations, but their current failure fallback can make an unavailable service look like an intentionally empty inventory. Show an actionable retry/error state.
- Walk-In currently presents a price as though it were final before server pricing has resolved it. This is both a UX and integrity defect covered by the required fix above.

## SECURITY ISSUE

- The server-side permissions added to management inventory reads and pricing timing mutation are correct and were verified. However, security cannot rely on UI controls: completion of the pricing fix must ensure the authenticated staff identity can create only a canonical, server-priced counter booking.
- `POST /api/bookings/hold` is public. Its intended quote/hold policy and anti-abuse/rate-limit posture should be rechecked with the pricing/finalization slice; this review did not broaden it because it predates Phase 1 and requires an agreed public booking contract.

## DATA ISSUE

- Physical resource records correctly model two turfs/two courts/one rink/one net in the disposable database. The Phase 1 `POST /physical` upsert can still overwrite canonical `code` and `default_name` for an existing ID. That contradicts the distinction between stable physical identity/default name and operator-managed display name. Restrict identity/default changes to a future validated inventory migration workflow, or reject upserts for existing canonical IDs.
- Pricing has two competing data shapes: the legacy `pricing_tiers` display model and the Stage 0 pricing-engine requirements. Do not expand Admin price editing until writes and booking calculation share a single normalized authoritative rule model.

## TEST GAP

- `npm test` passed all 8 suites / 159 tests on isolated SQLite. The Stage 0–09 regression suites and Admin Phase 1 suite are included.
- Isolated HTTP QA passed: unauthenticated inventory reads rejected; authenticated six-resource inventory; Green Net add-on model; same-resource block conflict; different-resource concurrent block; canonical walk-in conflict against a block; block release; pricing timing mutation rejected without authentication; legal session transition path and invalid-path rejection.
- Browser QA passed with disposable credentials: sign in, dashboard metrics/inventory, Facility CMS list, Facility configure/save/authoritative reload, and Blocks empty state. It also reproduced and verified the fixed authenticated-read defect.
- Android build verification is blocked locally, not passed: `npx cap sync android` requires Node.js >=22 while this environment is Node 20.20.2; direct `./gradlew assembleDebug` cannot start because `JAVA_HOME`/a JDK is unavailable. No dependency downgrade was made.
- PostgreSQL integration/concurrency was not independently executed because the configured remote PostgreSQL/Supabase endpoint remains unreachable in this environment (`EAI_AGAIN` in prior release-gate evidence). The SQLite implementation/tests pass, but PostgreSQL resource-lock behavior remains an environment-limited verification gate.

## FINAL VERDICT

**NOT READY**

The Phase 1 shell, data presentation, authorization hardening, lifecycle protection, and SQLite regression checks are materially improved and verified. It is not ready for Phase 2 because Admin walk-ins still trust a client-formatted amount instead of a server pricing result, and block/extension occupancy mutations are not yet serialized with conflict checking. Both defects can corrupt operational availability or booking/payment data under normal concurrent operation.

## Exact Next Implementation Step

Do **not** start Phase 2. First implement a small transactional Admin booking/operations hardening slice:

1. Build/use a server-authoritative pricing resolver for Admin walk-ins and return a persisted price snapshot; remove client-selected totals as an authority.
2. Put facility-block create and session-extension conflict/read/write paths inside `dbAsync.withTransaction` with the physical-resource lock used by canonical booking finalization.
3. Add SQLite and PostgreSQL-targeted concurrency regression coverage, then repeat browser and API QA.

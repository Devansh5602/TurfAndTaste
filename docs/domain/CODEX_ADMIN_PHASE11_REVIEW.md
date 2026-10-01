# Codex — Admin Phase 1.1 Final Release Review

**Reviewed candidate:** `e55a30d fix(admin): phase 1.1 hardening — server-authoritative pricing and transactional concurrency`
**Review scope:** Admin Phase 1.1 only. No Phase 2/Admin expansion was performed.
**Review date:** 2026-10-01

## APPROVED

- Admin walk-in creation no longer accepts browser-provided totals as persistence authority. The route independently calls the server resolver before invoking the canonical booking command. Disposable HTTP QA submitted a deliberately manipulated amount and confirmed the persisted amount matched the server quote instead.
- The canonical command enforces the inside-one-hour walk-in rule server-side. A disposable authenticated request using a token deposit inside that threshold was rejected; this is not UI-only enforcement.
- The six-resource inventory remains physically correct: two Box Cricket turfs, two Pickleball courts, one Skating Rink, and one Green Net. HTTP QA confirmed an ordinary Green Net booking conflicts with a Green Net booking carrying the Shooting Machine add-on.
- Facility-block creation now checks every active occupancy type in a transaction. The direct booking, block, extension, payment-finalization, and payment-hold paths use the same `booking_lock_<physicalFacilityId>` key where PostgreSQL advisory locking is available. Direct booking creation and holds are now wrapped in `withTransaction`, so SQLite uses `BEGIN IMMEDIATE` and PostgreSQL keeps the lock through the read/write sequence.
- Disposable HTTP QA verified: a same-resource booking/block race yields exactly one `201` and one controlled `409`; different resources can block concurrently; a block overlapping an existing booking is rejected; an adjacent block is allowed under half-open semantics; a concurrent extension yields exactly one success; and releasing the same block twice is safe.
- Session extension now reloads booking and session state after acquiring the resource lock, validates its 15-minute rule and session lifecycle under that lock, performs the occupancy check there, and writes adjustment plus booked end atomically. Validation errors retain their correct HTTP status instead of being incorrectly reported as `409`.
- Admin browser QA against a disposable SQLite backend verified sign-in, Dashboard → Walk-In, physical-resource selection, real typed customer details, server quote/full-payment presentation, successful counter confirmation, and the non-native in-app block-release modal. The old Admin `window.confirm` use is removed. Raw block IDs remain only secondary support metadata, never action text.
- `npm test` passed twice on isolated SQLite: **165 tests, 0 failures**. Server syntax checks, production build, and `git diff --check` passed.

## REQUIRED FIX

### Complete the pricing engine before Phase 2

`server/domain/pricing/pricingResolver.js` is server-side, but it is still a simplified legacy tier calculator rather than the documented pricing-engine boundary. It hard-codes ₹800/₹1200/₹400 fallbacks, treats the ambiguously named `deposit_pct` as a fixed rupee amount, prices only by start-time day/night and weekend percentage, and ignores facility-service/add-on pricing, special dates, multi-hour packages, interval-boundary pricing, and a persisted pricing snapshot. `POST /api/sessions/extend` also trusts the staff-supplied `chargePaise` rather than resolving or explicitly approving a configured extension-pricing result. These are data-integrity defects: the browser cannot override the current total, but the server still cannot faithfully price the documented configuration.

Implement one versioned, paise-only pricing-rule resolver with explicit deposit semantics and an immutable accepted-price snapshot. Use it for Admin quotes/finalization and chargeable extensions; retain explicit staff-authorized free extensions. Do not reintroduce client monetary authority.

### Reconcile legacy availability reads with transactional facility blocks

`GET /api/bookings/slots` still reads legacy `blocked_slots`, not active interval rows in `facility_blocks`. A block created by the Admin Phase 1 Operations UI can therefore be server-enforced during finalization while an older availability response incorrectly presents the interval as selectable. Migrate that endpoint to canonical interval/block conflict data, then retire the duplicate write path only after compatibility QA.

## MINOR ISSUE

- `src/pages/Profile.jsx` still uses `window.confirm`, but it is a customer profile reset action outside the Admin Phase 1 operational surface. It should be migrated to the application dialog pattern during the customer-profile work; no native dialog remains in `src/admin`.
- PostgreSQL advisory-lock behavior is source-reviewed but not executed against a reachable non-production PostgreSQL instance. Prior Supabase DNS evidence remains `EAI_AGAIN`; no remote PostgreSQL success is claimed.
- Android build verification remains toolchain-blocked: this host has Node `20.20.2` while Capacitor requires Node 22+, and no JDK is installed. No downgrade was made.

## FINAL VERDICT

**NOT READY**

The transaction and counter-flow defects identified in the prior Phase 1 review are corrected and locally verified, but pricing remains insufficiently authoritative for the documented configurable pricing contract and extensions. Resolve the two required pricing/availability integration items before beginning Admin Phase 2.

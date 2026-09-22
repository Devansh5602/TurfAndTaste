# Turf & Taste v2 — Implementation Progress

## Current stable state

- **Branch:** `feature/turf-and-taste-v2` (created from the existing `feature/mobile-app` work).
- **Architecture:** React 18/Vite single-page web app packaged through Capacitor, with an Express API and SQLite development fallback / PostgreSQL production path.
- **Existing stable capabilities:** public facility discovery, customer booking wizard, server-side overlap checks, pricing/timing administration, maintenance blocks, direct-UTR review flow, Razorpay signature verification path, admin booking operations, inquiries, and annual archive generation.
- **Latest checks before v2 work:** `npm run build`, server syntax checks, and diff validation passed in the prior QA cycle. Capacitor Android sync remains blocked locally because Capacitor 8 needs Node 22 while the available runtime is Node 20.

## Audit summary — 2026-09-22

### Current implementation strengths

| Area | Assessment |
| --- | --- |
| Shared booking API | Present; includes authenticated admin operations, blocked slots, overlap detection, payment-state protections, and timing/pricing endpoints. |
| Public customer flows | Present for discovery, booking, contact/inquiry, guest booking history, profile, and pricing. |
| Admin portal | Present for bookings, walk-ins, pricing, timings, inquiries, and annual archives. |
| Mobile shell | Capacitor configuration, Android, and iOS projects exist; web UI has a mobile bottom bar and safe-area tokens. |
| Security improvements | Admin routes use JWT middleware; public booking creation cannot claim paid/confirmed state; environment template exists. |

### P0/P1 findings and architectural gaps

1. **Customer booking history is not identity-verified.** Exact phone/email matching improves privacy versus partial search but does not meet the v2 requirement. It must move to account identity or a booking-reference + OTP verification flow.
2. **Facilities are still frontend-authoritative.** `src/data/facilitiesData.js` is the public source, while the database has only a minimal legacy facilities table. Facility CRUD, schedules, media, rules, amenity, enabled state, and configurable duration are missing.
3. **Booking price trust boundary is incomplete.** The backend accepts formatted amount data for public UPI review reservations instead of independently deriving a price from facility pricing and slot rules. This must be addressed as part of the pricing/booking-engine module.
4. **Legacy schema evolution remains embedded in startup code.** The first v2 migration is now versioned and reproducible, but legacy tables are still initialized during startup and will be progressively migrated without a destructive cutover.
5. **Admin authorization has a minimal role foundation.** Enabled `super_admin` and `manager` accounts are server-authorized on every protected request, but session revocation, password reset, granular permissions, and an audit log remain.
6. **Food stalls/menus, events, blogs, reviews, media upload, public policies, and complete customer auth are not implemented.**
7. **SEO is limited by the SPA architecture.** The public routes lack page-specific metadata, canonical/OG handling, sitemap, robots, and structured data.

### Product/UX findings

- The booking screen needs a targeted small-mobile layout correction: the progress stepper and sport filters can visually clip at narrow widths, and redundant discovery panels delay the first venue selection.
- Public content describes a sports/café offering, but food discovery is static and not vendor/menu driven.
- The current admin portal is operationally useful but mixes unrelated tasks in one large view; v2 should introduce modular navigation after core data modules are available.

## Requirement coverage matrix

| Capability | Current state | v2 disposition |
| --- | --- | --- |
| Booking, pricing, blocks, walk-ins | Exists but needs improvement | Module 4/5: preserve interfaces; make facility-driven and server-priced. |
| Admin login/change password | Partial | Module 2: RBAC foundation, reset/revoke/rate-limit design. |
| Facility CRUD and schedules | Missing | Module 3. |
| Food stalls, parlour, menus | Missing | Module 8. |
| Events | Missing | Module 9. |
| Blogs | Missing | Module 10. |
| Reviews/moderation | Missing | Module 11. |
| Customer account / secure history | Partial | Module 13, after Module 2. |
| Contact and inquiries | Exists but needs improvement | Module 12. |
| Admin dashboard/analytics/finance | Partial | Modules 14–15. |
| Annual archive | Exists but needs hardening | Module 16. |
| Mobile UX and Capacitor verification | Partial | Module 17. |
| Security/performance/SEO/media | Partial | Module 18, with security fixes pulled forward where required. |

## Module queue

| Module | Status | Next / dependency |
| --- | --- | --- |
| 0 — Repository Audit & Architecture | **QA VERIFIED** | Build and server syntax checks passed; target architecture and requirement coverage are documented. |
| 1 — Core Backend Foundation | **QA VERIFIED** | Versioned migrations, v2 response/validation helpers, explicit public/admin settings boundary, facility inventory foundation, and provider-neutral media metadata are verified in SQLite. |
| 2 — Authentication & Authorization | **QA VERIFIED** | Management login throttling, roles/disablement, session invalidation, password hardening, and focused server-side auth audit records are verified in SQLite. Customer accounts remain intentionally deferred. |
| 3 — Facility Management | **QA VERIFIED** | Protected CRUD, editable schedules, Admin UI, rich-content parity, and API-backed public discovery/detail readers are implemented. Booking/pricing migration is intentionally deferred to Module 4. |
| 4 — Pricing & Booking Engine | **QA VERIFIED** | Signed, short-lived, one-time server quotes are enforced for public bookings; authenticated walk-ins retain their existing flow. |
| 5 — Payments & Booking Pass | **QA VERIFIED (provider exception)** | Local safeguards and customer-safe passes are verified; successful live Razorpay capture/replay remains externally blocked. |
| 6–7 — Website / Facility Discovery | **QA VERIFIED (device exception)** | Managed public inventory is preferred with enriched safe fallbacks. Desktop route QA and source-level responsive review passed; a true 390px physical/emulator viewport pass remains externally tool-limited. |
| 8 — Food Court & Parlour | NOT STARTED | Depends on Module 1 media/content conventions. |
| 9 — Events CMS | NOT STARTED | Depends on Module 1. |
| 10 — Blog CMS | NOT STARTED | Depends on Module 1. |
| 11 — Ratings & Reviews | NOT STARTED | Depends on Module 2 and bookings. |
| 12 — Contact & Inquiry | PARTIAL | Improve after common API conventions. |
| 13 — Customer Account | PARTIAL | Depends on Module 2. |
| 14–16 — Admin, Analytics, Archives | PARTIAL | Extend only after data model modules are stable. |
| 17 — Mobile UX | PARTIAL | Fix targeted regressions now; full pass after customer modules. |
| 18 — Security, Performance & Hardening | IN PROGRESS (cross-cutting) | Immediate P0/P1 defects are pulled into foundation modules. |
| 19 — Final QA | NOT STARTED | Requires all product modules. |

## Active module and next safe task

**Active module:** Module 8 — Food Court & Parlour.

**Completed atomic slice:** Added `server/migrations/001_v2_foundation.js` and migration tracking in `server/db.js`. The additive `business_settings`, `facility_profiles`, and `facility_schedules` schema is safe alongside the legacy booking tables. SQLite application, repeat application, schema presence, syntax, diff validation, and the production web build passed on 2026-09-22. PostgreSQL runtime validation remains blocked by the unavailable endpoint; placeholders are translated to PostgreSQL's numbered form for migration bookkeeping.

**Completed vertical slice:** Added additive backfills for legacy facility records and the established pricing tiers, plus `GET /api/facilities` and `GET /api/facilities/:identifier`. Isolated API QA confirmed five active bookable facilities, identifier lookup, and `404` behavior. The existing static frontend dataset remains in place deliberately; it has richer copy and images than the current backend model, so swapping it before admin content editing would degrade the public experience.

**Completed API/settings slice:** Established additive `/api/v2` response helpers (`{ success, data?, error?, details? }`) and the first explicit public/admin settings boundary. `GET /api/v2/settings/public` exposes only allowlisted public settings; `PUT /api/v2/settings/public/public_contact` requires an admin JWT and validates bounded object data. Isolated API QA verified public read, anonymous `401`, authenticated write, and persisted readback. Existing routes retain their contracts while consumers migrate.

**Completed media/persistence slice:** Added versioned `media_assets` metadata storage with owner, provider/key, public URL, alt text, dimensions, order, and JSON metadata. It intentionally stores no image binary and does not simulate an upload provider that is not configured. Isolated SQLite QA confirmed all four migrations apply once, repeat safely, and create the media table. The existing `dbAsync` abstraction intentionally supports application query paths rather than SQLite `PRAGMA` metadata reads; schema QA uses a standard `SELECT` against `sqlite_master`.

**Completed Module 3 API slice:** `POST /api/facilities` and `PUT /api/facilities/:identifier` now require the existing admin JWT, validate facility data and weekly schedules, and save profile + schedule replacement through a cross-database transaction. Public detail responses include the facility’s schedule. Schedule times use minutes from midnight, support overnight windows, reject duplicate weekday entries, and remain administrator-owned rather than enforcing a fixed opening-hours rule. Isolated QA verified anonymous `401`, create, invalid schedule `400`, update/replacement, and public readback.

**Completed Admin integration slice:** Added a dedicated Facilities tab in the authenticated Admin portal. It loads the protected facility inventory, supports creating/editing profile fields, and uses simple per-day schedule controls with overnight support. Public inventory now excludes draft/inactive records without accepting an untrusted query flag; the protected management list contains all statuses. Build and isolated API QA verified the client contract, public draft exclusion, and anonymous management-list `401`.

**Completed content-parity slice:** Migration `005_backfill_rich_facility_content` imports the seven established facility records into the managed model, including public descriptions, images, rules, highlights, and rich legacy metadata. It seeds seven editable schedule rows per facility (sports: 6:00–6:00; dining: 7:00–23:00) only when no row exists; those are defaults, not hard-coded policy. Dining is correctly non-bookable. The migration fills only empty legacy descriptions and preserves administrator-authored rich records. Isolated SQLite QA confirmed all records, schedules, repeat safety, and preservation behavior.

**Completed public discovery slice:** The Facilities page now fetches managed public facilities and overlays their authoritative profile fields/content over the established UI presentation. It retains the static dataset as a deliberate API-failure fallback, preserving a usable discovery experience offline or when the backend is unavailable. API metadata now travels in public facility responses for this read-only migration. Booking and pricing consumers were intentionally not changed.

**Completed public detail slice:** Facility Detail now reads the managed public inventory with the same presentation-preserving fallback for known legacy facilities. It respects a managed facility’s `bookingEnabled` state and presents a real unavailable/not-found experience for an unknown public slug rather than substituting another venue. The router no longer limits detail routes to the static array, so newly created active facilities can be addressed when their managed content is ready.

**Completed discovery reconciliation slice:** Facility Detail no longer turns a known static fallback venue into a false 404 when the managed-inventory API is unavailable; only a successful authoritative response can establish an unknown slug. Facilities group badges now derive their counts from the managed public inventory rather than fixed legacy values, preventing drift as administrators add, activate, or retire venues.

**Completed Home/Inquiry inventory slice:** Home now derives its inventory count, hero links, bookable quick-play availability, and dining cards from the managed public facility list when it is available, retaining enriched static copy/images as the safe outage fallback. Inquiry’s facility selector and preselected-facility validation now use only active, bookable managed sport facilities, with the same fallback behavior. No booking, quote, payment, or pricing contract was changed.

**Completed public schedule-language fix:** The focused UI review found stale claims of 24-hour sports operation and fixed dining hours, even though facilities own administrator-configurable schedules. Home, reusable facility cards, and dining detail now direct customers to current venue details instead of presenting hard-coded operational windows. This preserves schedule authority and avoids misleading availability claims.

**Completed fallback-detail regression fix:** Public route QA found that a static sport fallback without a managed `bookingEnabled` field could render the dining/walk-in branch during an API outage. Facility Detail now derives the legacy default from category, preserving the Book This Facility and event-inquiry CTAs for sports while retaining dining behavior for dining venues.

**Completed Modules 6–7 route/UI QA gate:** Desktop interactive review covered Home, Facilities, a valid and invalid Facility Detail URL, Pricing, Inquiry, Contact, About, primary navigation, and booking-entry CTAs with the public API unavailable. Managed-inventory fallbacks remained usable; inactive/draft visibility remains server-filtered; the unknown-detail recovery state now renders instead of loading indefinitely. The review removed remaining public fixed/24-hour operating-hour claims from Pricing, Booking, Facility Detail, and contact/footer content. CSS/source inspection found public layouts use the existing responsive grids, wrapping controls, and small-screen breakpoints without a new hard-width/overflow defect. Accessibility snapshots confirmed named navigation, meaningful CTA labels, and semantic headings/forms. A true 390px physical/device-emulator viewport was not available in this environment and is explicitly deferred; it was not claimed as executed.

**Next safe task:** Begin Module 8 with an additive, protected food-stall/menu persistence and API vertical slice, preserving the existing static food presentation until managed-content parity is verified.

**Completed login-throttling slice:** Admin login now applies a process-local, username-plus-IP keyed 15-minute/8-attempt throttle with `429` and `Retry-After` feedback. Successful login clears the relevant failure state, avoiding normal-user lockout. It applies only to management login, leaves JWT verification untouched, and is isolated behind a middleware factory suitable for replacing its in-memory store with a shared implementation later. Isolated QA confirmed throttling, identity isolation, reset-on-success, and normal authenticated endpoint access.

**Completed role/disablement slice:** Migration `008_admin_roles` safely backfills existing administrators as enabled `super_admin` accounts and introduces the expandable `manager` role. Every management JWT now resolves the authoritative account row, rejecting disabled or unsupported-role accounts even where a token was issued before the account changed. A small super-admin-only enable/disable endpoint protects against self-disablement and removing the final enabled super administrator. Disposable HTTP QA verified account backfill, enabled login, disabled-login rejection, old-token rejection, protected-route enforcement, manager escalation rejection, re-enablement, and fail-closed unknown roles.

**Completed session-invalidation slice:** Migration `009_admin_session_versions` adds an additive per-admin session version. New JWTs include that version and protected middleware compares it to the authoritative account on every request; pre-existing versionless JWTs remain compatible at version zero until an account security event. Enablement changes and password changes atomically increment the version, invalidating every prior token without a global blacklist. Disposable HTTP QA verified old-token rejection after disablement, non-revival after re-enablement, and password-change invalidation with old-password rejection/new-password login.

**Completed password-hardening slice:** The management login and password-change path now uses safe comparison for legacy plaintext seed records, then upgrades them to bcrypt on successful login. New passwords must be 10–128 characters and differ from the current password; password hashes use bcrypt cost 12. Password-change session invalidation remains in force. Disposable HTTP QA verified legacy sign-in/hash upgrade, weak/reused-password rejection, password change, old-token revocation, old-password rejection, and new-password login.

**Completed auth-audit slice / Module 2 gate:** Migration `010_admin_auth_audit` creates a small, indexed server-side event trail for management authentication actions. It records only actor/target identifiers, action, outcome, timestamp, and allowlisted non-sensitive metadata. Login success, throttling, account enablement, role changes, password changes, and explicit session revocation are covered; audit-storage failures are logged server-side but do not turn ordinary management operations into outages. Isolated HTTP QA verified every required event and confirmed persisted rows contain no passwords, hashes, JWT fragments, or request payloads. Module 2’s planned management-security foundation is QA verified; customer authentication remains deliberately deferred to Module 13.

**Completed payment-order slice:** `POST /api/payments/create-order` now requires a verified signed quote token and derives the gateway order amount from its server-authoritative deposit or total; browser `amount` is ignored. The Booking UI supplies the quote token and uses the backend-returned order amount. Existing UPI review behavior is unchanged. Build, server syntax, and diff validation passed.

**Completed order-context slice:** Payment orders now persist the quote ID, booking reference, expected amount, payment mode, and signed quote context server-side for both live Razorpay and fallback orders. Isolated QA verified that browser `amount: 1` produced a ₹200 signed-deposit order, while a missing quote was rejected (`400`).

**Completed verification binding slice:** Razorpay verification now loads the persisted order, rejects non-created/mismatched booking context, validates a constant-time signature, fetches the provider payment to confirm its order ID and exact server-derived paise amount, and atomically records payment, quote redemption, order state, and confirmed booking. Browser amount/status/context cannot select the booking price or state. Live payment capture QA remains credential/provider dependent.

**Completed customer pass slice:** The Booking confirmation pass now clearly distinguishes `Payment Review` from verified confirmation, presents booking reference/facility/date/slot/payment mode/total/paid-or-review amount/balance, and limits customer identity to the booked-for name. It no longer exposes a gateway payment identifier or phone number. The existing print action remains available through the browser’s reliable native print flow; no fake download/share or QR mechanism was added.

**Completed local Module 5 regression:** An invalid UPI reference returns `400` without consuming its quote, allowing a retry. A subsequent valid UPI reference stores the signed server deposit but remains `Pending verification` / `Payment Review` even when the browser submits paid/confirmed fields. Local syntax, build, and diff checks pass. A genuine successful Razorpay test capture is still required to exercise provider fetch/signature success and callback replay against Razorpay; it is not simulated or marked complete.

**Completed Module 4 quote slice:** Added `POST /api/v2/quotes`, which validates an active bookable facility, its day-specific schedule, reservation conflicts, maintenance blocks, pricing configuration, duration, and applicable weekend surcharge before returning a server-derived total and deposit. The endpoint is additive; legacy pricing and booking contracts remain unchanged. Isolated QA verified a valid configured quote, non-bookable dining rejection (`404`), and out-of-schedule rejection (`409`).

**Completed Booking quote integration slice:** Booking requests a new quote after every facility/date/slot change, displays the server-derived total, computes deposit/full payment from that response, and prevents progressing to payment or submitting a reservation without a current successful quote. The legacy booking submission endpoint remains in place, with quote context attached for the next server-enforcement slice. Production build and diff validation passed.

**Completed quote enforcement slice:** Public booking creation now requires a signed quote token carrying facility/date/slot/duration/pricing context and a short expiry. The server rejects expired, invalid, modified-context, or reused tokens; records quote redemption atomically with the reservation; and derives the stored amount exclusively from the verified quote. Authenticated walk-ins retain their existing amount behavior. Isolated QA verified valid redemption, ignored browser amount, reuse rejection, and context-tampering rejection.

## External configuration / known blockers

- PostgreSQL/Supabase endpoint is unavailable from the local QA environment; SQLite is used for isolated integration testing.
- Razorpay production keys, webhook secret, SMTP, object storage, and customer OTP provider are not configured. Their flows must remain accurately marked as unconfigured until credentials exist.
- Capacitor 8 Android sync requires Node.js 22 or newer; local Node.js is 20.20.2.

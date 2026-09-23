# Turf & Taste v2 — Implementation Progress

## Current stable state

- **Branch:** `feature/turf-and-taste-v2` (created from the existing `feature/mobile-app` work).
- **Architecture:** React 18/Vite single-page web app packaged through Capacitor, with an Express API and SQLite development fallback / PostgreSQL production path.
- **Existing stable capabilities:** public facility discovery, customer booking wizard, server-side overlap checks, pricing/timing administration, maintenance blocks, direct-UTR review flow, Razorpay signature verification path, admin booking operations, inquiries, and annual archive generation.
- **Latest checks before v2 work:** `npm run build`, server syntax checks, and diff validation passed in the prior QA cycle. Capacitor Android sync remains blocked locally because Capacitor 8 needs Node 22 while the available runtime is Node 20.

## Android / clean-install stabilization — 2026-09-23

- A physical Android test at approximately **384 × 832 CSS pixels** reported a payment failure that parsed an HTML/DOCTYPE response as JSON. The authoritative branch trace found that a bundled Capacitor app without `VITE_API_URL` falls back to relative `/api`; Vite's web-only proxy is absent inside the WebView, so that request can resolve to the app shell rather than Express.
- The API client now rejects an unconfigured native API endpoint before making a relative request and detects non-JSON/malformed JSON responses with a safe endpoint/status diagnostic. Android/iOS builds must set a device-reachable `VITE_API_URL` (HTTPS for deployed builds) before `cap:sync`; no secret is exposed through Vite variables.
- Razorpay checkout now uses only the publishable key returned by the server-created order. The former simulated order/key fallback was removed: an unconfigured gateway returns `503`, while manual UPI remains a separate `Payment Review` flow. Isolated QA created a real Razorpay **test** order from a signed quote (₹200 deposit) and verified an invalid signature returns `400` before booking confirmation. A successful provider capture/callback/replay still requires a real test-gateway completion and is not claimed here.
- A clean browser session at the mandatory 384 × 832 viewport no longer shows a seeded `Player`/`Member` identity. The Profile route is explicitly device-local **booking details**, not a login; guest booking is supported, while registration, login, logout, session restoration, customer profile sync, and identity-protected history remain unimplemented **Module 13** work. The legacy phone/email lookup is not an authentication boundary.
- Focused browser viewport QA at 384 × 832 found and fixed a clipped booking-stepper label. The active step remains named while the numbered sequence stays visible on narrow screens. Home, Facilities, valid/invalid Facility Detail, Booking, Inquiry, Pricing, Contact, About, My Bookings, and guest details were exercised with no document-level horizontal overflow. This is browser viewport evidence only; it is not a replacement for a rebuilt physical Android regression run.

## Mobile booking production-readiness — active

- Reviewed work from `fix/android-booking-ux-device-qa` was selectively integrated into the authoritative branch. Mobile booking controls, styled session filters, and the docked action treatment were retained; global Android cleartext/mixed-content allowances and an unrelated database connection rewrite were rejected.
- Live availability is now a hard integrity boundary. A failed request produces a recovery state with no locally generated selectable slots, invalidates downstream slot/quote state, and prevents Step 3 progression. Quote confirmation has explicit requesting/success/error states, cancellation, stale-response protection, a 15-second timeout, and retry—there is no infinite “confirming server price” path.
- The server now computes availability from managed facility schedules and `Asia/Kolkata` venue time (configurable via `VENUE_TIME_ZONE`). Past dates, already-started current-day slots, inactive facilities, closed days, maintenance, bookings, and slots extending after closing are excluded/rejected independently of the client. This does not add a new lead-time policy.
- Isolated SQLite API QA verified future availability and past-slot quote rejection; server syntax, production build, and `git diff --check` pass. Physical Android re-verification remains pending a Node 22+ Capacitor build with an explicit reachable HTTPS `VITE_API_URL`; no physical-device or Razorpay-success claim is made for this slice.
- Browser regression at 360×800, 384×832, and 412×860 found no document overflow. The offline booking state presents a recovery action and disables continuation rather than exposing stale inventory; light-theme token inspection confirms the session controls and docked action surface use light semantic values. Device-native keyboard, safe-area and payment execution still require the rebuilt APK gate.
- Native configuration audit found stale global cleartext traffic in the Android manifest despite the root Capacitor config requiring HTTPS. The manifest now follows the secure source configuration; ignored generated Capacitor assets will be recreated during the Node 22+ sync. The next APK must bake a reachable HTTPS `VITE_API_URL`, never `localhost` or a LAN-only address.

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
| 8 — Food Court & Parlour | IN PROGRESS | Additive shared stall/menu schema is migration-verified; protected APIs are next. |
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

**Completed Module 8 foundation slice:** Migration `011_food_menu_foundation` establishes one additive merchant/menu schema for food stalls and the convenience parlour (`stall_type`), with common categories and menu items. It uses stable IDs/slugs, draft/active status, images, hours/contact/metadata JSON, display ordering, availability/featured/dietary flags, and integer paise pricing. It creates no ordering flow and does not alter public dining presentation. Isolated SQLite first-apply and repeat-apply checks passed; next is protected stall/category/item CRUD and public read contracts.

**Completed Module 8 API slice:** Added protected stall, category, and item create/update endpoints under `/api/v2/food/admin`, plus public active-only stall list/detail reads. Public detail allowlists only active categories and active/available menu items; draft and inactive stalls return 404. The management model retains shared `food`/`parlour` types, validates identifiers, status, dietary type, ordering, category ownership, and integer-paise prices, and reports duplicate keys as `409`. Static dining UI remains unchanged. Disposable SQLite HTTP QA on an automatically assigned loopback port verified anonymous `401`, normal food and parlour creation, category/item persistence, paise price preservation, draft exclusion, public allowlisting, and missing-stall `404`, alongside syntax/build/diff checks. Next: Admin food-management UI.

**Completed Module 8 Admin Food UI slice:** The authenticated Admin portal now has a compact Food & Parlour tab backed only by the protected food APIs. It supports creating and editing shared food/parlour stalls, visibility/status, descriptions, ordering, categories, and items; prices are entered as rupees and submitted as paise. Existing category/item edit affordances reload the authoritative response after every successful mutation, while API failures remain visible and never optimistically mutate the display. Disposable browser QA verified login, empty state, food and parlour states, stall/category/item saves, category reassignment, ₹63.25 → 6325-paise persistence, dietary, availability, featured, and inactive/draft reload behavior.

**Completed Module 8 dining content backfill slice:** Migration `012_backfill_dining_content` seeds/backfills managed food and parlour content from the established static dining records in `src/data/facilitiesData.js` into the shared merchant model (`food_stalls`, `food_menu_categories`, `food_menu_items`). It seeds 2 stalls (`cafe` with `stall_type: 'food'` and `snack-parlours` with `stall_type: 'parlour'`), 6 categories (3 per stall), and 15 menu items with integer-paise pricing (for example, ₹120 → 12000 paise, ₹99 → 9900 paise, ₹320 → 32000 paise), rich copy, specs, highlights, operating hours, dietary classifications (`veg`, `vegan`), and featured/available flags. Its conflict guards do not overwrite an existing stall, category, or item, including an existing slug with another identifier. Independent disposable SQLite QA verified fresh seed counts, repeat application without duplicates, and preservation of an intentionally edited café record; active-only public reads hid an inactive parlour and returned `404` for its detail. PostgreSQL boolean/query compatibility was source-reviewed, but runtime validation remains blocked by the unavailable non-production PostgreSQL endpoint. Static frontend records remain in place as an outage fallback; public UI migration is deferred to the next slice.

**Next safe task:** Connect the public Food Court and Parlour UI to the managed `/api/v2/food` public APIs with resilient static fallbacks, without introducing online ordering, cart, or checkout.

**Completed Module 8 public dining-detail slice:** The existing Café and Quick-Bite Snack Parlours detail routes now use the allowlisted public `/api/v2/food/:identifier` response for current menu categories/items, integer-paise prices, dietary labels, featured state, managed ordering, and venue hours. The rich static facility presentation remains visible immediately and is retained when the food API is unavailable or the food stall is no longer public; no admin-only food fields, cart, checkout, or ordering flow were introduced. The public JSON helper now preserves explicitly expected array values, fixing the persisted `operatingHours` array that had been incorrectly omitted from a public food response. Disposable SQLite API/browser QA covered the active café and parlour menus, public-field allowlisting, managed hours, and inactive-parlour static fallback. The customer surface was measured without document overflow at 384×832 (café managed menu), 360×800 (parlour managed menu), and 412×860 (parlour fallback). This is browser viewport QA, not physical Android verification.

**Next safe task:** Reconcile Home and Facilities dining discovery cards with the active managed `/api/v2/food` list while keeping their enriched facility fallback; do not add food ordering or change booking/payment behavior.

**Completed Module 8 public dining-discovery slice:** Home and Facilities now replace only their dining-card subset with a successful active-only `/api/v2/food` list. This prevents draft/inactive managed stalls from surviving through stale static facility records, avoids duplicate cards by matching IDs/slugs, preserves routes into the existing detail/menu page, and retains rich static imagery/copy/specification fallback whenever the food API is unavailable. Managed records contribute their name, description, cover image, ordering and safe presentation metadata; legacy data fills only fields the managed response does not yet model. Sports, booking, pricing, payments and authentication are unchanged. Browser QA with an intentionally inactive disposable parlour confirmed only the active café card remains at 384×832 Home and 360×800 Facilities, with no document-width overflow; the café card navigates to `/facilities/cafe`. A separate frontend configured with an unreachable API confirmed both static dining cards and their detail routes remain available at 412px Home and desktop Facilities, also without horizontal overflow.

**Next safe task:** Perform focused public Food Court responsive/empty-state review before marking Module 8’s public migration QA verified.

**Module 8 public QA closure:** A managed stall with no public/available items now receives an explicit walk-in menu-updating state and contact recovery action rather than an ambiguous blank area; the API-outage path retains the richer static presentation. The active/inactive discovery, managed detail, paise prices, dietary/featured labels, operating hours, allowlisted responses, static fallback, and responsive widths have been verified in disposable browser/API QA. **Module 8 is QA VERIFIED for locally testable web behavior.** PostgreSQL runtime remains source-reviewed only. Android Razorpay physical-device verification is a separate pending Module 5 gate and is not implied by this status.

**Next safe task:** Module 9 — Events CMS foundation, beginning with additive event persistence and protected management APIs. Its Module 1 and management-auth dependencies are already QA verified; no customer-auth, payment, or destructive migration dependency is required for the foundation slice.

**Module 9 current state:** Additive unseeded migration `013_events_foundation` and initial protected/public event routes are committed. Migration apply/reapply and anonymous/public-empty HTTP checks pass. Authenticated disposable event creation currently returns `500`; route-layer diagnosis remains the exact next task. No production event data was created.

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

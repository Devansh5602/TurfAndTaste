# Turf & Taste QA Handoff

## Active objective

Complete a whole-platform mobile-first UI, UX, workflow, and shared API QA cycle. Fix verified findings without regressing web or Capacitor clients.

## v2 rebuild continuation

- The governing scope is the latest master rebuild requirement. Detailed status, dependencies, and the module queue live in `docs/IMPLEMENTATION_PROGRESS.md`; the repository remains the source of truth.
- **Module 1 is in progress.** Its first stable slice introduced tracked v2 migrations plus additive `business_settings`, `facility_profiles`, and `facility_schedules` tables without changing legacy booking contracts.
- The current vertical API slice exposes a safe backend inventory at `GET /api/facilities` and `GET /api/facilities/:identifier`, populated from legacy facilities or, for SQLite development, the seeded pricing tiers. Public UI remains on its richer static dataset until facility content administration is implemented.
- V2 response conventions are now available through `server/utils/api.js`. The first public/admin setting boundary is `GET /api/v2/settings/public` and protected `PUT /api/v2/settings/public/public_contact`; isolated QA verified public reads, anonymous rejection, authenticated persistence, and readback.
- **Module 1 is QA verified.** Migration `004_media_assets` defines provider-neutral media metadata (never file binaries). All four v2 migrations are additive, idempotent in isolated SQLite QA, and legacy booking contracts remain unchanged. The next safe module is Facility Management, using the existing admin JWT only for its protected management endpoints; broader RBAC/customer identity is not yet a dependency.
- **Module 3 is in progress.** Facility management now has protected profile create/update and transactional weekly schedules. Isolated QA on 2026-09-22 verified anonymous `401`, valid create, duplicate-day schedule `400`, atomic schedule replacement, and public readback. Time values are minutes from midnight; overnight schedules are supported and no hours are hard-coded as business rules.
- Admin now has a dedicated Facilities tab backed by the protected inventory API, including profile and weekly-schedule editing. Public inventory no longer exposes drafts via a query parameter; isolated QA verified public draft exclusion, authenticated admin visibility, and anonymous admin-list `401`.
- Verified on 2026-09-22: server syntax, a clean isolated SQLite application and repeat application of migration `001_v2_foundation`, `npm run build`, and `git diff --check`.
- PostgreSQL runtime execution remains environment-blocked because the configured endpoint is unreachable. The migration runner translates its bookkeeping placeholders for PostgreSQL; validate it against a reachable non-production database before production deployment.

## Completed in the current cycle

- Booking now requests live availability whenever facility, date, or duration changes.
- The API and server reject overlapping booking intervals, not just identical labels.
- Maintenance slots are non-selectable and have accessible status text.
- Direct UPI records a reference for staff review; it no longer claims automatic payment verification.
- Admin access validates a JWT; hard-coded browser credentials and privileged API gaps were removed.
- Build and server syntax checks passed. Local API checks verified public slots, protected management endpoints, and rejection of unconfigured gateway verification.
- Home discovery now derives hourly rates from the live pricing store and lists all seven facilities, including both dining offerings. It no longer promises a universal ₹200 deposit.
- Contact and group inquiry submissions now preserve the user's form and show an error if the server rejects or cannot receive the request; they no longer report simulated success.
- Customer booking history is now retrieved through the customer-history endpoint with a full 10-digit mobile number, rather than attempting a management endpoint or reading a potentially stale browser-wide booking cache. The API rejects partial phone searches, and Profile uses this same customer-scoped history for totals and receipts.
- Dining cards no longer label menu prices as hourly rates.
- Invalid facility-detail URLs now use the intended 404 experience instead of silently displaying Box Cricket. Customer-facing facility-rate language no longer exposes implementation terminology.
- Booking-status updates now accept only the four supported lifecycle states and return an error when the booking does not exist. SQLite now supports an explicit `SQLITE_DB_PATH`, allowing isolated integration QA without touching project data.
- Facilities now obtain sports rates from the same live pricing store as Booking and Pricing. The previously displayed sports/café hours were aligned with the then-current seed schedule only; they are not a business rule. Operating windows and slot durations must become administrator-configurable per facility, with the current values retained only as defaults until that migration is complete.
- The backend now backfills all five standard pricing tiers, including Cricket Practice Nets, and safely adds missing SQLite `details_json` metadata without overwriting saved administrator pricing. Token deposits now remain correct per facility across the API, customer UI, and admin UI.
- Management mutations no longer silently update browser state when server calls fail. Booking status, delete, pricing, and timings operations report server errors instead. A protected booking-delete endpoint was added with not-found handling.
- Public reservation creation can no longer forge `Paid` or `Confirmed` state from browser-provided fields. Public UPI submissions require a reference and are stored as `Payment Review` / `Pending verification`; authenticated staff retain the counter walk-in flow, and Razorpay verification remains the only path that marks a payment paid and a booking confirmed.
- Booking dates now reject impossible calendar dates, and only the advertised 6–9 PM slots are labelled `fast-filling`; overnight availability remains bookable without misleading scarcity messaging.
- Customer payment language now accurately distinguishes manual UPI staff review from gateway-verified confirmation. Contact phone, WhatsApp, and email details are actionable mobile links, and customer-facing inquiry/roadmap labels no longer expose internal implementation or describe live flows as upcoming.
- The UPI confirmation pass now carries the same `Payment Review` state returned by the server and uses a review indicator rather than a success checkmark, avoiding a contradictory visual confirmation.

## Current QA findings to finish

1. Run a route-by-route responsive audit for `/`, `/facilities`, facility detail, `/pricing`, `/booking`, `/my-bookings`, `/profile`, `/contact`, `/inquiry`, `/about`, and `/admin` at small mobile and desktop widths.
2. Check every submit flow for loading, success, error, cancellation, and duplicate-submission states.
3. Verify authenticated admin workflows with configured non-production credentials and a disposable database if available.
4. Run Capacitor sync/build after Node.js is upgraded to 22 or later. Current environment is Node 20.20.2; Capacitor 8 refuses `npx cap copy android`.

## Environment notes

- The configured cloud PostgreSQL endpoint is unreachable from this environment.
- `server/data/turf_and_taste.db-wal` and `.db-shm` were modified only by local SQLite QA startup; do not include them in a product commit.
- Use `.env.example` as the configuration template. Never commit a real `.env`.
- A local isolated SQLite server was used for this QA pass with ephemeral environment values. API checks passed: invalid partial booking-history lookup returns `400`; full mobile lookup returns `200` with only the matching history; invalid inquiry payload returns `400`.
- `npm run build`, server syntax checks, and `git diff --check` passed after the latest edits. The local browser audit verified Home’s seven-item inventory, live-price discovery cards, booking-step validation, facility detail pricing, My Bookings empty/history affordance, Profile, Contact, Inquiry, About, and authenticated admin schedule/archive UI.
- Authenticated API QA was completed against `/tmp/turf-taste-qa-5001.db`: admin login/verification and protected bookings, inquiries, and archives routes returned `200`; anonymous booking-list access returned `401`; invalid/nonexistent booking status updates returned `400`/`404` respectively.
- The `ECONNREFUSED 127.0.0.1:5000` issue was confirmed as an environment process issue, not a proxy/configuration defect: Vite correctly proxies `/api` to port 5000, and health, pricing, and slot requests return `200` once `npm run backend` is running.
- Disposable admin UI QA against `/tmp/turf-taste-ui-qa.db` verified login, all five pricing tiers and deposits, the confirmation/save workflow, booking display, overlap rejection (`409`), customer history, status update, protected delete (`200`), and missing-delete handling (`404`). A second isolated local backend verified invalid-date rejection, staff walk-in creation, public-payment-state coercion, and prime-slot status behavior; all created QA bookings were deleted afterward.

## Next safe actions

1. The in-app browser currently cannot change viewport programmatically, so complete a physical/device-emulator 390px responsive visual check when such a viewport is available; source-level responsive breakpoints and desktop interactive route checks are complete.
2. Complete final regression in a deployment-like backend environment: configured payment gateway callback, browser back navigation, logout, and actual email/PDF archive dispatch. These require real gateway/email/storage configuration and must not be simulated.
3. Run Capacitor sync once Node is upgraded to 22+.

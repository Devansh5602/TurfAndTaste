# Curated Customer Mobile Handoff

## Current Checkpoint

- **Branch:** `feature/customer-mobile-curated`
- **Remote upstream:** `origin/feature/customer-mobile-curated` (synced & up-to-date)
- **Design source:** `/home/pc/www/POC/design-reference/customer-app-mobile.svg` (read-only)
- **Figma reference:** `yUBIZk5ptihZqROIobT6S4`, curated Customer App node `97:1417`
- **Admin Mobile Status:** PAUSED — strictly waiting for customer mobile real-device verification.

---

## Real-Device Correction Pass V2 (Functional QA & Usability Fixes)

### 1. New Defects Discovered from Real-Device Testing
1. **Guest Details Input Fields Failing To Accept Typed Values:**
   - On real mobile keyboards, typing into Guest Details inputs was either blocked or reset immediately on keystroke.
2. **Inconsistent / Contradictory Required & Optional Field Semantics:**
   - Form fields lacked clear required badges or displayed disconnected "Optional" text lines.
3. **Hard-coded / Stale Dates in Booking Step 2:**
   - Calendar rendered static fixture dates (e.g. Mon 22 .. Fri 26) instead of generating dynamic real calendar days.
4. **Non-functional Duration Choices:**
   - 1 hr, 1.5 hrs, and 2 hrs chips were static labels rather than real selectable booking duration controls.
5. **Bottom Navigation Inconsistency Across Routes:**
   - Bottom navigation items changed positions and labels depending on route (e.g., Home showing Venues while Dining showed Bookings in different slots).

---

### 2. Root Causes & Engineering Fixes

- **Guest Details Input Fields Root Cause & Fix:**
  - *Root Cause:* In `CustomerMobilePrototype.jsx`, a `useMemo` wrapped the main page rendering function but omitted `bookingDetails` from its dependency array. Whenever a keystroke triggered a state update, React re-rendered with the memoized stale closure where `bookingDetails` was `{ name: '', phone: '', email: '', note: '' }`, immediately resetting the input field back to empty.
  - *Fix:* Replaced the buggy page memoization with direct rendering. Added mobile-friendly input attributes (`inputMode="tel"`, `inputMode="email"`, `-webkit-user-select: text`, `autoComplete="name"`, `pointer-events: auto`).
- **Required & Optional Semantics Standardized:**
  - Added `.cm-required-badge` ("Required") to Full Name, WhatsApp / Mobile Number, and Password.
  - Added `.cm-optional-badge` ("Optional") to Email Address and Special Requests.
- **Dynamic Real-Time Date & Slot Scheduler (`bookingScheduler.js`):**
  - Created a civil time scheduler using `Asia/Kolkata` (IST, UTC+5:30) timezone.
  - `generateBookingDays(5)` generates dynamic monotonically increasing days starting with `Today` and `Tomorrow`.
  - Past dates and past slots today ($\le$ current IST time) are marked `past` and strictly disabled.
  - Facility operating schedule (6:00 AM to 11:00 PM / 1380m) enforced. Midnight rollover works continuously.
- **Interactive Duration Selection & Slot Invalidation:**
  - Implemented segmented duration buttons (`1 hr`, `1.5 hrs`, `2 hrs`).
  - Selecting a duration re-evaluates slot validity (slots exceeding the 11:00 PM close boundary become disabled with a badge `Closes 11 PM`).
  - Itemized pricing (`calculateBookingPricing`) recalculates base court total, deposit, GST (18%), and total payable dynamically, propagating to Step 4 Review & Pay.
- **Canonical Bottom Navigation Ordering:**
  - Enforced single canonical 5-item order across both prototype and comparison layouts:
    1. `Home` (`/`)
    2. `Venues` (`/facilities`)
    3. `Dining` (`/dining`)
    4. `Events` (`/events`)
    5. `Profile` (`/profile`)
  - Positions and labels remain invariant across all routes; only active styling changes.

---

## Test Suite & Build Verification

- **Automated Regression Suite (`npm test`):** 22/22 tests passing across 9 suites in ~270ms.
  - Verified dynamic IST date generation and monotonicity.
  - Verified past-slot blocking for Today and past dates.
  - Verified duration calculation (1h, 1.5h, 2h) and operating hour close boundaries.
  - Verified itemized pricing computation and deposit ratios.
  - Verified canonical bottom navigation order invariance.
  - Verified 5 authorized sports rule, progression gating, and auth form validations.
- **Production Web Build (`npm run build`):** Built cleanly in 6.02s (0 errors, 1884 modules).
- **Whitespace / Lint Checks (`git diff --check`):** Passed with 0 errors.
- **Capacitor Sync (`npx cap sync android`):** Synced web assets and native config cleanly.
- **Android Debug Build (`./gradlew assembleDebug`):** `BUILD SUCCESSFUL` in 8s.

---

## Native Android Build Artifact

- **Debug APK Location:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **File Size:** 12,556,185 bytes (~12.5 MB)
- **Package / Application ID:** `com.turfandtaste.app`
- **Compile SDK / Target SDK / Min SDK:** 36 / 36 / 24

---

## Completion & Verification Status

- [x] Guest Full Name accepts typed text.
- [x] Guest mobile accepts typed digits.
- [x] Email accepts typed text.
- [x] Required/optional labels are semantically correct.
- [x] Review Booking enables based on actual entered values.
- [x] Booking calendar uses current real dates.
- [x] Past dates cannot be selected.
- [x] Past slots today cannot be selected.
- [x] Duration 1 hr is selectable.
- [x] Duration 1.5 hrs is selectable.
- [x] Duration 2 hrs is selectable.
- [x] Duration changes recompute slot validity.
- [x] Slots are generated from schedule/availability logic rather than hard-coded demo times.
- [x] Step 2 Continue enables only with valid selection.
- [x] Home bottom nav is canonical.
- [x] Dining bottom nav has identical ordering.
- [x] Navigating to another tab never reorders navigation items.
- [x] Booking Steps 1–4 work through actual visible interactions.
- [x] Review screen contains the values entered earlier.
- [x] No fake status bar has returned.
- [x] Create Account remains visually fixed and accepts typing.
- [x] Tests validate actual interaction, not direct URLs.
- [x] Responsive QA passes.
- [x] Web build passes.
- [x] Android debug build passes.
- [x] New APK generated.

---

## Phase 3: Authoritative Platform Foundation & Admin-Preparation

### Status: Complete & Committed (Ready for Codex Audit)
- **Objective Achieved:** Formalized the complete product truth, data model, business rules, booking engine, physical facility conflict model, dynamic pricing, ground session operations, cancellation model (0% refund), RBAC matrix, campus dining architecture, and 13-module CMS specifications in permanent documentation and agent guardrails.
- **Strict Constraint Enforced:** Admin UI implementation has NOT been started. Awaiting Codex audit first.

### Key Architectural Documents Created (`docs/domain/`)
1. [`docs/domain/PROJECT_TRUTH.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/PROJECT_TRUTH.md) — Single Patan, Gujarat property truth; physical facility breakdown; anti-invention rules.
2. [`docs/domain/FACILITY_DOMAIN.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/FACILITY_DOMAIN.md) — Section/Category vs Physical Facility vs Service vs Add-on hierarchy; auto-naming + custom display names; 24/7 sports availability.
3. [`docs/domain/BOOKING_ENGINE.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/BOOKING_ENGINE.md) — 1h customer lead time; walk-in payment rules (full payment if <1h); standard (1h/2h on :00) vs custom (quarter-hour starts, whole-hour duration); terminal 0% refund cancellation; delivery preferences.
4. [`docs/domain/PRICING_ENGINE.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/PRICING_ENGINE.md) — Multi-tier pricing rules (floodlights, weekend surge, package offers, token deposits, extension charges).
5. [`docs/domain/SESSION_OPERATIONS.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/SESSION_OPERATIONS.md) — QR check-in; scheduled vs actual times; delay adjustments; next-booking protection.
6. [`docs/domain/PAYMENTS_AND_CANCELLATION.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/PAYMENTS_AND_CANCELLATION.md) — Razorpay/UPI options; temporary reservation holds; 0% refund cancellation policy.
7. [`docs/domain/RBAC.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/RBAC.md) — Permission-oriented matrix (Super Admin, Staff, Stall, Customer + dynamic custom roles).
8. [`docs/domain/DINING_AND_ORDERS.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/DINING_AND_ORDERS.md) — Multi-stall campus dining; customer table-number ordering IN SCOPE.
9. [`docs/domain/ADMIN_CMS.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/ADMIN_CMS.md) — 13 administrative modules specification.
10. [`docs/domain/STATE_MACHINES.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/STATE_MACHINES.md) — State machines for Booking, Payment, Session, Dining Order, and Content.
11. [`docs/domain/DATA_MODEL.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/DATA_MODEL.md) — Relational schema definitions for 25 core tables.
12. [`docs/domain/SCHEMA_MIGRATION_PLAN.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/SCHEMA_MIGRATION_PLAN.md) — 4-stage non-destructive migration roadmap.
13. [`docs/domain/CODE_IMPACT_MAP.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/CODE_IMPACT_MAP.md) — Codebase impact matrix & conflict audit.
14. [`docs/domain/OPEN_DECISIONS.md`](file:///home/pc/www/POC/TurfAndTaste/docs/domain/OPEN_DECISIONS.md) — 5 classified open decisions.

### Agent Guardrails & Skills Created
- [`AGENTS.md`](file:///home/pc/www/POC/TurfAndTaste/AGENTS.md) (Root mandatory instructions)
- `.agents/skills/` and `docs/ai/skills/`:
  - `turf-taste-domain`
  - `turf-taste-booking-engine`
  - `turf-taste-admin-cms`
  - `turf-taste-functional-qa`
  - `turf-taste-no-invention`

### Immediate Next Step:
Codex review and audit of the domain model and migration plan before initiating Admin UI development.

---

## Phase 4: Stage 0 Platform Foundation Implementation

### Status: Complete & Verified (Ready for Final Codex Review Before Admin UI)
- **Objective Achieved:** Implemented the complete technical foundation addressing all blockers from `docs/domain/CODEX_FOUNDATION_REVIEW.md`:
  1. Additive non-destructive migration `014_stage0_foundation` applied to Supabase PostgreSQL (and verified on SQLite).
  2. Canonical physical inventory (`prop_patan`, 2 sections, 6 physical facilities with stable UUIDs, services, and add-on mapping).
  3. Reclassified `ball-machine` as an add-on mapped to `fac_green_net_1`.
  4. Timezone-aware interval engine (`server/domain/time/bookingInterval.js`) with explicit `Asia/Kolkata` handling, half-open `[start, end)` semantics, and cross-midnight date rollover safety.
  5. Authoritative booking rules engine (`server/domain/booking/bookingRules.js`):
     - Quick 1h/2h on `:00` (1.5h rejected).
     - Custom quarter-hour starts (`:00`, `:15`, `:30`, `:45`) with whole-hour durations.
     - Customer 60-minute minimum lead-time enforced server-side.
     - Admin/staff immediate walk-in policy supported.
     - Next quick start rounding helper after partial-hour session ends.
  6. Physical resource conflict engine (`server/domain/booking/conflictEngine.js`) validating overlap against physical facilities, blocks, and holds. Multi-turf concurrency supported.
  7. Booking state machine (`server/domain/booking/bookingStateMachine.js`) enforcing that `CANCELLED` is strictly terminal. Soft-cancel preserves history; slot releases occupancy.
  8. Ground session operations (`server/domain/session/sessionOperations.js`) distinguishing scheduled vs actual timestamps and validating 15-minute extensions against subsequent bookings.
  9. Guest identity privacy (`server/domain/guest/guestPrivacy.js`): Hardened `GET /api/bookings/history` against unauthenticated harvesting.
  10. Granular RBAC engine (`server/domain/rbac/rbacEngine.js`) with 24 permission keys and default-deny middleware.
  11. Campus dining table-number ordering engine (`server/domain/dining/diningEngine.js`) with line-item calculations in paise and formal state machine.
  12. Preflight inspection tool (`server/scripts/preflightCheck.js`) and comprehensive audit reports (`docs/domain/STAGE0_SCHEMA_PREFLIGHT.md`, `docs/domain/STAGE0_IMPLEMENTATION_REPORT.md`).

### Test & Build Verification
- **Test Suite (`npm test`):** 55 / 55 tests passing across 19 test suites in ~186ms.
- **Production Web Build (`npm run build`):** Built cleanly in 3.69s (0 errors).
- **Whitespace / Lint Checks (`git diff --check`):** Passed with 0 errors.

### Next Step:
Independent Codex audit of Stage 0 foundation before beginning Admin UI generation. Admin UI remains strictly paused.

---
name: turf-and-taste-engineering
description: Use for Turf & Taste business analysis, product design, web/mobile/backend development, QA, debugging, architecture, and repository maintenance.
---

# Turf & Taste Master Engineering Skill

This skill defines the authoritative operating standards, architectural invariants, visual language, and verification requirements for engineering work across Turf & Taste.

---

## 1. Core Inviolable Project Truths

1. **Single Patan Campus:** Turf & Taste is ONE physical property located in **Patan, Gujarat, India**.
   - NEVER reintroduce external cities: Bopal, South Bopal, Ahmedabad.
   - NEVER invent external arena brand identities: "Skyline Sports Arena", "Club Oval".
2. **Current Physical Inventory:**
   - **Box Cricket:** Turf 1 (`fac_box_cricket_1`), Turf 2 (`fac_box_cricket_2`)
   - **Pickleball:** Court 1 (`fac_pickleball_1`), Court 2 (`fac_pickleball_2`)
   - **Skating:** Skating Rink (`fac_skating_1`)
   - **Cricket Green Net:** Practice Net (`fac_green_net_1`)
   - **Ball-Shooting Machine:** Optional paid add-on attached directly to Cricket Green Net (`fac_green_net_1`). It shares the same physical net resource; it is NOT a standalone court.
3. **Sports Operating Model:** Sports operate **24/7** conceptually, reduced only by active reservations, ground delays, and maintenance blocks (`facility_blocks`). No arbitrary 6 AM – 11 PM cutoff exists for sports.
4. **Booking Duration Model:**
   - **Quick Slots:** Strictly **1 Hour** and **2 Hours**.
   - **Custom Slots:** Start time on 15-minute boundaries (`:00`, `:15`, `:30`, `:45`). Minimum duration is 1 hour. Total duration is whole-hour based from start (e.g. `12:45 → 13:45`, `12:45 → 14:45`).
   - Standard 30-minute and 90-minute / 1.5-hour bookings are strictly prohibited.
5. **Cancellation Policy:** Customer or authorized staff can cancel. No cutoff. Strict **0% REFUND**. Cancellation is terminal (`status = 'Cancelled'`); inventory is immediately released.
6. **Dining Scope:** Customer dining is informational only (no food ordering, cart, or payment). Admin Dining CMS manages outlets and menu items.
7. **Precedence Hierarchy:** Product / Business Truth > Current Backend Architecture > Curated Design References (`ADMIN APP · Mobile`, `CUSTOMER APP · Mobile`) > Existing Implementation > Legacy Mockups (`LEGACY — DO NOT PROTOTYPE`). Product truth always outranks UI mockups.

---

## 2. Business Analyst Standard

When analyzing requirements, feature requests, or bug reports:
1. **Analyze by Persona & State:**
   - **Actors:** Guest Customer, Authenticated Patron, Ground Staff, Stall Staff, Super Admin.
   - **Trace Lifecycles:** Preconditions → Happy Path → Alternate Path → Failure Path → State Transition → Audit Logging.
2. **Decision Precedence:**
   - Always verify if a domain specification (`docs/domain/`, `docs/product/`) already resolves the requirement.
   - Never invent business rules, refund percentages, cancellation policies, or discount schedules.
   - Only escalate to the user if a genuine unresolved ambiguity affects money, booking conflict logic, data models, or destructive policy. Batch questions together.

---

## 3. UI/UX Designer Standard

1. **Design System & Palette (Clubhouse Ivory):**
   - Canvas: `#FAF9F6` (warm ivory)
   - Surfaces: `#FFFFFF` (cards, dialogs) with `#EAE8E4` borders
   - Primary Accent: `#0F3D2E` (deep clubhouse forest green)
   - Mint Highlight: `#A0F399`
   - Primary Text: `#1A1C1A` | Secondary Text: `#5A645E`
   - Danger: `#D92D20` | Warning: `#D97706`
2. **Operational Mobile-First Hierarchy:**
   - Admin UI must prioritize speed, touchability, scanning, and high contrast over decorative marketing hero banners.
   - Maintain stable bottom navigation (Tabs: `Dashboard`, `Bookings`, `Facilities`, `Operations`). The tab order must never reorder based on active route.
   - Secondary tools live in the slide-up **Operations Launchpad Drawer** to avoid horizontal tab clutter.
3. **Responsive Mobile Viewports:**
   - Explicitly harden UI for `360px`, `375px`, `390px`, `412px`, and `430px`.
   - Primary visual QA target: `390px`.
   - Max shell width: `480px` centered on larger displays.
4. **Zero Simulated Device Chrome:**
   - Never render artificial status bars (9:41, fake Wi-Fi, battery 100%, device notch) inside web views. Real OS safe-areas handle this.

---

## 4. Web Developer Standard

1. **Architecture & Framework:**
   - Single Page Application built with React 18 and Vite.
   - Strict separation: Client handles presentation, input capture, and UI validation. Server owns business logic and pricing calculations.
2. **Interactive Form Standards:**
   - Every form must bind to real state, allow free typing/editing without loss of focus, and validate required fields.
   - Zero native browser dialogs (`window.alert`, `window.confirm`, `window.prompt`). All confirmations use branded modal sheets.
   - Display human-readable names for resources (`Turf 1`, `Green Net`), never raw internal IDs (`fac_box_cricket_1`).
3. **Accessibility & Touch Usability:**
   - Minimum `44px` interactive touch targets for buttons, inputs, and chips.
   - Accessible ARIA labels on icon buttons and modals (`role="dialog"`, `aria-modal="true"`).

---

## 5. Mobile App Developer Standard

1. **Capacitor Integration:**
   - Wrapped via `@capacitor/core`, `@capacitor/app`, and `@capacitor/status-bar`.
   - Use CSS safe-area variables (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) for edge-to-edge layouts.
2. **Keyboard & Touch Behavior:**
   - Ensure sticky action bars and footers do not obscure active inputs when the virtual keyboard opens.
   - Scrollable containers must handle momentum scrolling (`-webkit-overflow-scrolling: touch`).
3. **Dependency Discipline:**
   - Never edit files in `node_modules/`.
   - Never downgrade Capacitor or Gradle dependencies to silence IDE lint tooling. Real Android builds are verified in dedicated JDK environments.

---

## 6. Backend Engineer Standard

1. **Canonical Services & Invariants:**
   - **Pricing Authority:** `server/domain/pricing/pricingResolver.js`. Evaluates base tariffs, floodlight night rates (after 6:00 PM), weekend surge %, packages, and add-ons. All financial calculations evaluate in integer paise (`₹1 = 100 paise`).
   - **Availability Authority:** `server/domain/booking/canonicalBookingCommand.js`. Checks `(start_at < existing_end) AND (end_at > existing_start)` against physical facility IDs.
   - **Immutable Snapshots:** Confirmed bookings and extensions persist immutable `pricing_snapshot` JSON blobs. Historical records never recalculate when rates change.
   - **Payment Concurrency & Idempotency:** Managed via `server/domain/booking/paymentFinalization.js`. Duplicate webhook or client finalizations return the existing booking safely.
2. **RBAC & Authorization:**
   - Enforced by `requirePermission(permissionKey)` middleware via `server/domain/rbac/rbacEngine.js`.
   - Zero role-name bypasses (`if role === 'super_admin'`). Permissions are loaded dynamically.
   - Session versioning (`session_version`) ensures immediate revocation on password change.
   - Dining stall staff tokens are strictly scoped to their assigned `stall_id`.
3. **Database & Migration Safety:**
   - Migrations in `server/migrations/` execute sequentially on startup.
   - New schema additions must be backward-compatible with existing SQLite and PostgreSQL tables.

---

## 7. QA & Release Engineer Standard

1. **Functional QA Invariants:**
   - Never mark a test or QA passed based solely on HTTP 200 or component mounting.
   - Forms must be tested with real typing, blurring, re-focusing, submitting, and verifying database persistence after page reload.
   - Destructive actions (cancellations, blocks, purges) must require explicit confirmation.
2. **Testing Lifecycle:**
   - Unit & domain regression: Run focused tests during development.
   - Milestone verification: Run the full test suite (`npm test`) across all 12 test suites. All 224+ tests must pass with 0 failures.
   - Production bundle: Verify `npm run build` succeeds cleanly before every commit.
   - Git hygiene: Run `git diff --check` to guarantee zero trailing whitespace or merge conflict markers.

---

## 8. Repository Hygiene Rules

Before committing or pushing:
1. **Remove Debug Logging:** Delete temporary `console.log`, test dumps, and print statements.
2. **Remove Unnecessary Comments:** Delete AI narration, obvious restatements, and temporary fix notes. Keep only comments explaining non-obvious business/security invariants.
3. **No Tracked Sidecars:** Ensure `*.db-wal`, `*.db-shm`, `.env`, and scratch dumps are ignored.
4. **Diff Check:** Run `git status --short` and `git diff --check`.

---

## 9. Strict "NEVER" Rules

- **NEVER** reintroduce Bopal, Ahmedabad, or Skyline Arena into production.
- **NEVER** allow the client to calculate, dictate, or trust financial amounts.
- **NEVER** create parallel pricing or availability calculators outside the canonical domain engines.
- **NEVER** use facility display names as conflict keys; always use physical IDs.
- **NEVER** bypass RBAC permissions using role-name string checks.
- **NEVER** render artificial status bar chrome (9:41, fake battery/Wi-Fi) inside web views.
- **NEVER** hardcode fixed 90-minute booking durations or 11 PM sports cutoffs.
- **NEVER** commit or expose production API keys, service credentials, or JWT secrets.
- **NEVER** use `git reset --hard` or force-push without explicit user authorization.

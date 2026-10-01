# Turf & Taste — Project Master Context (PROJECT_CONTEXT.md)

> **PRIMARY ARCHITECTURAL & PRODUCT TRUTH FOR ALL DEVELOPERS & AI AGENTS**  
> Read this document first before designing, modifying, or testing any part of the Turf & Taste repository.  
> **RULE OF PRECEDENCE:** Product & Business Truth > Hardened Backend Domain > Curated UI References > Existing Code > Legacy Mockups. Product truth always outranks obsolete UI mockups.

---

## 1. Product Summary
**Turf & Taste** is a premier single-property sports, recreation, and dining clubhouse destination located in **Patan, Gujarat, India**. It combines tournament-grade sports arenas (Box Cricket, Pickleball, Skating, and Practice Nets with an automated Ball-Shooting Machine) with social and gourmet dining experiences (Sports Café and Gourmet Parlour).

---

## 2. Location & Campus Truth
- **Single Physical Campus:** Turf & Taste operates on **one unified physical campus** in **Patan, Gujarat**.
- **❌ Strictly Prohibited:** NEVER re-introduce external cities (e.g. Bopal, South Bopal, Ahmedabad), fake multi-branch networks, or invented arena brands (e.g. "Skyline Sports Arena"). All facilities belong directly to the Patan campus.

---

## 3. Physical Resource Inventory
Current operational physical grounds and resources:

1. **Box Cricket:**
   - Turf 1 (`fac_box_cricket_1`)
   - Turf 2 (`fac_box_cricket_2`)
2. **Pickleball:**
   - Court 1 (`fac_pickleball_1`)
   - Court 2 (`fac_pickleball_2`)
3. **Skating:**
   - One Skating Rink (`fac_skating_1`)
4. **Cricket Green Net:**
   - One Practice Net (`fac_green_net_1`)
5. **Ball-Shooting Machine:**
   - **NOT** a standalone court or separate facility.
   - It is an optional paid add-on / service attached directly to Cricket Green Net (`fac_green_net_1`), sharing the identical physical space and conflict occupancy.

Future facilities are CMS-driven through database tables (`physical_facilities`, `facility_services`, `facility_addons`), not hardcoded in UI logic.

---

## 4. Operating Model & Availability
- **Sports Facilities:** Conceptually operate **24 hours, 7 days a week (24/7)**. Availability is reduced only by canonical occupancies (confirmed bookings, active sessions, approved extensions) and administrative maintenance/tournament blocks (`facility_blocks`). No arbitrary 6 AM – 11 PM limits exist for sports.
- **Dining Outlets:** Sports Café and Gourmet Parlour may operate with independent, configured opening hours.
- **Single Availability Authority:** Both Customer and Admin interfaces resolve availability strictly against `server/domain/booking/canonicalBookingCommand.js`. Legacy parallel slot-blocking tables are de-authoritized.

---

## 5. Booking Engine & Duration Rules
- **Lead Time:** Minimum 1-hour booking lead time required. Bookings starting within 1 hour (walk-ins or immediate slots) require **full payment** at counter.
- **Duration Model:**
  - **Quick Durations:** Strictly **1 Hour** and **2 Hours**.
  - **Custom Durations:** Start time selectable on 15-minute boundaries (`:00`, `:15`, `:30`, `:45`). Minimum duration is **1 hour**. Duration remains **whole-hour based** from the chosen start time (e.g., `12:45 → 13:45`, `12:45 → 14:45`).
  - **❌ Prohibited:** No 30-minute standard bookings. No 90-minute / 1.5-hour standard bookings.
- **Extensions:** Operational on-ground extensions are managed in **15-minute pro-rated increments** and require authorized Admin/Staff approval with re-verification against future occupancies.

---

## 6. Cancellation & Refund Policy
- **Cancellation Authority:** Both customers and authorized staff/admin may cancel reservations.
- **Cutoff Policy:** No strict cutoff policy currently imposed.
- **Refund Policy:** Strict **0% REFUND**. Cancellation is a terminal transition (`status = 'Cancelled'`).
- **Inventory Behavior:** Cancelling immediately and non-destructively releases future canonical occupancy for other players. Cancelled bookings can never be reverted back to Confirmed.

---

## 7. Pricing & Financial Authority
- **Single Server Authority:** Pricing is strictly server-authoritative via `server/domain/pricing/pricingResolver.js`. Client applications must never compute, override, or trust client-calculated amounts.
- **Multi-Tier Rules:** Supports base hourly tariffs, day rates, floodlight night rates (active from 6:00 PM IST onwards), weekend surge percentages, special holiday overrides, package offers, and facility add-on rates.
- **Immutable Pricing Snapshots:** Confirmed bookings and approved extensions persist an immutable, detailed snapshot (`pricing_snapshot`) recording base tariff, package discount, add-on amounts, and total paise. Historical reservations never change when current tariffs are edited.
- **Currency Invariant:** Financial transactions and snapshots evaluate in integer paise (`₹1 = 100 paise`) to prevent floating-point rounding errors.

---

## 8. Sessions & Ground Check-In Operations
- **Scheduled vs. Actual Intervals:** The scheduled reservation interval and the actual physical session interval are tracked separately in database records (`actual_start_at`, `actual_end_at`).
- **Late Start Handover:** Ground delays or late customer arrivals do not automatically shift or extend bookings. Handover adjustments are decided by authorized staff based on pitch availability.
- **QR Pass Flow:** Scanning a customer pass or looking up a booking displays full session details for verification. Scanning itself never triggers an irreversible state transition without explicit staff confirmation.

---

## 9. Dining & Orders Scope
- **Customer App:** Dining is strictly **informational and discovery-focused** (viewing outlets, ambiance, and menu highlights). There is **NO customer food ordering, cart, checkout, or food payment**.
- **Admin CMS:** Admin Dining CMS manages outlets (Sports Café, Gourmet Parlour), food categories, menu item descriptions, paise prices, and instant availability toggles.

---

## 10. Role-Based Access Control (RBAC) & Security
- **Permission Matrix:** Access control is strictly permission-oriented (e.g. `booking.create`, `booking.cancel`, `facility.block`, `pricing.manage`, `dining.stall.manage`).
- **Zero Role-Name Bypasses:** Code must never use `if (role === 'super_admin')` or `if (role === 'manager')` to bypass authorization. All route guards evaluate effective permissions dynamically through `server/domain/rbac/rbacEngine.js`.
- **Session Versioning:** Admin accounts enforce `session_version` revocation. Password updates or status changes immediately invalidate all outstanding JWTs.
- **Dining Tenancy Scoping:** Stall staff tokens are scoped strictly to their assigned `stall_id`.

---

## 11. Design System & Visual Guidelines
- **Authoritative Design References:**
  - `ADMIN APP · Mobile.png` / `ADMIN APP · Mobile.svg` (Primary Admin Visual Authority)
  - `CUSTOMER APP · Mobile.png` / `CUSTOMER APP · Mobile.svg` (Shared System Language)
  - `LEGACY — DO NOT PROTOTYPE` frames are obsolete and must be ignored.
- **Clubhouse Ivory Palette:**
  - Background Canvas: `#FAF9F6`
  - Cards & Surfaces: `#FFFFFF` with `#EAE8E4` subtle borders
  - Primary Accent: `#0F3D2E` (deep clubhouse forest green)
  - Mint Highlight: `#A0F399`
  - Primary Text: `#1A1C1A`
  - Secondary/Muted: `#5A645E`
- **Zero Fake Device Chrome:** Never render artificial status bars (9:41, fake Wi-Fi, battery 100%, simulated notch) inside web views. Real OS safe-areas provide these.
- **Mobile Responsive Widths:** Tested and verified across `360px`, `375px`, `390px`, `412px`, and `430px` viewports with zero horizontal scrolling.

---

## 12. Technical Stack & Architecture
- **Client Frontend:** React 18, Vite v6, Lucide icons, custom responsive CSS design tokens.
- **Mobile Wrappers:** Capacitor Android and iOS runtime wrappers (`@capacitor/core`, `@capacitor/app`, `@capacitor/status-bar`).
- **Backend Server:** Node.js, Express, JWT, SQLite (development/isolated testing) and Supabase PostgreSQL (cloud production).
- **Test Infrastructure:** Node.js native test runner (`node:test`) with dedicated temporary SQLite databases per run. 12 comprehensive test suites (224/224 passing).

---

## 13. Current Project State & Next Step
- **Current Branch:** `feature/turf-and-taste-admin-platform`
- **Admin Platform Status:** FUNCTIONALLY SUBSTANTIAL / IMPLEMENTATION COMPLETE CANDIDATE — FINAL FUNCTIONAL AND VISUAL VERIFICATION PENDING. Substantial Admin functional/domain implementation exists with extensive automated coverage (224/224 tests passing in previous checkpoints). Final independent end-to-end Admin verification, user acceptance, visual fidelity sign-off, and interactive form/navigation/CRUD/device QA remain pending.
- **Customer Mobile Status:** Functional prototype exists; full functional correction and UI redesign is queued for the **next phase** (after Admin acceptance).
- **Next Development Priority:**
  1. Perform one consolidated independent Admin verification
  2. Correct genuine Admin functional defects found
  3. Align Admin UI with the authoritative curated design
  4. Verify responsive/mobile interactions
  5. Only after Admin acceptance, proceed to Customer Mobile correction and UI alignment

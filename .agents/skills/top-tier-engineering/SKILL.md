---
name: top-tier-engineering
description: Comprehensive operating system and engineering standard for autonomous top-tier application engineering, UX design, product quality, mobile-first Android standards, and continuous audit-test-verify cycle for Turf & Taste.
---

# Top-Tier Application Engineering & Product Quality Operational Standard

## Purpose & Authority
This skill establishes the rigorous engineering, UX design, and product quality standard for the **Turf & Taste, Patan** multi-sport and dining platform across Web, Android (Capacitor), and mobile environments. It governs all development, architectural refinements, interaction designs, verification workflows, and regression audits.

---

## 1. Product & Domain Architecture
- **Multi-Activity Platform Identity**: Turf & Taste is not merely a single-sport facility; it is Patan's premier sports and dining ecosystem featuring:
  1. **Competitive Sports**: Box Cricket Arena (72ft turf, 500-lux floodlights), Pickleball Court (cushion court, USA Pickleball specs), Skating Rink (polyurethane circular speed track).
  2. **Performance Training**: Cricket Practice Nets (2 lanes, bowler run-up), Automated Bowling Machine (60–150 km/h programmable speeds & swing).
  3. **Player Dining & Refuel**: Turf & Taste Café & Snack Parlour Dugouts.
- **Mental Model Integrity**: A user must understand the full breadth of available inventory within 2–3 seconds of opening any platform touchpoint (Home, Venues, or Booking). No sport or service may be hidden or obscured.

---

## 2. Application Architecture & Data Flow
- **Single Source of Truth**: Facility inventory derives strictly from `src/data/facilitiesData.js`. Dynamic rates, open hours, and bookings sync through `adminStore.js` with PostgreSQL backend fallback to local storage.
- **Service Layer Separation**:
  - `bookingService.js`: Time-slot generation, concurrency locking, validation, pricing computation (day ₹600 / night ₹800 logic).
  - `paymentService.js`: Hybrid payments supporting direct UPI with UTR transaction verification and Razorpay Checkout gateway integration.
  - `inquiryService.js` / `api.js`: External communication with graceful network resilience.
- **No Orphaned State**: All reactive events (pricing updates, slot bookings) must broadcast using standard dispatch patterns (`tt_pricing_updated`, storage events) to synchronize across tabs, screens, and modals.

---

## 3. UI Architecture & Design System Tokens
- **Design Tokens (`src/styles/variables.css`)**:
  - *Color Palette*: Rich obsidian & forest depths (`--bg-primary`: `#090D0B`, `--bg-surface`: `#111814`, `--bg-card`: `#16201A`). Vibrant sport accents (`--brand-green`: `#22C55E`, `--brand-olive-bright`: `#4ADE80`, `--brand-orange`: `#F97316`, `--brand-gold`: `#EAB308`).
  - *Typography*: Modern sans typography (`Inter` / `Outfit`) with strict hierarchy (`display`, `h1`-`h4`, `body`, `label`, `caption`). No raw un-styled browser text.
  - *Elevation & Borders*: Subdued borders (`rgba(255,255,255,0.08)`), glowing focus rings (`0 0 0 3px rgba(74, 222, 128, 0.25)`), glassmorphism (`backdrop-filter: blur(12px)`).
- **Component Primitives (`src/styles/components.css`)**:
  - Uniform `.btn` system: `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-ghost`, `.btn-danger`.
  - Steppers: Compact segmented mobile steppers with active, completed (checkmark), and future states.
  - Discovery bars: `.activity-discovery-bar` with `.activity-pill-btn` for seamless horizontal category filtering.
  - Cross-discovery cards: Contextual suggestions for alternative sports and refuel amenities.

---

## 4. Mobile & Android UX Excellence
- **Native Android Feel**:
  - Touch target accessibility: All interactive elements must strictly adhere to **≥44×44px** (preferably 48px on primary actions).
  - Viewport Inset Handling: Full support for `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` to prevent collisions with Android gesture bars and camera cutouts.
  - Bottom Navigation: Persistent, ergonomic `BottomTabBar` (`Home`, `Venues`, `Book Now`, `My Passes`, `Profile`) with active visual indicators and haptic-feel transitions.
  - Footer Suppression: Standard marketing/website footers must be suppressed on app transactional routes (`/booking`, `/my-bookings`, `/profile`, `/admin`) to prevent clashing with native mobile shells.
- **Keyboard & Screen Resilience**:
  - Form inputs must maintain visibility when the Android virtual keyboard opens.
  - All scrolling containers must use `-webkit-overflow-scrolling: touch` and scrollbar suppression (`scrollbar-width: none`) for smooth native feel.
  - Screen sizes from **320px to 480px** (and tablet viewports) must render without horizontal overflow, text clipping, or broken grid wraps.

---

## 5. Interaction States & Error Resilience
- **Mandatory 5-State Coverage**: Every view and interactive component must gracefully handle:
  1. **Initial / Idle State**: Clear affordance and obvious next action.
  2. **Loading State**: Shimmer skeletons or branded spinners (`lucide-react` spin animations). Never blank screens.
  3. **Success State**: Crisp positive confirmation with actionable follow-ups (e.g. Booking Voucher with Return Home / Print / WhatsApp dispatch).
  4. **Empty State**: Never a dead end. Always recommend alternative actions (e.g. "No slots on this date? Check tomorrow or try Pickleball / Skating").
  5. **Error State**: User-friendly, non-technical recovery messaging with retry options.
- **Double-Submission Prevention**: All submission buttons must enter `disabled` / `isLoading` states upon tap to eliminate duplicate payment orders or concurrent slot locks.

---

## 6. Accessibility & Semantic Quality
- High-contrast text exceeding WCAG AA standards (minimum 4.5:1 for body copy).
- Semantic HTML tags (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<button>`).
- Explicit `aria-label`, `aria-selected`, `aria-current`, and descriptive headings.
- Keyboard focus rings for web accessibility alongside touch states for mobile.

---

## 7. Performance & Native Packaging
- Fast LCP and bundle efficiency (Vite production build target < 500kB gzip).
- Asset optimization: Compressed WebP / progressive JPG imagery with explicit dimensions to eliminate layout shifts (CLS = 0).
- Capacitor Synchronization: Every production build must copy web assets into Android (`npx cap copy android` / `npx cap sync`) and ensure valid native manifests.

---

## 8. Continuous Engineering Loop (The 7-Step Cycle)
For every audit finding or feature enhancement, strictly execute:
```
1. AUDIT & DIAGNOSE   -> Understand existing code, trace root causes, map dependencies
2. SYSTEMIC DESIGN    -> Design shared architectural solution (avoid one-off patches)
3. IMPLEMENT          -> Clean code preserving all existing working functionality
4. BUILD              -> Run `npm run build` and ensure 0 compilation errors
5. SYNC NATIVE        -> Run `npx cap copy android`
6. VERIFY & TEST      -> Run automated test scripts and verify user flows end-to-end
7. REGRESSION AUDIT   -> Verify previously completed screens, edge cases, and stop conditions
```

---

## 9. Absolute Preservation of Working Functionality
- Never delete or break working business logic, API integrations, admin tools, UPI/Razorpay payment flows, pricing computation, or existing routes.
- If an architectural component is improved, verify all dependents and preserve existing interfaces.

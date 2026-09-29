# Curated Customer Mobile Handoff

## Current checkpoint

- **Branch:** `feature/customer-mobile-curated`
- **Latest commit:** `61c2969 chore(handoff): preserve codex customer mobile checkpoint`
- **Remote upstream:** `origin/feature/customer-mobile-curated` (synced & up-to-date)
- **Design source:** `/home/pc/www/POC/design-reference/customer-app-mobile.svg` (read-only)
- **Figma reference:** `yUBIZk5ptihZqROIobT6S4`, curated Customer App node `97:1417`

The Clubhouse Ivory **Home**, **Facilities**, and **Facility Detail** screens are approved visual baselines. They are implemented by `src/comparison/*` and must not be redesigned. Their integration connects the curated Facility Detail CTA and bottom navigation to the remaining customer-mobile routes.

## Scope and rules

- Remaining curated areas: Booking Journey, Bookings & Pass, Authentication, Profile & Settings, Ratings & Reviews, Events, Dining, Support/Information, Resilience, and Midnight Ivory parity.
- Only authorized services: Box Cricket; Skating Rink; Pickle Ball; Cricket Green Net Practice; Cricket Green Net Practice with Shooting Machine. Never expose unauthorized sports.
- Dining is discovery/menu information only: no cart, ordering, delivery, pickup, checkout, or food payment.
- Fixture/demo values stay inside `src/prototype/customerMobile/data.js`; do not make them authoritative backend data or present them as a real authenticated account.
- Do not use raw Stitch exports as design authority. The shared SVG is sufficient while Figma MCP remains rate-limited.

## Current implementation map

- Approved discovery baseline: `src/comparison/Home.jsx`, `Facilities.jsx`, `FacilityDetail.jsx`, `components.jsx`, `comparison.css`, `fixtures.js`.
- Remaining fixture-backed curated screens: `src/prototype/customerMobile/CustomerMobilePrototype.jsx`, `customerMobile.css`, `data.js`.
- `src/App.jsx` exposes direct customer-mobile entry routes (`/booking`, `/payment/processing`, `/my-bookings`, `/sign-in`, `/profile`, `/events`, `/dining`, `/appearance`, `/system-error`, information and recovery routes) without changing the approved discovery composition.

## Completed checkpoint summary

1. **Preserved Codex Uncommitted Work:** Checkpoint commit `61c2969` (`chore(handoff): preserve codex customer mobile checkpoint`) safely committed and pushed.
2. **Booking Route & Prerequisite Guards:**
   - 4-step booking flow with authorized sports only. Step 2 requires slot selection; Step 3 requires contact validation (name + 10-digit mobile number); changing a service clears chosen slot.
   - Deep links for later steps restart at Step 1 to prevent faking in-progress bookings.
   - Payment processing/failure remains fixture-only.
3. **Authentication Fixture Guard:**
   - Sign In / Create Account / Forgot / Reset starts with blank values and disables primary action until requirements are satisfied.
   - Explicit local preview labels; no customer identity prefilled.
4. **Alternate-State Route Normalization:**
   - `/create-account`, `/events/loading`, `/events/empty`, `/dining/loading`, `/dining/unavailable` render specified state with recovery actions.
5. **Guest-Safe Profile & Settings:**
   - Profile, Edit Profile, and Settings render local-preview information without claiming authenticated customer accounts.
6. **Appearance & Midnight Ivory Parity:**
   - Appearance route (`/appearance`) allows switching between Clubhouse Ivory and Midnight Ivory.
   - `?theme=midnight` applies dark theme tokens cleanly without breaking contrast.
7. **Safe Booking-Pass and Review Fixtures:**
   - Digital entry pass (`TT-DEMO-2407`) and verified reviews explicitly identified as preview fixtures.
8. **Events & Dining Consistency:**
   - Events and Dining discovery cards accurately reference fixture records.
   - Dining is strictly discovery/menu info with no cart or payment actions.
9. **Resilience & Recovery:**
   - `/offline` and `/system-error` provide structured recovery ("Go Home", "Go Back", "Try Again").

## QA & Verification Status

- `npm run build` passed in 3.73s (0 errors).
- `git diff --check` passed (0 whitespace errors).
- All 29 routes return HTTP 200 and render correctly at 390px mobile viewport.
- Authorized sports rule strictly verified (5 disciplines only).
- Working tree is clean and synced with remote.

## Recommended next task for Codex

1. Run automated component integration tests if configured for the customer mobile suite.
2. Proceed with pre-production release staging when ready.

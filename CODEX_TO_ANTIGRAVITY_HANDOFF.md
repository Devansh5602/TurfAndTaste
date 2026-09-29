# Curated Customer Mobile Handoff

## Current checkpoint

- **Branch:** `feature/customer-mobile-curated`
- **Latest commit:** `29b381b feat(android): add hardware back-button listener and align native build toolchain`
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
- Automated regression suite: `tests/customer-mobile-regression.test.js` (`npm test`).
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
10. **Automated Regression Suite (`npm test`):**
    - Expanded test runner covering authorized sports compliance, booking input validation guards, dining constraints, support page integrity, venue time calculations, and cryptographic quote token verification.
11. **Security & Integration Hardening:**
    - Fixed serverless crash handler in `api/index.js` to eliminate stack and environment leakage.
    - Hardened `verifyQuoteToken` in `server/utils/quoteToken.js` with length checks before `crypto.timingSafeEqual`.
12. **Native Android / Capacitor Delivery & Build:**
    - Integrated native hardware back-button listener (`@capacitor/app`) into `RouterContext.jsx`.
    - Aligned Android toolchain using Node v22 LTS, JDK 21, and Gradle 8.14.3.
    - Successfully built safe debug APK: `android/app/build/outputs/apk/debug/app-debug.apk` (12MB).

## QA & Verification Status

- `npm test` passed 9/9 tests across 5 suites in ~130ms.
- `npm run build` passed in 2.83s (0 errors, 1883 modules transformed).
- `npx cap sync android` passed in 0.15s (copied web assets, generated `capacitor.config.json`, synced 3 plugins).
- `./gradlew assembleDebug` passed in 2s (`BUILD SUCCESSFUL`).
- `git diff --check` passed (0 whitespace errors).
- All 29 routes return HTTP 200 and render correctly at 390px mobile viewport.
- Authorized sports rule strictly verified (5 disciplines only).
- Working tree is clean and synced with remote.

## Native Android Build Artifact

- **Debug APK Location:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **File Size:** ~12 MB
- **Package / Application ID:** `com.turfandtaste.app`
- **Compile SDK / Target SDK / Min SDK:** 36 / 36 / 24
- **Security:** Cleartext HTTP disabled; strict HTTPS scheme configured in `capacitor.config.json`.

## Integration Risk Classification

- **READY:** Frontend routing, UI design baseline, product constraints, Supabase schema queries, CORS configuration, quote signing & verification, serverless handler sanitization, native Capacitor sync, Android Gradle build & debug APK generation.
- **NEEDS CONFIGURATION:** Physical Android device connectivity for runtime ADB smoke testing; `VITE_API_URL` override when testing against remote staging API.
- **BLOCKED BY DESIGN:** Live production payments and real customer auth accounts (deliberately isolated from preview flows).

## Continuity status

Codex can resume cleanly on this branch when its usage quota resets. All changes are committed and pushed to `origin/feature/customer-mobile-curated`.

# Curated Customer Mobile Handoff

## Current Checkpoint

- **Branch:** `feature/customer-mobile-curated`
- **Remote upstream:** `origin/feature/customer-mobile-curated` (synced & up-to-date)
- **Design source:** `/home/pc/www/POC/design-reference/customer-app-mobile.svg` (read-only)
- **Figma reference:** `yUBIZk5ptihZqROIobT6S4`, curated Customer App node `97:1417`
- **Admin Mobile Status:** PAUSED — strictly waiting for customer mobile real-device verification.

---

## Real-Device Correction Pass (Usability & Runtime Fixes)

### 1. Defects Discovered from Real-Device Testing
1. **Duplicate / Fake Status Bar on Home & Discovery Screens:**
   - Static Figma status bar (9:41, Signal, Wi-Fi, Battery icons) rendered inside application DOM, colliding with the native Android OS status bar.
2. **Broken Create Account Screen Logo / Mark:**
   - Decorative mark (`t & t`) letters were overlapping/stacked vertically inside a circle due to CSS Grid `place-items: center` treating anonymous text nodes as separate grid rows. Form also lacked proper input validation and interactive feedback.
3. **Booking Step 1 Progression Blocker & State Contradiction:**
   - User selected an authorized sport/service, but no visible or enabled progression CTA was available to advance to Step 2 (Schedule).
   - Global `BottomNav` (`z-index: 4`) was rendered on every screen and overlaid the sticky action bar (`z-index: 3`).
   - Sticky `BookingBar` button was styled as a narrow 50px icon-only box instead of an accessible, descriptive primary action button.
   - Contradictory copy ("Selected · available times shown next" vs "Choose a service to continue").
4. **Bottom Navigation Over-injection:**
   - Bottom navigation was forced onto focused flows (Booking Steps 1–4, Payment Processing, Payment Failure, Success, Entry Pass, Auth/Create Account, Profile Edit, Settings, Support pages).

### 2. Root Causes & Engineering Fixes
- **Fake Status Bar:** Removed `.status-bar` DOM elements and unused icon imports from `src/comparison/components.jsx` and removed status bar CSS rules from `src/comparison/comparison.css`. App headers now respect native safe area insets via `env(safe-area-inset-top, 0px)`.
- **Create Account Screen:** Updated `.cm-source-auth .cm-auth-mark` to `display: inline-flex; align-items: center; justify-content: center;` with serif styling for the ampersand `&`. Added real-time validation for Full Name (>=2 chars), WhatsApp/Mobile (10 digits), and Password (>=6 chars), with inline error cues and an active `Create Account` CTA that transitions safely to Profile preview.
- **Booking Progression & State Model:**
  - Upgraded `BookingBar` to render a prominent, accessible primary button (`.cm-sticky-cta`) with clear action labels ("Select Date & Time", "Continue to Details", "Review Booking", "Proceed to Pay").
  - Raised `.cm-sticky-action` z-index to `20`.
  - Replaced contradictory labels with unified status feedback.
  - Selecting any of the 5 authorized sports updates selection state, displays arena details and tariff, and enables the primary CTA to advance directly to Step 2.
  - Stepper header supports back-navigation to completed steps, and changing the selected sport clears downstream selected slots to prevent stale state.
- **Bottom Navigation Scoping:** Configured `BottomNav` to render strictly on top-level tabs (`home`, `facilities`, `events`, `dining`, `profile`, `bookings`) and suppressed it on all focused transactional flows. Added `.cm-scroll-full` padding to prevent content clipping.

---

## Test Suite & Build Verification

- **Automated Regression Suite (`npm test`):** 14/14 tests passing across 8 suites in ~150ms.
  - Verified all 5 authorized sports can be selected in Step 1 and enable progression.
  - Verified Step 1 unselected gating and slot invalidation upon sport switch.
  - Verified end-to-end interactive booking step progression (Step 1 -> 2 -> 3 -> 4 -> Pay -> Success / Failure & Retry).
  - Verified Create Account and auth form field validations (Name, Mobile, Password, Confirm).
  - Verified global `BottomNav` scoping between top-level tabs and focused flows.
  - Verified authorized sports rule (strict 5 disciplines, 0 unauthorized sports).
  - Verified static dining menu constraints and quote signing integrity.
- **Production Web Build (`npm run build`):** Built cleanly in 3.82s (0 errors, 1883 modules).
- **Whitespace / Lint Checks (`git diff --check`):** Passed with 0 errors.
- **Capacitor Sync (`npx cap sync android`):** Synced web assets, plugins, and config cleanly.
- **Android Debug Build (`./gradlew assembleDebug`):** `BUILD SUCCESSFUL` in 13s.

---

## Native Android Build Artifact

- **Debug APK Location:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **File Size:** 12,512,346 bytes (~12.5 MB)
- **Package / Application ID:** `com.turfandtaste.app`
- **Compile SDK / Target SDK / Min SDK:** 36 / 36 / 24

---

## Pending Next Steps

- **Customer Mobile Usability Gate:** Awaiting user verification of updated APK and mobile screens.
- **Admin Mobile:** PAUSED until customer mobile gate is formally approved.


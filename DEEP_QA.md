# DEEP_QA.md — Persistent Deep-Dive QA & UX Engineering Configuration

> **Authoritative QA Methodology:** [`skill.md`](./skill.md)
> This repository permanently enforces the QA & UX Engineering standards defined in `skill.md`. Every feature, bug fix, UI change, API update, and mobile build must pass the verification and regression criteria specified herein.

---

## 1. Purpose

This document serves as the project-specific operational QA state, testing inventory, and execution matrix for **Turf & Taste**. It links the project codebase directly to the engineering principles of `skill.md`.

Whenever any meaningful change is introduced to this codebase, the following workflow is mandatory:

```text
CHANGE IMPLEMENTED
        ↓
BUILD & RUNTIME VERIFICATION (Vite Build / Gradle Build)
        ↓
TARGETED FUNCTIONAL & UI/UX TEST (Real-time user behavior)
        ↓
RESPONSIVE & DEVICE MATRIX CHECK (Desktop, Tablet, Mobile)
        ↓
PLATFORM-SPECIFIC VALIDATION (Web browser / Android / iOS)
        ↓
REGRESSION LOOP (Adjacent features & Critical paths)
        ↓
UPDATE QA RECORD & FINALIZE
```

---

## 2. Supported Platforms & Guidelines

| Platform | Target Runtime | Primary UX Goals | Visual Parity Requirement |
|---|---|---|---|
| **Web** | Modern Desktop, Tablet & Mobile Browsers | Responsive layout, keyboard navigation, crisp typography, hover states, fast load | Platform-independent. Web conventions apply. |
| **Android** | Native APK / AAB (API 24 to 36) | Touch ergonomics, Android back gestures, system bar safe areas (`WindowInsets`), dark status bars | Platform-independent. Native Android conventions apply. |
| **iOS** | Native iOS app (iOS 15+) | Smooth touch, safe areas (`env(safe-area-inset-*)`), swipe-back, modal sheets | Platform-independent. iOS conventions apply. |

---

## 3. Application Feature & Test Inventory

### Web Application Inventory

#### Routes & Pages
- `/` — **Home:** Hero section, USP pillars, facility preview cards, cafe teaser, location/CTA.
- `/about` — **About Us:** Mission, story, founders/management, facility amenities, arena rules.
- `/facilities` — **Facilities Hub:** Filterable/browseable directory of all sports facilities.
- `/facilities/:slug` — **Facility Detail:** Deep-dive specs, rules, photo previews, timing, pricing, and direct "Book This Facility" CTA.
  - Slug routes: `box-cricket`, `skating-rink`, `pickleball-court`, `cricket-nets`, `sports-cafe`, `snack-parlour`.
- `/pricing` — **Pricing & Packages:** Full pricing breakdown, memberships, corporate tournament packages, terms.
- `/booking` — **Slot Booking Engine (Core Workflow):** Facility selector, dynamic multi-day calendar, morning/afternoon/evening/night slots, live slot availability, real-time slot selection, customer details form, payment method selector (Online Razorpay UPI / Cash on Arrival), order summary with discount breakdown, booking confirmation modal with ticket download/print.
- `/contact` — **Contact & Directions:** Google map directions, telephone/email contacts, operating hours, quick question card.
- `/inquiry` — **Custom Event & Tournament Inquiries:** Multi-field inquiry form with validation (Name, Phone, Facility, Expected Guests, Date, Details).
- `/admin` — **Admin Control Center:**
  - Password authentication & JWT session persistence.
  - Analytics cards: Total Bookings, Revenue, Active Courts, Utilization.
  - Live Booking Management table (Search, Filter by date/facility/status, Status actions: Confirm, Cancel, Mark Paid).
  - Slot Inventory Manager (Block slots for maintenance, dynamic price override, bulk slot release).
  - Customer Inquiry inbox (Review, update status to Contacted/Closed).

#### Global UI & Shared Components
- **Navbar Header:** Sticky glassmorphism header, brand logo, responsive navigation links, Theme Toggle, Admin portal shortcut, "Book a Slot" CTA button, mobile slide-out drawer with gesture overlay.
- **Footer:** Brand overview, address badge, quick links, sports list, social links, legal notices.
- **Theme System:** Dark (primary brand theme `#090C09`) & Light mode with seamless variable transitions.
- **Universal Modals:** Glassmorphic confirmation modals, booking ticket summaries, accessibility escape listener.
- **Toast Notifications:** Floating dynamic feedback system for user actions.

---

### Android Native Inventory

- **Package ID:** `com.turfandtaste.app`
- **Native Activity:** `MainActivity.java` (extends `BridgeActivity` with native `WindowInsetsCompat` handling).
- **System Bars:** Status bar (`#090C09`), Navigation bar (`#090C09`), edge-to-edge system insets applied to `android.R.id.content`.
- **Hardware Integration:** Hardware acceleration (Intel VT-x / AMD-V / WHPX), Android back button, screen rotation handling.
- **Network Stack:** Cleartext traffic permitted for local development APIs, secure HTTPS for production.
- **Native Splash Screen:** Non-immersive brand splash (`#0B0F0B`, 2000ms duration).

---

### iOS Native Inventory

- **Bundle ID:** `com.turfandtaste.app`
- **Framework:** Capacitor iOS with Swift Package Manager (SPM).
- **Safe Area Insets:** CSS `viewport-fit=cover` with `env(safe-area-inset-top/bottom/left/right)`.
- **Status Bar:** Dark content style (`Style.Dark`), non-overlaying webview layout.

---

## 4. Testing Matrix

### Viewport & Responsive Matrix (Web)
- **Mobile Handsets:**
  - 320×568 (Small/SE)
  - 360×640 (Standard Android)
  - 375×667 (Standard iPhone)
  - 390×844 (Modern iPhone)
  - 412×915 (Modern Android / Pixel)
  - 430×932 (Large iPhone Pro Max)
- **Tablets:**
  - 768×1024 (iPad Portrait)
  - 820×1180 (iPad Air)
  - 1024×768 (Tablet Landscape)
- **Desktops:**
  - 1280×720 (HD Laptop)
  - 1366×768 (Standard Laptop)
  - 1440×900 (MacBook standard)
  - 1536×864 (Windows standard)
  - 1920×1080 (FHD Desktop)

### Device Matrix (Native Mobile)
- **Android Virtual Device:** `medium_phone` (API 36 / 35, x86_64 Google Play image, 1080×2400).
- **Android Hardware Device:** Connected physical test devices (via ADB USB debugging).

---

## 5. Critical Core Workflows

1. **Slot Availability & Reservation Flow:**
   - Select date → Choose sports facility → View slot availability → Pick available slot → Fill contact form → Select payment method → Verify slot locking.
2. **Payment & Confirmation Flow:**
   - Online payment simulation (Razorpay test mode) OR "Pay at Venue" selection.
   - Immediate ticket generation with unique Booking Reference ID, printable confirmation, and instant state synchronization.
3. **Admin Operation & Slot Governance:**
   - Login to `/admin` using verified credentials.
   - Filter and search bookings by customer name/phone.
   - Block/unblock slots in real-time to prevent customer double-booking during tournaments.
4. **Mobile Navigation & System Bar Cleanliness:**
   - Ensure notification bar and bottom button bar never clip or obscure navigation elements or floating action buttons.

---

## 6. Build & Test Commands

```bash
# Web Development Server (Vite)
npm run dev

# Backend API Server (Express + PostgreSQL)
npm run backend

# Web Production Build (Zero-error validation)
npm run build

# Native Capacitor Sync (Web -> Android & iOS)
npm run cap:sync

# Android APK Compilation (Debug)
npm run cap:build:apk

# Android App Bundle Compilation (Release)
npm run cap:build:bundle
```

---

## 7. Current Project QA State

- **Last Full Deep QA Pass:** 2026-09-19 (Pass 1 — Full Audit & System Invariants Verified)
- **Current Active Branch:** `feature/mobile-app`
- **Web Build Status:** `PASSED` (Vite 6 production build, 0 errors, 1,875 modules)
- **Android Native Build Status:** `PASSED` (`app-debug.apk` built cleanly with Gradle 8.14.3 & JDK 21 in 13s)
- **Automated Regression Suite:** 22/22 tests passing (`scratch/test_deep_qa.mjs`)

### Pass 1 Audit Findings & Resolutions

| Category | Finding / Defect | Root Cause | Fix Applied | Status |
|---|---|---|---|---|
| **Mobile Overlap** | System notification bar & 3-button navigation bar overlapped app content | Immersive splash mode, default `overlaysWebView: true`, mobile media query stripping `--safe-top` | Injected native `WindowInsets` padding in `MainActivity.java`, added safe areas to navbar/footer/sticky bar, set `overlays: false` | ✅ FIXED |
| **Gradle JVM** | Android Studio sync failure: Gradle 8.14.3 incompatible with JVM 25 | Android Studio selected bundled `jbr-25` by default | Configured `org.gradle.java.home` in `gradle.properties` and `#JAVA_HOME` in `.idea/gradle.xml` to JDK 21 LTS | ✅ FIXED |
| **Booking Validation** | Incomplete booking requests accepted with dummy "Guest Player" data | Missing request body validation in `POST /api/bookings` | Added strict validation requiring valid customer name, 10-digit phone, date, time slot, and facility | ✅ FIXED |
| **Double-Booking** | Concurrent or duplicate bookings possible on the same facility time slot | Missing conflict check prior to database insertion | Added pre-insert conflict query rejecting double bookings with HTTP 409 Conflict | ✅ FIXED |
| **Database Schema** | `relation "blocked_slots" does not exist` on slot maintenance operations | Table creation missing in PostgreSQL and SQLite migrations | Added `CREATE TABLE IF NOT EXISTS blocked_slots` migration in `server/db.js` | ✅ FIXED |
| **Slot Governance** | Missing REST endpoints for admin slot blocking / unblocking | Incomplete booking route coverage | Implemented `GET /blocked-slots`, `POST /block-slot`, and `DELETE /unblock-slot` | ✅ FIXED |
| **Slot Listing State** | Blocked maintenance slots did not reflect on public customer slot query | `GET /api/bookings/slots` only checked `bookings` table | Joined `blocked_slots` into availability generator, flagging maintenance slots | ✅ FIXED |

### Known Environment Limitations

1. **Playwright Browser Subagent Tool:** The automated headless browser runner encountered a Playwright driver package 404 (`playwright-1.57.0-win32_x64.zip` from Microsoft CDN). All UI, API, and build validations were executed directly via Node.js native test suites, Vite dev server, and native Gradle CLI.
2. **iOS Compilation:** Native Xcode compilation requires macOS. Web assets and Capacitor iOS configurations are validated and synced via `npx cap sync`.
3. **Android Emulator Virtualization:** Android Virtual Device `medium_phone` is created and ready. Starting the emulator on Windows requires the Intel AEHD hypervisor driver (`silent_install.bat`) with Windows administrator privileges. Physical Android USB debugging is operational.

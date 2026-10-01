# Turf & Taste — Design System & Visual Standards (DESIGN_SYSTEM.md)

This document specifies the design tokens, visual hierarchy, responsive viewports, and UI constraints for Turf & Taste applications.

---

## 1. Visual Source Hierarchy
1. **Primary Admin Authority:** `ADMIN APP · Mobile.png` (rendered visuals) & `ADMIN APP · Mobile.svg` (component & layout inspection).
2. **Shared System Reference:** `CUSTOMER APP · Mobile.png` & `CUSTOMER APP · Mobile.svg` (used for shared primitives: buttons, cards, typography, chips, badges, modals).
3. **Legacy Frames (`LEGACY — DO NOT PROTOTYPE`):** Obsolete and must not be used as production sources.
4. **Product Truth Rule:** Finalized product and business rules outrank design mockup visuals.

---

## 2. Color Palette & Surfaces (Clubhouse Ivory)

| Token Name | Hex Value | Semantic Role |
|---|---|---|
| `--admin-bg` | `#FAF9F6` | Primary warm ivory canvas background |
| `--admin-surface` | `#FFFFFF` | Elevated card & sheet surfaces |
| `--admin-surface-subtle` | `#F3F1ED` | Recessed containers, table headers, stat wells |
| `--admin-border` | `#EAE8E4` | Hairline borders for cards and inputs |
| `--admin-forest` | `#0F3D2E` | Deep clubhouse forest green; primary brand accent & active states |
| `--admin-mint` | `#A0F399` | Mint vibrant highlight / live status indicators |
| `--admin-text-main` | `#1A1C1A` | High-contrast primary headings and text |
| `--admin-text-muted` | `#5A645E` | Secondary captions, timestamps, and metadata |
| `--admin-danger` | `#D92D20` | Destructive alerts, cancellations, and errors |
| `--admin-warning` | `#D97706` | Amber warnings, surge badges, add-on notices |

---

## 3. Typography & Spacing
- **Font Stack:** Clean modern sans-serif (`Outfit`, `Inter`, system fallback).
- **Headings:**
  - View titles: `1.2rem` – `1.3rem`, weight `800`.
  - Section headers: `0.95rem` – `1.05rem`, weight `700`.
  - Body text: `0.85rem` – `0.9rem`, line-height `1.5`.
  - Captions / Metadata: `0.7rem` – `0.78rem`, weight `500` or `600`.
- **Card Radius:** Standard `16px` (`--admin-radius-lg`), button radius `10px` (`--admin-radius-md`), chip radius `20px` (`--admin-radius-full`).
- **Touch Targets:** Minimum `44px` height on all interactive buttons, inputs, and chips.

---

## 4. Mobile Navigation & Drawer Pattern
- **Stable 4 Primary Tabs:** `Dashboard`, `Bookings`, `Facilities`, `Operations`. Navigation order never rearranges based on route.
- **Operations Launchpad Drawer:** Clicking "Operations" slides up a 2-column mobile launcher drawer giving 1-tap access to all 13 secondary submodules without horizontal scroll clutter.
- **Top Header:** Clean Clubhouse top bar with campus status indicator (`• LIVE`), notifications bell, user profile, and secure logout.

---

## 5. Responsive Mobile Viewports
All mobile views must be verified across standard device widths:
- **360px:** Compact Android (e.g. Galaxy A series). Single-column metrics, no horizontal overflow.
- **375px:** iPhone SE / small iOS.
- **390px:** Standard modern mobile (iPhone 13/14/15, Pixel 7). **Primary visual QA target**.
- **412px:** Large Android (e.g. Galaxy S / Note series).
- **430px:** Large iOS (e.g. iPhone Pro Max / Plus).
- **Max-Width Rule:** Application shell centers at `max-width: 480px` on desktop/tablet viewports.

---

## 6. Strict Prohibitions
1. **NO Fake Device Chrome:** Never render artificial 9:41 time, battery 100%, Wi-Fi icons, or camera notches inside web components. The real native OS provides these. Use CSS safe-area insets (`env(safe-area-inset-top)`).
2. **NO Native Browser Dialogs:** Never use `window.alert`, `window.confirm`, or `window.prompt` in production flows. All confirmations must use branded in-app modal sheets.

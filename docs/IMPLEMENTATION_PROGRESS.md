# Turf & Taste v2 — Implementation Progress

## Current stable state

- **Branch:** `feature/turf-and-taste-v2` (created from the existing `feature/mobile-app` work).
- **Architecture:** React 18/Vite single-page web app packaged through Capacitor, with an Express API and SQLite development fallback / PostgreSQL production path.
- **Existing stable capabilities:** public facility discovery, customer booking wizard, server-side overlap checks, pricing/timing administration, maintenance blocks, direct-UTR review flow, Razorpay signature verification path, admin booking operations, inquiries, and annual archive generation.
- **Latest checks before v2 work:** `npm run build`, server syntax checks, and diff validation passed in the prior QA cycle. Capacitor Android sync remains blocked locally because Capacitor 8 needs Node 22 while the available runtime is Node 20.

## Audit summary — 2026-09-22

### Current implementation strengths

| Area | Assessment |
| --- | --- |
| Shared booking API | Present; includes authenticated admin operations, blocked slots, overlap detection, payment-state protections, and timing/pricing endpoints. |
| Public customer flows | Present for discovery, booking, contact/inquiry, guest booking history, profile, and pricing. |
| Admin portal | Present for bookings, walk-ins, pricing, timings, inquiries, and annual archives. |
| Mobile shell | Capacitor configuration, Android, and iOS projects exist; web UI has a mobile bottom bar and safe-area tokens. |
| Security improvements | Admin routes use JWT middleware; public booking creation cannot claim paid/confirmed state; environment template exists. |

### P0/P1 findings and architectural gaps

1. **Customer booking history is not identity-verified.** Exact phone/email matching improves privacy versus partial search but does not meet the v2 requirement. It must move to account identity or a booking-reference + OTP verification flow.
2. **Facilities are still frontend-authoritative.** `src/data/facilitiesData.js` is the public source, while the database has only a minimal legacy facilities table. Facility CRUD, schedules, media, rules, amenity, enabled state, and configurable duration are missing.
3. **Booking price trust boundary is incomplete.** The backend accepts formatted amount data for public UPI review reservations instead of independently deriving a price from facility pricing and slot rules. This must be addressed as part of the pricing/booking-engine module.
4. **Legacy schema evolution remains embedded in startup code.** The first v2 migration is now versioned and reproducible, but legacy tables are still initialized during startup and will be progressively migrated without a destructive cutover.
5. **Admin authorization is single-role.** JWT authentication exists but no RBAC, account disablement, reset flow, rate limiting, or audit log exists.
6. **Food stalls/menus, events, blogs, reviews, media upload, public policies, and complete customer auth are not implemented.**
7. **SEO is limited by the SPA architecture.** The public routes lack page-specific metadata, canonical/OG handling, sitemap, robots, and structured data.

### Product/UX findings

- The booking screen needs a targeted small-mobile layout correction: the progress stepper and sport filters can visually clip at narrow widths, and redundant discovery panels delay the first venue selection.
- Public content describes a sports/café offering, but food discovery is static and not vendor/menu driven.
- The current admin portal is operationally useful but mixes unrelated tasks in one large view; v2 should introduce modular navigation after core data modules are available.

## Requirement coverage matrix

| Capability | Current state | v2 disposition |
| --- | --- | --- |
| Booking, pricing, blocks, walk-ins | Exists but needs improvement | Module 4/5: preserve interfaces; make facility-driven and server-priced. |
| Admin login/change password | Partial | Module 2: RBAC foundation, reset/revoke/rate-limit design. |
| Facility CRUD and schedules | Missing | Module 3. |
| Food stalls, parlour, menus | Missing | Module 8. |
| Events | Missing | Module 9. |
| Blogs | Missing | Module 10. |
| Reviews/moderation | Missing | Module 11. |
| Customer account / secure history | Partial | Module 13, after Module 2. |
| Contact and inquiries | Exists but needs improvement | Module 12. |
| Admin dashboard/analytics/finance | Partial | Modules 14–15. |
| Annual archive | Exists but needs hardening | Module 16. |
| Mobile UX and Capacitor verification | Partial | Module 17. |
| Security/performance/SEO/media | Partial | Module 18, with security fixes pulled forward where required. |

## Module queue

| Module | Status | Next / dependency |
| --- | --- | --- |
| 0 — Repository Audit & Architecture | **QA VERIFIED** | Build and server syntax checks passed; target architecture and requirement coverage are documented. |
| 1 — Core Backend Foundation | **IN PROGRESS** | Tracked SQLite/PostgreSQL foundation plus safe legacy/pricing facility backfills and public inventory API. API conventions and media foundations remain. |
| 2 — Authentication & Authorization | NOT STARTED | Depends on Module 1 decisions. |
| 3 — Facility Management | NOT STARTED | Depends on Module 1; first product vertical slice after foundation. |
| 4 — Pricing & Booking Engine | PARTIAL / NEEDS REDESIGN | Depends on Module 3 facility schedules/pricing. |
| 5 — Payments & Booking Pass | PARTIAL / NEEDS HARDENING | Depends on Modules 2–4. |
| 6–7 — Website / Facility Discovery | PARTIAL | Migrate from static data only after Module 3. |
| 8 — Food Court & Parlour | NOT STARTED | Depends on Module 1 media/content conventions. |
| 9 — Events CMS | NOT STARTED | Depends on Module 1. |
| 10 — Blog CMS | NOT STARTED | Depends on Module 1. |
| 11 — Ratings & Reviews | NOT STARTED | Depends on Module 2 and bookings. |
| 12 — Contact & Inquiry | PARTIAL | Improve after common API conventions. |
| 13 — Customer Account | PARTIAL | Depends on Module 2. |
| 14–16 — Admin, Analytics, Archives | PARTIAL | Extend only after data model modules are stable. |
| 17 — Mobile UX | PARTIAL | Fix targeted regressions now; full pass after customer modules. |
| 18 — Security, Performance & Hardening | IN PROGRESS (cross-cutting) | Immediate P0/P1 defects are pulled into foundation modules. |
| 19 — Final QA | NOT STARTED | Requires all product modules. |

## Active module and next safe task

**Active module:** Module 1 — Core Backend Foundation.

**Completed atomic slice:** Added `server/migrations/001_v2_foundation.js` and migration tracking in `server/db.js`. The additive `business_settings`, `facility_profiles`, and `facility_schedules` schema is safe alongside the legacy booking tables. SQLite application, repeat application, schema presence, syntax, diff validation, and the production web build passed on 2026-09-22. PostgreSQL runtime validation remains blocked by the unavailable endpoint; placeholders are translated to PostgreSQL's numbered form for migration bookkeeping.

**Completed vertical slice:** Added additive backfills for legacy facility records and the established pricing tiers, plus `GET /api/facilities` and `GET /api/facilities/:identifier`. Isolated API QA confirmed five active bookable facilities, identifier lookup, and `404` behavior. The existing static frontend dataset remains in place deliberately; it has richer copy and images than the current backend model, so swapping it before admin content editing would degrade the public experience.

**Next safe task:** Define shared API response/validation conventions and the public/admin settings boundary, then begin facility-management APIs against the new schema. No public CMS screen will start before that model is stable.

## External configuration / known blockers

- PostgreSQL/Supabase endpoint is unavailable from the local QA environment; SQLite is used for isolated integration testing.
- Razorpay production keys, webhook secret, SMTP, object storage, and customer OTP provider are not configured. Their flows must remain accurately marked as unconfigured until credentials exist.
- Capacitor 8 Android sync requires Node.js 22 or newer; local Node.js is 20.20.2.

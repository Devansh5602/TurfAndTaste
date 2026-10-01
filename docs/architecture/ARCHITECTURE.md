# Turf & Taste — System Architecture Overview (ARCHITECTURE.md)

This document outlines the software architecture, layer separation, database schema, and migration pipeline of Turf & Taste.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Client Layer (Mobile First)                 │
│  - React 18 SPA (Vite v6)                                   │
│  - Capacitor Mobile Wrappers (Android & iOS)                │
│  - Clubhouse Ivory UI Design System                         │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON REST API
┌──────────────────────────────▼──────────────────────────────┐
│                    Express Backend Server                   │
│  - Authentication & Session Verification (JWT)              │
│  - Dynamic RBAC Middleware (`requirePermission`)            │
│  - Domain Controllers: Bookings, Quotes, Payments, CMS      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Canonical Invariants
┌──────────────────────────────▼──────────────────────────────┐
│                    Canonical Domain Engines                 │
│  - `canonicalBookingCommand.js`: Unified Physical Resource  │
│  - `pricingResolver.js`: Server-Authoritative Pricing       │
│  - `paymentFinalization.js`: Idempotent Concurrency Safe    │
│  - `rbacEngine.js`: Permission-Oriented Scoping             │
└──────────────────────────────┬──────────────────────────────┘
                               │ Async SQL Driver
┌──────────────────────────────▼──────────────────────────────┐
│                       Database Layer                        │
│  - Development / Isolated Testing: Better-SQLite3           │
│  - Cloud Staging / Production: Supabase Cloud PostgreSQL    │
│  - 23 Sequential Numbered Migrations                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Server & Client Responsibilities
- **Client (Frontend):** Focuses on presentation, form entry, immediate UI validation, and navigation. The client NEVER computes prices, determines conflict availability, or decides financial totals.
- **Server (Backend):** Authoritative for all state mutations, pricing resolutions, financial calculations, conflict detection, permission checks, and database concurrency.
- **Database Engine Isolation:** The test suite runs against isolated in-memory or temporary SQLite files (`scripts/test-runner.js`), completely isolating tests from development databases.

---

## 3. Migration Sequence & Data Integrity
Migrations are located in `server/migrations/` and execute sequentially on server startup:
- `001_core_schema.js` – `019_rbac_foundation.js`: Core entities, physical facilities, booking constraints, dining tenancy.
- `020_pricing_rules.js`: Base pricing rules, surge rates, floodlight schedules.
- `021_pricing_and_availability_reconciliation.js`: Reconciles legacy blocked slots into unified canonical facility blocks.
- `022_phase1_closeout_repair.js`: Immutable pricing snapshots, signed quote tokens, fail-closed occupancy guards.
- `023_admin_cms_modules.js`: Customer CRM notes, notices bulletins, reviews moderation, annual archives manifest.

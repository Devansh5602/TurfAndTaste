# Stage 0 — Database Reality & Schema Preflight Report

**Generated Date:** 2026-09-30  
**Audit Executed By:** Stage 0 Preflight Tool (`server/scripts/preflightCheck.js`)  
**Target Property:** Turf & Taste, Patan, Gujarat (`Asia/Kolkata`)  

---

## 1. Executive Summary & Database Reality

An independent preflight audit of the running database environments resolved the core question raised in Codex's Foundation Review:

| Database Environment | Engine | Tables Found | Applied Migrations | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Supabase Cloud** (`process.env.DATABASE_URL`) | PostgreSQL 15 | **22 tables** | 13 (`001_v2_foundation` → `013_events_foundation`) | Active primary backend |
| **Local Development File** (`server/data/turf_and_taste.db`) | SQLite 3 | **10 legacy tables** | 0 (`schema_migrations` uninitialized) | Unsynced local fallback snapshot |

### Key Discovery:
- The production/staging Supabase PostgreSQL database **already has all 13 v2 migrations applied** recorded in `schema_migrations`.
- The local SQLite file `server/data/turf_and_taste.db` remained on legacy schema because developer and runtime operations were directed to Supabase via `.env`.
- Any new Stage 0 foundation migrations must be **additive and dual-compatible** (Postgres and SQLite), executed via the versioned migration runner `runVersionedMigrations()`.

---

## 2. Inventory of Current Reality

### Existing Tables in Primary PostgreSQL (22 Tables):
1. `admin_auth_audit` (auth event auditing)
2. `admins` (admin credentials, roles, session versions)
3. `annual_archives` (ledger snapshots)
4. `blocked_slots` (legacy per-slot blocks: `facility_id`, `date`, `time_slot`, `reason`)
5. `bookings` (legacy booking records: `facility_id`, `date`, `time_slot`, `amount_paid`, `booking_status`)
6. `business_settings` (v2 key-value settings)
7. `events` (v2 events foundation)
8. `facilities` (legacy 4 rows: `box-cricket`, `pickleball`, `ball-machine`, `skating`)
9. `facility_profiles` (v2 profiles: `box-cricket`, `skating`, `pickleball`, `cricket-nets`, `ball-machine`, `cafe`, `snack-parlours`)
10. `facility_schedules` (v2 day_of_week opening/closing schedules)
11. `food_menu_categories` (v2 dining categories)
12. `food_menu_items` (v2 dining menu items)
13. `food_stalls` (v2 food stalls)
14. `inquiries` (contact submissions)
15. `media_assets` (image assets)
16. `payment_orders` (gateway order records)
17. `payments` (legacy payment audit rows)
18. `pricing_tiers` (legacy day/night rates and deposit percentages)
19. `quote_redemptions` (cryptographic quote single-use redemptions)
20. `schema_migrations` (migration tracking table, 13 entries)
21. `system_settings` (system config)
22. `timings` (legacy opening/closing and floodlight times)

---

## 3. Critical Legacy Discrepancies & Audit Findings

### A. Overlapping Bookings in Legacy History
The preflight audit detected overlapping confirmed bookings in legacy data:
- **Date & Slot:** `2026-09-19` from `06:00 PM – 07:00 PM`
- **Legacy Facility ID:** `box-cricket`
- **Colliding Bookings:** `TT-512005` and `TT-222332`
- **Root Cause:** Legacy schema used `facility_id = 'box-cricket'` as a single string, whereas the physical property in Patan actually has **two Box Cricket Turfs (`Turf 1` and `Turf 2`)**. In reality, both games were played concurrently on different turfs, but the flat string schema made them look like a double-booking collision!
- **Resolution:** Physical resource modeling with stable IDs (`fac_box_cricket_1` and `fac_box_cricket_2`) resolves this permanently. Historical legacy bookings are quarantined/preserved without rewriting historical timestamps.

### B. Misclassification of Ball-Shooting Machine
- In legacy tables (`facilities`, `facility_profiles`, `pricing_tiers`), `ball-machine` was treated as an independent facility.
- Under authoritative product truth, **Cricket Green Net is 1 physical facility**, and the **Ball-Shooting Machine is an optional paid add-on on that physical facility**.
- **Resolution:** Reclassify `ball-machine` as an add-on mapped to `fac_green_net_1`. Legacy bookings referencing `ball-machine` are preserved in legacy tables for audit, while new reservations map to `fac_green_net_1` with add-on `addon_shooting_machine`.

---

## 4. Target Schema Architecture (Stage 0 Additive Evolution)

To support Admin and Customer features without destroying live tables, Stage 0 introduces the canonical normalized structure additively via `014_stage0_foundation`:

```
properties (Single Patan property)
  └── sections (SPORTS, DINING)
        ├── physical_facilities (Turf 1, Turf 2, Court 1, Court 2, Rink 1, Green Net 1)
        │     ├── facility_services (Box Cricket, Pickleball, Skating, Green Net Practice)
        │     ├── facility_add_ons (Shooting Machine attached to Green Net 1)
        │     ├── facility_blocks (Maintenance, Private, Tournament intervals)
        │     └── facility_sessions (Scheduled vs Actual session logs)
        │           └── session_adjustments (15m extensions, delay records)
        └── dining_stalls (Campus food court stalls)
              ├── dining_tables (Active table numbers / QR tokens)
              └── dining_orders & dining_order_items (Table-number orders)
```

Additionally, security and access control foundations are established:
- `roles`, `permissions`, `role_permissions`, `user_roles` (Dynamic RBAC with 26 fine-grained permissions)
- `payment_holds` (10-minute temporary holds releasing automatically without generating cancelled bookings)
- Additive nullable columns on `bookings`: `physical_facility_id`, `scheduled_start_at`, `scheduled_end_at`, `booking_type`, `delivery_preference`, `total_amount_paise`, `deposit_amount_paise`, `cancellation_actor`, `cancelled_at`.

---

## 5. Compatibility Matrix (PostgreSQL vs SQLite)

| Feature / Concept | Supabase PostgreSQL (`isPostgres = true`) | Local SQLite (`isPostgres = false`) |
| :--- | :--- | :--- |
| **Timestamps** | `TIMESTAMP WITH TIME ZONE` / `TIMESTAMP` | `DATETIME` (ISO 8601 strings in UTC) |
| **Booleans** | `BOOLEAN` (`TRUE`/`FALSE`) | `INTEGER` (`1`/`0`) |
| **Primary Keys** | `VARCHAR(100)` / `BIGSERIAL` | `TEXT PRIMARY KEY` / `AUTOINCREMENT` |
| **Foreign Keys** | `REFERENCES table(id) ON DELETE CASCADE` | `REFERENCES table(id) ON DELETE CASCADE` |
| **Unique Constraints** | `UNIQUE(a, b)` | `UNIQUE(a, b)` |
| **Checks** | `CHECK (end_at > start_at)` | `CHECK (end_at > start_at)` |
| **Overlap Detection** | `WHERE physical_facility_id = $1 AND scheduled_start_at < $3 AND scheduled_end_at > $2` | Same interval query with `?` parameters |
| **Money Amounts** | Non-negative `INTEGER` (Amounts stored strictly in **paise**) | Non-negative `INTEGER` (Amounts stored strictly in **paise**) |

---

## 6. Migration Sequencing & Non-Destructive Policy

1. **Step 1:** Migration `014_stage0_foundation` creates all target foundation tables using `CREATE TABLE IF NOT EXISTS` and adds nullable columns to `bookings` using safe column checks.
2. **Step 2:** Seed canonical baseline property (`prop_patan`), sections (`sec_sports`, `sec_dining`), physical facilities, services, add-on mappings, and RBAC roles/permissions.
3. **Step 3:** Legacy compatibility bridges:
   - Existing legacy routes continue functioning without regression.
   - Legacy booking strings (`2026-09-19`, `06:00 PM – 07:00 PM`) remain untouched.
   - Canonical booking helpers validate new bookings using UTC/IST instants.
4. **Step 4:** Migration execution wrapped in `runVersionedMigrations()` with transactional execution to ensure idempotency.

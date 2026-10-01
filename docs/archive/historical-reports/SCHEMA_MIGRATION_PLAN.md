# Turf & Taste — Schema Migration Plan & Roadmap

## 1. Current State vs. Target Architecture

### Current Database State:
- **Engines:** Supabase Cloud PostgreSQL is the intended production target; the repository also ships a SQLite fallback database for local development and isolated QA.
- **Mandatory preflight:** Do not infer migration state from this document. Before any migration, inspect `schema_migrations`, `sqlite_master` / `information_schema`, row counts, and representative legacy rows in the target environment. The checked-in SQLite fixture may not have every versioned migration recorded even when a remote environment does.
- **Existing Tables:** `admins`, `admin_auth_audit`, `annual_archives`, `blocked_slots`, `bookings`, `business_settings`, `events`, `facilities`, `facility_profiles`, `facility_schedules`, `food_menu_categories`, `food_menu_items`, `food_stalls`, `inquiries`, `media_assets`, `payment_orders`, `payments`, `pricing_tiers`, `quote_redemptions`, `timings`.
- **Key Gaps in Current Model:**
  - Lacks dedicated `sections` and `physical_facilities` separation (facilities and sports are somewhat coupled).
  - Lacks `booking_sessions` for ground operational tracking (`actual_start`, `actual_end`, `delay_minutes`, extensions).
  - Lacks `dining_orders` and `dining_order_items` for table-number food ordering.
  - Lacks dynamic `permissions` and `role_permissions` for granular RBAC.

---

## 2. Non-Destructive Migration Strategy

Migrations will be staged additively without dropping existing tables or interrupting live customer queries:

```
[Stage 1: Additive Foundation]
  ├── Create `sections` table (seed Box Cricket, Pickleball, Skating, Green Nets, Dining)
  ├── Create a bridge from legacy `facilities` / `facility_profiles` to one physical-resource identity
  ├── Add `auto_name`, `display_name`, `section_id`, and unambiguous 24/7 schedule semantics
  └── Create `services`, `addons`, `facility_services`, and `facility_addons` mappings

[Stage 2: Booking Intervals & Session Operations]
  ├── Add canonical timezone-aware scheduled start/end instants and immutable quote/pricing snapshots
  ├── Create `booking_sessions` and extension/adjustment records (1-to-1 / one-to-many as appropriate)
  ├── Add verified guest-history linking metadata and `delivery_preference` (whatsapp/sms)
  └── Retain legacy date/time-slot rows as compatibility data until parity and reconciliation checks pass

[Stage 3: Table-Based Dining Orders]
  ├── Create `dining_orders` table (with `table_number`, `order_status`, `source`)
  └── Create `dining_order_items` table

[Stage 4: Granular RBAC]
  ├── Create `roles`, `permissions`, and `role_permissions`
  └── Map existing `admins` to standard initial roles
```

---

## 3. Backfill & Data Preservation Mapping

1. **Facilities Backfill:**
   - Map legacy facility records only after an explicit identity map is reviewed. `ball-machine` must not be carried forward as a physical facility: it becomes the optional paid add-on on the one Cricket Green Net facility. The two Box Cricket turfs and two Pickleball courts require distinct physical-resource IDs before availability is migrated.
2. **Pricing Backfill:**
   - Preserve existing rates from `pricing_tiers` into normalized `pricing_rules`.
3. **Dining Stalls Backfill:**
   - Existing `food_stalls`, `food_menu_categories`, and `food_menu_items` are preserved, but the migration first verifies their actual column shape. `CREATE TABLE IF NOT EXISTS` alone cannot upgrade an older incompatible `food_stalls` table.

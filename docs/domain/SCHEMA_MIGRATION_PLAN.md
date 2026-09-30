# Turf & Taste — Schema Migration Plan & Roadmap

## 1. Current State vs. Target Architecture

### Current Database State:
- **Engine:** Supabase Cloud PostgreSQL with 13 existing migrations recorded in `schema_migrations`.
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
  ├── Add `auto_name`, `display_name`, `section_id` to `facilities`
  └── Create `services` & `addons` tables with mappings

[Stage 2: Session Operations & Ground Reality]
  ├── Create `booking_sessions` table (1-to-1 extension of `bookings`)
  └── Add `delivery_preference` (whatsapp/sms) to `bookings`

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
   - Map existing facility records (`box-cricket`, `pickleball`, `skating`, `ball-machine`, `cricket-nets`) into normalized `facilities` with proper `section_id` and auto-generated names.
2. **Pricing Backfill:**
   - Preserve existing rates from `pricing_tiers` into normalized `pricing_rules`.
3. **Dining Stalls Backfill:**
   - Existing `food_stalls`, `food_menu_categories`, and `food_menu_items` are preserved and linked to parent `sec_dining`.

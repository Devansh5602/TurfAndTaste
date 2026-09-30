# Turf & Taste — Admin CMS Specification

## 1. CMS Architecture & Core Modules

The Turf & Taste Management Portal is a comprehensive operations and content management system structured into 13 core modules:

```
[Admin Management Portal]
  ├── 1. Section & Category CMS (Dynamic sports & activity sections)
  ├── 2. Physical Facility CMS (Turfs, courts, specs, display names)
  ├── 3. Services & Add-On CMS (Base sports, machine attachments)
  ├── 4. Pricing & Tariffs Engine (Multi-tier, day/night, surges, packages, token rules)
  ├── 5. Availability & Block Manager (Maintenance, tournament, weather closures)
  ├── 6. Booking Desk & Walk-In Creator (Instant reservations, full payment enforcement <1h)
  ├── 7. QR Scanner & Ground Session Desk (Check-in, start/end timestamps, 15m extensions)
  ├── 8. Customer & Guest CRM (Verified mobile/email matching, booking history)
  ├── 9. Dining & Stall POS (Multi-stall management, menus, table orders)
  ├── 10. Events & Notices Publisher (Clubhouse announcements, external CTAs)
  ├── 11. Review Moderation (Approve, unpublish, delete customer reviews)
  ├── 12. Roles & Permissions RBAC (Dynamic role creation, permission assignment)
  └── 13. Reports, Annual Archives & Audit Vault
```

---

## 2. Module Specifications

### Module 1: Section & Category CMS
- Create and organize property sections (e.g. Box Cricket, Pickleball, Skating, Cricket Nets, Future Padel).
- Configure display priority, badges, and default auto-naming conventions.

### Module 2: Physical Facility CMS
- Register physical units (Turf 1, Turf 2, Court 1, Court 2, Rink, Net Area).
- Manage internal ID vs custom display name, surface specs, dimensions, lighting type, and active status.

### Module 3: Services & Add-Ons
- Attach primary services to physical facilities.
- Configure optional paid add-ons (e.g. Ball-Shooting Machine on Cricket Green Net).

### Module 4: Pricing & Package Offers CMS
- Configure Day Rates, Night/Floodlit Rates, and Floodlight start hour.
- Set Weekend Surge percentages (Saturday/Sunday).
- Define consecutive-hour package rules (e.g. 3-hour match rate).
- Configure Token Deposit amount or percentage rule.
- Define 15-minute pro-rated Extension tariffs.

### Module 5: Availability & Facility Blocks
- Block specific physical facilities for maintenance, tournaments, or private hires.
- Enter internal administrative notes and customer-facing status messages (e.g. "Turf maintenance in progress").

### Module 6: Booking Desk & Walk-In Creator
- Full calendar view of all physical facilities.
- Counter booking creation for walk-in players with immediate start options and automatic full-payment enforcement if within 1 hour.

### Module 7: QR Scanner & Session Operations
- Scan customer entry pass QR.
- Display verified booking details.
- Staff buttons for: Check-In, Start Session (logs `actual_start`), Record Delay (with reason), Approve 15-min Extension, End Session (logs `actual_end`).

### Module 8: Customer & Guest Management
- View player profiles and history.
- Match guest bookings to new accounts via verified phone and email.

### Module 9: Dining Stalls & Table Orders
- Manage stall profiles, operating hours, food categories, and menu items.
- Live kitchen order display tagged by Table Number.

### Module 10: Events & Notices
- Publish club tournaments, coaching clinics, and announcements.
- Configure action CTAs (e.g. "Register on WhatsApp", "Google Form Entry", "Read Notice").

### Module 11: Review Moderation
- Review customer feedback. Toggle visibility or delete non-compliant reviews.

### Module 12: Roles & Permissions
- Create custom staff roles (e.g. Night Supervisor, Counter Cashier) and assign specific granular permissions.

### Module 13: Reports & Annual Archives
- View revenue, booking volume, turf occupancy rates, and generate annual audit PDF archives.

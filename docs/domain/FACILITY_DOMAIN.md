# Turf & Taste — Facility & Section Domain Architecture

## 1. Domain Entities & Hierarchy

The facility management architecture is designed around four decoupled levels:

```
[Property]
    └── [Section / Category] (e.g., Box Cricket, Pickleball, Skating, Cricket Nets, Future Activities)
            └── [Physical Facility] (e.g., Turf 1, Turf 2, Court 1, Court 2, Rink, Net Area)
                    ├── [Base Service] (e.g., Box Cricket Play, Standard Net Practice)
                    └── [Optional Add-Ons] (e.g., Ball-Shooting Machine)
```

---

## 2. Dynamic Auto-Naming and Custom Display Names

Physical facilities have both a **stable internal identifier / system auto-name** and an **editable customer-facing display name**:

### Auto-Naming Rule:
- When a section contains only **1 physical facility**, the default auto-name is the section singular title:
  - Example: Section `Box Cricket` -> Default Facility Name: `Box Cricket Turf`.
  - Example: Section `Skating` -> Default Facility Name: `Skating Rink`.
- When a **2nd physical facility** is added to that section, the system auto-indexes existing and new units:
  - Example: `Box Cricket Turf 1`, `Box Cricket Turf 2`.
  - Example: `Pickleball Court 1`, `Pickleball Court 2`.
- **Admin Customization:** Admin can override any facility display name in CMS (e.g., `Pavilion Court A`, `North Box Turf`) without breaking system foreign keys or slot conflict relationships.

---

## 3. Physical Facilities & Add-On Mapping

### Current Baseline Inventory (Patan Campus):

| Section Identifier | Section Name | Physical Facility Identifier | Auto-Generated Name | Default Display Name | Supported Services | Supported Add-Ons |
|---|---|---|---|---|---|---|
| `sec_box_cricket` | Box Cricket | `fac_box_cricket_1` | Box Cricket Turf 1 | Box Cricket Turf 1 | `svc_box_cricket` | None |
| `sec_box_cricket` | Box Cricket | `fac_box_cricket_2` | Box Cricket Turf 2 | Box Cricket Turf 2 | `svc_box_cricket` | None |
| `sec_pickleball` | Pickleball | `fac_pickleball_1` | Pickleball Court 1 | Pickleball Court 1 | `svc_pickleball` | None |
| `sec_pickleball` | Pickleball | `fac_pickleball_2` | Pickleball Court 2 | Pickleball Court 2 | `svc_pickleball` | None |
| `sec_skating` | Skating | `fac_skating_1` | Skating Rink | Skating Rink | `svc_skating` | None |
| `sec_cricket_net` | Cricket Green Nets | `fac_cricket_net_1` | Cricket Practice Net | Cricket Green Net Practice | `svc_cricket_net_practice` | `addon_shooting_machine` |

### The Cricket Green Net & Shooting Machine Model:
- Physical resource: `fac_cricket_net_1` (a single physical batting/bowling net area).
- If booked for standard practice, `fac_cricket_net_1` is occupied.
- If booked with the automated Ball-Shooting Machine (`addon_shooting_machine`), `fac_cricket_net_1` is occupied with the machine fee added.
- **Conflict Rule:** Booking either service occupies the same physical net area `fac_cricket_net_1`. No concurrent booking can exist for standard nets while shooting machine is active, and vice versa.

---

## 4. Extensibility for Future Sections & Facilities

The schema and API do NOT restrict sections or sports to hardcoded enums. CMS administrators can:
1. Create new sections/categories (e.g., Padel, Badminton, Football, Table Tennis, Virtual Gaming).
2. Configure section specifications, icons, and layout styles.
3. Add physical facilities under new or existing sections.
4. Define services, durations, and add-on attachments.
5. Set publication status (`draft`, `published`, `archived`) so customer discovery only exposes authorized and published facilities.

---

## 5. 24/7 Availability & Operational Blocks

Sports facilities operate **24 hours a day, 7 days a week** by default.

### Availability Calculation Factors:
1. **Facility Active & Bookable Flags:** `is_active = true`, `is_bookable = true`.
2. **Confirmed Bookings:** Overlapping intervals occupied by confirmed customer/walk-in bookings.
3. **Approved Session Extensions:** Active bookings with approved time extensions.
4. **Maintenance & Admin Overrides:** Explicit blocks registered in `facility_blocks` table with time range (`start_time`, `end_time`), reason (`maintenance`, `tournament`, `weather`, `private_hire`), internal notes, and customer-facing message (e.g. "Turf re-surfacing scheduled until 4:00 PM").
5. **Operational Delays:** Real-time delay buffers recorded by staff.

# Turf & Taste — Role-Based Access Control (RBAC) Specification

## 1. Permission-Oriented RBAC Architecture

To avoid brittle `if (user.role === 'admin')` checks, access control is governed by **granular permissions assigned to roles**.

### Core Architecture:
```
[User] ──assigned──> [Role] ──composed of──> [Permissions[]]
```

Administrators can create new custom roles (e.g. `Night Duty Staff`, `Event Coordinator`, `Kitchen Cashier`) and assign specific capability permissions.

---

## 2. Standard Baseline Roles

| Role Identifier | Role Name | Intended User Group | Primary Responsibility |
|---|---|---|---|
| `super_admin` | Super Administrator | Property Owner / Lead Manager | Full system access, role management, financial logs, system config |
| `staff` | Ground Operations Staff | Turf & Front Desk Operators | Walk-in bookings, QR check-ins, session start/end, court extensions |
| `stall_staff` | Dining / Stall Operator | Café & Kitchen Operators | Food order management, menu item stock/availability, table delivery |
| `customer` | Registered Member | End-User Customer | Account bookings, passes, table ordering, saved details, reviews |

---

## 3. Granular Permission Matrix

| Module | Permission Key | Description | Super Admin | Staff | Stall Staff | Customer |
|---|---|---|:---:|:---:|:---:|:---:|
| **Facilities** | `facility.view` | View facility profiles | ✓ | ✓ | ✓ | ✓ |
| | `facility.edit` | Update specs, images, names | ✓ | — | — | — |
| | `facility.block` | Create maintenance/event blocks | ✓ | ✓ | — | — |
| **Pricing** | `pricing.view` | View rate cards and tiers | ✓ | ✓ | — | — |
| | `pricing.manage` | Update hourly rates, surges, packages | ✓ | — | — | — |
| **Bookings** | `booking.create_self` | Book courts as customer/guest | ✓ | ✓ | — | ✓ |
| | `booking.create_walkin` | Create immediate counter walk-ins | ✓ | ✓ | — | — |
| | `booking.view_all` | View all customer bookings | ✓ | ✓ | — | — |
| | `booking.extend` | Approve session extensions | ✓ | ✓ | — | — |
| | `booking.cancel` | Cancel reservations | ✓ | ✓ | — | Self only |
| **Session** | `session.scan_qr` | Scan booking QR passes | ✓ | ✓ | — | — |
| | `session.check_in` | Mark customer checked in | ✓ | ✓ | — | — |
| | `session.start_end` | Record actual start/end times | ✓ | ✓ | — | — |
| | `session.adjust` | Apply delay compensation | ✓ | ✓ | — | — |
| **Dining** | `dining.order_table` | Place food orders by table number | ✓ | ✓ | ✓ | ✓ |
| | `dining.manage_orders`| Update kitchen order progress | ✓ | — | ✓ | — |
| | `dining.manage_menu` | Update food menu items & prices | ✓ | — | ✓ (Own stall) | — |
| | `dining.manage_stalls`| Add/edit dining stalls & shops | ✓ | — | — | — |
| **Finance** | `payments.view_logs` | View gateway & audit transactions | ✓ | — | — | — |
| | `reports.view` | View revenue, occupancy, archive reports | ✓ | — | — | — |
| **Administration** | `roles.manage` | Create roles and assign permissions | ✓ | — | — | — |
| | `reviews.moderate` | Moderate and delete reviews | ✓ | — | — | — |
| | `events.manage` | Publish events and notices | ✓ | — | — | — |

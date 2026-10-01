# Turf & Taste — Booking & Availability Engine (BOOKING_AND_AVAILABILITY.md)

This document specifies the canonical booking conflict detection, availability computation, and extension rules.

---

## 1. Single Canonical Availability Authority
All availability checks and conflict evaluations across both Customer and Admin apps evaluate exclusively through `server/domain/booking/canonicalBookingCommand.js`.

### Physical Resource Identity vs Display Name
- Bookings, availability, and facility blocks bind strictly to stable physical resource identifiers (`fac_box_cricket_1`, `fac_box_cricket_2`, `fac_pickleball_1`, `fac_pickleball_2`, `fac_skating_1`, `fac_green_net_1`).
- Human-editable display names (e.g. "Pitch 1", "Centre Court") are never used as conflict identity keys.

---

## 2. Shared Physical Resource Attachment
- **Cricket Green Net & Ball-Shooting Machine:**
  The Ball-Shooting Machine is an add-on attached to `fac_green_net_1`. It occupies the same physical net.
  If Green Net has a standard practice booking from `10:00 – 11:00`, a Ball-Shooting Machine session CANNOT be booked at `10:00 – 11:00` because the underlying physical resource is occupied.

---

## 3. Conflict Invariant
Two occupancies conflict on the same physical facility if:
```sql
(start_at < existing_end_at) AND (end_at > existing_start_at)
```
Occupancies include:
1. `bookings` with status in `('Confirmed', 'Checked-in', 'In Progress')`.
2. `facility_blocks` with status `'Active'`.
3. Approved active `session_adjustments` (extensions).

Cancelled bookings (`status = 'Cancelled'`) are terminal and excluded from conflict queries.

---

## 4. Extension Rules
- Operational extensions must be approved by authorized staff.
- Increments are strictly in **15-minute intervals**.
- The extension engine verifies that `[current_end_at, current_end_at + extension_minutes]` does NOT conflict with the next scheduled occupancy on that resource.
- May be Free (recorded with reason and staff ID) or Paid (server-calculated at pro-rated hourly tariff).

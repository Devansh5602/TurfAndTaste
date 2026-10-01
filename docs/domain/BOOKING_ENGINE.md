# Turf & Taste — Booking Engine Specification

## 1. Core Booking Rules & Constraints

### 1.1 Lead Time Rules
- **Customer Self-Service (Web & Mobile App):** Requires a minimum lead time of **1 Hour (60 minutes)** from current venue time (`Asia/Kolkata`).
  - *Example:* If current venue time is 5:15 PM, the earliest selectable start slot for a customer is 6:15 PM (or next valid slot boundary).
- **Admin & Staff Walk-In Desk:** Can create immediate, last-minute, or current-time walk-in bookings without the 1-hour lead time restriction.

### 1.2 Walk-In Payment Requirement
- Walk-in reservations created **>= 1 hour** before scheduled start may accept either a **Token Deposit** or **Full Payment**.
- Walk-in reservations created **< 1 hour** before scheduled start strictly require **Full Payment** at the counter.

### 1.3 Booking Duration Models

#### A. Standard Quick Bookings (1 Hour / 2 Hours)
- **Durations:** `1 Hour` (60 mins) or `2 Hours` (120 mins).
- **Start Boundaries:** Whole-hour clock boundaries only (`:00`).
  - *Valid Starts:* `06:00 AM`, `07:00 AM`, `08:00 AM`, ..., `11:00 PM`, `12:00 AM`, etc.
- Obsolete fixed `90-minute / 1.5 hr` durations are removed from platform rules.

#### B. Custom Duration Bookings (Whole-Hour Lengths on Quarter-Hour Starts)
- **Start Boundaries:** Quarter-hour increments (`:00`, `:15`, `:30`, `:45`).
  - *Valid Starts:* `12:00`, `12:15`, `12:30`, `12:45`, `01:00`, `01:15`, etc.
- **Duration Rule:** Must be an exact multiple of whole hours (minimum `1 Hour`).
  - *Valid Examples:*
    - Start `12:15` -> Ends `13:15` (1h), `14:15` (2h), `15:15` (3h).
    - Start `18:45` -> Ends `19:45` (1h), `20:45` (2h), `22:45` (4h).
  - *Invalid Examples:*
    - Start `12:15` -> End `13:00` (45 mins — INVALID).
    - Start `12:30` -> End `14:00` (1.5h — INVALID).

### 1.4 Advance Booking Horizon
- Customers can book arbitrarily far in advance as long as pricing rules, facility schedules, and valid calendar dates exist.
- No artificial cutoff (e.g. 7-day or 30-day limits) is enforced unless explicitly configured as a special business policy in CMS.

### 1.5 Notification & Delivery Preference
- Every booking captures the customer's communication channel preference for entry passes, booking updates, and reminders:
  - `whatsapp` (WhatsApp Message)
  - `sms` (Text SMS)
- Captured identically for both **Guest Bookings** and **Logged-In Member Bookings**.

---

## 2. Physical Conflict & Overlap Algorithm

Booking conflicts are evaluated strictly against the **Physical Facility Resource** (`facility_id`), NOT abstract sport names:

### Overlap Condition:
Two intervals $[S_1, E_1)$ and $[S_2, E_2)$ on physical facility $F$ overlap if and only if:
$$\max(S_1, S_2) < \min(E_1, E_2) \iff S_1 < E_2 \land S_2 < E_1$$

### Occupancy Sources Evaluated:
1. Confirmed bookings (`status = 'Confirmed'`, `status = 'Checked In'`, `status = 'In Progress'`).
2. Active approved session extensions (advancing effective interval boundary).
3. Facility maintenance and event blocks (`facility_blocks`).
4. Active payment hold sessions (with temporary TTL).

### 2.1 Unified Slot Availability (`/api/bookings/slots`):
- Operates directly on the canonical physical resource ID (`fac_box_cricket_1`, `fac_green_net_1`, etc.).
- Normalizes all slots to Asia/Kolkata half-open intervals $[S, E)$ with UTC ISO instant evaluation.
- Overlapping active facility blocks flag the slot as `maintenance` with `maintenanceReason`.
- Unblocking immediately restores slot to `available` only when no other confirmed booking, hold, or extension occupies the interval.
- Cross-midnight intervals (e.g. 23:00 to 01:00) cleanly bridge the calendar date boundary.
- Green Net blocks cascade to both standard net practice and Ball-Shooting Machine sessions because both share physical resource `fac_green_net_1`.

---

## 3. Session Extensions & Effect on Availability

Extensions allow customers currently playing to request additional court time:
1. **Manual Staff Approval:** Extensions are not self-executed; staff reviews court availability and approves/rejects.
2. **15-Minute Increments:** Extensions can be granted in `15`, `30`, `45`, or `60+` minute blocks.
3. **Availability Ripple Effect:**
   - *Scenario:* Turf 1 booked `19:00 -> 20:00`. Approved extension of 30 mins extends occupation to `20:30`.
   - **For Standard Quick Bookings (Whole-Hour Starts):** The next available standard slot starts at `21:00` (since `20:00` is partially blocked).
   - **For Custom Bookings (Quarter-Hour Starts):** The next available custom slot starts at `20:30` (conflict-free).

---

## 4. Cancellation & Refund Policy

1. **Who Can Cancel:** Customers (via self-service or desk request) and Admin/Staff.
2. **Cutoff Policy:** No strict cancellation window cutoff is applied. A Customer or authorized Admin/Staff actor may cancel at any time. For a session that has already started, the cancellation must retain actual session history and release only the unoccupied future portion of the facility interval.
3. **Refund Policy:** **0% / NONE** (Token deposits and full payments are non-refundable under current business rules).
4. **Terminal State:** Once a booking is `Cancelled`, it is permanently terminal. It cannot be reverted to `Confirmed`. Availability must exclude the cancelled booking while retaining its immutable audit/session history; if play has already begun, only the unoccupied future portion is newly available.

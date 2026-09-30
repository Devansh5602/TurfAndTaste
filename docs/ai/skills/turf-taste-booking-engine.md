# Turf & Taste Booking Engine Skill Reference

## Core Directives:
1. **Lead Time:** Minimum 1-hour lead time for self-service customer bookings. Staff walk-in desk can create immediate bookings.
2. **Walk-In Payment:** Walk-ins >= 1h can pay token or full payment; walk-ins < 1h require Full Payment.
3. **Durations:**
   - Standard Quick: `1 Hour` and `2 Hours` on whole-hour boundaries (`:00`). (90-min duration is obsolete).
   - Custom: Whole-hour durations (`1h`, `2h`, `3h`...) on quarter-hour starts (`:00`, `:15`, `:30`, `:45`).
4. **Physical Conflict Engine:** Conflicts are evaluated across physical facility ID ($S_1 < E_2 \land S_2 < E_1$).
5. **Extensions:** Approved by staff in 15-minute increments; quick bookings start on next whole hour; custom can start on quarter hour.
6. **Cancellation & Refunds:** Customer/Staff can cancel anytime. Current refund is 0% (none). Cancelled is terminal.
7. **Delivery Preferences:** WhatsApp or SMS stored per booking.

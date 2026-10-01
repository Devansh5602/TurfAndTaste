# Turf & Taste — Product & Business Rules (PRODUCT_RULES.md)

This document specifies the authoritative business rules governing Turf & Taste. Product decisions outrank UI design mockups.

---

## 1. Property & Campus Truth
1. **Patan, Gujarat Property Only:** Turf & Taste is a single physical property located exclusively in Patan, Gujarat, India.
2. **Anti-Hallucination Guardrail:** Never reintroduce external cities (Ahmedabad, Bopal, South Bopal) or fake arena identities (Skyline Arena).
3. **Physical Facilities Inventory:**
   - **Box Cricket:** Turf 1 (`fac_box_cricket_1`), Turf 2 (`fac_box_cricket_2`)
   - **Pickleball:** Court 1 (`fac_pickleball_1`), Court 2 (`fac_pickleball_2`)
   - **Skating:** Skating Rink (`fac_skating_1`)
   - **Cricket Green Net:** Practice Net (`fac_green_net_1`)
   - **Ball-Shooting Machine:** Optional paid add-on attached directly to Cricket Green Net (`fac_green_net_1`). It shares the same physical turf; it is NOT a standalone court.

---

## 2. Operating Model & Hours
1. **Sports Availability:** Sports facilities operate **24 hours a day, 7 days a week (24/7)** conceptually.
2. **Exception-Based Closures:** Sports availability is reduced only by active reservations, ground maintenance, tournaments, private events, or authorized admin blocks (`facility_blocks`). No arbitrary 6 AM – 11 PM cutoff exists for sports facilities.
3. **Dining Outlets:** Sports Café and Gourmet Parlour have independent operational schedules configured by staff.

---

## 3. Booking Engine Rules
1. **Lead Time:** Minimum 1-hour booking lead time required. Bookings starting within 1 hour require full payment at the counter.
2. **Booking Durations:**
   - **Quick Slots:** Strictly **1 Hour** or **2 Hours**.
   - **Custom Slots:** Start time on 15-minute boundaries (`:00`, `:15`, `:30`, `:45`). Minimum duration is 1 hour. Total duration must be a whole-hour multiple from start (e.g. `12:45 → 13:45`, `12:45 → 14:45`).
   - **Forbidden Durations:** 30-minute standard bookings and 90-minute / 1.5-hour standard bookings are strictly prohibited.
3. **Communication Preferences:** Customer may specify WhatsApp or SMS/Text delivery for receipts and booking confirmations. This preference is independent of whether the customer is logged in or booking as a guest.

---

## 4. Cancellation & Refund Policy
1. **Cancellation Rights:** Both customers and authorized staff/admins may cancel a booking.
2. **Cutoff Policy:** No strict time cutoff currently applies.
3. **Refund Policy:** Strictly **0% REFUND**. Cancellation is a terminal transition (`status = 'Cancelled'`).
4. **Re-Opening Inventory:** A cancelled reservation immediately releases the canonical physical resource for other players. Cancelled bookings can never be reverted to Confirmed.

---

## 5. Session & Check-In Operations
1. **QR & Pass Scanning:** Staff can scan QR passes or look up bookings by ID/phone. Scanning displays details for verification and does NOT execute an irreversible state transition automatically.
2. **Scheduled vs. Actual Times:** Scheduled intervals (`start_at`, `end_at`) and actual session times (`actual_start_at`, `actual_end_at`) are separate fields.
3. **Late Starts:** Delays in handover or late customer arrivals do not automatically grant free extensions. Staff decides based on ground availability and upcoming bookings.
4. **Extensions:** Extensions operate in **15-minute pro-rated increments**, check future resource availability on the canonical conflict engine, and may be Free (audited) or Paid (server-calculated).

---

## 6. Dining Scope
1. **Customer App:** Strictly informational/discovery. Customers can browse menus, café ambiance, and highlights. There is NO food ordering, cart, delivery, or food payment on the customer app.
2. **Admin CMS:** Staff can manage food outlets, item descriptions, paise prices, and availability toggle switches.

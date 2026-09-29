# Customer App · Mobile — curated prototype inventory

Source: `CUSTOMER APP · Mobile.svg`, exported from Figma node `97:1417`.

The SVG export outlines textual layer names as vector paths, so its production-frame
names are resolved using the accompanying curated hierarchy rather than any raw
Stitch/export inventory. Dark booking treatments are visual parity states, not
additional light-flow screens.

## Approved production groups

1. **Home & Discovery** — Home - Core Discovery; Facilities - Venue Discovery;
   Customer App — Facility Detail.
2. **Booking Journey** — Booking Step 1 - Sport & Venue; Booking Step 2 - Date
   & Slot; Booking Step 3 - Customer Details; Booking Step 4 - Review & Pay;
   Payment Processing - Razorpay Gateway; Booking Success - Confirmed; Payment
   Failure - Recoverable Retry.
3. **Bookings & Pass** — My Bookings - Confirmed & History; Booking Detail -
   Digital Entry Pass.
4. **Authentication** — Sign In; Create Account; Forgot Password; Reset
   Password; Session Expired.
5. **Profile & Settings** — Profile Overview; Edit Profile; Settings;
   Appearance.
6. **Ratings & Reviews** — Customer App — Verified Ratings & Reviews.
7. **Events** — Events discovery; Event Detail; Event loading; Event empty.
8. **Dining** — Dining discovery; Outlet Detail; Menu; Dining loading; Menu
   unavailable.
9. **Support / Notices / Information** — Customer App — Updates & Notices;
   Customer App — Contact & Inquiry; Customer App — Ground Rules & Guidelines;
   Customer App — About; Customer App — Terms; Customer App — Privacy.
10. **Resilience** — curated offline/recovery state(s).
11. **Midnight Ivory dark-theme parity** — Booking Step 1; Booking Step 2;
    Booking Step 3.

## Ambiguity handling

- No raw Stitch frame is used to add, rename, or replace a curated production
  screen.
- The export does not preserve semantic Figma frame names, so there is no
  machine-verifiable duplicate label inside the SVG. The supplied curated
  hierarchy is authoritative for names and resolves the historical duplicate
  warning.
- Prototype fixture content lives only in `src/prototype/customerMobile/data.js`;
  it intentionally preserves neutral facility/tariff placeholders and does not
  represent production account, booking, payment, or menu data.

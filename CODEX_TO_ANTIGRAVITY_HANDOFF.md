# Curated Customer Mobile Handoff

## Current checkpoint

- **Branch:** `feature/customer-mobile-curated`
- **Base checkpoint:** `6490703 docs(handoff): record chat handoff notes`
- **Design source:** `/home/pc/www/POC/design-reference/customer-app-mobile.svg` (read-only)
- **Figma reference:** `yUBIZk5ptihZqROIobT6S4`, curated Customer App node `97:1417`

The Clubhouse Ivory **Home**, **Facilities**, and **Facility Detail** screens are approved visual baselines. They are implemented by `src/comparison/*` and must not be redesigned. Their small integration changes only connect the curated Facility Detail CTA and bottom navigation to the remaining customer-mobile routes.

## Scope and rules

- Remaining curated areas: Booking Journey, Bookings & Pass, Authentication, Profile & Settings, Ratings & Reviews, Events, Dining, Support/Information, Resilience, and Midnight Ivory parity.
- Only authorized services: Box Cricket; Skating Rink; Pickle Ball; Cricket Green Net Practice; Cricket Green Net Practice with Shooting Machine.
- Dining is discovery/menu information only: no cart, ordering, delivery, pickup, checkout, or food payment.
- Fixture/demo values stay inside `src/prototype/customerMobile/data.js`; do not make them authoritative backend data or present them as a real authenticated account.
- Do not use raw Stitch exports as design authority. The shared SVG is sufficient while Figma MCP remains rate-limited.

## Current implementation map

- Approved discovery baseline: `src/comparison/Home.jsx`, `Facilities.jsx`, `FacilityDetail.jsx`, `components.jsx`, `comparison.css`, `fixtures.js`.
- Remaining fixture-backed curated screens: `src/prototype/customerMobile/CustomerMobilePrototype.jsx`, `customerMobile.css`, `data.js`.
- `src/App.jsx` now exposes direct customer-mobile entry routes (`/booking`, `/payment/processing`, `/my-bookings`, `/sign-in`, `/profile`, `/events`, `/dining`, information and recovery routes) without changing the approved discovery composition.

## Completed checkpoint — Booking route and prerequisite guards

- Curated Facility Detail now enters the booking journey; the approved discovery layout was not redesigned.
- The approved bottom navigation now reaches customer Dining, Events, and Profile entries.
- Direct customer-mobile entry routes are exposed from `src/App.jsx` for booking, payment, pass/history, auth, profile, events, dining, information, and offline states.
- The fixture booking flow starts without a selected slot. Step 2 cannot continue without one, Step 3 cannot continue without a name and a ten-digit mobile number, and changing a service clears a chosen slot.
- Browser deep links for later booking steps intentionally restart at Step 1 because no verified local reservation context exists. This prevents a route from faking an in-progress booking.
- Payment processing/failure remains a fixture-only state with no live order, secret, or charge. The obsolete unsupported Paddle reference was removed from the processing surface.
- `npm run build` and `git diff --check` passed after this slice.

## Exact next task

1. Finish the SVG comparison and interactive browser QA for Booking Steps 1–4, Processing, Success, Failure, Pass, and My Bookings at the 390px composition.
2. Preserve the new prerequisite guards while correcting only verified visual divergences.
3. Then refine the Authentication and Profile & Settings groups against the curated SVG, keeping guest/fixture state explicit and non-authoritative.

## Known constraints

- Figma MCP rate limiting is not a blocker; use the local SVG.
- The main project’s historical backend roadmap documentation is separate from this curated customer-mobile visual fixture work.
- No live authentication, backend booking, or payment transaction is required for this curated prototype. Never expose credentials or secrets.

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

## Completed checkpoint — Authentication fixture guard

- The exposed Sign In/Create Account/Forgot/Reset fixture now starts with blank values and disables its primary action until the appropriate local input requirements are satisfied.
- The rendered auth copy explicitly identifies this as a local preview and does not claim to create or use a production customer account.
- Direct `/sign-in` browser QA confirms no phone number or other customer identity is prefilled and the Sign In action is disabled initially.

## Completed checkpoint — Alternate-state route correction

- `/create-account`, `/events/loading`, `/events/empty`, `/dining/loading`, and `/dining/unavailable` now normalize to their intended owning screen and render their specified state.
- Browser accessibility checks verified the account form has one mobile-number field, no prefilled customer identity, and the expected disabled action; the Events and Dining recovery states expose meaningful retry/home/outlet actions.

## Completed checkpoint — Guest-safe Profile & Settings

- The exposed Profile, Edit Profile, and Settings routes now render guest/local-preview information instead of hardcoded personal data, saved payment methods, membership status, or a supposedly authenticated customer.
- Profile keeps its curated hierarchy and navigation to bookings, local edit details, reviews, appearance, notices, and support; no profile form writes production data.
- Browser QA of `/profile` confirms an explicit local preview label and no customer phone/email values.

## Completed checkpoint — Midnight Ivory parity entry

- Customer-mobile routes accept `?theme=midnight` to initialize the existing semantic Midnight Ivory token set without duplicating light-theme screens.
- The controlled parity check route is `/booking?theme=midnight`; it preserves the same fixture safeguards and only changes the visual token layer.

## Completed checkpoint — Safe booking-pass and review fixtures

- The exposed confirmation, entry-pass, reservation-history, and verified-review screens keep their curated compositions and routes while clearly identifying local fixture data.
- Fabricated reservation references, venue dates, payment claims, live-sync language, customer review history, and supposedly active venue access were replaced by contextual placeholders or preview labels.
- The entry-pass QR remains illustrative and is explicitly not valid for venue entry. No prototype route writes a review, creates a booking, or opens a real payment flow.

## Completed checkpoint — Events, Dining, and Midnight fixture consistency

- Event discovery/detail now preserves the curated card/detail treatment while using the selected fixture record consistently instead of mixing it with unrelated hardcoded event content.
- Event capacity, registration, ticketing, and venue data are not presented as live; no event purchase or registration route exists.
- Dining remains browse-only. Its loading/unavailable recovery copy and discovery label make the fixture status clear; no ordering, cart, delivery, pickup, or food-payment behavior has been added.
- Midnight Ivory now overrides the event, payment, pass, and recovery surfaces that previously retained light-only hardcoded values, while preserving the same route and component composition.

## Completed checkpoint — Appearance and resilience route coverage

- Appearance is available as its own controlled customer-mobile route (`/appearance`) as well as from Settings; it toggles only the local Clubhouse Ivory/Midnight Ivory preview state.
- A distinct customer-app system recovery route (`/system-error`) now provides Go Home and Go Back actions without changing local fixture data.

## Exact next task

1. Complete the source-driven QA pass for direct support/information routes and the remaining alternate loading/empty/unavailable recovery states at the 390px composition.
2. Verify the complete customer navigation graph (booking guards, authentication, profile/settings/appearance, events, dining, support, resilience, and Midnight route entry) without introducing production claims.
3. Keep the approved discovery baselines unchanged and avoid using demo values as live customer, booking, payment, event, account, or outlet data.

## Known constraints

- Figma MCP rate limiting is not a blocker; use the local SVG.
- The main project’s historical backend roadmap documentation is separate from this curated customer-mobile visual fixture work.
- No live authentication, backend booking, or payment transaction is required for this curated prototype. Never expose credentials or secrets.
- The current local branch is ahead of `origin/feature/customer-mobile-curated` by the recent verified checkpoints. An attempted push was rejected by this environment’s branch-risk policy despite the branch documented in the continuation brief; do not force-push or use a workaround.

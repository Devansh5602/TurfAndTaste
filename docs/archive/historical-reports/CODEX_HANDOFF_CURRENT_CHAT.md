# Turf & Taste — Current Chat Handoff

## 1. Project Overview

Turf & Taste is a sports-venue and dining platform with a Vite/React customer UI, Capacitor mobile packaging, and an Express backend. The wider repository has evolved through server-authoritative booking, pricing, payment, admin, facility, food, and events work. The current task is a **controlled visual comparison**, not a continuation of that product roadmap.

Use the existing Vite, Capacitor, Express, environment, and asset conventions. Do not replace the architecture or add a large UI library for the comparison.

## 2. Product Rules

The only permitted sports/services are:

1. Box Cricket
2. Skating Rink
3. Pickle Ball
4. Cricket Green Net Practice
5. Cricket Green Net Practice with Shooting Machine

Never expose Football, Padel, Tennis, Badminton, Basketball, Squash, Golf, or invented sports.

Dining is discovery and menu information only. Never add food cart, ordering, delivery, pickup, food checkout, or food payment.

## 3. Figma Source of Truth

- Figma file: **Turf & Taste — Mobile App UI/UX Master**
- Figma file key: `yUBIZk5ptihZqROIobT6S4`
- Curated Customer App node: `97:1417`
- Primary current comparison reference: `/home/pc/www/POC/design-reference/customer-app-mobile.svg`

The shared SVG is read-only and authoritative. Inspect it directly before implementation. Do not rename, edit, optimize, regenerate, or move it.

Raw Stitch exports are not authoritative: they include duplicate, superseded, legacy, and experimental screens. If historical code or assets conflict with the curated SVG, the SVG wins. Live Figma MCP has previously hit a Starter-plan rate limit; do not block on it or retry it repeatedly.

## 4. Curated Customer Mobile Group Hierarchy

The curated Customer App mobile source groups are:

1. Home & Discovery — Home - Core Discovery; Facilities - Venue Discovery; Customer App — Facility Detail
2. Booking Journey — Booking Steps 1–4; Payment Processing; Payment Failure
3. Bookings & Pass — Booking Success; Digital Entry Pass; My Reservations
4. Authentication — Sign In; Create Account; Forgot Password; Reset Password; Session Expired
5. Profile & Settings — Profile; Edit Profile; Settings; Appearance
6. Ratings & Reviews — Customer App — Verified Ratings & Reviews
7. Events — Events; Event Detail; loading and empty states
8. Dining — dining discovery; outlet detail; menu; loading/unavailable states
9. Support, Notices & Information — notices; contact; rules; about; terms; privacy
10. Resilience — offline and recovery states
11. Midnight Ivory · Dark Theme — curated dark parity frames

Only the first group is in scope for the controlled comparison.

## 5. Yesterday’s Codex Prototype Branch

Branch: `prototype/customer-mobile-from-curated-figma`

It was an earlier broad prototype effort, created to make a runnable Customer Mobile preview from the curated design. It implemented many screens and was pushed to `origin`. Its current local/remote commit is:

`d19ed37451239413fd3b08bada607b2f80bae360`

It must remain intact. It is historical/reference work only and **must not be inspected, copied, cherry-picked, or used as implementation source** for the fair comparison.

## 6. Three-Agent Comparison Setup

All comparison branches start from the same base SHA:

`175c09fa596b4f82d7c6bbe67508862772aec027`

| Agent | Worktree | Branch | Preview port |
| --- | --- | --- | --- |
| Codex | `/home/pc/www/POC/turf-taste-codex` | `prototype/compare-codex` | `3001` |
| Antigravity | `/home/pc/www/POC/turf-taste-antigravity` | `prototype/compare-antigravity` | `3002` |
| Gemini CLI | `/home/pc/www/POC/turf-taste-gemini` | `prototype/compare-gemini` | `3003` |

The worktrees are isolated. Do not edit, inspect, switch to, merge, rebase, reset, or cherry-pick another comparison branch or worktree. Do not copy the previous prototype implementation. Each agent independently implements the same three screens from the shared SVG.

## 7. Current Codex Session Problem

This old chat remains bound to:

- Worktree: `/home/pc/www/POC/TurfAndTaste`
- Branch: `prototype/customer-mobile-from-curated-figma`
- HEAD: `d19ed37451239413fd3b08bada607b2f80bae360`

The proper Codex comparison worktree already exists at `/home/pc/www/POC/turf-taste-codex` and is correctly checked out on `prototype/compare-codex` at the shared base SHA.

Therefore, do **not** use this old session for comparison implementation. Start a new Codex chat rooted at `/home/pc/www/POC/turf-taste-codex`.

## 8. Current Comparison Scope

Implement exactly these three curated screens:

1. Home - Core Discovery
2. Facilities - Venue Discovery
3. Customer App — Facility Detail

Required flow:

`Home → Facilities → Facility Detail`

The detail booking CTA may be inert or lead to a minimal explicit out-of-scope indication. Do not implement booking, payments, accounts, events, dining, support, resilience, admin, web, or dark theme in the comparison.

## 9. Visual Fidelity Requirements

- Target roughly 390px width.
- Use a fixed mobile viewport with natural vertical scrolling; never shrink an entire long Figma frame into one viewport.
- Use Plus Jakarta Sans where supported.
- Preserve the Clubhouse Ivory visual language from the SVG.
- Reproduce actual SVG structure, sequence, cards, copy, spacing, headings, radii, borders, overlays, status chips, CTA placement, and bottom navigation.
- This is not a redesign or "inspired by" exercise.
- Preserve source copy when readable. Use a neutral placeholder only where outlined SVG text cannot be recovered.
- Do not transform source stacked cards into masonry/Pinterest layouts, thumbnail-left cards, or a generic marketplace.

## 10. Home Fidelity Details

Reproduce:

- Home header with notification and profile controls
- Bopal, Ahmedabad location selector
- CLUBHOUSE LOUNGE
- Good afternoon, Devansh
- Reserve Your Slot hero, source badge/status treatment, and Book Now CTA
- Authorized Arenas
- All Activities selected initially where shown
- Authorized sport chips using only the five approved services
- Quick Match Booking
- vertically stacked image-led facility cards with overlays, tariff/availability, and Book Slot CTA
- source bottom navigation

Earlier rejected reinterpretations: “Find your next play,” “Ready for your game?”, masonry/Pinterest grids, and compact horizontal cards.

## 11. Facilities Fidelity Details

Match the source header, search field, filter/settings control, sport chips, availability summary, vertically stacked cards, image proportions, distance/rating overlays, tags, venue name/location, tariff/availability, View Arena & Slots CTA, scrolling, and bottom navigation. Do not create a generic marketplace list.

## 12. Facility Detail Fidelity Details

Use only the newer curated Facility Detail. Do not revive old Skyline-style legacy detail.

Preserve the intentionally neutral source treatment where shown:

- `[Facility Name]`
- `[Facility Reference]`
- `[Review Count]`
- `[Configured Tariff]`

Match header, imagery, status, reference/name/review block, authorized service label, specification cards, About This Facility, pricing/tariff, supporting information, long scroll, and booking CTA/sticky action.

## 13. Repository and Safety Rules

- Do not modify production branches, main/master, or `feature/turf-and-taste-v2`.
- Do not force-push, reset, or delete unrelated work.
- Do not expose secrets or alter existing `.env` handling.
- Do not install unrelated packages.
- Use the existing Vite/Capacitor/Express/Supabase/Vercel architecture when useful.
- Keep comparison fixture data isolated from production backend/domain logic.

## 14. Current Next Step

The next step is **not** to continue this current chat.

1. Start a new Codex chat/project context rooted at `/home/pc/www/POC/turf-taste-codex`.
2. Give the new chat this file first.
3. Have it verify `prototype/compare-codex`, shared base SHA, status, and worktree path.
4. Have it inspect `/home/pc/www/POC/design-reference/customer-app-mobile.svg`.
5. Send the controlled three-screen prompt.
6. Run the preview on port `3001`.

## 15. Known Important Paths and Branches

| Item | Path / branch |
| --- | --- |
| Old chat worktree | `/home/pc/www/POC/TurfAndTaste` |
| Old prototype branch | `prototype/customer-mobile-from-curated-figma` |
| Codex comparison worktree | `/home/pc/www/POC/turf-taste-codex` |
| Codex comparison branch | `prototype/compare-codex` |
| Shared design reference | `/home/pc/www/POC/design-reference/customer-app-mobile.svg` |
| Original user SVG attachment | `/home/pc/Downloads/CUSTOMER APP · Mobile.svg` |
| Git remote | `origin` → `git@github.com:Devansh5602/TurfAndTaste.git` |
| Codex preview | `http://127.0.0.1:3001` |

## 16. New-Session Do / Do Not Checklist

### Do

- Work only in `/home/pc/www/POC/turf-taste-codex` on `prototype/compare-codex`.
- Read the shared SVG first.
- Independently implement only Home, Facilities, and Facility Detail.
- Use port 3001.
- Perform visual comparison at approximately 390px after every screen.
- Test Home → Facilities → Facility Detail and both back paths.
- Run production build, `git diff --check`, and configured lint/type/test commands when available.
- Commit only the independent comparison implementation on its own branch.

### Do Not

- Do not switch branches/worktrees.
- Do not inspect, modify, merge, or copy another comparison implementation.
- Do not use yesterday’s broad prototype implementation.
- Do not implement out-of-scope screens or backend work.
- Do not use raw Stitch material as screen authority.
- Do not add unauthorized sports or food ordering.
- Do not modify the shared SVG.

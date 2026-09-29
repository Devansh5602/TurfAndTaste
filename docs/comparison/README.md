# Curated three-screen comparison

Independent implementation on `prototype/compare-codex`, based on
`175c09fa596b4f82d7c6bbe67508862772aec027` in
`/home/pc/www/POC/turf-taste-codex`.

## Reference and scope

The authoritative reference is the read-only file
`/home/pc/www/POC/design-reference/customer-app-mobile.svg`.
Its SHA-256 before implementation was
`ea12a22effc63262a3560a8077863d64c2bcff6395669e802703e3fd0cce03c8`.

The three reference frames begin at `(135,94)`, `(557,94)`, and `(979,94)`;
each is 390px wide. Home is 2296.5px tall; the Facilities content frame is
1492px tall (its exported bottom navigation is farther down the shared
2296.5px artboard); Detail is 1887.75px tall. In the implementation, bottom
navigation and the detail CTA stay at the viewport bottom, with enough
content padding to scroll every card above them. Nothing scales the long
screens to fit the viewport.

Routes:

- `/`: Home - Core Discovery
- `/facilities`: Facilities - Venue Discovery
- `/facilities/detail`: Customer App — Facility Detail

Home's Book Now / Book Slot actions go to Facilities. Every View Arena &
Slots action opens the one neutral curated detail template. Both explicit
back controls, browser history, and Home/Venues bottom navigation work.
Search and activity chips filter isolated fixtures. Booking and other
out-of-scope actions show a dismissible scope message without opening new
screens or contacting production services.

The Home event/dining teaser cards, detail feedback excerpt, and inactive
navigation labels reproduce content within the three approved screens.
They do not implement Events, Dining, Reviews, accounts, or booking flows.

## Implementation boundaries

`src/main.jsx` selects the isolated `src/comparison/ComparisonApp.jsx`
entry using the existing RouterProvider. Existing production page and
backend modules remain unchanged. The comparison does not fetch inventory
or call booking, payment, account, or admin APIs. Existing Capacitor startup
is preserved; its status-bar background now matches the ivory preview.
The preview HTML no longer loads the unrelated checkout SDK or old fonts.

`src/comparison/fixtures.js` holds SVG example venue names, prices, counts,
and availability. They are visual fixtures, not authoritative live data.
Detail specifications and other source copy are likewise display fixtures.
Neutral placeholders remain intact. No unsupported sports were added.

All nine photographs were decoded unchanged from embedded JPEG data in the
shared SVG. `public/comparison` contains these exact image assets plus
locally hosted Plus Jakarta Sans weights 400–800 and their OFL license.
No images were generated or replaced with stock photography.

## Validation

Run the preview with the assigned CLI port override:

```sh
npm run dev -- --host 127.0.0.1 --port 3001 --strictPort
```

- Production build: `npm run build` — passed.
- Whitespace validation: `git diff --check` — passed.
- No lint, typecheck, or test scripts are configured in the root or server
  package manifests. Existing scratch scripts exercise unrelated backend
  and payment behavior; they are outside this comparison's scope.
- Browser QA: 84 assertions passed, with zero console or runtime errors.
- Tested 390×844, 320×844, 360×844, and 480×844 viewports. The application
  remains centered at a maximum width of 390px.
- Verified forward flow, both explicit back controls, browser back, search,
  empty-state recovery, chip selection, filter reset, and inert booking
  feedback. All images load, every screen scrolls, fixed controls remain
  visible, and document width never exceeds viewport width.
- Visually rendered all three screens, compared them to local SVG crops,
  corrected Home wrapping and Detail spacing, then inspected again.
- At 390px, Facilities cards begin at y=234/600/994 with heights
  350/378/402px, matching the SVG. Detail specifications, About, Pricing,
  Guidelines, and Feedback start at y=520/826/1057.75/1343.75/1613.75,
  matching the SVG. Home hero begins at y=188 and first card at y=514.

The reproducible browser checks are in `scripts/compare-qa.cjs`. They use
Playwright available in the environment, without adding a project package:

```sh
PLAYWRIGHT_MODULE_PATH=/path/to/playwright \
CHROME_PATH=/usr/bin/google-chrome \
node scripts/compare-qa.cjs
```

`QA_OUTPUT` optionally changes the artifact folder from
`/tmp/turf-taste-comparison-qa`. The preview must already be running.

## Remaining visual differences

- Lucide equivalents differ from some source pictograms, including sports,
  profile, status-bar, and specification icons.
- Live Plus Jakarta Sans text has small glyph, kerning, weight and baseline
  differences from the outlined export. Home's two venue-card heights differ
  by about 0.5px each; full-page content height rounds to 2296px versus the
  2296.5px source.
- Facilities includes an explicit back arrow to satisfy the required
  Facilities → Home path, which shifts its title compared with the source.
- The SVG's overflowing review link is constrained to the mobile content
  width. Narrow viewports wrap text rather than clipping it.
- Fixed controls follow the actual mobile viewport rather than the bottom
  of the very long exported artboard.

Missing/unrecoverable images: none. The SVG contains no text nodes (copy is
outlined paths), but all visible copy in the three target screens was
recovered visually; no unreadable fragments needed invented replacements.

No out-of-scope production screens were implemented. No other worktree or
comparison implementation was inspected or modified. No previous prototype
code was used. The shared SVG was not modified. No push was performed.

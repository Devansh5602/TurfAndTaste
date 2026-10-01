# Turf & Taste — Mandatory AI Agent Operating Instructions (AGENTS.md)

> **MANDATORY DIRECTIVE FOR ALL AI CODING AGENTS (Codex, Antigravity, Gemini, Claude, etc.):**
> Before designing, editing, or modifying ANY code in this repository, you MUST read and follow the authoritative domain specifications located in `docs/domain/`.

---

## 1. Required Reading Before Modifying Code

1. [docs/domain/PROJECT_TRUTH.md](file:///home/pc/www/POC/TurfAndTaste/docs/domain/PROJECT_TRUTH.md) — Single Patan property model, physical hierarchy, sports inventory.
2. [docs/domain/FACILITY_DOMAIN.md](file:///home/pc/www/POC/TurfAndTaste/docs/domain/FACILITY_DOMAIN.md) — Section vs Facility vs Service vs Add-On model, 24/7 sports availability.
3. [docs/domain/BOOKING_ENGINE.md](file:///home/pc/www/POC/TurfAndTaste/docs/domain/BOOKING_ENGINE.md) — Lead time (1h), durations (1h/2h quick, whole-hour custom on :00,:15,:30,:45), conflict algorithm, 0% refund cancellation.
4. [docs/domain/PRICING_ENGINE.md](file:///home/pc/www/POC/TurfAndTaste/docs/domain/PRICING_ENGINE.md) — Dynamic multi-tier pricing, floodlight night rates, weekend surge, package offers.
5. [docs/domain/SESSION_OPERATIONS.md](file:///home/pc/www/POC/TurfAndTaste/docs/domain/SESSION_OPERATIONS.md) — Scheduled vs actual time, QR check-in, 15-minute extensions, ground delay adjustments.
6. [docs/domain/RBAC.md](file:///home/pc/www/POC/TurfAndTaste/docs/domain/RBAC.md) — Permission-oriented access control matrix.
7. [docs/domain/DINING_AND_ORDERS.md](file:///home/pc/www/POC/TurfAndTaste/docs/domain/DINING_AND_ORDERS.md) — Multi-stall property dining, table-number food ordering in scope.
8. [docs/domain/DATA_MODEL.md](file:///home/pc/www/POC/TurfAndTaste/docs/domain/DATA_MODEL.md) — Target normalized relational data model.

---

## 2. Strict Inviolable Agent Guardrails

### ❌ Strictly Prohibited:
1. **NO Invented Locations:** Turf & Taste is in **Patan, Gujarat**. NEVER reintroduce Bopal, Ahmedabad, South Bopal, or fake city branches.
2. **NO Fake Arena Identities:** NEVER invent external arena names (e.g. "Skyline Arena"). All facilities belong directly to the single Turf & Taste campus.
3. **NO Hardcoded 90-Minute Booking:** NEVER use fixed 90-minute / 1.5h durations. Standard durations are strictly **1 Hour** and **2 Hours**.
4. **NO Hardcoded 11 PM Sports Closing:** Sports facilities operate **24/7** conceptually, constrained only by active bookings, approved extensions, and administrative maintenance blocks.
5. **NO View-Only Dining Claims:** Customer table-number food ordering is IN SCOPE. Never claim dining is view-only.
6. **NO Separate Shooting Machine Facility:** The Ball-Shooting Machine is an optional paid add-on on the single Cricket Green Net facility, not a standalone court.
7. **NO Fake Production Auth / Payments:** Keep mock preview states isolated; never fake verified production auth or live payment records.
8. **NO Route-Only QA Verification:** Never mark functional QA passed merely because HTTP 200 was returned. Forms must accept real typing, CTAs must trigger real state transitions, and step guards must be validated interactively.

---

## 3. Project-Local Skill Cheatsheets
Refer to the specialized project skills in `.agents/skills/` and `docs/ai/skills/`:
- `turf-taste-domain`: Property and facility hierarchy rules.
- `turf-taste-booking-engine`: Lead times, durations, overlaps, and extensions.
- `turf-taste-admin-cms`: CMS modules and data management rules.
- `turf-taste-functional-qa`: Interactive state and UI validation standards.
- `turf-taste-no-invention`: Strict anti-hallucination policies.

---

## 4. Mandatory Repository Cleanliness Rule

Before EVERY commit and push, all AI agents (Antigravity, Codex, etc.) must:
1. **Remove Debug & Dead Code:** Remove temporary `console.log` statements, print assertions, and abandoned helpers.
2. **Remove Unnecessary Comments:** Delete AI-generated narration, obvious code restatements, and temporary fix notes. Keep only comments explaining non-obvious business/security/database invariants.
3. **Remove Accidental Generated Files:** Ensure runtime sidecars (`*.db-wal`, `*.db-shm`), temporary scratch files, and build dumps are not tracked in git.
4. **Inspect Untracked Files & Run Diff Check:** Run `git status` and `git diff --check` before committing.
5. **Preserve Architectural History:** Keep repository structure intentional and do not delete valuable domain documentation or regression tests.


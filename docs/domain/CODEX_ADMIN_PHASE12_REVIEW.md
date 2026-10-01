# Codex Admin Phase 1.2 Release Review

**Reviewed commit:** `1b1d8df`  
**Review date:** 2026-10-01  
**Verdict:** **NOT READY**

## APPROVED

- The canonical resolver supports facility/service scope, day/night and weekend periods, special-date replacement/modifier rules, deterministic packages, add-ons, deposit calculation, and 15-minute extension rates in integer paise. This review made service/generic and facility/generic selection deterministic and fail-closed when no price exists.
- Authenticated walk-in creation ignores client monetary fields. A real HTTP regression persisted the server-resolved total instead of a submitted one-paise value. The canonical command still enforces full payment for an immediate Staff walk-in inside the one-hour threshold.
- Paid extension requests ignore client `chargePaise`, calculate inside the resource-locked transaction, and persist the server amount. Resolver failure now aborts instead of silently granting a zero-price paid extension.
- Free extensions require an explicit boolean and reason and persist zero charge, operator, reason, and timestamp. String coercion such as `isFree: "false"` is rejected.
- `GET /api/bookings/slots` uses canonical physical-resource occupancies for confirmed bookings, active `facility_blocks`, approved extensions, and active holds. Turf isolation, release behavior, cross-midnight half-open intervals, and shared Green Net/Shooting Machine identity passed route/domain QA.
- Migration 020 is additive and idempotent on fresh isolated SQLite state, and configured legacy facility prices are preserved through additive rule backfill.
- Two final full isolated runs passed `190/190`; production web build and Android `:app:assembleDebug` passed with Node 22 and the full JDK 21 at `/home/pc/jdk-21`.

## REQUIRED FIX

- **One pricing authority is not yet established.** `POST /api/v2/quotes` still independently reads `pricing_tiers`, computes start-time-only day/night/weekend totals, and ignores canonical service/add-on, package, special-date, interval-boundary, and canonical occupancy rules. Customer quotes can therefore disagree with Admin walk-ins and the new resolver.
- **One availability/block authority is not yet established.** `loadCanonicalOccupancies` still reads legacy `blocked_slots`; legacy `/api/bookings/block-slot`, `/blocked-slots`, and `/unblock-slot` still write/read that table; and `POST /api/v2/quotes` checks it directly. These remain active parallel authorities beside `facility_blocks`.
- **Accepted booking price evidence is incomplete.** Confirmed bookings store total/deposit amounts, while the immutable applied-rule snapshot required by `PRICING_ENGINE.md` remains only in transient quote/payment-order context and is not persisted on every booking mutation path. Later pricing edits cannot be audited reliably from the booking alone.
- **Migration 020 seeds an unsupported ₹200/hour Shooting Machine tariff as production truth.** No authoritative source establishes that amount. Because migration 020 may already be recorded, do not rewrite it or blindly delete the row; an additive reconciliation must distinguish the bootstrap value from an administrator-confirmed price and require explicit configuration.

## MINOR NON-BLOCKING ISSUE

- Package rules support replacement totals but the schema does not yet encode a separate package-discount modifier mode described as optional in the domain document. Phase 2 CMS must not expose a modifier option until its persisted semantics are explicit.
- Remote PostgreSQL execution was not available in this review. PostgreSQL compatibility was inspected structurally and existing cross-database regression evidence remains green, but migration 020 was executed only on isolated SQLite here.

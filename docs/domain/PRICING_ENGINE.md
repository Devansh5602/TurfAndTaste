# Turf & Taste — Pricing Engine Specification

## 1. Dynamic Multi-Tier Pricing Architecture

Pricing is calculated server-authoritatively using rule-based evaluation rather than hardcoded UI formulas.

### Pricing Input Variables:
1. **Section / Category** (`section_id`)
2. **Physical Facility** (`facility_id`)
3. **Base Service** (`service_id`)
4. **Optional Add-Ons** (`addon_ids[]`, e.g., `addon_shooting_machine`)
5. **Time Period:**
   - **Day Session:** (Standard daylight hours, e.g., `06:00 AM – 06:00 PM`)
   - **Night / Floodlit Session:** (Peak lighting hours, e.g., `06:00 PM – 06:00 AM`)
6. **Day of Week:** Weekday (Mon–Fri) vs Weekend (Sat–Sun) surge multipliers.
7. **Special Occasions / Date Overrides:** Holiday or festival date-specific tariffs.
8. **Consecutive Hour Packages & Offers:** Discounted multi-hour tier rules (e.g. 3-hour match package).

All monetary inputs and outputs are integer **paise**. Display formatting to rupees is a client concern and must never be reparsed as an authoritative amount.

---

## 2. Rule Evaluation Precedence Order

When quoting or finalizing a booking, the Pricing Engine evaluates rules in strict hierarchical precedence:

```
[1. Special Date / Holiday Override Rule]
       ↓ (If not matched)
[2. Multi-Hour Package / Offer Rule]
       ↓ (If not matched)
[3. Time-of-Day / Peak Rate (Floodlit / Day Rate)]
       ↓
[4. Day-of-Week Surge Multiplier (Weekend Surge %)]
       ↓
[5. Add-On Surcharges (e.g., Ball-Shooting Machine)]
       ↓
[6. Token Deposit Calculation (Configured Fixed Deposit or % Rule)]
```

### Rule Composition Clarification

- A special-date rule declares whether it is a **replacement base rate** or a **modifier**. It must not be silently combined with an unrelated base rate.
- A package declares whether it replaces the computed service subtotal or applies a discount modifier. Only one replacing package may apply to a quote.
- When a booking crosses a pricing boundary (for example day to floodlit time), the engine prices each intersecting interval segment before applying a package or allowed modifier; it must not price the entire booking from its start time alone.
- The confirmed booking stores an immutable pricing snapshot: rule identifiers/versions, all applied components, total paise, deposit paise, and quote expiry. Later CMS edits never reprice an existing booking.

---

## 3. Package Offers & Multi-Hour Discounts

The CMS enables administrators to configure package rates:
- **Standard Hourly Rate:** Calculated per hour based on day/night rate + weekend surge.
- **Consecutive Hour Packages:**
  - *Example:* Standard Rate = ₹1,200/hr. 3-Hour Package = ₹3,000 (saves ₹600).
- **Special Occasion Tariffs:** Admin can define custom pricing for specific calendar dates (e.g. New Year's Eve, IPL Tournament Week).

---

## 4. Token / Deposit Policy

1. **Configurable per Facility/Service:** Each pricing rule defines whether a deposit is accepted and what rule applies:
   - `fixed_amount`: An explicit rupee value (e.g., ₹300 for Box Cricket, ₹200 for Skating).
   - `percentage`: A percentage of total booking fee (e.g., 30% of total payable).
2. **Walk-In Token Cutoff:** If booked within 1 hour of session start, token payment is disabled and full payable amount is required.

---

## 5. Session Extension & Adjustment Tariffs

- **Extension Rate:** Configured as a pro-rated 15-minute tariff based on the active session's hourly rate period (Day or Night) via `pricing_rules` (`rule_type = 'EXTENSION_RATE'`) or pro-rated `BASE_RATE`.
- **Server Authority:** Staff approval determines whether an extension is free or chargeable; the charge amount is calculated strictly by the server and persisted in `session_adjustments`. Client-submitted monetary values are ignored.
- **Discretionary Adjustments:** Admin/Staff can waive extension fees (Free Extension, persisting `is_free = 1` and `charge_paise = 0`) or apply standard server-calculated extension charges.

---

## 6. Canonical Schema & Precedence Implementation (Migration 020)

- **Database Tables:**
  - `pricing_rules`: Stores base rates, package deals, and extension tariffs per facility and period type (`DAY`, `NIGHT`, `WEEKEND_DAY`, `WEEKEND_NIGHT`, `PACKAGE`).
  - `special_date_prices`: Stores calendar-date specific overrides (`calendar_date`, `is_replacement`, `rate_paise_per_hour`).
  - `add_on_prices`: Stores hourly and flat tariffs per add-on (`add_on_id`, `rate_paise_per_hour`, `rate_paise_flat`).
- **Resolver Engine:**
  - `server/domain/pricing/pricingResolver.js`: Exposes `resolvePricing`, `resolveExtensionPricing`, and `resolveAdminWalkInPricing`.
  - Implements interval-boundary splitting across floodlight transitions, multi-hour package evaluation, and transparent rule-application logs.

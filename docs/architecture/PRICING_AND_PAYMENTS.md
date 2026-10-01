# Turf & Taste — Pricing & Payments Engine (PRICING_AND_PAYMENTS.md)

This document specifies the server-authoritative pricing resolver, signed quote tokens, payment finalization, and snapshot persistence.

---

## 1. Single Server-Authoritative Pricing Resolver
All pricing calculations for quotes, bookings, walk-ins, and extensions execute through `server/domain/pricing/pricingResolver.js`.

### Pricing Calculation Precedence
1. **Special Date Overrides:** Explicit holiday / event calendar tariffs take top precedence.
2. **Weekend Surge:** If active day is Saturday or Sunday, configured surge % is applied to the base rate.
3. **Day vs. Night (Floodlights):** Sessions occurring after the configured floodlight threshold (default `18:00` / 6:00 PM IST) incur night tariffs.
4. **Package Discounts:** Multi-hour package rules deduct an explicit discount amount.
5. **Facility Add-Ons:** Hourly add-on rates (e.g. Ball-Shooting Machine) are added to the subtotal.
6. **Token Deposit vs. Full Payment:**
   - If scheduled start is within 1 hour (`fullPaymentRequired = true`), the entire total is charged.
   - Otherwise, the configured token deposit is permitted.

---

## 2. Signed Quote Tokens
- Quotes are signed server-side using a cryptographic HMAC (`server/utils/quoteToken.js`).
- The payment gateway order creation endpoint (`/api/payments/create-order`) verifies the quote token and binds the Razorpay order amount strictly to the token’s exact integer paise.
- Tampering with prices or durations on the client immediately invalidates the token.

---

## 3. Concurrency & Idempotency in Payment Finalization
Implemented in `server/domain/booking/paymentFinalization.js`:
- Multiple concurrent payment callbacks for the same `razorpay_order_id` return the existing booking idempotently without duplicate records.
- Concurrent payment captures for conflicting times on the same physical facility serialize via transactions; exactly one succeeds and the other fails safely.

---

## 4. Immutable Pricing Snapshots
Confirmed bookings and approved extensions persist an immutable snapshot:
```json
{
  "totalAmountPaise": 80000,
  "depositAmountPaise": 25000,
  "breakdown": {
    "baseAmountPaise": 80000,
    "packageDiscountPaise": 0,
    "addOnAmountPaise": 0,
    "periodType": "NIGHT"
  }
}
```
Historical records never recalculate when current rates change in the Admin CMS.

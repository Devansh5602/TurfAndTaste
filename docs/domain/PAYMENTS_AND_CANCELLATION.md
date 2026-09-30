# Turf & Taste — Payments & Cancellation Architecture

## 1. Supported Payment Methods & Architecture

Turf & Taste supports multiple payment channels separated from core booking domain logic:

```
[Booking Intent / Quote]
       ↓
[Payment Method Selection]
  ├── Razorpay Gateway (Cards, Net Banking, Wallets, Supported UPI Apps)
  ├── Direct UPI (Static QR / Direct UPI Reference for Staff Review)
  └── Counter POS (Cash / Card Swipe / UPI Machine at Turf Desk)
       ↓
[Cryptographic Verification / Counter Receipt]
       ↓
[Atomic Booking Confirmation & Quote Consumption]
```

### Security & Secret Hygiene:
- Client bundle receives ONLY publishable test keys (`VITE_RAZORPAY_KEY_ID`).
- Gateway order creation, HMAC signature verification, and Razorpay API secret remain strictly server-side.
- Payment amounts are strictly server-authoritative (verified against signed quote tokens).

---

## 2. Reservation Finalization vs. Temporary Holds

1. **Temporary Hold Model:**
   - When a user opens payment checkout, a temporary hold with a **10–15 minute TTL** is registered in `payment_orders`.
   - If payment is cancelled, declines, or times out, the hold expires automatically without creating a database booking record.
2. **Atomic Finalization:**
   - A slot is marked `Confirmed` only upon verified payment signature receipt or authenticated staff confirmation.

---

## 3. Cancellation Policy & Rules

| Attribute | Specification |
|---|---|
| **Initiators** | Customer (self-service) or Admin / Staff |
| **Cancellation Cutoff Window** | None (can be cancelled any time prior to session start) |
| **Current Refund Policy** | **0% / NONE** (All token deposits and full payments are non-refundable) |
| **State Permanence** | Terminal. A cancelled booking CANNOT be un-cancelled or re-activated |
| **Resource Release** | Immediate. The physical facility slot is released for new bookings |
| **Future Extensibility** | Data model includes `cancellation_reason`, `cancelled_by`, `refund_status` (defaults to `none`), and `refund_amount` (defaults to `0`) so future refund tiers (e.g. 50% refund if >24h) can be introduced via CMS without schema rewrites. |

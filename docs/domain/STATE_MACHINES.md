# Turf & Taste — Domain State Machines & Lifecycle Specifications

## 1. Booking State Machine

```mermaid
stateDiagram-v2
    [*] --> PendingPayment: Quote Selected / Hold Active
    PendingPayment --> Confirmed: Payment Verified (Token or Full) / Walk-in Saved
    PendingPayment --> Expired: User abort, payment decline, or hold timeout / Released
    Expired --> [*]

    Confirmed --> CheckedIn: Customer Arrives / Pass QR Scanned
    CheckedIn --> InProgress: Facility Handed Over (actual_start logged)
    InProgress --> Completed: Facility Vacated (actual_end logged)
    Completed --> [*]

    Confirmed --> Cancelled: Customer / Staff Cancels (0% Refund)
    CheckedIn --> Cancelled: Customer / Staff Cancels (0% Refund)
    InProgress --> Cancelled: Customer / Staff Cancels; retain actual-session history
    Cancelled --> [*]

    note right of Cancelled
        CANCELLED is strictly terminal and cannot be reverted.
        Pending-payment expiration is not a cancelled booking:
        no confirmed booking exists until payment is verified.
    end note
```

---

## 2. Payment State Machine

```mermaid
stateDiagram-v2
    [*] --> Created: Razorpay Order Generated / UPI Intent Initialized
    Created --> Verified: HMAC Signature Verified / Gateway Capture / Counter Received
    Created --> Failed: Gateway Decline / Bank Failure / Timeout
    Failed --> [*]

    Verified --> Refunded: (Future Phase Only — Currently 0% Refund Policy)
    Verified --> [*]
```

> **Separation Rule:** Payment status (`created`, `verified`, `failed`) is distinct from Booking status (`Confirmed`, `In Progress`, `Completed`, `Cancelled`). A payment cannot create a booking without cryptographic verification.

---

## 3. Ground Session State Machine

```mermaid
stateDiagram-v2
    [*] --> Scheduled: Booking Confirmed (Waiting for session day/time)
    Scheduled --> CheckedIn: Player group at desk / QR scanned
    CheckedIn --> Active: Turf unlocked / handover completed
    Active --> Extended: Extension approved (+15m / +30m)
    Extended --> Active: Extension running
    Active --> Concluded: Match ended / Turf inspected & vacated
    Concluded --> [*]
```

---

## 4. Dining Order State Machine

```mermaid
stateDiagram-v2
    [*] --> Received: Order Placed by Table # / Counter POS
    Received --> Preparing: Kitchen Acknowledges & Begins Cooking
    Preparing --> Ready: Food Plated
    Ready --> Delivered: Delivered to Table #
    Delivered --> Completed: Payment Settled & Closed
    Completed --> [*]

    Received --> Cancelled: Item Unavailable / Customer Cancelled
    Preparing --> Cancelled: Kitchen Exception
    Cancelled --> [*]
```

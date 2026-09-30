# Turf & Taste — Domain State Machines & Lifecycle Specifications

## 1. Booking State Machine

```mermaid
stateDiagram-v2
    [*] --> PendingPayment: Quote Selected / Hold Active
    PendingPayment --> Confirmed: Payment Verified (Token or Full) / Walk-in Saved
    PendingPayment --> Expired: Payment Timeout (15m TTL) / Discarded
    Expired --> [*]

    Confirmed --> CheckedIn: Customer Arrives / Pass QR Scanned
    CheckedIn --> InProgress: Facility Handed Over (actual_start logged)
    InProgress --> Completed: Facility Vacated (actual_end logged)
    Completed --> [*]

    PendingPayment --> Cancelled: User Aborts / Payment Decline
    Confirmed --> Cancelled: Customer / Staff Cancels (0% Refund)
    CheckedIn --> Cancelled: Prior-to-play cancellation by Staff
    Cancelled --> [*]

    note right of Cancelled
        CANCELLED is strictly terminal.
        Cannot be reverted to Confirmed.
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
    Preparing --> ReadyForService: Food Plated
    ReadyForService --> Delivered: Delivered to Table #
    Delivered --> Settled: Payment Settled & Closed
    Settled --> [*]

    Received --> Rejected: Item Unavailable / Cancelled
    Preparing --> Rejected: Kitchen Exception
    Rejected --> [*]
```

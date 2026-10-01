# Turf & Taste — Open Product & Architectural Decisions

The following items are deliberately classified as **Open Decisions** pending stakeholder finalization. The architecture is designed to accommodate any choice without structural rework:

---

### 1. Unified Property Umbrella Terminology
- **Current Status:** Not finalized.
- **Context:** The generic term referring to the combined sports and dining campus (e.g. "Clubhouse", "Arena", "Grounds", "Campus", "Property").
- **Architecture Stance:** The data model uses technically clean identifiers (`property`, `section`, `facility`, `stall`). Display labels are configurable via CMS.

---

### 2. Future Refund Policy Tiers
- **Current Status:** 0% Refund / No Refund on cancellation.
- **Context:** Future business policies may introduce pro-rated refund percentages based on notice windows (e.g., 50% refund if cancelled >24 hours prior).
- **Architecture Stance:** The `cancellations` model includes `refund_status` and `refund_amount` fields initialized to 0, ready for future automated gateway refund triggers.

---

### 3. WhatsApp / SMS Notification Gateway Provider
- **Current Status:** User preference (`whatsapp` vs `sms`) is stored with the booking.
- **Context:** Selection of messaging service provider (Meta Cloud API, Gupshup, Twilio, or MSG91).
- **Architecture Stance:** Isolated behind a notification gateway interface (`server/services/notificationService.js`).

---

### 4. Verified-Booking Review Restriction
- **Current Status:** Authenticated customers can submit reviews, subject to Admin moderation.
- **Context:** Whether to restrict review submission strictly to accounts with a `Completed` booking on that facility.
- **Architecture Stance:** Configurable system setting `reviews_require_verified_booking` (defaults to `false` during staging).

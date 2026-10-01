# Turf & Taste — RBAC & Security Architecture (RBAC_AND_SECURITY.md)

This document specifies the authorization engine, permission scoping, session management, and guest privacy rules.

---

## 1. Permission-Oriented Authorization
Implemented in `server/domain/rbac/rbacEngine.js` and enforced by `requirePermission(permKey)`:
- Authorization checks evaluate whether the principal possesses a specific granular permission key (e.g. `booking.create`, `booking.cancel`, `facility.block`, `pricing.manage`, `dining.stall.manage`).
- **No Role-Name Bypasses:** Handlers must never evaluate role strings directly (`if (user.role === 'super_admin')`). Permissions are dynamically resolved and cached.

---

## 2. Session Versioning & Token Invalidation
- Admin user records contain a `session_version` integer.
- The JWT contains `id` and `sv`.
- On authentication or sensitive actions, `sv` is verified against the database.
- Admin password resets or status toggles (`is_enabled = 0`) increment `session_version`, instantly invalidating all existing JWT sessions globally.

---

## 3. Dining Tenancy Scoping
- Dining stall staff tokens carry an assigned `stall_id`.
- The middleware enforces that stall staff can only query or mutate orders matching their exact assigned stall. Attempting to query or edit another stall’s orders returns `403 Forbidden`.

---

## 4. Guest Privacy Protections
- Guest phone numbers, emails, and booking references are protected from public enumeration.
- Direct booking lookups without an active session require a secure possession token or cryptographic signature.

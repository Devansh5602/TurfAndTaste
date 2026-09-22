# Turf & Taste v2 Architecture Decision Record

## Decision: retain the current client platform, strengthen the shared backend

The existing React/Vite app will remain the customer web experience and Capacitor shell. A React Native migration is not justified before the shared business system is extensible and the Capacitor experience has passed device QA. The website, Capacitor app, and admin portal will continue to use one Express API and one database model.

## Target boundaries

```text
Customer web / Capacitor customer app ─┐
Admin web portal                       ├─ Express API ─ PostgreSQL / Supabase
Future dedicated mobile frontend       ─┘       │
                                                ├─ payment providers
                                                ├─ storage / media provider
                                                ├─ notification providers
                                                └─ archive report storage
```

## Data ownership

- **Facilities** become database-managed business entities. Their content, operating rules, pricing rules, enabled state, images, and bookable configuration cannot remain duplicated in React source.
- **Facility schedules** are administrator-managed per facility. Any hours currently visible in the product are seed/default data only, never a permanent operating-hours rule.
- **Booking availability and price** are computed by the server from the facility, schedule, availability block, duration, and applicable pricing rule. Clients only request a quote and submit a selected, server-recognized slot.
- **Food stalls, parlour, categories, and menu items** share a merchant/menu model. The parlour is a stall type, not a separate inventory platform.
- **Events, posts, reviews, inquiries, archives, and settings** are separate domain resources with administrative visibility/publication rules.
- **Business contact information and public settings** are stored centrally. Credentials, payment secrets, email secrets, and provider keys remain server environment configuration.

## API and persistence conventions

1. Retain existing API routes while v2 consumers migrate; use additive `/api/v2` routes only when changing a contract materially.
2. Every write validates/sanitizes input server-side and returns `{ success, data?, error? }` with meaningful HTTP status codes.
3. Administrative writes require JWT authorization; role claims are introduced before role-specific permissions are enforced.
4. Database evolution is versioned using migrations tracked in `schema_migrations`. Startup DDL will be moved incrementally rather than replaced in one unsafe rewrite.
5. Media records store metadata and provider paths, never arbitrary binaries in PostgreSQL.

## Customer identity decision

Guest booking remains supported. A phone/email-only booking history lookup is not sufficient identity proof; v2 will replace it with an authenticated customer history or a short-lived OTP / booking-reference verification flow. Existing public lookup behavior is retained only until the replacement is migrated and verified.

## Product navigation direction

- Public: Home, Sports, Food Court, Events, Updates, Reach Us, Book.
- Mobile bottom bar: Home, Explore, Book, Passes, Profile.
- Admin: Dashboard, Operations, Facilities, Food, Content, Customers, Finance, Settings.

The first v2 modules will add the shared data/API foundations; pages will migrate to database content only after those APIs are stable.

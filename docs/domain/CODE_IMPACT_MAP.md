# Turf & Taste — Code Impact & Refactoring Map

## 1. Audit of Conflicts in Current Implementation

During our code and domain audit, the following obsolete prototype assumptions were identified across the repository:

| Obsolete Assumption | Where Found in Code / Assets | Required Correction / Resolution |
|---|---|---|
| **Location: "Bopal, Ahmedabad"** | `src/prototype/customerMobile/CustomerMobilePrototype.jsx`, `src/comparison/Home.jsx`, `src/comparison/fixtures.js` | Update location identity to **Patan, Gujarat**. Remove redundant city selection pills from Home discovery. |
| **Duration: "1.5 hrs / 90 mins"** | `src/prototype/customerMobile/CustomerMobilePrototype.jsx`, `data.js` | Replace with standard `1 Hour` / `2 Hours` quick bookings + quarter-hour custom starts. |
| **Sports 11 PM Closing Hours** | `server/routes/bookings.js`, `server/routes/v2/quotes.js` | Formalize sports default availability as **24/7**, constrained only by bookings, extensions, and administrative blocks. |
| **Dining "View-Only" Rule** | `src/prototype/customerMobile/CustomerMobilePrototype.jsx`, tests | Support table-number-based food ordering in architecture. |
| **Shooting Machine as Separate Facility** | `server/db.js`, `fixtures.js` | Model Ball-Shooting Machine as a paid optional add-on on the single Cricket Green Net physical facility. |
| **Single Hardcoded Admin Role** | `server/routes/auth.js`, `server/middleware/auth.js` | Transition to permission-based RBAC matrix. |

---

## 2. Codebase Impact Matrix

```
[Backend API Services]
  ├── `server/routes/facilities.js`    --> Add Section & Physical Facility hierarchy endpoints
  ├── `server/routes/bookings.js`      --> Update slot generation (24/7, 1h lead time, quarter-hour custom starts)
  ├── `server/routes/v2/quotes.js`     --> Evaluate multi-tier pricing, package offers & add-ons
  ├── `server/routes/auth.js`          --> Implement granular permission checks
  ├── `server/routes/v2/food.js`       --> Add Table Order endpoints (`POST /api/v2/food/orders`)
  └── `server/db.js`                   --> Add migration runner for stages 1–4

[Frontend Customer & Admin Modules]
  ├── `src/services/api.js`            --> Add API client methods for sessions, table orders, dynamic facilities
  ├── `src/context/RouterContext.jsx`  --> Preserve native back-button handling
  ├── `src/comparison/*`               --> Update location references to Patan, Gujarat (preserving visual layout)
  └── `src/prototype/customerMobile/*` --> Align duration options (1h, 2h, custom) and table ordering
```

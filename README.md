# 🏏 Turf & Taste — Sports Complex & Concourse Café

> **Patan's premier multi-sport arena and café.**  
> Real-time court reservation engine, dynamic UPI/Razorpay payment processing, audit-ready annual financial ledger generation, and high-density administration portal.

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/Supabase_PostgreSQL-Pool-336791?logo=postgresql&logoColor=white)](https://supabase.com/)
[![Vanilla CSS](https://img.shields.io/badge/Styling-Vanilla_CSS-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Platform Architecture](#-platform-architecture)
- [Key Features](#-key-features)
  - [1. Customer Reservation Engine](#1-customer-reservation-engine)
  - [2. Multi-Tier Payment Processing](#2-multi-tier-payment-processing)
  - [3. High-Density Admin Management Portal](#3-high-density-admin-management-portal)
  - [4. Annual Archive Vault & PDF Ledger Generator](#4-annual-archive-vault--pdf-ledger-generator)
- [Engineered UX & Design System](#-engineered-ux--design-system)
  - [Density & Depth Architecture](#density--depth-architecture)
  - [Three-State Selection & Range Shift-Click](#three-state-selection--range-shift-click)
  - [Destructive Action Undo Window (No Modals)](#destructive-action-undo-window-no-modals)
  - [Native CSS `:has()` and `:user-invalid` Validation](#native-css-has-and-user-invalid-validation)
- [Facilities & Sports Available](#-facilities--sports-available)
- [Tech Stack](#-tech-stack)
- [Directory Structure](#-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Production Build](#-production-build)
- [License](#-license)

---

## 🏟️ Overview

Located in Patan, Gujarat, **Turf & Taste** is an integrated athletic arena and culinary café built for competitive athletes, box cricket squads, and casual players. The platform enables players to view real-time court availability, select 60-minute daytime or evening floodlit slots, lock reservations via instant UPI or credit card deposits, and walk directly onto the pitch.

Behind the public storefront lies a full enterprise operations suite allowing arena managers to oversee schedules, execute walk-in counter bookings, adjust live hourly rates, generate legally audited annual PDF ledgers, and purge historical database records to reclaim cloud storage space.

---

## 🏗️ Platform Architecture

```mermaid
graph TD
    User["Customer / Player"] -->|Browses & Books| ReactSPA["React 18 SPA (Vite)"]
    Admin["Arena Manager"] -->|Manages Rosters & Vault| ReactSPA
    
    ReactSPA -->|API Requests (/api/*)| ExpressAPI["Node.js / Express Server (Port 5000)"]
    
    ExpressAPI -->|Transactions & Bookings| PostgresDB[("Supabase Cloud PostgreSQL")]
    ExpressAPI -->|Payment Intent & Verification| RazorpayAPI["Razorpay / UPI Gateway"]
    ExpressAPI -->|Ledger Compilation| PDFKitEngine["PDFKit Multi-Page Generator"]
    ExpressAPI -->|Email Dispatch| NodemailerSMTP["Nodemailer (SMTP Distribution)"]
    
    PDFKitEngine -->|Saves Audit Files| ArchiveVault["Archive Vault Storage (Disk / Cloud)"]
```

---

## ✨ Key Features

### 1. Customer Reservation Engine
- **Visual Stepper Workflow**: Interactive 3-step booking flow (Sport & Session Selection → Slot & Customer Details → Payment & Instant Ticket).
- **Session Split**: Instant filtering between Morning/Day rates and Evening Peak Floodlight rates with calibrated pricing per facility.
- **Real-Time Slot Engine**: Automatically computes dynamic slots between arena opening (06:00 AM) and closing (11:30 PM), disabling booked or conflicting times.
- **Pass / Ticket Generation**: Generates an in-browser confirmation receipt with booking reference, court details, date/time, and barcode pass.

### 2. Multi-Tier Payment Processing
- **Token Deposit vs. Full Payment**: Choose between locking a reservation with a nominal advance deposit (e.g. ₹200) or prepaying 100% of the slot fee.
- **Dual Payment Rails**:
  - **Dynamic UPI QR & Virtual Intent**: Instant QR rendering with verified VPA (`pay?pa=...&am=...&tn=...`) and direct intent links for mobile apps (GPay, PhonePe, Paytm).
  - **Razorpay Checkout**: Seamless integration supporting Credit/Debit Cards, NetBanking, and Wallets.

### 3. High-Density Admin Management Portal
- **Engineered Data Density**: 13px typography, 32px row heights, and tabular figures display nearly 2× more records per viewport without scrolling.
- **Live Search & Filter**: Real-time multi-column search across customer names, phone numbers, and booking reference IDs.
- **Counter Walk-In Creator**: Dedicated counter workflow for on-site cash/walk-in players.
- **Live Facility Rate Editor**: Modify public daytime, floodlit night rates, and minimum advance deposits with instant synchronization across the platform.

### 4. Annual Archive Vault & PDF Ledger Generator
- **Calendar-Year Archival (Jan 1 – Dec 31)**: Isolate and compile annual booking rosters into legal financial ledgers.
- **Audit-Ready PDF Compilation**: Multi-page PDF generated via `pdfkit` complete with:
  - Corporate ledger header and Patan HQ metadata.
  - KPI executive dashboard (Gross Revenue, Total Bookings, Full vs. Deposit split).
  - Month-by-month (Jan to Dec) volume and revenue breakdown.
  - Facility/sport distribution table.
  - Itemized reservation ledger with automated `"Page X of Y"` pagination.
- **Automated Stakeholder Distribution**: Dispatches the ledger PDF to a persistent email distribution list via SMTP.
- **Safe DB Purge**: Frees live database records for archived years behind high-security confirmation guards (`CONFIRM PURGE <YEAR>`).

---

## 📐 Engineered UX & Design System

The platform strictly avoids AI-generated visual clichés (such as ambient purple smears, generic glow halos, and fake trust numbers) in favor of precision craftsmanship:

### Density & Depth Architecture
- **Three-Layer Surface Value**: Depth is achieved via value differentiation rather than blur (`--bg-base` → `--bg-surface` → `--bg-raised`).
- **Hairline Borders**: Elements are delineated by subtle 1px borders at 8% white (`--border-hairline: rgba(255, 255, 255, 0.08)`). Zero blurred drop shadows.
- **Single Accent Color**: High-contrast olive-bright (`#82AB58`) is strictly reserved for selected rows, primary CTA buttons, and input focus rings. Statuses are rendered as neutral icons rather than loud rainbow pills.
- **Micro-Transitions**: All animations are capped under 150ms (`0.08s – 0.12s`) with zero overshoot or bounce.

### Three-State Selection & Range Shift-Click
- **Tri-State Header Checkbox**: Fully supports `empty`, `partial` (indeterminate dash), and `checked` states.
- **Honest Scope**: The header checkbox tooltip and bulk toolbar name the exact number of matching records (e.g. `"Selected 4 of 24 matching"` and `"Select all 24 matching"`). Context changes (like typing a search filter) update this count live.
- **Resolution Rule**: Clicking an indeterminate dash always resolves to **Select All**, never to clear.
- **Shift-Click Range**: Holding `Shift` while clicking a row checkbox selects the contiguous block of records between the last selected index and the clicked row. Selection state persists in memory by ID across filtering and pagination.

### Destructive Action Undo Window (No Modals)
- **Zero Disruptive Confirmations**: Clicking "Delete" executes the deletion immediately and optimistically removes records from the visible view.
- **10-Second Undo Window**: Displays an undo bar with an SVG circular draining countdown ring that tracks remaining seconds (`10s` down to `0s`).
- **Instant Restoration**: Pressing <kbd>Z</kbd> or clicking `"Undo"` restores records immediately. Deletion is committed permanently to PostgreSQL only when the countdown drains.

### Native CSS `:has()` and `:user-invalid` Validation
- Form fields leverage `.form-group:has(:user-invalid)` to style labels, asterisks, and inputs concurrently with zero derived React validation state.
- Forms automatically dim submit buttons via `form:has(:user-invalid) button[type="submit"]`.
- `body:has(.modal-overlay)` handles document scroll locking natively without `useEffect` cleanup listeners.

---

## 🎯 Facilities & Sports Available

| Facility | Surface / Specs | Best For | Typical Timing |
| :--- | :--- | :--- | :--- |
| **Box Cricket Arena** | 72-ft enclosed turf, high netting, LED floodlights | Tournaments, corporate matches, gully leagues | 6:00 AM – 11:30 PM |
| **Cricket Practice Nets** | Full-runup synthetic turf with bowling crease markers | Batting drills, pace bowling practice | 6:00 AM – 11:00 PM |
| **Bowling Machine Lane** | Variable speed (60–150 km/h), spin & swing adjustments | Professional batting technique & stroke refinement | 7:00 AM – 10:00 PM |
| **Pickleball Court** | High-grip outdoor court with regulation tournament net | Singles/doubles matches, quick rally sessions | 6:00 AM – 10:30 PM |
| **Skating Rink** | Smooth polyurethane anti-skid surface, boundary rails | Speed skating, roller hockey, beginner drills | 6:00 AM – 9:00 PM |
| **Sports Café & Lounge** | Open-air & AC seating, healthy shakes, recovery snacks | Spectators, post-match refreshments, strategy | 7:00 AM – 11:30 PM |

---

## 💻 Tech Stack

### Frontend
- **Framework**: React 18.3 + Vite 6
- **Routing**: Custom SPA Router Context (`<Link>`, `<Route>`)
- **Icons**: Lucide React
- **Styling**: Vanilla CSS with modular design tokens (`variables.css`, `global.css`, `components.css`, `pages.css`, `navigation.css`)

### Backend & Database
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: PostgreSQL (Supabase Cloud) via connection pool (`pg`)
- **Security & Auth**: JSON Web Tokens (`jsonwebtoken`), password hashing (`bcryptjs`)
- **Document Engine**: `pdfkit`
- **Mail Transport**: `nodemailer` (with simulated console fallback when SMTP is unconfigured)
- **Payment SDK**: `razorpay`

---

## 📁 Directory Structure

```text
TurfAndTaste/
├── index.html                   # HTML entry point with modern typography
├── package.json                 # Frontend dependencies & npm scripts
├── vite.config.js               # Vite bundler config with /api proxy to port 5000
│
├── server/                      # Node.js / Express API Backend
│   ├── index.js                 # Server entry point (Port 5000)
│   ├── db.js                    # Supabase PostgreSQL pool & migrations
│   ├── package.json             # Backend server dependencies
│   ├── routes/
│   │   ├── archives.js          # Annual archive generation, email & purge API
│   │   ├── payments.js          # Razorpay orders & dynamic UPI intent verification
│   │   └── pricing.js           # Live hourly rates & token deposits API
│   ├── services/
│   │   ├── emailService.js      # Nodemailer SMTP dispatcher with log fallback
│   │   └── pdfReportGenerator.js# PDFKit annual multi-page ledger generator
│   └── data/                    # Generated PDF files and local dispatch logs
│
└── src/                         # Frontend Application Source
    ├── App.jsx                  # Root layout & route definitions
    ├── main.jsx                 # React root renderer
    ├── components/              # Modular UI components
    │   ├── ConfirmationModal.jsx# Reusable dialog modal
    │   ├── CourtBackground.jsx  # Pitch line geometry canvas
    │   ├── FacilityCard.jsx     # Arena showcase card
    │   ├── Footer.jsx           # Global site footer
    │   ├── Navbar.jsx           # Header navigation & active indicators
    │   ├── SectionHeading.jsx   # Section titles with outcome focus
    │   └── Toast.jsx            # Toast notifications container
    ├── data/                    # Seed data & static constants
    │   ├── contactData.js
    │   ├── facilitiesData.js
    │   ├── navigationData.js
    │   └── pricingData.js
    ├── pages/                   # Application views
    │   ├── About.jsx            # Mission, standards, and arena facilities
    │   ├── Admin.jsx            # Management portal, live tables & Archive Vault
    │   ├── Booking.jsx          # 3-step booking engine & ticket confirmation
    │   ├── Contact.jsx          # Inquiries form with live database submission
    │   ├── FacilityDetail.jsx   # Individual court spec sheet & direct book
    │   ├── Home.jsx             # Hero, outcome showcase, testimonial & CTA
    │   ├── Inquiry.jsx          # Corporate / tournament booking inquiries
    │   └── Pricing.jsx          # Hourly pricing breakdown & rate calculator
    ├── services/                # Data & API abstraction layer
    │   ├── adminStore.js        # Admin data persistence & state cache
    │   ├── api.js               # Centralized fetch wrapper for backend endpoints
    │   ├── bookingService.js    # Client-side booking helpers & storage
    │   └── paymentService.js    # Client-side payment gateway triggers
    └── styles/                  # Vanilla CSS Design System
        ├── components.css       # Buttons, cards, modals, steppers, inputs
        ├── global.css           # 32px density tables, base styles, reset
        ├── layout.css           # CSS Grid, containers, flex wrappers
        ├── navigation.css       # Header, mobile drawer, active states
        ├── pages.css            # Hero, proof card, showcase layouts
        └── variables.css        # Color tokens, typography, hairline borders, timings
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Devansh5602/TurfAndTaste.git
   cd TurfAndTaste
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Install backend dependencies**:
   ```bash
   cd server
   npm install
   cd ..
   ```

### Running Locally

You can launch both servers simultaneously in separate terminal windows:

**Terminal 1 — Backend API (Port 5000):**
```bash
npm run backend
# Or: cd server && npm start
```

**Terminal 2 — Frontend Dev Server (Port 5173):**
```bash
npm run dev
```

Visit **`http://localhost:5173`** in your browser. All `/api/*` requests will be automatically proxied to the backend on `http://localhost:5000`.

---

## ⚙️ Environment Variables

Create a `.env` file inside the `server/` directory with the following configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database (Supabase PostgreSQL Connection String)
DATABASE_URL=postgresql://postgres.xxx:your-password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres

# Admin Authentication
JWT_SECRET=your_super_secret_jwt_key_here
ADMIN_PASSWORD=your_admin_portal_password

# Razorpay Credentials (Optional - Test keys supported)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx

# SMTP Email Dispatch (Optional - Logs to console and disk if omitted)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@turfandtaste.com
SMTP_PASS=your_app_password
SMTP_FROM="Turf & Taste Sports Complex" <alerts@turfandtaste.com>
```

> **Note**: If `DATABASE_URL` is omitted or temporarily unreachable, the backend automatically operates in graceful in-memory storage mode so development is never blocked.

---

## 📡 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck and database connectivity status |
| `GET` | `/api/pricing` | Retrieve live hourly rates and minimum advance deposits |
| `PUT` | `/api/pricing` | Update hourly rate configurations (Admin only) |
| `POST` | `/api/payments/create-order` | Create a Razorpay payment order |
| `POST` | `/api/payments/verify` | Verify Razorpay payment signature & confirm booking |
| `GET` | `/api/archives/years` | List all calendar years with archive and purge status flags |
| `GET` | `/api/archives/preview?year=YYYY` | Fetch live revenue, reservation metrics, and 12-month summary |
| `POST` | `/api/archives/generate` | Generate annual PDF ledger, save to vault, and email distribution |
| `POST` | `/api/archives/email` | Resend vaulted archive PDF to distribution list |
| `POST` | `/api/archives/purge` | Safely purge bookings for an archived year (`CONFIRM PURGE <YEAR>`) |
| `GET` | `/api/archives` | Retrieve all historical PDF archives stored in the vault |
| `GET` | `/api/archives/:id/download` | Stream and download audited PDF ledger directly |
| `GET` | `/api/archives/settings` | Read configured stakeholder email distribution list |
| `POST` | `/api/archives/settings` | Update stakeholder email distribution list |

---

## ⌨️ Keyboard Shortcuts

Power user shortcuts available in the Administration Portal:

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd> | Jump to and focus the booking search input | Global Admin |
| <kbd>C</kbd> | Open the New Walk-In reservation modal | Outside input fields |
| <kbd>X</kbd> | Export current filtered bookings to CSV | Outside input fields |
| <kbd>Z</kbd> | Instantly undo record deletion | During 10s undo window |
| <kbd>Shift</kbd> + Click | Select contiguous range of table rows | Bookings table |

---

## 📦 Production Build

To test and compile the production bundle:

```bash
npm run build
```

The optimized static assets will be output to `dist/`:
```text
dist/index.html                   ~2.2 kB
dist/assets/index-*.css           ~51 kB (gzip: ~9.8 kB)
dist/assets/index-*.js            ~409 kB (gzip: ~106 kB)
```

To preview the built production app locally:
```bash
npm run preview
```

---

## 📄 License

This project is proprietary and confidential.  
© 2026 **Turf & Taste Sports Complex & Café**, Patan, Gujarat, India. All rights reserved.

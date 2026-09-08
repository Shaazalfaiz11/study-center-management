# Self Study Center — Admin Dashboard

A management dashboard for a self-study centre (a paid study hall where students
rent a fixed seat for a shift). Built for the operational reality of running one:
who is in today, who owes money, which seats are actually free, and what is
waiting on a decision.

**This is a frontend-only build.** There is no backend, database, websocket
server, payment gateway or notification integration. Every data operation runs
through a mock service layer with simulated latency, structured so the mocks can
be swapped for a real REST API without touching the UI.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # production build to dist/
npm run preview  # serve the production build
```

Sign-in credentials are pre-filled on the login screen — no account is needed.

---

## Architecture

```
components  →  services  →  store  →  mockData
   (UI)        (API-shaped)  (state)   (seed)
```

- **`src/data/mockData.js`** — deterministic seed data. A fixed PRNG seed means
  the same student always has the same seat, expiry date and payment history on
  every reload.
- **`src/services/store.js`** — in-memory store standing in for the database.
  Every write runs through `recompute()`, which re-derives all status fields from
  the raw entities. This is what guarantees the seat map, the student profile and
  the collection screen can never disagree about the same student.
- **`src/services/businessRules.js`** — pure, deterministic calculations. No
  React, no store access. Membership status, payment status, seat status,
  overdue days, shift-change eligibility.
- **`src/services/*Service.js`** — the API surface. Promise in, plain object out.
  Components never touch the data arrays directly.

Swapping to a real API means changing the bodies of the service modules. The UI
contract stays identical.

### Business rules

Implemented as deterministic functions so the interface behaves like a real
product rather than a static mock:

| Rule | Behaviour |
| --- | --- |
| Membership expires within 7 days | Flagged *Expiring Soon* |
| Payment due date has passed | Flagged *Overdue* |
| Seat holder with no attendance for 7+ days | Flagged as potentially idle |
| Requested shift has no free seat | Shift change **cannot** be approved |
| Membership paused | Seat may become temporarily available |
| Payment recorded | Outstanding amount decreases |
| Membership renewed | Expiry date extends from the current expiry, not today |
| Seat transferred | Old seat frees, new seat assigns, history recorded |
| Leave resumed | Paused days are added back to the expiry date |

---

## Features

### Core modules

Dashboard · Students · Live Seat Map · Seat Register · Shifts · Assignments ·
Attendance · Memberships · Plans · Billing · Payments · Invoices · Outstanding ·
Expenses · Maintenance · Notifications · Reports · Settings · Audit Log ·
Global Search

### Shift Change & Seat Transfer

Requests move through **Pending → Approved → Completed**. Approval is blocked
when the requested shift has no free seat or is at capacity. Completing the
transfer frees the old seat, assigns the new one, applies any fee difference and
writes to both assignment history and the audit log. Every request keeps a full
approval history.

### Fee Collection

The screen a front desk opens each morning. Due Today / Tomorrow / This Week /
Overdue / Expiring Soon, with per-row record payment, renew, send reminder and
add note.

### Leave / Temporary Membership Pause

Pausing keeps the student on the register and preserves their remaining days —
those days are added back to the expiry date on resume. The seat can either be
temporarily released or held.

### Temporary Seat Release & Reallocation

A released seat keeps its original holder on the record throughout. Someone else
can be given temporary use of it, and the seat returns to the holder
automatically when their leave ends. **A temporary release is never a permanent
reassignment**, and the interface says so explicitly.

### Daily Operations Report

One page covering attendance, seat utilisation, revenue, outstanding payments,
renewals, shift changes, leave and maintenance. Print, CSV export and PDF export
(via the browser print dialog — no server involved).

---

## Interface

- One `DataTable` used by every list screen — search, sort, filter, pagination,
  row actions, CSV export, and consistent loading / empty / error states.
- Detail drawers for quick operations instead of full page navigation.
- Confirmation dialogs on every destructive or consequential action.
- `Ctrl` + `K` global search across students, seats, payments, memberships,
  invoices and shift changes.
- Responsive from desktop down to mobile: the sidebar becomes a drawer, tables
  scroll horizontally, drawers go full screen.
- Every important admin action writes an audit event.

---

## Demo data

Realistic Indian study-centre data: 96 students, 120 seats across two floors and
four sections, 45 days of attendance, and a full payment history. The dataset
deliberately covers every state worth demonstrating — active, expiring, expired
and paused memberships; paid, due, upcoming, overdue and partially paid fees;
available, assigned, occupied, reserved, temporarily released, maintenance and
blocked seats; pending, approved, rejected and completed shift changes; and
active, upcoming and completed leave.

Relationships are consistent by construction. If a student holds seat A-24 on
their profile, the seat map, the seat register and the search results all agree.

---

## Stack

React 18 · Vite 6 · React Router 6 · Chart.js · lucide-react

No CSS framework — the design system lives in `src/index.css` and
`src/styles/shared.css` as CSS custom properties.

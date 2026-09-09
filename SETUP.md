# Setup — Next.js + Supabase

Phase 1 of the backend migration: **authentication and settings run on real
Supabase Postgres.** The remaining operational screens are still being ported.

---

## 1. Environment variables

Copy `.env.example` to `.env.local` and fill in four values. **Never commit
`.env.local`** — it is gitignored.

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Safe in the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` / `public` | Safe in the browser — every query it makes goes through Row Level Security |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` | **Server only.** Bypasses all RLS. Never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | Your own URL | `http://localhost:3000` locally; the deployed URL in production |

There is deliberately **no `DATABASE_URL`**. See *Why no direct connection* below.

---

## 2. Create the schema

Open **Supabase → SQL Editor → New query**, paste the whole of
[`supabase/schema.sql`](supabase/schema.sql), and run it.

It is idempotent — running it twice is safe. It creates:

- `profiles` keyed to `auth.users`, with a trigger that creates a profile on signup
- `centre_settings` (a single row) holding centre details and the business-rule thresholds
- Every operational table (students, seats, payments, attendance, leave, shift changes…)
- Indexes matched to the app's actual read patterns
- **Row Level Security on every table**, plus owner-only policies for settings and roles

---

## 3. Configure auth in Supabase

**Authentication → URL Configuration**

- Site URL: `http://localhost:3000` (add your deployed URL for production)
- Redirect URLs: add `http://localhost:3000/auth/confirm` and
  `https://<your-domain>/auth/confirm`

**Authentication → Providers → Email** — enabled by default.

> Email confirmation is on by default. For local testing you can turn off
> "Confirm email" so signup signs you straight in. Turn it back on before
> anyone real uses this.

---

## 4. Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Go to `/signup` and create the first account.

**The first account created becomes the Owner.** Everyone who signs up after
that lands on Front Desk, and an owner changes roles from Settings → Team.

---

## 5. Seed the demo data (optional)

```bash
npm run seed          # add demo data
npm run seed:reset    # wipe operational tables first, then seed
```

This loads 96 students, 120 seats, 45 days of attendance and the full payment
history — the same deterministic dataset the mock build used, so a student who
held seat A-24 before still holds it.

`seed:reset` clears operational tables but leaves `profiles` and
`centre_settings` alone, so it will not delete your login.

The script uses the service-role key and bypasses RLS. **Never point it at a
project holding real student data.**

---

## Notes on the architecture

### Why no direct database connection

Next.js on Vercel runs as serverless functions. Each cold start that opens a
raw Postgres connection holds one until it is reclaimed, and Supabase's smaller
tiers cap out around 60. At 100 concurrent users that is exactly where a
direct-connection setup falls over.

Everything here goes through Supabase's HTTP API (PostgREST), which pools
server-side. Concurrency becomes a request-rate question rather than a
connection-count one — which is the single most important choice for the
100-concurrent-user target.

### Security model

- **RLS is on for every table.** The anon key by itself grants nothing; the
  caller must be an active staff member.
- **Owner-only** for centre settings, business rules and role changes —
  enforced by policy *and* by a trigger, since Postgres has no column-level RLS
  and a non-owner must not be able to promote themselves.
- **`getUser()`, never `getSession()`** on the server. `getSession` reads the
  cookie without verifying it, so a forged cookie would look valid.
- **The last owner cannot be demoted**, which would otherwise lock everyone out
  of settings permanently.
- **The audit log is append-only** — staff can insert and read, never update or
  delete. A trail that can be rewritten is not a trail.
- **`server-only`** guards the service-role client, so importing it into a
  client component fails the build instead of leaking the key.

### Signup is open

You chose open signup, so anyone with the URL can create an account and lands on
Front Desk. To lock it down later without touching code:

**Supabase → Authentication → Providers → Email → disable "Allow new users to sign up"**

Existing accounts keep working; only new signups stop.

---

## What is done, and what is next

**Working on Supabase**

- Sign up, sign in, sign out, email confirmation, password reset
- Route protection (proxy-level plus a per-layout check)
- Roles: Owner / Front Desk / Facilities
- Settings: centre details, business rules, own profile, team management

**Still on mock data**

Students, seats, shifts, assignments, attendance, memberships, billing,
maintenance, reports. These screens live in `src/screens/` and will be moved
onto the tables the schema already creates, one module at a time.

-- ============================================================
-- SELF STUDY CENTER — MULTI-TENANT SCHEMA
-- ------------------------------------------------------------
-- Paste this whole file into the Supabase SQL editor and run it.
-- Idempotent: re-running it is safe.
--
-- Tenancy model
--   organization  a customer (one study-centre business)
--   centre        a physical branch belonging to an organization
--   membership    a user's role WITHIN one organization
--
-- A role is meaningless without naming the organization it applies to,
-- so roles live on organization_memberships, never on profiles.
-- profiles holds identity only.
--
-- Every operational row carries organization_id (the tenant boundary)
-- and centre_id (the branch). RLS filters on organization_id; centre_id
-- narrows within a tenant.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============================================================
-- 1. TENANTS
-- ============================================================
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.centres (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  code            text not null default 'MAIN',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, code)
);

-- Identity only. No role column: see the header note.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  phone      text default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- NULL means the member may act across every centre in the org.
  centre_id       uuid references public.centres(id) on delete set null,
  role            text not null default 'front_desk'
                    check (role in ('owner', 'front_desk', 'facilities')),
  status          text not null default 'active'
                    check (status in ('active', 'invited', 'disabled')),
  invited_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- ============================================================
-- 2. TENANT HELPERS
-- ------------------------------------------------------------
-- SECURITY DEFINER so they read membership WITHOUT re-entering RLS.
-- A policy on organization_memberships that selects from
-- organization_memberships would recurse forever; this is the way out.
--
-- search_path is pinned so a caller cannot shadow these tables with
-- objects of their own.
-- ============================================================
create or replace function public.my_organization_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.organization_memberships
  where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.my_centre_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id
  from public.centres c
  join public.organization_memberships m
    on m.organization_id = c.organization_id
   and m.user_id = auth.uid()
   and m.status = 'active'
  -- A membership pinned to one centre may not roam the organization.
  where m.centre_id is null or m.centre_id = c.id;
$$;

create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_memberships
    where user_id = auth.uid() and organization_id = org and status = 'active'
  );
$$;

create or replace function public.is_org_owner(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_memberships
    where user_id = auth.uid() and organization_id = org
      and role = 'owner' and status = 'active'
  );
$$;

/** Owner of the organization that owns this centre. */
create or replace function public.is_centre_owner(centre uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.centres c
    join public.organization_memberships m on m.organization_id = c.organization_id
    where c.id = centre and m.user_id = auth.uid()
      and m.role = 'owner' and m.status = 'active'
  );
$$;

-- ============================================================
-- 3. SETTINGS — one row per centre
-- ============================================================
create table if not exists public.centre_settings (
  centre_id                uuid primary key references public.centres(id) on delete cascade,
  organization_id          uuid not null references public.organizations(id) on delete cascade,
  name                     text not null default 'Self Study Center',
  branch                   text not null default 'Main Branch',
  address                  text not null default '',
  phone                    text not null default '',
  email                    text not null default '',
  gstin                    text not null default '',
  opening_time             text not null default '06:00 AM',
  closing_time             text not null default '11:00 PM',
  currency                 text not null default 'INR',
  timezone                 text not null default 'Asia/Kolkata',

  -- Business rules drive the flags across every screen, so they belong
  -- in the database rather than hard-coded in the frontend.
  expiring_soon_days       int not null default 7  check (expiring_soon_days between 1 and 90),
  inactive_attendance_days int not null default 7  check (inactive_attendance_days between 1 and 90),
  grace_period_days        int not null default 10 check (grace_period_days between 0 and 90),

  reminder_offsets         int[]  not null default '{7,3,1,0}',
  payment_methods          text[] not null default '{Cash,UPI,Card,Bank Transfer}',

  -- The settings form sends the value it was rendered with and the write
  -- matches on it, so a concurrent save fails loudly instead of silently
  -- losing an update.
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.profiles(id) on delete set null
);

-- ============================================================
-- 4. OPERATIONAL TABLES
-- ============================================================
create table if not exists public.slots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  centre_id       uuid not null references public.centres(id) on delete cascade,
  name            text not null,
  start_time      text not null,
  end_time        text not null,
  capacity        int not null default 40 check (capacity >= 0),
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists public.membership_plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  duration        int not null check (duration > 0),
  duration_unit   text not null default 'month' check (duration_unit in ('day','days','month','months')),
  duration_days   int not null check (duration_days > 0),
  price           numeric(10,2) not null check (price >= 0),
  description     text not null default '',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.seats (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  centre_id       uuid not null references public.centres(id) on delete cascade,
  number          text not null,
  floor           int not null default 1,
  floor_name      text not null default 'Floor 1',
  section         text not null default 'A',
  zone            text not null default '',
  position        int not null default 0,
  override        text check (override in ('maintenance','blocked','reserved')),
  -- Temporary release while the holder is on leave. The holder stays on
  -- students.seat_id throughout — this is never a reassignment.
  temporary       jsonb,
  created_at      timestamptz not null default now(),
  -- Seat numbers repeat across centres; they must be unique within one.
  unique (centre_id, number)
);

create table if not exists public.students (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  centre_id         uuid not null references public.centres(id) on delete cascade,
  student_code      text not null,
  first_name        text not null,
  last_name         text not null default '',
  full_name         text generated always as (trim(first_name || ' ' || last_name)) stored,
  gender            text default 'Male',
  email             text default '',
  phone             text not null,
  address           text default '',
  city              text default '',
  pincode           text default '',
  emergency_name    text default '',
  emergency_contact text default '',
  exam              text default '',

  seat_id           uuid references public.seats(id) on delete set null,
  slot_id           uuid references public.slots(id) on delete set null,

  plan_id           uuid references public.membership_plans(id) on delete set null,
  plan_price        numeric(10,2) not null default 0,
  membership_start  date not null default current_date,
  membership_expiry date not null default current_date,
  paused_days       int not null default 0,

  fee_due_date      date not null default current_date,
  outstanding       numeric(10,2) not null default 0 check (outstanding >= 0),

  status            text not null default 'active' check (status in ('active','on_leave','inactive')),
  join_date         date not null default current_date,
  source            text default 'Walk-in',
  referred_by       text,
  reminder_sent_on  date,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (centre_id, student_code)
);

-- One student per seat. Enforced here because "two students on A-24" is
-- the bug that quietly ruins a seat map, and it must hold per centre.
create unique index if not exists students_seat_unique
  on public.students (seat_id) where seat_id is not null;

create table if not exists public.attendance (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  centre_id       uuid not null references public.centres(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  slot_id         uuid references public.slots(id) on delete set null,
  seat_number     text,
  date            date not null,
  check_in        text,
  check_out       text,
  status          text not null default 'absent' check (status in ('present','absent','late','leave')),
  marked_by       text not null default 'Manual',
  created_at      timestamptz not null default now(),
  unique (student_id, date)
);

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  centre_id       uuid not null references public.centres(id) on delete cascade,
  receipt_number  text not null,
  invoice_number  text not null default '',
  student_id      uuid not null references public.students(id) on delete cascade,
  amount          numeric(10,2) not null check (amount > 0),
  method          text not null default 'Cash',
  date            date not null default current_date,
  status          text not null default 'completed' check (status in ('completed','pending','failed')),
  plan_id         uuid references public.membership_plans(id) on delete set null,
  plan_name       text default '',
  period_start    date,
  period_end      date,
  transaction_id  text default '',
  collected_by    text default '',
  notes           text default '',
  type            text not null default 'membership' check (type in ('membership','locker','deposit','other')),
  created_at      timestamptz not null default now(),
  -- Receipt numbers restart per organization, so they are not globally unique.
  unique (organization_id, receipt_number)
);

create table if not exists public.leaves (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  centre_id       uuid not null references public.centres(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  seat_number     text,
  start_date      date not null,
  end_date        date not null,
  extended_to     date,
  reason          text not null default '',
  status          text not null default 'upcoming' check (status in ('upcoming','active','completed','cancelled')),
  seat_action     text not null default 'released' check (seat_action in ('released','reserved')),
  remaining_days_at_start int not null default 0,
  requested_on    date not null default current_date,
  resumed_on      date,
  approved_by     text default '',
  created_at      timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.shift_change_requests (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  centre_id         uuid not null references public.centres(id) on delete cascade,
  student_id        uuid not null references public.students(id) on delete cascade,
  current_slot_id   uuid references public.slots(id) on delete set null,
  requested_slot_id uuid references public.slots(id) on delete set null,
  current_seat      text,
  new_seat          text,
  new_seat_id       uuid references public.seats(id) on delete set null,
  effective_date    date not null default current_date,
  fee_difference    numeric(10,2) not null default 0,
  reason            text not null default '',
  status            text not null default 'pending' check (status in ('pending','approved','rejected','completed')),
  requested_on      date not null default current_date,
  history           jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

create table if not exists public.seat_assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  centre_id       uuid not null references public.centres(id) on delete cascade,
  student_id      uuid references public.students(id) on delete set null,
  student_name    text not null default '',
  type            text not null check (type in ('assigned','transferred','released','temp_released','temp_allocated','resumed','shift_changed')),
  from_seat       text,
  to_seat         text,
  note            text default '',
  performed_by    text default '',
  occurred_at     timestamptz not null default now()
);

create table if not exists public.waitlist (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  centre_id         uuid not null references public.centres(id) on delete cascade,
  name              text not null,
  phone             text not null,
  preferred_slot_id uuid references public.slots(id) on delete set null,
  preferred_section text default 'Any',
  exam              text default '',
  note              text default '',
  priority          text not null default 'normal' check (priority in ('low','normal','high')),
  added_on          date not null default current_date,
  created_at        timestamptz not null default now()
);

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  centre_id       uuid not null references public.centres(id) on delete cascade,
  category        text not null,
  description     text not null,
  amount          numeric(10,2) not null check (amount > 0),
  date            date not null default current_date,
  payment_method  text not null default 'Cash',
  added_by        text default '',
  receipt         text,
  notes           text default '',
  created_at      timestamptz not null default now()
);

create table if not exists public.maintenance_issues (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  centre_id           uuid not null references public.centres(id) on delete cascade,
  seat_number         text not null,
  issue               text not null,
  priority            text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status              text not null default 'open' check (status in ('open','in_progress','resolved')),
  reported_date       date not null default current_date,
  reported_by         text default '',
  expected_resolution date,
  assigned_staff      text default '',
  resolved_date       date,
  blocks_seat         boolean not null default false,
  notes               text default '',
  created_at          timestamptz not null default now()
);

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  centre_id       uuid references public.centres(id) on delete cascade,
  type            text not null default 'system',
  title           text not null,
  message         text not null default '',
  category        text not null default 'system',
  link            text,
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  centre_id       uuid references public.centres(id) on delete cascade,
  action          text not null,
  entity          text not null default '',
  summary         text not null default '',
  before          text default '—',
  after           text default '—',
  actor_id        uuid references public.profiles(id) on delete set null,
  actor_name      text not null default '',
  occurred_at     timestamptz not null default now()
);

-- ============================================================
-- 5. TRIGGERS
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['organizations','centres','profiles','organization_memberships','students','centre_settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Default slots and plans for a brand-new organization.
--
-- Reference data is per-tenant now, so it cannot be seeded globally the
-- way a single-tenant schema would.
-- ------------------------------------------------------------
create or replace function public.seed_organization_defaults(org uuid, centre uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.slots (organization_id, centre_id, name, start_time, end_time, capacity, is_active, sort_order)
  values
    (org, centre, 'Morning',   '06:00 AM', '12:00 PM', 45, true,  1),
    (org, centre, 'Afternoon', '12:00 PM', '06:00 PM', 45, true,  2),
    (org, centre, 'Evening',   '06:00 PM', '11:00 PM', 45, true,  3),
    (org, centre, 'Full Day',  '06:00 AM', '11:00 PM', 20, true,  4),
    (org, centre, 'Night',     '11:00 PM', '06:00 AM', 20, false, 5);

  insert into public.membership_plans (organization_id, name, duration, duration_unit, duration_days, price, description)
  values
    (org, 'Daily Pass',      1,  'day',    1,   120.00,  'Single day access, any open seat'),
    (org, 'Weekly',          7,  'days',   7,   600.00,  'Seven days, shift of choice'),
    (org, 'Monthly',         1,  'month',  30,  1500.00, 'Fixed seat for one shift'),
    (org, 'Premium Monthly', 1,  'month',  30,  1800.00, 'Fixed seat, locker and reading light'),
    (org, 'Quarterly',       3,  'months', 90,  4200.00, 'Three months, 7% saving'),
    (org, 'Half Yearly',     6,  'months', 180, 7800.00, 'Six months, 13% saving'),
    (org, 'Yearly',          12, 'months', 365, 14400.00,'Twelve months, 20% saving');
end;
$$;

-- ------------------------------------------------------------
-- New signup.
--
-- Always creates the identity profile. Then the bootstrap question:
-- with no organizations in the system at all, the first user must be
-- able to create one, or nobody could ever sign in — every account
-- would land on /account-blocked with no owner able to invite them.
--
-- So: the FIRST account provisions an organization, a centre, its
-- settings and default reference data, and becomes owner. Every later
-- signup gets a profile and no membership, so it lands on
-- /account-blocked until an owner invites it.
--
-- To make this a self-serve SaaS instead, drop the
-- `not exists (select 1 from organizations)` guard so every signup
-- provisions its own organization.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org    uuid;
  new_centre uuid;
  org_name   text;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  if not exists (select 1 from public.organizations) then
    org_name := coalesce(nullif(new.raw_user_meta_data->>'organization_name', ''), 'My Study Center');

    insert into public.organizations (name, slug)
    values (org_name, 'org-' || substr(replace(new.id::text, '-', ''), 1, 12))
    returning id into new_org;

    insert into public.centres (organization_id, name, code)
    values (new_org, 'Main Branch', 'MAIN')
    returning id into new_centre;

    insert into public.centre_settings (centre_id, organization_id, name, branch, email)
    values (new_centre, new_org, org_name, 'Main Branch', new.email);

    insert into public.organization_memberships (user_id, organization_id, centre_id, role, status)
    values (new.id, new_org, null, 'owner', 'active');

    perform public.seed_organization_defaults(new_org, new_centre);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Nobody may promote themselves or reactivate their own membership.
-- Postgres has no column-level RLS, so this lives in a trigger.
-- ------------------------------------------------------------
create or replace function public.guard_membership_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- No end-user context means service_role or a migration (the seed
  -- script and break-glass repair both need this). An anonymous caller
  -- can never reach here: the UPDATE policy filters the row out first.
  if auth.uid() is null then
    return new;
  end if;

  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not public.is_org_owner(old.organization_id) then
    raise exception 'Only an owner can change a member''s role or status';
  end if;

  -- Losing the last active owner would lock everyone out of settings
  -- permanently, with no way back through the UI.
  if (old.role = 'owner' and old.status = 'active')
     and (new.role <> 'owner' or new.status <> 'active') then
    if (select count(*) from public.organization_memberships
        where organization_id = old.organization_id
          and role = 'owner' and status = 'active') <= 1 then
      raise exception 'The organization must keep at least one active owner';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_guard on public.organization_memberships;
create trigger memberships_guard before update on public.organization_memberships
  for each row execute function public.guard_membership_change();

-- Internal functions must not be callable over the API.
revoke all on function public.handle_new_user()            from public, anon, authenticated;
revoke all on function public.guard_membership_change()    from public, anon, authenticated;
revoke all on function public.touch_updated_at()           from public, anon, authenticated;
revoke all on function public.seed_organization_defaults(uuid, uuid) from public, anon, authenticated;

grant execute on function public.my_organization_ids() to anon, authenticated;
grant execute on function public.my_centre_ids()       to anon, authenticated;
grant execute on function public.is_org_member(uuid)   to anon, authenticated;
grant execute on function public.is_org_owner(uuid)    to anon, authenticated;
grant execute on function public.is_centre_owner(uuid) to anon, authenticated;

-- ============================================================
-- 6. INDEXES
-- ------------------------------------------------------------
-- Every tenant-scoped query filters on organization_id or centre_id
-- first, so those lead the composite indexes.
-- ============================================================
create index if not exists memberships_user_idx      on public.organization_memberships (user_id, status);
create index if not exists memberships_org_idx       on public.organization_memberships (organization_id, status);
create index if not exists centres_org_idx           on public.centres (organization_id, is_active);

create index if not exists students_centre_status_idx on public.students (centre_id, status);
create index if not exists students_expiry_idx        on public.students (centre_id, membership_expiry);
create index if not exists students_fee_due_idx       on public.students (centre_id, fee_due_date) where outstanding > 0;
create index if not exists students_slot_idx          on public.students (slot_id);
create index if not exists students_phone_idx         on public.students (centre_id, phone);
create index if not exists students_name_idx          on public.students using gin (to_tsvector('simple', full_name));

create index if not exists attendance_centre_date_idx  on public.attendance (centre_id, date desc);
create index if not exists attendance_student_date_idx on public.attendance (student_id, date desc);

create index if not exists payments_centre_date_idx  on public.payments (centre_id, date desc);
create index if not exists payments_student_idx      on public.payments (student_id, date desc);

create index if not exists seats_centre_idx          on public.seats (centre_id, section, position);
create index if not exists leaves_centre_status_idx  on public.leaves (centre_id, status);
create index if not exists shift_requests_status_idx on public.shift_change_requests (centre_id, status);
create index if not exists maintenance_status_idx    on public.maintenance_issues (centre_id, status);
create index if not exists expenses_date_idx         on public.expenses (centre_id, date desc);
create index if not exists audit_occurred_idx        on public.audit_log (organization_id, occurred_at desc);
create index if not exists slots_centre_idx          on public.slots (centre_id, sort_order);
create index if not exists plans_org_idx             on public.membership_plans (organization_id, price);

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- On for every table. The anon key alone grants nothing. A caller sees
-- only rows belonging to an organization they are an active member of.
-- ============================================================
alter table public.organizations            enable row level security;
alter table public.centres                  enable row level security;
alter table public.profiles                 enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.centre_settings          enable row level security;
alter table public.slots                    enable row level security;
alter table public.membership_plans         enable row level security;
alter table public.seats                    enable row level security;
alter table public.students                 enable row level security;
alter table public.attendance               enable row level security;
alter table public.payments                 enable row level security;
alter table public.leaves                   enable row level security;
alter table public.shift_change_requests    enable row level security;
alter table public.seat_assignments         enable row level security;
alter table public.waitlist                 enable row level security;
alter table public.expenses                 enable row level security;
alter table public.maintenance_issues       enable row level security;
alter table public.notifications            enable row level security;
alter table public.audit_log                enable row level security;

-- ── Organizations ───────────────────────────────────────────
drop policy if exists orgs_select_member on public.organizations;
create policy orgs_select_member on public.organizations
  for select using (id in (select public.my_organization_ids()));

drop policy if exists orgs_update_owner on public.organizations;
create policy orgs_update_owner on public.organizations
  for update using (public.is_org_owner(id)) with check (public.is_org_owner(id));

-- ── Centres ─────────────────────────────────────────────────
drop policy if exists centres_select_member on public.centres;
create policy centres_select_member on public.centres
  for select using (organization_id in (select public.my_organization_ids()));

drop policy if exists centres_write_owner on public.centres;
create policy centres_write_owner on public.centres
  for all using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));

-- ── Profiles ────────────────────────────────────────────────
-- Yourself, or anyone sharing an organization with you.
drop policy if exists profiles_select_self_or_colleague on public.profiles;
create policy profiles_select_self_or_colleague on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.organization_memberships m
      where m.user_id = public.profiles.id
        and m.organization_id in (select public.my_organization_ids())
    )
  );

-- Identity only; role and status are not on this table.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── Memberships ─────────────────────────────────────────────
drop policy if exists memberships_select on public.organization_memberships;
create policy memberships_select on public.organization_memberships
  for select using (
    user_id = auth.uid() or organization_id in (select public.my_organization_ids())
  );

drop policy if exists memberships_write_owner on public.organization_memberships;
create policy memberships_write_owner on public.organization_memberships
  for all using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));

-- ── Settings: members read, owners write ────────────────────
drop policy if exists settings_select_member on public.centre_settings;
create policy settings_select_member on public.centre_settings
  for select using (organization_id in (select public.my_organization_ids()));

drop policy if exists settings_update_owner on public.centre_settings;
create policy settings_update_owner on public.centre_settings
  for update using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));

-- ── Plans: organization-wide, owners write ──────────────────
drop policy if exists plans_select_member on public.membership_plans;
create policy plans_select_member on public.membership_plans
  for select using (organization_id in (select public.my_organization_ids()));

drop policy if exists plans_write_owner on public.membership_plans;
create policy plans_write_owner on public.membership_plans
  for all using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));

-- ── Everything else: any active member of the organization ──
do $$
declare t text;
begin
  foreach t in array array[
    'slots','seats','students','attendance','payments','leaves',
    'shift_change_requests','seat_assignments','waitlist','expenses',
    'maintenance_issues','notifications'
  ] loop
    execute format('drop policy if exists %I_member_all on public.%I', t, t);
    execute format(
      'create policy %I_member_all on public.%I for all
         using (organization_id in (select public.my_organization_ids()))
         with check (organization_id in (select public.my_organization_ids()))',
      t, t
    );
  end loop;
end $$;

-- ── Audit log: append-only ──────────────────────────────────
-- Members read and insert but never update or delete; a trail that can
-- be rewritten is not a trail.
drop policy if exists audit_select_member on public.audit_log;
create policy audit_select_member on public.audit_log
  for select using (organization_id in (select public.my_organization_ids()));

drop policy if exists audit_insert_member on public.audit_log;
create policy audit_insert_member on public.audit_log
  for insert with check (organization_id in (select public.my_organization_ids()));

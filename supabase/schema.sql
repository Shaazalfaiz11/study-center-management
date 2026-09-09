-- ============================================================
-- SELF STUDY CENTER — SCHEMA
-- ------------------------------------------------------------
-- Paste this whole file into the Supabase SQL editor and run it.
-- It is idempotent: re-running it is safe.
--
-- Covers auth/profiles and centre settings (wired up now), plus the
-- operational tables the rest of the app will move onto. Creating the
-- schema once avoids painful migrations against live data later.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============================================================
-- 1. PROFILES — staff accounts, keyed to auth.users
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  phone       text default '',
  role        text not null default 'front_desk'
                check (role in ('owner', 'front_desk', 'facilities')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Staff who can sign in. One row per auth user.';

-- ------------------------------------------------------------
-- Role helpers.
--
-- SECURITY DEFINER so they read profiles WITHOUT re-entering RLS.
-- A policy on profiles that selects from profiles would recurse
-- infinitely; this is the standard way out of that trap.
-- ------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and is_active
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  );
$$;

-- ------------------------------------------------------------
-- New signups get a profile automatically.
--
-- The very first account becomes the owner — otherwise nobody could
-- ever reach the owner-only settings. Everyone after that lands on
-- front_desk and an owner promotes them.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count int;
  assigned_role  text;
begin
  select count(*) into existing_count from public.profiles;
  assigned_role := case when existing_count = 0 then 'owner' else 'front_desk' end;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    assigned_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 2. CENTRE SETTINGS — single row
-- ============================================================
create table if not exists public.centre_settings (
  id                        int primary key default 1 check (id = 1),
  name                      text not null default 'Self Study Center',
  branch                    text not null default 'Main Branch',
  address                   text not null default '',
  phone                     text not null default '',
  email                     text not null default '',
  gstin                     text not null default '',
  opening_time              text not null default '06:00 AM',
  closing_time              text not null default '11:00 PM',
  currency                  text not null default 'INR',
  timezone                  text not null default 'Asia/Kolkata',

  -- Business rules. These drive the flags across the app, so they live
  -- in the database rather than being hard-coded in the frontend.
  expiring_soon_days        int  not null default 7  check (expiring_soon_days between 1 and 90),
  inactive_attendance_days  int  not null default 7  check (inactive_attendance_days between 1 and 90),
  grace_period_days         int  not null default 10 check (grace_period_days between 0 and 90),

  reminder_offsets          int[] not null default '{7,3,1,0}',
  payment_methods           text[] not null default '{Cash,UPI,Card,Bank Transfer}',

  updated_at                timestamptz not null default now(),
  updated_by                uuid references public.profiles(id) on delete set null
);

drop trigger if exists centre_settings_touch on public.centre_settings;
create trigger centre_settings_touch before update on public.centre_settings
  for each row execute function public.touch_updated_at();

insert into public.centre_settings (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- 3. OPERATIONAL TABLES
-- ============================================================
create table if not exists public.slots (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_time  text not null,
  end_time    text not null,
  capacity    int  not null default 40 check (capacity >= 0),
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.membership_plans (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  duration       int  not null check (duration > 0),
  duration_unit  text not null default 'month' check (duration_unit in ('day','days','month','months')),
  duration_days  int  not null check (duration_days > 0),
  price          numeric(10,2) not null check (price >= 0),
  description    text not null default '',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.seats (
  id          uuid primary key default gen_random_uuid(),
  number      text not null unique,
  floor       int  not null default 1,
  floor_name  text not null default 'Floor 1',
  section     text not null default 'A',
  zone        text not null default '',
  position    int  not null default 0,
  -- Admin override: maintenance | blocked | reserved | null
  override    text check (override in ('maintenance','blocked','reserved')),
  -- Temporary release while the holder is on leave. The holder stays on
  -- student_id throughout — this is never a reassignment.
  temporary   jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.students (
  id                 uuid primary key default gen_random_uuid(),
  student_code       text not null unique,
  first_name         text not null,
  last_name          text not null default '',
  full_name          text generated always as (trim(first_name || ' ' || last_name)) stored,
  gender             text default 'Male',
  email              text default '',
  phone              text not null,
  address            text default '',
  city               text default '',
  pincode            text default '',
  emergency_name     text default '',
  emergency_contact  text default '',
  exam               text default '',

  seat_id            uuid references public.seats(id) on delete set null,
  slot_id            uuid references public.slots(id) on delete set null,

  plan_id            uuid references public.membership_plans(id) on delete set null,
  plan_price         numeric(10,2) not null default 0,
  membership_start   date not null default current_date,
  membership_expiry  date not null default current_date,
  paused_days        int  not null default 0,

  fee_due_date       date not null default current_date,
  outstanding        numeric(10,2) not null default 0 check (outstanding >= 0),

  status             text not null default 'active'
                       check (status in ('active','on_leave','inactive')),
  join_date          date not null default current_date,
  source             text default 'Walk-in',
  referred_by        text,
  reminder_sent_on   date,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists students_touch on public.students;
create trigger students_touch before update on public.students
  for each row execute function public.touch_updated_at();

-- A seat holds at most one student. Enforced in the database, because
-- "two students on seat A-24" is the bug that quietly ruins a seat map.
create unique index if not exists students_seat_unique
  on public.students (seat_id) where seat_id is not null;

create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  slot_id      uuid references public.slots(id) on delete set null,
  seat_number  text,
  date         date not null,
  check_in     text,
  check_out    text,
  status       text not null default 'absent'
                 check (status in ('present','absent','late','leave')),
  marked_by    text not null default 'Manual',
  created_at   timestamptz not null default now(),
  unique (student_id, date)
);

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  receipt_number  text not null unique,
  invoice_number  text not null,
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
  created_at      timestamptz not null default now()
);

create table if not exists public.leaves (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete cascade,
  seat_number    text,
  start_date     date not null,
  end_date       date not null,
  extended_to    date,
  reason         text not null default '',
  status         text not null default 'upcoming'
                   check (status in ('upcoming','active','completed','cancelled')),
  seat_action    text not null default 'released' check (seat_action in ('released','reserved')),
  remaining_days_at_start int not null default 0,
  requested_on   date not null default current_date,
  resumed_on     date,
  approved_by    text default '',
  created_at     timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.shift_change_requests (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students(id) on delete cascade,
  current_slot_id    uuid references public.slots(id) on delete set null,
  requested_slot_id  uuid references public.slots(id) on delete set null,
  current_seat       text,
  new_seat           text,
  new_seat_id        uuid references public.seats(id) on delete set null,
  effective_date     date not null default current_date,
  fee_difference     numeric(10,2) not null default 0,
  reason             text not null default '',
  status             text not null default 'pending'
                       check (status in ('pending','approved','rejected','completed')),
  requested_on       date not null default current_date,
  history            jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now()
);

create table if not exists public.seat_assignments (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid references public.students(id) on delete set null,
  student_name text not null default '',
  type         text not null
                 check (type in ('assigned','transferred','released','temp_released','temp_allocated','resumed','shift_changed')),
  from_seat    text,
  to_seat      text,
  note         text default '',
  performed_by text default '',
  occurred_at  timestamptz not null default now()
);

create table if not exists public.waitlist (
  id                uuid primary key default gen_random_uuid(),
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
  id             uuid primary key default gen_random_uuid(),
  category       text not null,
  description    text not null,
  amount         numeric(10,2) not null check (amount > 0),
  date           date not null default current_date,
  payment_method text not null default 'Cash',
  added_by       text default '',
  receipt        text,
  notes          text default '',
  created_at     timestamptz not null default now()
);

create table if not exists public.maintenance_issues (
  id                  uuid primary key default gen_random_uuid(),
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
  id         uuid primary key default gen_random_uuid(),
  type       text not null default 'system',
  title      text not null,
  message    text not null default '',
  category   text not null default 'system',
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  action     text not null,
  entity     text not null default '',
  summary    text not null default '',
  before     text default '—',
  after      text default '—',
  actor_id   uuid references public.profiles(id) on delete set null,
  actor_name text not null default '',
  occurred_at timestamptz not null default now()
);

-- ============================================================
-- 4. INDEXES
-- ------------------------------------------------------------
-- Sized for the read patterns the dashboard actually issues. Without
-- these, the collection screen and seat map degrade into sequential
-- scans as soon as there is real data behind them.
-- ============================================================
create index if not exists students_status_idx        on public.students (status);
create index if not exists students_expiry_idx        on public.students (membership_expiry);
create index if not exists students_fee_due_idx       on public.students (fee_due_date) where outstanding > 0;
create index if not exists students_slot_idx          on public.students (slot_id);
create index if not exists students_plan_idx          on public.students (plan_id);
create index if not exists students_name_idx          on public.students using gin (to_tsvector('simple', full_name));
create index if not exists students_phone_idx         on public.students (phone);

create index if not exists attendance_date_idx        on public.attendance (date desc);
create index if not exists attendance_student_date_idx on public.attendance (student_id, date desc);
create index if not exists attendance_slot_date_idx   on public.attendance (slot_id, date desc);

create index if not exists payments_date_idx          on public.payments (date desc);
create index if not exists payments_student_idx       on public.payments (student_id, date desc);

create index if not exists seats_override_idx         on public.seats (override);
create index if not exists seats_section_idx          on public.seats (section, position);

create index if not exists leaves_status_idx          on public.leaves (status);
create index if not exists leaves_student_idx         on public.leaves (student_id);
create index if not exists shift_requests_status_idx  on public.shift_change_requests (status);
create index if not exists maintenance_status_idx     on public.maintenance_issues (status);
create index if not exists expenses_date_idx          on public.expenses (date desc);
create index if not exists audit_occurred_idx         on public.audit_log (occurred_at desc);
create index if not exists seat_assignments_seat_idx  on public.seat_assignments (from_seat, to_seat);

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- On for every table. The anon key alone grants nothing; a caller must
-- be an active staff member. Settings and role changes are owner-only.
-- ============================================================
alter table public.profiles              enable row level security;
alter table public.centre_settings       enable row level security;
alter table public.slots                 enable row level security;
alter table public.membership_plans      enable row level security;
alter table public.seats                 enable row level security;
alter table public.students              enable row level security;
alter table public.attendance            enable row level security;
alter table public.payments              enable row level security;
alter table public.leaves                enable row level security;
alter table public.shift_change_requests enable row level security;
alter table public.seat_assignments      enable row level security;
alter table public.waitlist              enable row level security;
alter table public.expenses              enable row level security;
alter table public.maintenance_issues    enable row level security;
alter table public.notifications         enable row level security;
alter table public.audit_log             enable row level security;

-- ── Profiles ────────────────────────────────────────────────
drop policy if exists profiles_select_self_or_staff on public.profiles;
create policy profiles_select_self_or_staff on public.profiles
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles
  for update using (public.is_owner()) with check (public.is_owner());

drop policy if exists profiles_delete_owner on public.profiles;
create policy profiles_delete_owner on public.profiles
  for delete using (public.is_owner() and id <> auth.uid());

-- A non-owner must not be able to promote themselves. Postgres has no
-- column-level RLS, so the guard lives in a trigger.
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'Only an owner can change a role';
  end if;
  if new.is_active is distinct from old.is_active and not public.is_owner() then
    raise exception 'Only an owner can activate or deactivate an account';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role_change();

-- ── Centre settings: everyone reads, owner writes ───────────
drop policy if exists settings_select_staff on public.centre_settings;
create policy settings_select_staff on public.centre_settings
  for select using (public.is_staff());

drop policy if exists settings_update_owner on public.centre_settings;
create policy settings_update_owner on public.centre_settings
  for update using (public.is_owner()) with check (public.is_owner());

-- ── Operational tables: any active staff member ─────────────
do $$
declare t text;
begin
  foreach t in array array[
    'slots','membership_plans','seats','students','attendance','payments',
    'leaves','shift_change_requests','seat_assignments','waitlist',
    'expenses','maintenance_issues','notifications'
  ] loop
    execute format('drop policy if exists %I_staff_all on public.%I', t, t);
    execute format(
      'create policy %I_staff_all on public.%I for all using (public.is_staff()) with check (public.is_staff())',
      t, t
    );
  end loop;
end $$;

-- ── Audit log: append-only ──────────────────────────────────
-- Staff can read and write entries but never edit or delete them;
-- a trail that can be rewritten is not a trail.
drop policy if exists audit_select_staff on public.audit_log;
create policy audit_select_staff on public.audit_log
  for select using (public.is_staff());

drop policy if exists audit_insert_staff on public.audit_log;
create policy audit_insert_staff on public.audit_log
  for insert with check (public.is_staff());

-- ============================================================
-- 6. SEED — reference data
-- ============================================================
insert into public.slots (name, start_time, end_time, capacity, is_active, sort_order)
select * from (values
  ('Morning',   '06:00 AM', '12:00 PM', 45, true,  1),
  ('Afternoon', '12:00 PM', '06:00 PM', 45, true,  2),
  ('Evening',   '06:00 PM', '11:00 PM', 45, true,  3),
  ('Full Day',  '06:00 AM', '11:00 PM', 20, true,  4),
  ('Night',     '11:00 PM', '06:00 AM', 20, false, 5)
) as v(name, start_time, end_time, capacity, is_active, sort_order)
where not exists (select 1 from public.slots);

insert into public.membership_plans (name, duration, duration_unit, duration_days, price, description)
select * from (values
  ('Daily Pass',      1,  'day',    1,   120.00, 'Single day access, any open seat'),
  ('Weekly',          7,  'days',   7,   600.00, 'Seven days, shift of choice'),
  ('Monthly',         1,  'month',  30,  1500.00, 'Fixed seat for one shift'),
  ('Premium Monthly', 1,  'month',  30,  1800.00, 'Fixed seat, locker and reading light'),
  ('Quarterly',       3,  'months', 90,  4200.00, 'Three months, 7% saving'),
  ('Half Yearly',     6,  'months', 180, 7800.00, 'Six months, 13% saving'),
  ('Yearly',          12, 'months', 365, 14400.00, 'Twelve months, 20% saving')
) as v(name, duration, duration_unit, duration_days, price, description)
where not exists (select 1 from public.membership_plans);

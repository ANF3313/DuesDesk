-- ============================================================================
-- DuesDesk — database schema + Row Level Security
--
-- HOW TO APPLY: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Safe to run once on a fresh project.
--
-- The security model in one paragraph:
--   Every tenant table carries org_id. RLS is enabled on every table, and
--   Postgres denies by default — a table with no policy returns nothing.
--   Logged-in org staff (the `authenticated` role) can only touch rows where
--   org_id matches their own org, resolved by private.user_org_id().
--   Browsers (the `anon` role) have NO policies at all: members, webhooks,
--   and cron are served by server code using the service-role key, and each
--   of those routes enforces its own gate (portal token / Stripe signature /
--   CRON_SECRET).
-- ============================================================================

-- Private schema: not exposed through the API. Helpers live here.
create schema if not exists private;

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

-- The tenant: one HOA or landlord.
create table public.orgs (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 2 and 120),
  currency          char(3) not null default 'USD' check (char_length(currency) = 3),
  -- Stripe Connect: set once the org starts onboarding; unique so a webhook
  -- event's account id maps to exactly one org.
  stripe_account_id text unique,
  -- Cached from Stripe's account.updated webhook so the UI can show
  -- "connected" without calling Stripe on every page load.
  charges_enabled   boolean not null default false,
  created_at        timestamptz not null default now()
);

-- Org staff. One row per Supabase auth user, created atomically with the org
-- by create_org_and_profile() below — never inserted directly by clients.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  org_id     uuid not null references public.orgs (id) on delete cascade,
  full_name  text,
  role       text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

-- A unit/property and its one owner or tenant.
create table public.units (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs (id) on delete cascade,
  label             text not null check (char_length(btrim(label)) between 1 and 80),
  member_name       text not null check (char_length(btrim(member_name)) between 1 and 120),
  member_email      text not null check (member_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- The unit's standard dues, in integer cents. Prefills invoices/schedules.
  dues_amount_cents integer not null check (dues_amount_cents > 0 and dues_amount_cents <= 10000000),
  -- The member's private pay link: /pay/<portal_token>. Two UUIDs of entropy;
  -- regenerating it instantly invalidates every previously sent link.
  portal_token      text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at        timestamptz not null default now(),
  -- The pair (id, org_id) lets child tables use a composite foreign key, so a
  -- row can never point at another org's unit — even if server code has a bug.
  unique (id, org_id)
);
create unique index units_org_label_unique on public.units (org_id, lower(label));

-- Recurring dues configuration. A daily cron turns due schedules into invoices.
create table public.dues_schedules (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs (id) on delete cascade,
  unit_id           uuid not null,
  amount_cents      integer not null check (amount_cents > 0 and amount_cents <= 10000000),
  currency          char(3) not null default 'USD' check (char_length(currency) = 3),
  cadence           text not null check (cadence in ('monthly', 'quarterly', 'annually')),
  memo              text not null default 'Dues' check (char_length(memo) between 1 and 140),
  next_invoice_date date not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  -- Composite FK: the unit must belong to the same org. Cross-tenant
  -- references are impossible at the schema level.
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index dues_schedules_org_idx on public.dues_schedules (org_id);
create index dues_schedules_due_idx on public.dues_schedules (next_invoice_date) where active;

-- One bill for one unit.
-- Status: open → processing (ACH initiated) → paid. 'void' = cancelled.
-- "Overdue" is DERIVED in queries (status='open' and due_date < today) —
-- never stored, so it can never go stale.
create table public.invoices (
  id                         uuid primary key default gen_random_uuid(),
  org_id                     uuid not null references public.orgs (id) on delete cascade,
  unit_id                    uuid not null,
  schedule_id                uuid references public.dues_schedules (id) on delete set null,
  amount_cents               integer not null check (amount_cents > 0 and amount_cents <= 10000000),
  currency                   char(3) not null default 'USD' check (char_length(currency) = 3),
  memo                       text not null check (char_length(memo) between 1 and 140),
  due_date                   date not null,
  -- For recurring invoices: which billing cycle this covers.
  period                     date,
  status                     text not null default 'open' check (status in ('open', 'processing', 'paid', 'void')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  paid_at                    timestamptz,
  created_at                 timestamptz not null default now(),
  foreign key (unit_id, org_id) references public.units (id, org_id) on delete cascade
);
create index invoices_org_status_idx on public.invoices (org_id, status);
create index invoices_unit_idx on public.invoices (unit_id);
-- The cron can run twice (or crash mid-run and retry) without double-billing:
-- one invoice per schedule per billing cycle, enforced by the database.
-- (One-off invoices have NULL schedule_id; Postgres treats NULLs as distinct,
-- so they're unaffected.)
alter table public.invoices
  add constraint invoices_schedule_period_unique unique (schedule_id, period);

-- Append-only ledger of Stripe-confirmed money events. Written ONLY by the
-- webhook handler (service role). The unique payment-intent id means a
-- replayed webhook physically cannot record the same payment twice.
create table public.payments (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.orgs (id) on delete cascade,
  invoice_id               uuid not null references public.invoices (id) on delete cascade,
  amount_cents             integer not null check (amount_cents > 0),
  currency                 char(3) not null check (char_length(currency) = 3),
  stripe_payment_intent_id text not null unique,
  payment_method           text not null default 'other' check (payment_method in ('card', 'us_bank_account', 'other')),
  status                   text not null check (status in ('processing', 'succeeded', 'failed')),
  failure_reason           text,
  created_at               timestamptz not null default now(),
  settled_at               timestamptz
);
create index payments_org_idx on public.payments (org_id);
create index payments_invoice_idx on public.payments (invoice_id);

-- Idempotency ledger for Stripe webhooks. The handler's FIRST action is an
-- insert here with ON CONFLICT DO NOTHING; if the row already existed, the
-- event was already processed and the handler returns immediately.
create table public.webhook_events (
  stripe_event_id text primary key,
  type            text not null,
  stripe_account  text,
  received_at     timestamptz not null default now()
);

-- Sent email blasts (history only — the send happens through Resend).
create table public.announcements (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs (id) on delete cascade,
  subject         text not null check (char_length(btrim(subject)) between 1 and 150),
  body            text not null check (char_length(body) between 1 and 5000),
  recipient_count integer not null default 0,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index announcements_org_idx on public.announcements (org_id);

-- ----------------------------------------------------------------------------
-- 2. HELPER: which org does the caller belong to?
-- SECURITY DEFINER so it can read profiles without tripping RLS recursion.
-- ----------------------------------------------------------------------------
create or replace function private.user_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

grant usage on schema private to authenticated;
grant execute on function private.user_org_id() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- Enabled everywhere; no policy = no access. The anon role gets nothing.
-- ----------------------------------------------------------------------------
alter table public.orgs            enable row level security;
alter table public.profiles        enable row level security;
alter table public.units           enable row level security;
alter table public.dues_schedules  enable row level security;
alter table public.invoices        enable row level security;
alter table public.payments        enable row level security;
alter table public.webhook_events  enable row level security;
alter table public.announcements   enable row level security;

-- orgs: staff can see and rename their own org. Creation goes through the
-- RPC below; no delete from the app.
create policy "org staff read own org" on public.orgs
  for select to authenticated using (id = private.user_org_id());
create policy "org staff update own org" on public.orgs
  for update to authenticated
  using (id = private.user_org_id()) with check (id = private.user_org_id());

-- profiles: visible within the org; you may edit only your own row, and you
-- can never move yourself to another org.
create policy "org staff read org profiles" on public.profiles
  for select to authenticated using (org_id = private.user_org_id());
create policy "user updates own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and org_id = private.user_org_id());

-- units: full CRUD inside your org.
create policy "org units select" on public.units
  for select to authenticated using (org_id = private.user_org_id());
create policy "org units insert" on public.units
  for insert to authenticated with check (org_id = private.user_org_id());
create policy "org units update" on public.units
  for update to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy "org units delete" on public.units
  for delete to authenticated using (org_id = private.user_org_id());

-- dues_schedules: full CRUD inside your org.
create policy "org schedules select" on public.dues_schedules
  for select to authenticated using (org_id = private.user_org_id());
create policy "org schedules insert" on public.dues_schedules
  for insert to authenticated with check (org_id = private.user_org_id());
create policy "org schedules update" on public.dues_schedules
  for update to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy "org schedules delete" on public.dues_schedules
  for delete to authenticated using (org_id = private.user_org_id());

-- invoices: create/read/update inside your org. Paid invoices can never be
-- deleted — that's money history, and the database itself refuses.
create policy "org invoices select" on public.invoices
  for select to authenticated using (org_id = private.user_org_id());
create policy "org invoices insert" on public.invoices
  for insert to authenticated with check (org_id = private.user_org_id());
create policy "org invoices update" on public.invoices
  for update to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy "org invoices delete unpaid only" on public.invoices
  for delete to authenticated
  using (org_id = private.user_org_id() and status <> 'paid');

-- payments: read-only for staff. Rows are written only by the webhook
-- handler via the service role.
create policy "org payments select" on public.payments
  for select to authenticated using (org_id = private.user_org_id());

-- webhook_events: intentionally NO policies. Service role only.

-- announcements: read history + record new sends; history is immutable.
create policy "org announcements select" on public.announcements
  for select to authenticated using (org_id = private.user_org_id());
create policy "org announcements insert" on public.announcements
  for insert to authenticated
  with check (org_id = private.user_org_id() and created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. SIGNUP: create org + profile atomically.
-- SECURITY DEFINER so it can insert into both tables; the auth.uid() checks
-- mean a user can only ever create a profile for themselves, exactly once.
-- ----------------------------------------------------------------------------
create or replace function public.create_org_and_profile(org_name text, owner_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'This account already belongs to an organization';
  end if;
  if org_name is null or char_length(btrim(org_name)) < 2 then
    raise exception 'Organization name must be at least 2 characters';
  end if;

  insert into public.orgs (name) values (btrim(org_name)) returning id into new_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (auth.uid(), new_org_id, nullif(btrim(coalesce(owner_name, '')), ''), 'owner');

  return new_org_id;
end;
$$;

revoke all on function public.create_org_and_profile(text, text) from public, anon;
grant execute on function public.create_org_and_profile(text, text) to authenticated;

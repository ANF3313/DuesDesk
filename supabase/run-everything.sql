-- ============================================================================
-- DuesDesk MASTER UPGRADE + DEMO STAGING
-- Run this ONE file in Supabase → SQL Editor. Safe to run multiple times.
-- It applies every upgrade (team, automation, expenses, autopay) and then
-- stages clean demo data. Ends by printing the member pay link to copy.
-- ============================================================================

-- ── Upgrade 01: team invites + reminder tracking ────────────────────────────
alter table public.profiles add column if not exists email text;
update public.profiles p set email = lower(u.email)
from auth.users u where u.id = p.id and p.email is null;

drop policy if exists "org staff remove teammates" on public.profiles;
create policy "org staff remove teammates" on public.profiles
  for delete to authenticated
  using (org_id = private.user_org_id() and id <> auth.uid());

create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs (id) on delete cascade,
  email       text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  token       text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);
create unique index if not exists invites_org_email_pending
  on public.invites (org_id, lower(email)) where accepted_at is null;
alter table public.invites enable row level security;

drop policy if exists "org staff read invites" on public.invites;
drop policy if exists "org staff create invites" on public.invites;
drop policy if exists "org staff revoke invites" on public.invites;
create policy "org staff read invites" on public.invites
  for select to authenticated using (org_id = private.user_org_id());
create policy "org staff create invites" on public.invites
  for insert to authenticated with check (org_id = private.user_org_id() and invited_by = auth.uid());
create policy "org staff revoke invites" on public.invites
  for delete to authenticated using (org_id = private.user_org_id());

create or replace function public.accept_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inv public.invites%rowtype;
  user_email text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'This account already belongs to an organization';
  end if;
  select * into inv from public.invites
  where token = invite_token and accepted_at is null and expires_at > now();
  if inv.id is null then
    raise exception 'This invite is no longer valid — ask your organization for a new one';
  end if;
  select lower(email) into user_email from auth.users where id = auth.uid();
  if user_email <> lower(inv.email) then
    raise exception 'This invite was sent to a different email address';
  end if;
  insert into public.profiles (id, org_id, full_name, role, email)
  values (auth.uid(), inv.org_id, inv.name, 'admin', user_email);
  update public.invites set accepted_at = now() where id = inv.id;
  return inv.org_id;
end; $$;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

create or replace function public.create_org_and_profile(org_name text, owner_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'This account already belongs to an organization';
  end if;
  if org_name is null or char_length(btrim(org_name)) < 2 then
    raise exception 'Organization name must be at least 2 characters';
  end if;
  insert into public.orgs (name) values (btrim(org_name)) returning id into new_org_id;
  insert into public.profiles (id, org_id, full_name, role, email)
  values (auth.uid(), new_org_id, nullif(btrim(coalesce(owner_name, '')), ''), 'owner',
          (select lower(email) from auth.users where id = auth.uid()));
  return new_org_id;
end; $$;
revoke all on function public.create_org_and_profile(text, text) from public, anon;
grant execute on function public.create_org_and_profile(text, text) to authenticated;

alter table public.invoices add column if not exists reminder_count integer not null default 0;
alter table public.invoices add column if not exists last_reminded_at timestamptz;

-- ── Upgrade 02: late fees + board digest ────────────────────────────────────
alter table public.orgs add column if not exists late_fee_cents integer not null default 0
  check (late_fee_cents >= 0 and late_fee_cents <= 10000000);
alter table public.orgs add column if not exists late_fee_grace_days integer not null default 5
  check (late_fee_grace_days between 0 and 90);
alter table public.orgs add column if not exists last_digest_on date;
alter table public.invoices add column if not exists is_late_fee boolean not null default false;
alter table public.invoices add column if not exists late_fee_applied boolean not null default false;

-- ── Upgrade 03: expense tracking ────────────────────────────────────────────
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.orgs (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 10000000),
  currency     char(3) not null default 'USD' check (char_length(currency) = 3),
  category     text not null default 'other' check (category in
    ('maintenance','utilities','insurance','landscaping','legal','management','reserves','other')),
  memo         text not null check (char_length(btrim(memo)) between 1 and 140),
  vendor       text check (vendor is null or char_length(vendor) <= 120),
  spent_on     date not null,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists expenses_org_date_idx on public.expenses (org_id, spent_on desc);
alter table public.expenses enable row level security;

drop policy if exists "org expenses select" on public.expenses;
drop policy if exists "org expenses insert" on public.expenses;
drop policy if exists "org expenses update" on public.expenses;
drop policy if exists "org expenses delete" on public.expenses;
create policy "org expenses select" on public.expenses
  for select to authenticated using (org_id = private.user_org_id());
create policy "org expenses insert" on public.expenses
  for insert to authenticated with check (org_id = private.user_org_id());
create policy "org expenses update" on public.expenses
  for update to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy "org expenses delete" on public.expenses
  for delete to authenticated using (org_id = private.user_org_id());

-- ── Upgrade 04: autopay ─────────────────────────────────────────────────────
alter table public.units add column if not exists stripe_customer_id text;
alter table public.units add column if not exists stripe_payment_method_id text;
alter table public.units add column if not exists autopay_enabled boolean not null default false;
alter table public.units add column if not exists autopay_label text;

-- ── Demo staging: clean artifacts, stage realistic data ─────────────────────
delete from public.invoices where memo ilike '%duew%';
delete from public.dues_schedules where amount_cents = 38900;
update public.units set label = 'Unit 3D', dues_amount_cents = 35000
where label ilike 'unit1%';

update public.orgs set charges_enabled = true
where id = (select id from public.orgs order by created_at limit 1);

with org as (select id from public.orgs order by created_at limit 1),
u as (select id, label from public.units where org_id = (select id from org))
insert into public.invoices (org_id, unit_id, amount_cents, memo, due_date, status, paid_at)
select (select id from org), u.id, v.amount, v.memo, v.due, v.status, v.paid_at
from u
join (values
  ('Unit 2A', 35000,  'July dues',                   date '2026-06-01', 'open', null::timestamptz),
  ('Unit 4B', 35000,  'July dues',                   date '2026-07-01', 'paid', timestamptz '2026-07-03 10:00:00+00'),
  ('Unit 1C', 35000,  'July dues',                   date '2026-07-15', 'open', null),
  ('Unit 3D', 120000, 'Pool resurfacing assessment', date '2026-07-20', 'paid', timestamptz '2026-07-08 15:00:00+00')
) as v(label, amount, memo, due, status, paid_at)
  on v.label = u.label
where not exists (
  select 1 from public.invoices i
  where i.unit_id = u.id and i.memo = v.memo and i.due_date = v.due
);

insert into public.expenses (org_id, amount_cents, category, memo, vendor, spent_on)
select (select id from public.orgs order by created_at limit 1),
       v.amount_cents, v.category, v.memo, v.vendor, v.spent_on
from (values
  (42000, 'landscaping', 'Summer landscaping contract', 'GreenScape Co.',  date '2026-07-02'),
  (31000, 'insurance',   'Quarterly liability premium', 'Alliance Mutual', date '2026-07-05'),
  (18500, 'maintenance', 'Pool pump repair',            'Apex Plumbing',   date '2026-06-24')
) as v(amount_cents, category, memo, vendor, spent_on)
where not exists (select 1 from public.expenses e where e.memo = v.memo);

-- ── FINAL STEP: copy the link this prints and paste it to Claude ────────────
select 'https://dues-desk-six.vercel.app/pay/' || portal_token as member_pay_link
from public.units
where label = 'Unit 2A'
limit 1;

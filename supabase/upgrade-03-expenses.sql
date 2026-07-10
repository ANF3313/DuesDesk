-- DuesDesk upgrade 03: expense tracking.
-- HOW TO APPLY: Supabase → SQL Editor → paste → Run. Safe to run twice.

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

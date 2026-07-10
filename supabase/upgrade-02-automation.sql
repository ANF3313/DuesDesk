-- DuesDesk upgrade 02: late fees + monthly board digest.
-- HOW TO APPLY: Supabase → SQL Editor → paste → Run (after upgrade-01).

alter table public.orgs add column if not exists late_fee_cents integer not null default 0
  check (late_fee_cents >= 0 and late_fee_cents <= 10000000);
alter table public.orgs add column if not exists late_fee_grace_days integer not null default 5
  check (late_fee_grace_days between 0 and 90);
alter table public.orgs add column if not exists last_digest_on date;

alter table public.invoices add column if not exists is_late_fee boolean not null default false;
alter table public.invoices add column if not exists late_fee_applied boolean not null default false;

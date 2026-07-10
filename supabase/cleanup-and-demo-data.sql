-- DuesDesk: clean up test data + seed a polished demo set.
-- Supabase → SQL Editor → paste → Run. Safe to run twice.
-- NOTE: this only fixes text/typos and adds demo units. Ugly unit names,
-- amounts, or personal emails you created are easiest to fix in the app UI
-- (Units → pencil icon) — or adapt section C below.

-- A) Fix the "duews" typo anywhere it appears.
update public.dues_schedules set memo = 'Monthly dues' where memo ilike '%duew%';
update public.invoices      set memo = 'Monthly dues' where memo ilike '%duew%';

-- B) Seed three polished demo units into your org so screenshots look real.
--    (Uses your first org. Skips any label that already exists.)
insert into public.units (org_id, label, member_name, member_email, dues_amount_cents)
select o.id, v.label, v.member_name, v.member_email, 35000
from (select id from public.orgs order by created_at limit 1) o,
     (values
       ('Unit 2A', 'Maya Rodriguez',  'resident2a@example.com'),
       ('Unit 4B', 'Sam Alvarez',     'resident4b@example.com'),
       ('Unit 1C', 'Priya Natarajan', 'resident1c@example.com')
     ) as v(label, member_name, member_email)
on conflict do nothing;

-- C) Optional: rename your org for clean screenshots (uncomment to use).
-- update public.orgs set name = 'Maple Court HOA'
-- where id = (select id from public.orgs order by created_at limit 1);

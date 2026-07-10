-- DuesDesk demo staging: cleans test artifacts and stages realistic data
-- for marketing screenshots. Supabase → SQL Editor → paste all → Run.
-- Safe to run twice.

-- 1) Remove the test artifacts
delete from public.invoices where memo ilike '%duew%';
delete from public.dues_schedules where amount_cents = 38900;
update public.units set label = 'Unit 3D', dues_amount_cents = 35000
where label ilike 'unit1%';

-- 2) Hide the setup checklist / show pay buttons for the screenshot.
-- (If this org connects Stripe for real later, the app overwrites this with
-- the true status automatically.)
update public.orgs set charges_enabled = true
where id = (select id from public.orgs order by created_at limit 1);

-- 3) Stage realistic invoices: one overdue, one due, two paid
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

-- 4) A few expenses so Reports look alive too
insert into public.expenses (org_id, amount_cents, category, memo, vendor, spent_on)
select (select id from public.orgs order by created_at limit 1),
       v.amount_cents, v.category, v.memo, v.vendor, v.spent_on
from (values
  (42000, 'landscaping', 'Summer landscaping contract', 'GreenScape Co.',  date '2026-07-02'),
  (31000, 'insurance',   'Quarterly liability premium', 'Alliance Mutual', date '2026-07-05'),
  (18500, 'maintenance', 'Pool pump repair',            'Apex Plumbing',   date '2026-06-24')
) as v(amount_cents, category, memo, vendor, spent_on)
where not exists (select 1 from public.expenses e where e.memo = v.memo);

-- 5) IMPORTANT: this query prints a link — copy it and paste it to Claude.
select 'https://dues-desk-six.vercel.app/pay/' || portal_token as member_pay_link
from public.units
where label = 'Unit 2A'
limit 1;

-- DuesDesk upgrade 04: autopay. Safe to run twice.
alter table public.units add column if not exists stripe_customer_id text;
alter table public.units add column if not exists stripe_payment_method_id text;
alter table public.units add column if not exists autopay_enabled boolean not null default false;
alter table public.units add column if not exists autopay_label text;

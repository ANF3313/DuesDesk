-- ============================================================================
-- DuesDesk upgrade 01: team invites + automation columns
--
-- HOW TO APPLY: Supabase → SQL Editor → New query → paste this whole file →
-- Run. Safe to run once on a database that already ran schema.sql.
-- ============================================================================

-- ── Profiles: store email so the team list can show it ─────────────────────
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id and p.email is null;

-- Team members may remove other members of their org (never themselves).
create policy "org staff remove teammates" on public.profiles
  for delete to authenticated
  using (org_id = private.user_org_id() and id <> auth.uid());

-- Keep signup in sync: new profiles record their email too.
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

  insert into public.profiles (id, org_id, full_name, role, email)
  values (
    auth.uid(),
    new_org_id,
    nullif(btrim(coalesce(owner_name, '')), ''),
    'owner',
    (select lower(email) from auth.users where id = auth.uid())
  );

  return new_org_id;
end;
$$;

-- ── Team invites ────────────────────────────────────────────────────────────
create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs (id) on delete cascade,
  email       text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  -- The invite link credential, same entropy as portal tokens.
  token       text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);

-- One pending invite per email per org.
create unique index invites_org_email_pending
  on public.invites (org_id, lower(email)) where accepted_at is null;

alter table public.invites enable row level security;

create policy "org staff read invites" on public.invites
  for select to authenticated using (org_id = private.user_org_id());
create policy "org staff create invites" on public.invites
  for insert to authenticated
  with check (org_id = private.user_org_id() and invited_by = auth.uid());
create policy "org staff revoke invites" on public.invites
  for delete to authenticated using (org_id = private.user_org_id());

-- Accepting an invite: SECURITY DEFINER so it can read the invite by token
-- and create the profile. The email on the signed-in account MUST match the
-- email the invite was sent to.
create or replace function public.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites%rowtype;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'This account already belongs to an organization';
  end if;

  select * into inv
  from public.invites
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
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- ── Automation: track automatic overdue reminders per invoice ───────────────
alter table public.invoices add column if not exists reminder_count integer not null default 0;
alter table public.invoices add column if not exists last_reminded_at timestamptz;

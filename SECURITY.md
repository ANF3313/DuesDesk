# DuesDesk security checklist

What's enforced today, how to verify it, and what to review **before real
customer data or real payments touch this app**.

## 1. Tenant data isolation (RLS)

**Enforced:**
- Row Level Security is enabled on every table. Postgres denies by default —
  a table with no policy returns nothing, even to signed-in users.
- Every policy is the same auditable pattern:
  `org_id = private.user_org_id()` (the caller's org, resolved from their
  auth identity by a `SECURITY DEFINER` helper).
- The `anon` (browser) role has **zero policies** — nothing is readable
  without signing in.
- Cross-tenant references are impossible at the schema level: child tables
  use a composite foreign key `(unit_id, org_id)` against `units (id, org_id)`,
  so even buggy server code cannot attach Org A's invoice to Org B's unit.
- Paid invoices cannot be deleted (`status <> 'paid'` in the delete policy) —
  money history is protected by the database itself.
- Signup goes through one `SECURITY DEFINER` function that can only create a
  profile for the caller, exactly once.

**Verify before launch:** create two orgs, add data to both, then confirm in
the Supabase SQL editor (running as `authenticated` via the API, not as
`postgres`) that neither can read the other's rows. Five minutes, worth it.

## 2. Authentication

- Supabase email/password auth; sessions live in httpOnly cookies via
  `@supabase/ssr`. Middleware refreshes tokens and redirects signed-out users
  away from app routes.
- Every server action independently re-checks the session and org membership
  (`requireOrg()`) — middleware is convenience, not the security boundary.
- All input is re-validated server-side with zod; the client is never trusted.
- The sign-in `next` redirect only accepts same-site paths (no open redirect).

**Review before launch:** turn ON email confirmation in Supabase
(Authentication → Providers → Email), set a password strength policy, and
enable Supabase's built-in rate limits / captcha on auth endpoints.

## 3. Member portal links

- The pay link token is ~250 bits of randomness, unguessable and unqueryable
  (unique-indexed lookups only; malformed tokens 404 before touching the DB).
- A link holder sees ONE unit's balance and can pay it — nothing else. Pages
  send `noindex` and orgs can reset a unit's token in one click.
- **Understand the model:** the link is a bearer credential, like a Stripe
  invoice link. Anyone the member forwards it to can see that unit's balance.
  That's the accepted trade-off for zero-friction payment.

## 4. Stripe webhook + payments

- Signature verified with `STRIPE_WEBHOOK_SECRET` before anything is read;
  bad signatures get a 400.
- Idempotent at two independent layers: (1) a `webhook_events` ledger keyed
  by Stripe event id — replays return 200 without side effects; (2) a UNIQUE
  constraint on `payments.stripe_payment_intent_id` — the same payment can
  never be recorded twice.
- If handling throws mid-way, the ledger row is rolled back and we return
  500 so Stripe retries — no event is half-processed then forgotten.
- Payments are direct charges on each org's own connected account; the
  platform never holds funds. ACH's delayed settlement is modeled explicitly
  (`processing` → `paid`/back to `open`), so nothing shows paid before the
  bank actually clears it.
- Amount/currency come from the invoice row server-side — the client never
  sends a price.

**Review before launch:** in the Stripe dashboard, confirm the webhook
endpoint shows the exact 4 events and 100% delivery; set up an alert on
failed webhook deliveries (Stripe emails you, but check it's on).

## 5. Secrets

- Secrets exist only in `.env.local` (git-ignored) and Vercel env vars. The
  only NEXT_PUBLIC values are the Supabase URL, the anon key (designed to be
  public — RLS is the guard), and the app URL.
- The service-role key is used exclusively in server routes that gate access
  themselves (webhook = Stripe signature, portal/checkout = portal token,
  cron = `CRON_SECRET`). It is never imported by client-rendered code.
- The cron route rejects requests without `Authorization: Bearer CRON_SECRET`
  and refuses to run if the secret is unset.

## 6. Flag for review before real money 🚩

Do these before onboarding a paying customer:

1. **Second pair of eyes on RLS.** The policies are simple by design — have
   someone (or a fresh session of me) attempt cross-tenant reads/writes
   against a staging project.
2. **Rate limiting.** Auth endpoints get Supabase's limits, but
   `/api/checkout` and the portal page have none — a scraper could probe
   tokens (they're unguessable, but add Vercel WAF / rate rules anyway).
3. **Email confirmation + password policy ON** (see §2).
4. **A real sending domain** in Resend with SPF/DKIM — both for
   deliverability and because dues emails from `resend.dev` look like
   phishing.
5. **Live-mode Stripe review.** Switch keys, recreate the webhook in live
   mode, and run one real $1 end-to-end payment (card AND ACH) before
   announcing anything.
6. **Backups.** Supabase Pro has point-in-time recovery — for money records,
   pay for it.
7. **Monitoring.** At minimum: Vercel log drains or alerts on 5xx from
   `/api/webhooks/stripe` and the cron route.
8. **Legal.** Terms, privacy policy, and (depending on your state) whether
   collecting on behalf of HOAs triggers any registration requirements —
   worth one conversation with a lawyer.

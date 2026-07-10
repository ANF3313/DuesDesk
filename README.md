# DuesDesk

Dues collection and communication for self-managed HOAs and small landlords.
Members get a private link, pay by card or bank transfer (or enroll in
autopay), and invoices mark themselves paid. Money settles directly to the
organization's own bank account via Stripe Connect — DuesDesk never holds
funds. Also included: team invites, automatic overdue reminders, late fees,
offline-payment recording, expense tracking, yearly reports with CSV/PDF
export, CSV unit import, announcements, and a monthly board digest.

Schema changes live in `supabase/` — run `schema.sql` once, then each
`upgrade-XX-*.sql` in order in the Supabase SQL editor. The autopay upgrade
also needs `payment_intent.succeeded` and `payment_intent.payment_failed`
added to the Stripe webhook's events.

**Stack:** Next.js (App Router) · TypeScript · Supabase (Postgres + auth, RLS) ·
Stripe Connect · Resend · Tailwind CSS v4 · Vercel

---

## 1. Local setup (15 minutes)

Prereqs: Node 20+, free accounts at [supabase.com](https://supabase.com),
[stripe.com](https://stripe.com), [resend.com](https://resend.com).

```bash
npm install
copy .env.example .env.local   # then fill it in, see below
```

### Supabase (database + auth)

1. Create a new Supabase project.
2. Project Settings → API: copy the URL, `anon` key, and `service_role` key
   into `.env.local`.
3. SQL Editor → New query → paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql) → Run. This creates every
   table, all Row Level Security policies, and the signup function.
4. Recommended for a smooth demo: Authentication → Sign In / Providers →
   Email → turn **off** "Confirm email". (Leave it on if you prefer — signup
   then asks users to confirm before their org is created; both paths work.)

### Stripe

- Developers → API keys (Test mode ON): copy the secret key into `.env.local`.
- `STRIPE_WEBHOOK_SECRET` can stay empty until you deploy (webhooks need a
  public URL — see "Going live"). Payments still redirect to Stripe locally;
  invoices just won't auto-mark paid without the webhook. For full local
  testing use the Stripe CLI:
  `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
  and put the printed `whsec_...` in `.env.local`.

### Resend

- API Keys → create one → `RESEND_API_KEY`.
- No domain yet? Set `EMAIL_FROM=onboarding@resend.dev` — zero setup, but it
  only delivers to the email address on your Resend account (fine for testing).
- With a verified domain (Resend → Domains): `EMAIL_FROM=DuesDesk <dues@yourdomain.com>`

### Run it

```bash
npm run dev
```

Open http://localhost:3000 — create a workspace, add a unit, create dues.
To test a payment, connect Stripe in Settings (Test mode onboarding accepts
dummy data), then open the unit's pay link and use card `4242 4242 4242 4242`,
any future date, any CVC.

---

## 2. Going live on Vercel

1. Push this repo to GitHub, then vercel.com → Add New → Project → import it.
2. Settings → Environment Variables: add every variable from `.env.example`
   (use your **live** Stripe key when you're ready for real money; test key
   until then). Set `NEXT_PUBLIC_APP_URL` to your Vercel URL.
3. Deploy.
4. **Create the one Stripe webhook** (needs the deployed URL):
   - dashboard.stripe.com/webhooks → Add destination
   - Listen to events on: **Connected accounts**
   - Events (exactly these 4): `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `account.updated`
   - Endpoint URL: `https://YOUR-APP.vercel.app/api/webhooks/stripe`
   - Copy the signing secret → set `STRIPE_WEBHOOK_SECRET` in Vercel → redeploy.
5. The daily recurring-dues cron is configured in `vercel.json` and runs
   automatically once `CRON_SECRET` is set (any random 32+ char string —
   `openssl rand -hex 32`).

Read [`SECURITY.md`](SECURITY.md) before real customers or real money.

---

## 3. How the code is organized

```
supabase/schema.sql          entire database: tables, RLS policies, signup RPC
src/app/globals.css          the design system: every color/radius/shadow token
src/components/ui/           primitives: Button, fields, Card, StatusPill,
                             Table, Modal, Toast, EmptyState, Skeleton
src/lib/
  money.ts                   integer-cents math; the only dollars<->cents code
  validation.ts              zod schemas — every server action re-validates
  supabase/server.ts         RLS-scoped client (acts as the signed-in user)
  supabase/admin.ts          service-role client (webhook/portal/cron only)
  stripe.ts, emails.ts       lazy Stripe + Resend clients, email templates
src/app/(auth)/              sign in / sign up / onboarding + server actions
src/app/(app)/               dashboard, units, invoices, announcements,
                             settings — each folder: page + client + actions
src/app/pay/[token]/         member portal (no login; token is the credential)
src/app/api/checkout/        creates Stripe Checkout on the org's account
src/app/api/webhooks/stripe/ signature-verified, doubly idempotent webhook
src/app/api/cron/…           daily recurring-invoice generation
```

Key invariants:

- **Money is integer cents everywhere**, `currency` is an explicit column.
- **Every tenant table has `org_id` + RLS**; the browser-facing client can
  only ever see its own org's rows, enforced by Postgres, not app code.
- **"Overdue" is computed** (`open` + past due date), never stored.
- **Webhook idempotency is two-layer**: an event-id ledger plus a UNIQUE
  payment-intent constraint. Replays and retries are harmless.

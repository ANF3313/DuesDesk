import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/org";
import { sendPaymentIssueEmail, sendReceiptEmail } from "@/lib/emails";

/**
 * The single Stripe webhook. Listens to events on CONNECTED accounts
 * (payments happen on each org's own Stripe account).
 *
 * Idempotency, two independent layers:
 *   1. webhook_events ledger — first action is an insert keyed by event id;
 *      a replayed event finds the row and we return 200 without doing work.
 *   2. payments.stripe_payment_intent_id is UNIQUE — even if layer 1 were
 *      bypassed, the same payment cannot be recorded twice.
 * If handling throws, the ledger row is removed and we return 500 so
 * Stripe retries the event later.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const admin = createAdminClient();

  const { data: gate, error: gateError } = await admin
    .from("webhook_events")
    .upsert(
      {
        stripe_event_id: event.id,
        type: event.type,
        stripe_account: event.account ?? null,
      },
      { onConflict: "stripe_event_id", ignoreDuplicates: true },
    )
    .select("stripe_event_id");

  if (gateError) return new NextResponse("Ledger unavailable", { status: 500 });
  if (!gate || gate.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "setup") {
          // Autopay enrollment: save the card the member just verified.
          await saveAutopayMethod(admin, session, event.account);
          break;
        }
        if (session.payment_status === "paid") {
          // Card (or other instant method): money is confirmed.
          await markPaid(admin, session, "card");
        } else {
          // ACH debit initiated: confirmed later by async_payment_succeeded.
          await markProcessing(admin, session);
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaid(admin, session, "us_bank_account");
        break;
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markFailed(admin, session);
        break;
      }
      case "payment_intent.succeeded": {
        // Autopay charges (and a safety net for checkout payments).
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.invoice_id) await markPaidFromIntent(admin, pi);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        // Only autopay attempts — checkout failures are messaged by Stripe UI.
        if (pi.metadata?.autopay === "1" && pi.metadata?.invoice_id) {
          await notifyAutopayFailure(admin, pi.metadata.invoice_id);
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await admin
          .from("orgs")
          .update({ charges_enabled: !!account.charges_enabled })
          .eq("stripe_account_id", account.id);
        break;
      }
      default:
        break;
    }
  } catch {
    await admin.from("webhook_events").delete().eq("stripe_event_id", event.id);
    return new NextResponse("Handler failed, retry", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type InvoiceForWebhook = {
  id: string;
  org_id: string;
  amount_cents: number;
  currency: string;
  memo: string;
  status: string;
  units: {
    member_name: string;
    member_email: string;
    portal_token: string;
  } | null;
  orgs: { name: string } | null;
};

function invoiceIdOf(session: Stripe.Checkout.Session): string | null {
  return session.client_reference_id ?? session.metadata?.invoice_id ?? null;
}

function paymentIntentIdOf(session: Stripe.Checkout.Session): string {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent?.id ?? session.id);
}

async function loadInvoiceById(
  admin: SupabaseClient,
  invoiceId: string | null,
): Promise<InvoiceForWebhook | null> {
  if (!invoiceId) return null;
  const { data } = await admin
    .from("invoices")
    .select(
      "id, org_id, amount_cents, currency, memo, status, units(member_name, member_email, portal_token), orgs(name)",
    )
    .eq("id", invoiceId)
    .maybeSingle<InvoiceForWebhook>();
  return data;
}

async function loadInvoice(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<InvoiceForWebhook | null> {
  return loadInvoiceById(admin, invoiceIdOf(session));
}

/** Autopay enrollment: persist the verified card onto the unit. */
async function saveAutopayMethod(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
  account: string | undefined,
) {
  const unitId = session.metadata?.unit_id;
  const setupIntentId =
    typeof session.setup_intent === "string"
      ? session.setup_intent
      : session.setup_intent?.id;
  if (!unitId || !setupIntentId || !account) return;

  const si = await getStripe().setupIntents.retrieve(
    setupIntentId,
    { expand: ["payment_method"] },
    { stripeAccount: account },
  );
  const pm = si.payment_method as Stripe.PaymentMethod | null;
  if (!pm?.id) return;

  const label = pm.card
    ? `${pm.card.brand.toUpperCase()} •••• ${pm.card.last4}`
    : "saved payment method";

  const { error } = await admin
    .from("units")
    .update({
      stripe_payment_method_id: pm.id,
      autopay_enabled: true,
      autopay_label: label,
    })
    .eq("id", unitId);
  if (error) throw error;
}

/** Autopay success (also a harmless duplicate path for checkout payments). */
async function markPaidFromIntent(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
) {
  const invoice = await loadInvoiceById(admin, pi.metadata?.invoice_id ?? null);
  if (!invoice || invoice.status === "paid" || invoice.status === "void") return;

  const now = new Date().toISOString();
  const method = pi.payment_method_types?.includes("us_bank_account")
    ? "us_bank_account"
    : "card";

  const { error: invoiceError } = await admin
    .from("invoices")
    .update({ status: "paid", paid_at: now, stripe_payment_intent_id: pi.id })
    .eq("id", invoice.id);
  if (invoiceError) throw invoiceError;

  const { error: paymentError } = await admin.from("payments").upsert(
    {
      org_id: invoice.org_id,
      invoice_id: invoice.id,
      amount_cents: invoice.amount_cents,
      currency: invoice.currency,
      stripe_payment_intent_id: pi.id,
      payment_method: method,
      status: "succeeded",
      settled_at: now,
    },
    { onConflict: "stripe_payment_intent_id" },
  );
  if (paymentError) throw paymentError;

  if (invoice.units && invoice.orgs) {
    try {
      await sendReceiptEmail({
        to: invoice.units.member_email,
        memberName: invoice.units.member_name,
        orgName: invoice.orgs.name,
        memo: invoice.memo,
        amountCents: invoice.amount_cents,
      });
    } catch {}
  }
}

/** Autopay charge declined: tell the member and leave the invoice open. */
async function notifyAutopayFailure(admin: SupabaseClient, invoiceId: string) {
  const invoice = await loadInvoiceById(admin, invoiceId);
  if (!invoice || invoice.status !== "open") return;
  if (invoice.units && invoice.orgs) {
    try {
      await sendPaymentIssueEmail({
        to: invoice.units.member_email,
        memberName: invoice.units.member_name,
        orgName: invoice.orgs.name,
        memo: invoice.memo,
        amountCents: invoice.amount_cents,
        payUrl: `${appUrl()}/pay/${invoice.units.portal_token}`,
      });
    } catch {}
  }
}

async function markPaid(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
  method: "card" | "us_bank_account",
) {
  const invoice = await loadInvoice(admin, session);
  if (!invoice || invoice.status === "paid" || invoice.status === "void") return;

  const paymentIntentId = paymentIntentIdOf(session);
  const now = new Date().toISOString();

  const { error: invoiceError } = await admin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: now,
      stripe_payment_intent_id: paymentIntentId,
      stripe_checkout_session_id: session.id,
    })
    .eq("id", invoice.id);
  if (invoiceError) throw invoiceError;

  // Upsert (not insert-ignore): an ACH payment already recorded as
  // "processing" flips to "succeeded" here.
  // Record the DUES amount (the fee line is platform revenue, not org money).
  const { error: paymentError } = await admin.from("payments").upsert(
    {
      org_id: invoice.org_id,
      invoice_id: invoice.id,
      amount_cents: invoice.amount_cents,
      currency: invoice.currency,
      stripe_payment_intent_id: paymentIntentId,
      payment_method: method,
      status: "succeeded",
      settled_at: now,
    },
    { onConflict: "stripe_payment_intent_id" },
  );
  if (paymentError) throw paymentError;

  if (invoice.units && invoice.orgs) {
    try {
      await sendReceiptEmail({
        to: invoice.units.member_email,
        memberName: invoice.units.member_name,
        orgName: invoice.orgs.name,
        memo: invoice.memo,
        amountCents: invoice.amount_cents,
      });
    } catch {
      // Receipt email is best-effort; the payment record is what matters.
    }
  }
}

async function markProcessing(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
) {
  const invoice = await loadInvoice(admin, session);
  if (!invoice || invoice.status !== "open") return;

  const paymentIntentId = paymentIntentIdOf(session);

  const { error: invoiceError } = await admin
    .from("invoices")
    .update({
      status: "processing",
      stripe_payment_intent_id: paymentIntentId,
      stripe_checkout_session_id: session.id,
    })
    .eq("id", invoice.id);
  if (invoiceError) throw invoiceError;

  const { error: paymentError } = await admin.from("payments").upsert(
    {
      org_id: invoice.org_id,
      invoice_id: invoice.id,
      amount_cents: invoice.amount_cents,
      currency: invoice.currency,
      stripe_payment_intent_id: paymentIntentId,
      payment_method: "us_bank_account",
      status: "processing",
    },
    { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
  );
  if (paymentError) throw paymentError;
}

async function markFailed(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
) {
  const invoice = await loadInvoice(admin, session);
  if (!invoice || invoice.status === "paid" || invoice.status === "void") return;

  const { error: invoiceError } = await admin
    .from("invoices")
    .update({ status: "open" })
    .eq("id", invoice.id);
  if (invoiceError) throw invoiceError;

  const { error: paymentError } = await admin
    .from("payments")
    .update({
      status: "failed",
      failure_reason: "Bank debit was declined or failed",
    })
    .eq("stripe_payment_intent_id", paymentIntentIdOf(session));
  if (paymentError) throw paymentError;

  if (invoice.units && invoice.orgs) {
    try {
      await sendPaymentIssueEmail({
        to: invoice.units.member_email,
        memberName: invoice.units.member_name,
        orgName: invoice.orgs.name,
        memo: invoice.memo,
        amountCents: invoice.amount_cents,
        payUrl: `${appUrl()}/pay/${invoice.units.portal_token}`,
      });
    } catch {
      // Best-effort.
    }
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/org";
import { PLATFORM_FEE_CENTS, PLATFORM_FEE_LABEL } from "@/lib/fees";

/**
 * Starts a Stripe Checkout session for one invoice, charged directly on the
 * org's connected account so the money settles to THEIR bank.
 *
 * Unauthenticated by design (members don't have logins) — the portal token IS
 * the credential, and the invoice must belong to that token's unit.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const invoiceId = String(form.get("invoiceId") ?? "");

  const back = (t: string, status: string) =>
    NextResponse.redirect(`${appUrl()}/pay/${t}?status=${status}`, 303);

  if (!/^[a-f0-9]{32,128}$/i.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();

  const { data: unit } = await admin
    .from("units")
    .select("id, label, member_email, org_id, orgs(name, stripe_account_id, charges_enabled)")
    .eq("portal_token", token)
    .maybeSingle<{
      id: string;
      label: string;
      member_email: string;
      org_id: string;
      orgs: { name: string; stripe_account_id: string | null; charges_enabled: boolean } | null;
    }>();
  if (!unit || !unit.orgs) return new NextResponse("Not found", { status: 404 });

  // The invoice must belong to THIS token's unit and still be payable.
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, amount_cents, currency, memo, status, unit_id")
    .eq("id", invoiceId)
    .eq("unit_id", unit.id)
    .maybeSingle<{
      id: string;
      amount_cents: number;
      currency: string;
      memo: string;
      status: string;
      unit_id: string;
    }>();
  if (!invoice) return back(token, "error");
  if (invoice.status !== "open") return back(token, "error");
  if (!unit.orgs.stripe_account_id || !unit.orgs.charges_enabled) {
    return back(token, "error");
  }

  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: invoice.currency.toLowerCase(),
              unit_amount: invoice.amount_cents,
              product_data: {
                name: invoice.memo,
                description: `${unit.label} · ${unit.orgs.name}`,
              },
            },
          },
          // The platform fee, shown transparently as its own line. The org
          // still receives the full dues amount.
          {
            quantity: 1,
            price_data: {
              currency: invoice.currency.toLowerCase(),
              unit_amount: PLATFORM_FEE_CENTS,
              product_data: { name: PLATFORM_FEE_LABEL },
            },
          },
        ],
        customer_email: unit.member_email,
        client_reference_id: invoice.id,
        metadata: { invoice_id: invoice.id, org_id: unit.org_id },
        payment_intent_data: {
          application_fee_amount: PLATFORM_FEE_CENTS,
          metadata: { invoice_id: invoice.id, org_id: unit.org_id },
        },
        success_url: `${appUrl()}/pay/${token}?status=success`,
        cancel_url: `${appUrl()}/pay/${token}?status=cancelled`,
      },
      // Direct charge on the org's own Stripe account.
      { stripeAccount: unit.orgs.stripe_account_id },
    );

    await admin
      .from("invoices")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", invoice.id);

    return NextResponse.redirect(session.url!, 303);
  } catch {
    return back(token, "error");
  }
}

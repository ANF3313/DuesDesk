import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/org";

/**
 * Autopay enrollment from the member portal. The portal token is the
 * credential. "start" opens a Stripe setup session to save a card on the
 * org's connected account; "stop" turns autopay off.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const action = String(form.get("action") ?? "");

  const back = (status?: string) =>
    NextResponse.redirect(
      `${appUrl()}/pay/${token}${status ? `?status=${status}` : ""}`,
      303,
    );

  if (!/^[a-f0-9]{32,128}$/i.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const { data: unit } = await admin
    .from("units")
    .select(
      "id, org_id, label, member_name, member_email, stripe_customer_id, orgs(name, stripe_account_id, charges_enabled)",
    )
    .eq("portal_token", token)
    .maybeSingle<{
      id: string;
      org_id: string;
      label: string;
      member_name: string;
      member_email: string;
      stripe_customer_id: string | null;
      orgs: { name: string; stripe_account_id: string | null; charges_enabled: boolean } | null;
    }>();
  if (!unit || !unit.orgs) return new NextResponse("Not found", { status: 404 });

  if (action === "stop") {
    await admin
      .from("units")
      .update({
        autopay_enabled: false,
        stripe_payment_method_id: null,
        autopay_label: null,
      })
      .eq("id", unit.id);
    return back("autopay-off");
  }

  if (!unit.orgs.stripe_account_id || !unit.orgs.charges_enabled) {
    return back("error");
  }

  try {
    const stripe = getStripe();
    const stripeAccount = unit.orgs.stripe_account_id;

    let customerId = unit.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: unit.member_email,
          name: unit.member_name,
          metadata: { unit_id: unit.id, org_id: unit.org_id },
        },
        { stripeAccount },
      );
      customerId = customer.id;
      await admin
        .from("units")
        .update({ stripe_customer_id: customerId })
        .eq("id", unit.id);
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "setup",
        customer: customerId,
        payment_method_types: ["card"],
        metadata: { unit_id: unit.id, org_id: unit.org_id },
        success_url: `${appUrl()}/pay/${token}?status=autopay-on`,
        cancel_url: `${appUrl()}/pay/${token}`,
      },
      { stripeAccount },
    );

    return NextResponse.redirect(session.url!, 303);
  } catch {
    return back("error");
  }
}

import type { Metadata } from "next";
import { requireOrg } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import type { Org } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { SettingsClient, type StripeStatus } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, orgId } = await requireOrg();
  const { data } = await supabase
    .from("orgs")
    .select("*")
    .eq("id", orgId)
    .single<Org>();
  const org = data!;

  // If onboarding was started, ask Stripe for the live status so returning
  // from onboarding flips the banner without waiting for a webhook.
  let status: StripeStatus = org.stripe_account_id ? "incomplete" : "none";
  if (org.stripe_account_id) {
    try {
      const account = await getStripe().accounts.retrieve(org.stripe_account_id);
      const enabled = !!account.charges_enabled;
      if (enabled !== org.charges_enabled) {
        await supabase
          .from("orgs")
          .update({ charges_enabled: enabled })
          .eq("id", orgId);
      }
      status = enabled ? "connected" : "incomplete";
    } catch {
      status = org.charges_enabled ? "connected" : "incomplete";
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Your organization and how you get paid."
      />
      <SettingsClient orgName={org.name} stripeStatus={status} />
    </div>
  );
}

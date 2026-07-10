import type { Metadata } from "next";
import { requireOrg, appUrl } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import type { Org } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import {
  SettingsClient,
  type StripeStatus,
  type TeamMember,
  type PendingInvite,
} from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, user, orgId } = await requireOrg();

  const [orgRes, membersRes, invitesRes] = await Promise.all([
    supabase.from("orgs").select("*").eq("id", orgId).single<Org>(),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .order("created_at"),
    supabase
      .from("invites")
      .select("id, name, email, token, created_at, expires_at")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const org = orgRes.data!;
  const members = (membersRes.data ?? []) as TeamMember[];
  const invites = ((invitesRes.data ?? []) as PendingInvite[]).filter(
    (i) => i.expires_at > new Date().toISOString(),
  );

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
      <SettingsClient
        orgName={org.name}
        stripeStatus={status}
        members={members}
        invites={invites}
        currentUserId={user.id}
        baseUrl={appUrl()}
      />
    </div>
  );
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg, appUrl } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import { sendTeamInviteEmail } from "@/lib/emails";
import {
  fieldErrorsOf,
  orgNameSchema,
  type ActionState,
} from "@/lib/validation";
import type { Org } from "@/lib/types";

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Who are you inviting?").max(120, "Keep the name under 120 characters"),
  email: z.string().trim().toLowerCase().email("That doesn't look like an email address"),
});

export async function updateOrgName(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = orgNameSchema.safeParse({
    orgName: formData.get("orgName") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { supabase, orgId } = await requireOrg();
  const { error } = await supabase
    .from("orgs")
    .update({ name: parsed.data.orgName })
    .eq("id", orgId);

  if (error) return { formError: "The name couldn't be saved. Give it another try." };

  revalidatePath("/", "layout");
  return { success: "Organization name saved" };
}

/**
 * Starts (or resumes) Stripe Connect onboarding. Creates the org's own
 * Standard account on first click, then hands the user to Stripe's hosted
 * onboarding. Dues settle directly to the org's bank — never ours.
 */
export async function connectStripe(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { supabase, orgId } = await requireOrg();
  const { data: org } = await supabase
    .from("orgs")
    .select("*")
    .eq("id", orgId)
    .single<Org>();
  if (!org) return { formError: "Something went wrong. Give it another try." };

  let onboardingUrl: string;
  try {
    const stripe = getStripe();
    let accountId = org.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({ type: "standard" });
      accountId = account.id;
      const { error } = await supabase
        .from("orgs")
        .update({ stripe_account_id: accountId })
        .eq("id", orgId);
      if (error) {
        return { formError: "Stripe setup couldn't be saved. Give it another try." };
      }
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl()}/settings`,
      return_url: `${appUrl()}/settings`,
      type: "account_onboarding",
    });
    onboardingUrl = link.url;
  } catch {
    return {
      formError:
        "Stripe couldn't be reached. Check that STRIPE_SECRET_KEY is set, then try again.",
    };
  }

  redirect(onboardingUrl);
}

export async function inviteTeamMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { supabase, user, orgId } = await requireOrg();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (existing) {
    return { fieldErrors: { email: "They're already on your team." } };
  }

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      org_id: orgId,
      email: parsed.data.email,
      name: parsed.data.name,
      invited_by: user.id,
    })
    .select("token")
    .single<{ token: string }>();

  if (error || !invite) {
    if (error?.code === "23505") {
      return {
        fieldErrors: {
          email: "There's already a pending invite for this email — revoke it below to resend.",
        },
      };
    }
    return { formError: "The invite couldn't be created. Give it another try." };
  }

  revalidatePath("/settings");

  const { data: org } = await supabase
    .from("orgs")
    .select("name")
    .eq("id", orgId)
    .single<{ name: string }>();

  try {
    await sendTeamInviteEmail({
      to: parsed.data.email,
      inviteeName: parsed.data.name,
      orgName: org?.name ?? "your organization",
      inviteUrl: `${appUrl()}/invite/${invite.token}`,
    });
  } catch {
    return {
      success:
        "Invite created, but the email couldn't be sent — copy the invite link below and share it yourself.",
    };
  }

  return { success: `Invite sent to ${parsed.data.email}` };
}

export async function updateLateFee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = String(formData.get("amount") ?? "").trim();
  const daysRaw = Number(formData.get("graceDays") ?? 5);

  let cents = 0;
  if (raw !== "" && raw !== "0") {
    const { parseMoneyInput } = await import("@/lib/money");
    const parsed = parseMoneyInput(raw);
    if (parsed === null) {
      return { fieldErrors: { amount: "Enter an amount like 25, or leave empty to turn late fees off" } };
    }
    cents = parsed;
  }
  if (!Number.isInteger(daysRaw) || daysRaw < 0 || daysRaw > 90) {
    return { fieldErrors: { graceDays: "Grace period must be 0–90 days" } };
  }

  const { supabase, orgId } = await requireOrg();
  const { error } = await supabase
    .from("orgs")
    .update({ late_fee_cents: cents, late_fee_grace_days: daysRaw })
    .eq("id", orgId);
  if (error) return { formError: "The late fee couldn't be saved. Give it another try." };

  revalidatePath("/settings");
  return {
    success: cents === 0 ? "Late fees turned off" : "Late fee saved",
  };
}

export async function revokeInvite(inviteId: string): Promise<ActionState> {
  const { supabase } = await requireOrg();
  const { error } = await supabase.from("invites").delete().eq("id", inviteId);
  if (error) return { formError: "The invite couldn't be revoked. Give it another try." };
  revalidatePath("/settings");
  return { success: "Invite revoked — its link no longer works" };
}

export async function removeTeamMember(profileId: string): Promise<ActionState> {
  const { supabase, user } = await requireOrg();
  if (profileId === user.id) {
    return { formError: "You can't remove yourself." };
  }
  const { error } = await supabase.from("profiles").delete().eq("id", profileId);
  if (error) return { formError: "They couldn't be removed. Give it another try." };
  revalidatePath("/settings");
  return { success: "Team member removed — they no longer have access" };
}

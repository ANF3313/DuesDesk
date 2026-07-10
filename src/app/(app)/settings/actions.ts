"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrg, appUrl } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import {
  fieldErrorsOf,
  orgNameSchema,
  type ActionState,
} from "@/lib/validation";
import type { Org } from "@/lib/types";

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

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/org";
import type { ActionState } from "@/lib/validation";

/** Signed-in user (no org yet) accepts an invite. */
export async function acceptInvite(token: string): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/invite/${token}`);

  const { error } = await supabase.rpc("accept_invite", {
    invite_token: token,
  });
  if (error) return { formError: error.message };

  redirect("/dashboard");
}

/** Invited person creates their account. Email comes from the invite itself. */
export async function inviteSignUp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { fieldErrors: { password: "Use at least 8 characters" } };
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("email, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle<{ email: string; expires_at: string; accepted_at: string | null }>();

  if (!invite || invite.accepted_at || invite.expires_at <= new Date().toISOString()) {
    return { formError: "This invite is no longer valid — ask your organization for a new one." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: { emailRedirectTo: `${appUrl()}/invite/${token}` },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return {
        formError: "An account with this email already exists — use “Sign in instead” below.",
      };
    }
    return { formError: "We couldn't create your account. Give it another try in a moment." };
  }

  // Email confirmation on: no session yet — they confirm, land back here,
  // sign in, and accept.
  if (!data.session) {
    return {
      success:
        "Check your inbox and confirm your email — then reopen this invite link and sign in to join.",
    };
  }

  const { error: rpcError } = await supabase.rpc("accept_invite", {
    invite_token: token,
  });
  if (rpcError) return { formError: rpcError.message };

  redirect("/dashboard");
}

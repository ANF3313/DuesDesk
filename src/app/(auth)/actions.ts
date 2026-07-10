"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/org";
import {
  fieldErrorsOf,
  orgNameSchema,
  signInSchema,
  signUpSchema,
  type ActionState,
} from "@/lib/validation";

function safeNext(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  // Only same-site paths — never an open redirect.
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export async function signUp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    orgName: formData.get("orgName") ?? "",
    fullName: formData.get("fullName") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // If email confirmation is on, the confirm link lands on sign-in with a
    // "you're confirmed" banner instead of a dead end.
    options: { emailRedirectTo: `${appUrl()}/sign-in?confirmed=1` },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return {
        fieldErrors: {
          email: "An account with this email already exists — try signing in instead.",
        },
      };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: "That password is too easy to guess — try a longer one." } };
    }
    return { formError: "We couldn't create your account. Give it another try in a moment." };
  }

  // If email confirmation is ON in Supabase, there's no session yet — the org
  // gets created on first sign-in via /onboarding instead.
  if (!data.session) {
    return {
      success:
        "Almost there — check your inbox and confirm your email, then sign in.",
    };
  }

  const { error: rpcError } = await supabase.rpc("create_org_and_profile", {
    org_name: parsed.data.orgName,
    owner_name: parsed.data.fullName || null,
  });
  if (rpcError) {
    return { formError: rpcError.message };
  }

  redirect("/dashboard");
}

export async function signIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return { formError: "That email and password don't match our records." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  const next = safeNext(formData.get("next"));

  // Signed in but no org yet: honor a pending invite link, otherwise let
  // them create their own org.
  if (!profile) redirect(next.startsWith("/invite/") ? next : "/onboarding");

  redirect(next);
}

export async function sendPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { fieldErrors: { email: "That doesn't look like an email address" } };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl()}/reset-password`,
  });

  // Same reply whether or not the account exists — never leak which
  // emails have accounts.
  return {
    success: "If an account exists for that email, a reset link is on its way. Check your inbox.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function createOrg(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = orgNameSchema.safeParse({
    orgName: formData.get("orgName") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.rpc("create_org_and_profile", {
    org_name: parsed.data.orgName,
    owner_name: null,
  });
  if (error) return { formError: error.message };

  redirect("/dashboard");
}

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  // Signed in but no org yet (e.g. email confirmation was on at signup).
  if (!profile) redirect("/onboarding");

  redirect(safeNext(formData.get("next")));
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

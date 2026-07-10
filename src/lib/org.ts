import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

/**
 * Every server action and app page starts here: confirms the caller is
 * signed in and belongs to an org. Queries through the returned client are
 * additionally filtered by RLS — this is belt, RLS is braces.
 */
export async function requireOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  return { supabase, user, orgId: profile.org_id as string };
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

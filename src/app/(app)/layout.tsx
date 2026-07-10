import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import type { Org } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.profile) redirect("/onboarding");

  const { data: org } = await ctx.supabase
    .from("orgs")
    .select("*")
    .eq("id", ctx.profile.org_id)
    .single<Org>();
  if (!org) redirect("/onboarding");

  return (
    <AppShell
      orgName={org.name}
      email={ctx.user.email ?? ""}
      chargesEnabled={org.charges_enabled}
    >
      {children}
    </AppShell>
  );
}

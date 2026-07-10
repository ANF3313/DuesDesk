import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your organization" };

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/sign-in");
  if (ctx.profile) redirect("/dashboard");

  return <OnboardingForm />;
}

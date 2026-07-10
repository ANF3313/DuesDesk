import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { AcceptInvitePanel, InviteSignUpForm } from "./invite-client";

export const metadata: Metadata = {
  title: "Join your organization",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <Logo className="mb-8" />
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-7 shadow-card">
        {children}
      </div>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invalid = (
    <Shell>
      <h1 className="text-lg font-semibold text-neutral-950">
        This invite is no longer valid
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
        It may have expired (invites last 7 days), been revoked, or already
        been used. Ask your organization to send a fresh one.
      </p>
    </Shell>
  );

  if (!/^[a-f0-9]{32,128}$/i.test(token)) return invalid;

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("email, name, expires_at, accepted_at, orgs(name)")
    .eq("token", token)
    .maybeSingle<{
      email: string;
      name: string;
      expires_at: string;
      accepted_at: string | null;
      orgs: { name: string } | null;
    }>();

  if (
    !invite ||
    !invite.orgs ||
    invite.accepted_at ||
    invite.expires_at <= new Date().toISOString()
  ) {
    return invalid;
  }

  const ctx = await getSessionContext();

  // Already in an org — this account can't join another.
  if (ctx?.profile) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-neutral-950">
          You already belong to an organization
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
          This invite to {invite.orgs.name} was meant for {invite.email}. Sign
          out first if that&apos;s a different account, or ask for the invite
          to be re-sent to another email.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block text-[13px] font-medium text-pine-600 hover:text-pine-700"
        >
          Back to your dashboard
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-[13px] font-semibold uppercase tracking-wider text-pine-600">
        {invite.orgs.name}
      </p>
      <h1 className="mt-1 text-lg font-semibold text-neutral-950">
        You&apos;re invited, {invite.name}
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">
        Join {invite.orgs.name} on DuesDesk to help manage units, dues, and
        announcements.
      </p>
      <div className="mt-6">
        {ctx ? (
          <AcceptInvitePanel token={token} orgName={invite.orgs.name} />
        ) : (
          <InviteSignUpForm token={token} email={invite.email} />
        )}
      </div>
    </Shell>
  );
}

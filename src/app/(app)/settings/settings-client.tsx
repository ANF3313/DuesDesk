"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { OK, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { IconLink, IconShield, IconTrash } from "@/components/ui/icons";
import {
  connectStripe,
  inviteTeamMember,
  removeTeamMember,
  revokeInvite,
  updateOrgName,
} from "./actions";

export type StripeStatus = "none" | "incomplete" | "connected";

export type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "owner" | "admin";
};

export type PendingInvite = {
  id: string;
  name: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
};

function OrgNameCard({ orgName }: { orgName: string }) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(updateOrgName, OK);

  useEffect(() => {
    if (state.success) toast({ title: state.success });
  }, [state, toast]);

  return (
    <Card>
      <CardHeader
        title="Organization"
        description="Shown on member emails and pay pages."
      />
      <CardBody>
        <form action={formAction} noValidate className="flex max-w-md items-end gap-3">
          <div className="flex-1">
            <Input
              label="Organization name"
              name="orgName"
              defaultValue={orgName}
              error={state.fieldErrors?.orgName}
              required
            />
          </div>
          <Button type="submit" variant="secondary" loading={pending}>
            Save
          </Button>
        </form>
        {state.formError && (
          <p role="alert" className="mt-3 rounded-md bg-overdue-bg px-3 py-2 text-[13px] text-overdue-fg">
            {state.formError}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

const STRIPE_COPY: Record<
  StripeStatus,
  { pill: React.ReactNode; body: string; cta: string | null }
> = {
  none: {
    pill: <StatusPill kind="void" label="Not connected" />,
    body: "Connect your organization's own Stripe account and dues go straight to your bank. DuesDesk never touches or holds the money.",
    cta: "Connect Stripe",
  },
  incomplete: {
    pill: <StatusPill kind="due" label="Onboarding incomplete" />,
    body: "Stripe still needs a few details before payments can go live. Pick up where you left off — it usually takes a few minutes.",
    cta: "Resume onboarding",
  },
  connected: {
    pill: <StatusPill kind="paid" label="Connected" />,
    body: "Payments are live. Members can pay by card or bank transfer, and invoices mark themselves paid automatically.",
    cta: null,
  },
};

function StripeCard({ status }: { status: StripeStatus }) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(connectStripe, OK);

  useEffect(() => {
    if (state.formError) toast({ title: state.formError, kind: "error" });
  }, [state, toast]);

  const copy = STRIPE_COPY[status];

  return (
    <Card>
      <CardHeader title="Payments" action={copy.pill} />
      <CardBody>
        <p className="max-w-lg text-sm leading-relaxed text-neutral-600">{copy.body}</p>
        <div className="mt-4 flex items-center gap-4">
          {copy.cta && (
            <form action={formAction}>
              <Button type="submit" loading={pending}>
                {copy.cta}
              </Button>
            </form>
          )}
          {status === "connected" && (
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-medium text-pine-600 hover:text-pine-700"
            >
              Open your Stripe dashboard
            </a>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function TeamCard({
  members,
  invites,
  currentUserId,
  baseUrl,
}: {
  members: TeamMember[];
  invites: PendingInvite[];
  currentUserId: string;
  baseUrl: string;
}) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(inviteTeamMember, OK);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.success) {
      toast({ title: state.success });
      formRef.current?.reset();
    }
  }, [state, toast]);

  function run(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      const res = await fn();
      toast({
        title: res.success ?? res.formError ?? "Something went wrong",
        kind: res.success ? "success" : "error",
      });
    });
  }

  const iconButton =
    "rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600";

  return (
    <Card>
      <CardHeader
        title="Team"
        description="Board members and co-managers share the same view of units, dues, and payments."
      />
      <CardBody className="p-0">
        <ul className="divide-y divide-neutral-100">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-950">
                  {m.full_name || m.email || "Team member"}
                  {m.id === currentUserId && (
                    <span className="ml-2 font-normal text-neutral-400">you</span>
                  )}
                </p>
                <p className="truncate text-[13px] text-neutral-500">{m.email}</p>
              </div>
              <span className="flex items-center gap-2">
                <StatusPill
                  kind={m.role === "owner" ? "paid" : "void"}
                  label={m.role === "owner" ? "Owner" : "Admin"}
                />
                {m.id !== currentUserId && (
                  <button
                    type="button"
                    title="Remove from team"
                    aria-label={`Remove ${m.full_name ?? m.email ?? "member"} from the team`}
                    className={`${iconButton} hover:text-danger-600`}
                    onClick={() => run(() => removeTeamMember(m.id))}
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                )}
              </span>
            </li>
          ))}
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-950">{inv.name}</p>
                <p className="truncate text-[13px] text-neutral-500">{inv.email}</p>
              </div>
              <span className="flex items-center gap-2">
                <StatusPill kind="due" label="Invited" />
                <button
                  type="button"
                  title="Copy invite link"
                  aria-label={`Copy invite link for ${inv.email}`}
                  className={iconButton}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`${baseUrl}/invite/${inv.token}`);
                      toast({ title: "Invite link copied" });
                    } catch {
                      toast({ title: "Couldn't copy the link", kind: "error" });
                    }
                  }}
                >
                  <IconLink width={16} height={16} />
                </button>
                <button
                  type="button"
                  title="Revoke invite"
                  aria-label={`Revoke invite for ${inv.email}`}
                  className={`${iconButton} hover:text-danger-600`}
                  onClick={() => run(() => revokeInvite(inv.id))}
                >
                  <IconTrash width={16} height={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>

        <form
          ref={formRef}
          action={formAction}
          noValidate
          className="border-t border-neutral-100 px-5 py-4"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
            <Input
              label="Name"
              name="name"
              placeholder="Sam Alvarez"
              error={state.fieldErrors?.name}
              required
            />
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="sam@example.com"
              error={state.fieldErrors?.email}
              required
            />
            <Button type="submit" variant="secondary" loading={pending}>
              Send invite
            </Button>
          </div>
          {state.formError && (
            <p role="alert" className="mt-3 rounded-md bg-overdue-bg px-3 py-2 text-[13px] text-overdue-fg">
              {state.formError}
            </p>
          )}
          <p className="mt-3 text-[13px] text-neutral-500">
            They&apos;ll get an email with a private link — it expires in 7 days.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}

export function SettingsClient({
  orgName,
  stripeStatus,
  members,
  invites,
  currentUserId,
  baseUrl,
}: {
  orgName: string;
  stripeStatus: StripeStatus;
  members: TeamMember[];
  invites: PendingInvite[];
  currentUserId: string;
  baseUrl: string;
}) {
  return (
    <div className="space-y-5">
      <StripeCard status={stripeStatus} />
      <TeamCard
        members={members}
        invites={invites}
        currentUserId={currentUserId}
        baseUrl={baseUrl}
      />
      <OrgNameCard orgName={orgName} />
      <Card>
        <CardBody className="flex items-start gap-3">
          <span className="mt-0.5 text-pine-600">
            <IconShield width={18} height={18} />
          </span>
          <p className="text-[13px] leading-relaxed text-neutral-500">
            Each unit has a private pay link (find it on the Units page). Members
            see only their own balance and pay without creating an account. If a
            link ends up in the wrong hands, reset it from the unit&apos;s edit
            screen.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

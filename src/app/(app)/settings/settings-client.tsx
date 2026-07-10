"use client";

import { useActionState, useEffect } from "react";
import { OK } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { IconShield } from "@/components/ui/icons";
import { connectStripe, updateOrgName } from "./actions";

export type StripeStatus = "none" | "incomplete" | "connected";

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

export function SettingsClient({
  orgName,
  stripeStatus,
}: {
  orgName: string;
  stripeStatus: StripeStatus;
}) {
  return (
    <div className="space-y-5">
      <StripeCard status={stripeStatus} />
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

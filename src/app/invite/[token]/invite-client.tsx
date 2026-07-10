"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { OK } from "@/lib/validation";
import { acceptInvite, inviteSignUp } from "../actions";

export function AcceptInvitePanel({
  token,
  orgName,
}: {
  token: string;
  orgName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        className="w-full"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await acceptInvite(token);
            if (res?.formError) setError(res.formError);
          })
        }
      >
        Join {orgName}
      </Button>
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-overdue-bg px-3 py-2 text-[13px] text-overdue-fg">
          {error}
        </p>
      )}
    </div>
  );
}

export function InviteSignUpForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(inviteSignUp, OK);

  if (state.success) {
    return (
      <p className="rounded-md border border-paid-border bg-paid-bg px-3 py-2.5 text-[13px] leading-relaxed text-paid-fg">
        {state.success}
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <span className="block text-[13px] font-medium text-neutral-700">Email</span>
        <p className="flex h-9.5 items-center rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-600">
          {email}
        </p>
      </div>
      <Input
        label="Choose a password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={state.fieldErrors?.password}
        required
      />
      {state.formError && (
        <p role="alert" className="rounded-md bg-overdue-bg px-3 py-2 text-[13px] text-overdue-fg">
          {state.formError}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full">
        Create account and join
      </Button>
      <p className="text-center text-[13px] text-neutral-500">
        Already have an account?{" "}
        <Link
          href={`/sign-in?next=/invite/${token}`}
          className="font-medium text-pine-600 hover:text-pine-700"
        >
          Sign in instead
        </Link>
      </p>
    </form>
  );
}

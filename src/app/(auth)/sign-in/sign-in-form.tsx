"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { OK } from "@/lib/validation";

export function SignInForm({
  next,
  confirmed,
}: {
  next?: string;
  confirmed?: boolean;
}) {
  const [state, formAction, pending] = useActionState(signIn, OK);

  return (
    <div>
      {confirmed && (
        <p
          role="status"
          className="mb-5 rounded-md border border-paid-border bg-paid-bg px-3 py-2.5 text-[13px] text-paid-fg"
        >
          <strong className="font-semibold">Email confirmed.</strong> Sign in
          below to get started.
        </p>
      )}
      <h1 className="text-lg font-semibold text-neutral-950">Welcome back</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Sign in to your DuesDesk workspace.
      </p>

      <form action={formAction} className="mt-6 space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={state.fieldErrors?.email}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
          required
        />
        {state.formError && (
          <p role="alert" className="rounded-md bg-overdue-bg px-3 py-2 text-[13px] text-overdue-fg">
            {state.formError}
          </p>
        )}
        <Button type="submit" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-neutral-500">
        New here?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-pine-600 hover:text-pine-700"
        >
          Create your workspace
        </Link>
      </p>
    </div>
  );
}

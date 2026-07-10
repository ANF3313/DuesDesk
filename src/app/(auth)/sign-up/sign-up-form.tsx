"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { OK } from "@/lib/validation";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, OK);

  if (state.success) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold text-neutral-950">Check your inbox</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{state.success}</p>
        <Link
          href="/sign-in"
          className="mt-5 inline-block text-[13px] font-medium text-pine-600 hover:text-pine-700"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-neutral-950">
        Create your workspace
      </h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        For your HOA, condo board, or rental portfolio.
      </p>

      <form action={formAction} className="mt-6 space-y-4" noValidate>
        <Input
          label="Organization name"
          name="orgName"
          placeholder="Maple Court HOA"
          hint="What your members know you as — it appears on their invoices."
          error={state.fieldErrors?.orgName}
          required
        />
        <Input
          label="Your name"
          name="fullName"
          autoComplete="name"
          placeholder="Jordan Lee"
          error={state.fieldErrors?.fullName}
        />
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
          Create workspace
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-neutral-500">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-pine-600 hover:text-pine-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

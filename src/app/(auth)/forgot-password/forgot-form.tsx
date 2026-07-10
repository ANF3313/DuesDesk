"use client";

import Link from "next/link";
import { useActionState } from "react";
import { sendPasswordReset } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { OK } from "@/lib/validation";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(sendPasswordReset, OK);

  if (state.success) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold text-neutral-950">Check your inbox</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{state.success}</p>
        <Link
          href="/sign-in"
          className="mt-5 inline-block text-[13px] font-medium text-pine-600 hover:text-pine-700"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-neutral-950">Reset your password</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Enter your email and we&apos;ll send you a link to set a new one.
      </p>
      <form action={formAction} noValidate className="mt-6 space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={state.fieldErrors?.email}
          required
        />
        <Button type="submit" loading={pending} className="w-full">
          Send reset link
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-neutral-500">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-pine-600 hover:text-pine-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}

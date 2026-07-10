"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export default function ResetPasswordPage() {
  const supabase = useMemo(createClient, []);
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // The recovery link signs the user in as it lands here; listen for it in
    // case the exchange finishes after first render.
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters");
      return;
    }
    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("The password couldn't be saved — request a fresh reset link and try again.");
      setPending(false);
      return;
    }
    router.replace("/dashboard");
  }

  if (hasSession === false) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold text-neutral-950">
          This reset link didn&apos;t work
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
          It may have expired or already been used. Request a fresh one and
          open it on this device.
        </p>
        <Link
          href="/forgot-password"
          className="mt-5 inline-block text-[13px] font-medium text-pine-600 hover:text-pine-700"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-neutral-950">Set a new password</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        You&apos;ll be signed in right after.
      </p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Input
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
          required
        />
        <Button type="submit" loading={pending || hasSession === null} className="w-full">
          Save new password
        </Button>
      </form>
    </div>
  );
}

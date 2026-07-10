"use client";

import { useActionState } from "react";
import { createOrg } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { OK } from "@/lib/validation";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createOrg, OK);

  return (
    <div>
      <h1 className="text-lg font-semibold text-neutral-950">
        One last step
      </h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Name your organization to finish setting up your workspace.
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
        {state.formError && (
          <p role="alert" className="rounded-md bg-overdue-bg px-3 py-2 text-[13px] text-overdue-fg">
            {state.formError}
          </p>
        )}
        <Button type="submit" loading={pending} className="w-full">
          Continue to dashboard
        </Button>
      </form>
    </div>
  );
}

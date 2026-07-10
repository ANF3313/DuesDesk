"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Announcement } from "@/lib/types";
import { OK } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { IconAnnounce, IconChevronRight, IconSend } from "@/components/ui/icons";
import { sendAnnouncement } from "./actions";

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AnnouncementsClient({
  announcements,
  memberCount,
}: {
  announcements: Announcement[];
  memberCount: number;
}) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(sendAnnouncement, OK);

  useEffect(() => {
    if (state.success) {
      toast({ title: state.success });
      formRef.current?.reset();
    }
  }, [state, toast]);

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Email everyone at once — meeting notices, pool schedules, assessments."
      />

      <Card>
        <CardHeader
          title="New announcement"
          description={
            memberCount === 0
              ? "Add units with member emails first — then you can reach everyone here."
              : `Goes to all ${memberCount} ${memberCount === 1 ? "member" : "members"}, each addressed individually.`
          }
        />
        <CardBody>
          <form ref={formRef} action={formAction} noValidate className="space-y-4">
            <Input
              label="Subject"
              name="subject"
              placeholder="Annual meeting — Thursday, June 12"
              error={state.fieldErrors?.subject}
              required
            />
            <TextArea
              label="Message"
              name="body"
              rows={6}
              placeholder="Write it like a note to neighbors — plain and friendly."
              error={state.fieldErrors?.body}
              required
            />
            {state.formError && (
              <p role="alert" className="rounded-md bg-overdue-bg px-3 py-2 text-[13px] text-overdue-fg">
                {state.formError}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" loading={pending} disabled={memberCount === 0}>
                <IconSend width={15} height={15} />
                Send to {memberCount === 1 ? "1 member" : `${memberCount} members`}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-950">Sent</h2>
        {announcements.length === 0 ? (
          <Card className="p-8 text-center">
            <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-pine-50 text-pine-600">
              <IconAnnounce width={18} height={18} />
            </span>
            <p className="text-sm text-neutral-500">
              Announcements you send will be archived here.
            </p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-neutral-100">
              {announcements.map((a) => (
                <li key={a.id}>
                  <details className="group px-5 py-3.5">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 [&::-webkit-details-marker]:hidden">
                      <IconChevronRight
                        width={14}
                        height={14}
                        className="shrink-0 text-neutral-400 transition-transform duration-150 group-open:rotate-90"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-950">
                          {a.subject}
                        </span>
                        <span className="block text-[13px] text-neutral-500">
                          {formatSentAt(a.created_at)} · {a.recipient_count}{" "}
                          {a.recipient_count === 1 ? "recipient" : "recipients"}
                        </span>
                      </span>
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap pl-6 text-sm leading-relaxed text-neutral-700">
                      {a.body}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

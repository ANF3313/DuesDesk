"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/org";
import { sendAnnouncementEmails } from "@/lib/emails";
import {
  announcementSchema,
  fieldErrorsOf,
  type ActionState,
} from "@/lib/validation";

export async function sendAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = announcementSchema.safeParse({
    subject: formData.get("subject") ?? "",
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { supabase, user, orgId } = await requireOrg();

  const [{ data: units }, { data: org }] = await Promise.all([
    supabase.from("units").select("member_email"),
    supabase.from("orgs").select("name").eq("id", orgId).single<{ name: string }>(),
  ]);

  const recipients = (units ?? []).map((u) => u.member_email as string);
  if (recipients.length === 0) {
    return {
      formError: "There's no one to send to yet — add a unit with a member email first.",
    };
  }
  if (!org) return { formError: "Something went wrong. Give it another try." };

  let sent: number;
  try {
    sent = await sendAnnouncementEmails({
      recipients,
      subject: parsed.data.subject,
      body: parsed.data.body,
      orgName: org.name,
    });
  } catch {
    return {
      formError:
        "The emails couldn't be sent — nothing went out. Check your Resend key and sender address, then try again.",
    };
  }

  // Record it in history. The send already happened, so a failure here only
  // affects the log — don't scare the user with an error.
  await supabase.from("announcements").insert({
    org_id: orgId,
    subject: parsed.data.subject,
    body: parsed.data.body,
    recipient_count: sent,
    created_by: user.id,
  });

  revalidatePath("/announcements");
  return {
    success: `Sent to ${sent} ${sent === 1 ? "member" : "members"}`,
  };
}

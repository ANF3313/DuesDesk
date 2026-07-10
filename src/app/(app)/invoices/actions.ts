"use server";

import { revalidatePath } from "next/cache";
import { requireOrg, appUrl } from "@/lib/org";
import { parseMoneyInput } from "@/lib/money";
import { todayISO, formatDate } from "@/lib/dates";
import { sendInvoiceEmail } from "@/lib/emails";
import {
  fieldErrorsOf,
  oneOffInvoiceSchema,
  scheduleSchema,
  type ActionState,
} from "@/lib/validation";

function refresh() {
  revalidatePath("/invoices");
  revalidatePath("/units");
  revalidatePath("/dashboard");
}

type MemberInfo = {
  label: string;
  member_name: string;
  member_email: string;
  portal_token: string;
};

async function emailPayLink(
  supabase: Awaited<ReturnType<typeof requireOrg>>["supabase"],
  orgId: string,
  unitId: string,
  memo: string,
  amountCents: number,
  dueDate: string,
): Promise<boolean> {
  try {
    const [{ data: unit }, { data: org }] = await Promise.all([
      supabase
        .from("units")
        .select("label, member_name, member_email, portal_token")
        .eq("id", unitId)
        .single<MemberInfo>(),
      supabase.from("orgs").select("name").eq("id", orgId).single<{ name: string }>(),
    ]);
    if (!unit || !org) return false;

    await sendInvoiceEmail({
      to: unit.member_email,
      memberName: unit.member_name,
      orgName: org.name,
      memo,
      amountCents,
      dueDate,
      payUrl: `${appUrl()}/pay/${unit.portal_token}`,
    });
    return true;
  } catch {
    return false;
  }
}

/** Handles both modes of the "New invoice" modal: one-time and recurring. */
export async function createDues(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const mode = formData.get("mode") === "recurring" ? "recurring" : "one-time";
  const amountCents = parseMoneyInput(String(formData.get("amount") ?? ""));
  const { supabase, orgId } = await requireOrg();

  if (mode === "one-time") {
    const parsed = oneOffInvoiceSchema.safeParse({
      unitId: formData.get("unitId") ?? "",
      amountCents,
      memo: formData.get("memo") ?? "",
      dueDate: formData.get("dueDate") ?? "",
    });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

    const { error } = await supabase.from("invoices").insert({
      org_id: orgId,
      unit_id: parsed.data.unitId,
      amount_cents: parsed.data.amountCents,
      memo: parsed.data.memo,
      due_date: parsed.data.dueDate,
    });
    if (error) {
      return { formError: "The invoice couldn't be created. Give it another try." };
    }

    refresh();

    if (formData.get("emailNow") === "on") {
      const sent = await emailPayLink(
        supabase,
        orgId,
        parsed.data.unitId,
        parsed.data.memo,
        parsed.data.amountCents,
        parsed.data.dueDate,
      );
      return {
        success: sent
          ? "Invoice created — the member got their pay link by email"
          : "Invoice created, but the email couldn't be sent. You can copy their pay link from Units.",
      };
    }
    return { success: "Invoice created" };
  }

  const parsed = scheduleSchema.safeParse({
    unitId: formData.get("unitId") ?? "",
    amountCents,
    memo: formData.get("memo") ?? "",
    cadence: formData.get("cadence") ?? "",
    firstInvoiceDate: formData.get("firstInvoiceDate") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  if (parsed.data.firstInvoiceDate < todayISO()) {
    return {
      fieldErrors: { firstInvoiceDate: "Pick today or a future date" },
    };
  }

  const { error } = await supabase.from("dues_schedules").insert({
    org_id: orgId,
    unit_id: parsed.data.unitId,
    amount_cents: parsed.data.amountCents,
    memo: parsed.data.memo,
    cadence: parsed.data.cadence,
    next_invoice_date: parsed.data.firstInvoiceDate,
  });
  if (error) {
    return { formError: "The recurring dues couldn't be saved. Give it another try." };
  }

  refresh();
  return {
    success: `Recurring dues scheduled — the first invoice goes out ${formatDate(parsed.data.firstInvoiceDate)}`,
  };
}

export async function voidInvoice(invoiceId: string): Promise<ActionState> {
  const { supabase } = await requireOrg();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "void" })
    .eq("id", invoiceId)
    .in("status", ["open", "processing"])
    .select("id");

  if (error) return { formError: "The invoice couldn't be voided. Give it another try." };
  if (!data || data.length === 0) {
    return { formError: "Only unpaid invoices can be voided." };
  }
  refresh();
  return { success: "Invoice voided" };
}

export async function deleteInvoice(invoiceId: string): Promise<ActionState> {
  const { supabase } = await requireOrg();
  const { data, error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .neq("status", "paid")
    .select("id");

  if (error) return { formError: "The invoice couldn't be deleted. Give it another try." };
  if (!data || data.length === 0) {
    return { formError: "Paid invoices are payment history and can't be deleted." };
  }
  refresh();
  return { success: "Invoice deleted" };
}

export async function sendReminder(invoiceId: string): Promise<ActionState> {
  const { supabase, orgId } = await requireOrg();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("unit_id, memo, amount_cents, due_date, status")
    .eq("id", invoiceId)
    .single<{ unit_id: string; memo: string; amount_cents: number; due_date: string; status: string }>();

  if (!invoice) return { formError: "That invoice no longer exists." };
  if (invoice.status === "paid" || invoice.status === "void") {
    return { formError: "This invoice is settled — no reminder needed." };
  }

  const sent = await emailPayLink(
    supabase,
    orgId,
    invoice.unit_id,
    invoice.memo,
    invoice.amount_cents,
    invoice.due_date,
  );
  return sent
    ? { success: "Reminder sent" }
    : { formError: "The email couldn't be sent — check your Resend key and sender address." };
}

export async function setScheduleActive(
  scheduleId: string,
  active: boolean,
): Promise<ActionState> {
  const { supabase } = await requireOrg();
  const { error } = await supabase
    .from("dues_schedules")
    .update({ active })
    .eq("id", scheduleId);
  if (error) return { formError: "The change couldn't be saved. Give it another try." };
  refresh();
  return { success: active ? "Recurring dues resumed" : "Recurring dues paused" };
}

export async function deleteSchedule(scheduleId: string): Promise<ActionState> {
  const { supabase } = await requireOrg();
  const { error } = await supabase
    .from("dues_schedules")
    .delete()
    .eq("id", scheduleId);
  if (error) return { formError: "The schedule couldn't be deleted. Give it another try." };
  refresh();
  return { success: "Recurring dues deleted — already-created invoices are kept" };
}

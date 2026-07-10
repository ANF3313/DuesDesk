import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addCadence, todayISO } from "@/lib/dates";
import { sendInvoiceEmail } from "@/lib/emails";
import { appUrl } from "@/lib/org";

/**
 * Daily (vercel.json). Two jobs:
 *   1. Turn due recurring schedules into invoices and email each member their
 *      pay link. Safe to run any number of times: the UNIQUE
 *      (schedule_id, period) constraint means a billing cycle can only ever
 *      produce one invoice.
 *   2. Chase overdue invoices automatically — a reminder email when an
 *      invoice goes past due, then every 7 days, capped at 3 total. The org
 *      does nothing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const today = todayISO();

  const { data: schedules, error } = await admin
    .from("dues_schedules")
    .select("*, units(label, member_name, member_email, portal_token), orgs(name)")
    .eq("active", true)
    .lte("next_invoice_date", today);
  if (error) return new NextResponse("Query failed", { status: 500 });

  let created = 0;
  let emailed = 0;

  for (const s of schedules ?? []) {
    let next: string = s.next_invoice_date;
    let guard = 0;

    // Catch up if the cron missed days (deploys, outages) — capped for safety.
    while (next <= today && guard < 24) {
      guard++;

      const { data: inserted } = await admin
        .from("invoices")
        .upsert(
          {
            org_id: s.org_id,
            unit_id: s.unit_id,
            schedule_id: s.id,
            amount_cents: s.amount_cents,
            currency: s.currency,
            memo: s.memo,
            due_date: next,
            period: next,
          },
          { onConflict: "schedule_id,period", ignoreDuplicates: true },
        )
        .select("id");

      if (inserted && inserted.length > 0) {
        created++;
        if (s.units && s.orgs) {
          try {
            await sendInvoiceEmail({
              to: s.units.member_email,
              memberName: s.units.member_name,
              orgName: s.orgs.name,
              memo: s.memo,
              amountCents: s.amount_cents,
              dueDate: next,
              payUrl: `${appUrl()}/pay/${s.units.portal_token}`,
            });
            emailed++;
          } catch {
            // Invoice exists either way; the org can resend from Invoices.
          }
        }
      }

      next = addCadence(next, s.cadence);
    }

    await admin
      .from("dues_schedules")
      .update({ next_invoice_date: next })
      .eq("id", s.id);
  }

  // ── Job 2: automatic overdue reminders ────────────────────────────────────
  let reminded = 0;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  type OverdueRow = {
    id: string;
    memo: string;
    amount_cents: number;
    due_date: string;
    reminder_count: number;
    last_reminded_at: string | null;
    units: { member_name: string; member_email: string; portal_token: string } | null;
    orgs: { name: string } | null;
  };

  const { data: overdue } = await admin
    .from("invoices")
    .select(
      "id, memo, amount_cents, due_date, reminder_count, last_reminded_at, units(member_name, member_email, portal_token), orgs(name)",
    )
    .eq("status", "open")
    .lt("due_date", today)
    .lt("reminder_count", 3);

  for (const inv of (overdue ?? []) as unknown as OverdueRow[]) {
    if (inv.last_reminded_at && inv.last_reminded_at > sevenDaysAgo) continue;
    if (!inv.units || !inv.orgs) continue;
    try {
      await sendInvoiceEmail({
        to: inv.units.member_email,
        memberName: inv.units.member_name,
        orgName: inv.orgs.name,
        memo: inv.memo,
        amountCents: inv.amount_cents,
        dueDate: inv.due_date,
        payUrl: `${appUrl()}/pay/${inv.units.portal_token}`,
      });
      await admin
        .from("invoices")
        .update({
          reminder_count: inv.reminder_count + 1,
          last_reminded_at: new Date().toISOString(),
        })
        .eq("id", inv.id);
      reminded++;
    } catch {
      // Try again on the next run.
    }
  }

  return NextResponse.json({ created, emailed, reminded });
}

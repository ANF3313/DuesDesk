import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addCadence, todayISO } from "@/lib/dates";
import { sendInvoiceEmail } from "@/lib/emails";
import { appUrl } from "@/lib/org";

/**
 * Daily (vercel.json): turns due recurring schedules into invoices and emails
 * each member their pay link.
 *
 * Safe to run any number of times: the UNIQUE (schedule_id, period) constraint
 * means a billing cycle can only ever produce one invoice, no matter how often
 * or how concurrently this runs.
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

  return NextResponse.json({ created, emailed });
}

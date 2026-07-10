import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addCadence, todayISO } from "@/lib/dates";
import { sendBoardDigestEmail, sendInvoiceEmail } from "@/lib/emails";
import { getStripe } from "@/lib/stripe";
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
    .select(
      "*, units(label, member_name, member_email, portal_token, autopay_enabled, stripe_customer_id, stripe_payment_method_id), orgs(name, stripe_account_id, charges_enabled)",
    )
    .eq("active", true)
    .lte("next_invoice_date", today);
  if (error) return new NextResponse("Query failed", { status: 500 });

  let created = 0;
  let emailed = 0;
  let autopaid = 0;

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
        const invoiceId = inserted[0].id as string;

        // Autopay first: charge the saved card off-session. The webhook
        // (payment_intent.succeeded) marks it paid and sends the receipt.
        let charged = false;
        if (
          s.units?.autopay_enabled &&
          s.units.stripe_customer_id &&
          s.units.stripe_payment_method_id &&
          s.orgs?.stripe_account_id &&
          s.orgs.charges_enabled
        ) {
          try {
            await getStripe().paymentIntents.create(
              {
                amount: s.amount_cents,
                currency: String(s.currency).toLowerCase(),
                customer: s.units.stripe_customer_id,
                payment_method: s.units.stripe_payment_method_id,
                off_session: true,
                confirm: true,
                metadata: { invoice_id: invoiceId, org_id: s.org_id, autopay: "1" },
              },
              { stripeAccount: s.orgs.stripe_account_id },
            );
            charged = true;
            autopaid++;
          } catch {
            // Declined or expired card — fall back to the pay-link email;
            // the payment_intent.payment_failed webhook also notifies them.
          }
        }

        if (!charged && s.units && s.orgs) {
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

  // ── Job 3: late fees (orgs that enabled them) ─────────────────────────────
  let lateFees = 0;
  const { data: feeOrgs } = await admin
    .from("orgs")
    .select("id, name, late_fee_cents, late_fee_grace_days, currency")
    .gt("late_fee_cents", 0);

  for (const org of (feeOrgs ?? []) as Array<{
    id: string;
    name: string;
    late_fee_cents: number;
    late_fee_grace_days: number;
    currency: string;
  }>) {
    const cutoff = new Date(
      Date.now() - org.late_fee_grace_days * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    const { data: lateOnes } = await admin
      .from("invoices")
      .select("id, unit_id, memo, units(member_name, member_email, portal_token)")
      .eq("org_id", org.id)
      .eq("status", "open")
      .eq("is_late_fee", false)
      .eq("late_fee_applied", false)
      .lt("due_date", cutoff);

    for (const inv of (lateOnes ?? []) as unknown as Array<{
      id: string;
      unit_id: string;
      memo: string;
      units: { member_name: string; member_email: string; portal_token: string } | null;
    }>) {
      // Claim first so a concurrent run can't double-charge.
      const { data: claimed } = await admin
        .from("invoices")
        .update({ late_fee_applied: true })
        .eq("id", inv.id)
        .eq("late_fee_applied", false)
        .select("id");
      if (!claimed || claimed.length === 0) continue;

      const memo = `Late fee — ${inv.memo}`.slice(0, 140);
      const { error: feeError } = await admin.from("invoices").insert({
        org_id: org.id,
        unit_id: inv.unit_id,
        amount_cents: org.late_fee_cents,
        currency: org.currency,
        memo,
        due_date: today,
        is_late_fee: true,
      });
      if (feeError) continue;
      lateFees++;

      if (inv.units) {
        try {
          await sendInvoiceEmail({
            to: inv.units.member_email,
            memberName: inv.units.member_name,
            orgName: org.name,
            memo,
            amountCents: org.late_fee_cents,
            dueDate: today,
            payUrl: `${appUrl()}/pay/${inv.units.portal_token}`,
          });
        } catch {}
      }
    }
  }

  // ── Job 4: monthly board digest (1st of the month) ───────────────────────
  let digests = 0;
  if (today.endsWith("-01")) {
    const [y, m] = today.split("-").map(Number);
    const prevStart =
      m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
    const monthLabel = new Date(Date.UTC(y, m - 2, 1)).toLocaleDateString(
      "en-US",
      { timeZone: "UTC", month: "long" },
    );

    const { data: allOrgs } = await admin
      .from("orgs")
      .select("id, name, last_digest_on");

    for (const org of (allOrgs ?? []) as Array<{
      id: string;
      name: string;
      last_digest_on: string | null;
    }>) {
      if (org.last_digest_on === today) continue;

      const [{ data: staff }, { data: invs }] = await Promise.all([
        admin.from("profiles").select("email").eq("org_id", org.id),
        admin
          .from("invoices")
          .select("amount_cents, status, due_date, paid_at, memo, units(label)")
          .eq("org_id", org.id),
      ]);

      const emails = (staff ?? [])
        .map((s) => s.email as string | null)
        .filter((e): e is string => !!e);
      if (emails.length === 0) continue;

      type Row = {
        amount_cents: number;
        status: string;
        due_date: string;
        paid_at: string | null;
        memo: string;
        units: { label: string } | null;
      };
      const rows = (invs ?? []) as unknown as Row[];
      const collectedCents = rows
        .filter(
          (r) =>
            r.status === "paid" &&
            (r.paid_at ?? "") >= prevStart &&
            (r.paid_at ?? "") < today,
        )
        .reduce((s, r) => s + r.amount_cents, 0);
      const outstandingCents = rows
        .filter((r) => r.status === "open" || r.status === "processing")
        .reduce((s, r) => s + r.amount_cents, 0);
      const overdueLines = rows
        .filter((r) => r.status === "open" && r.due_date < today)
        .slice(0, 8)
        .map((r) => ({
          label: r.units?.label ?? "—",
          memo: r.memo,
          amountCents: r.amount_cents,
        }));

      try {
        await sendBoardDigestEmail({
          to: emails,
          orgName: org.name,
          monthLabel,
          collectedCents,
          outstandingCents,
          overdueLines,
        });
        await admin
          .from("orgs")
          .update({ last_digest_on: today })
          .eq("id", org.id);
        digests++;
      } catch {}
    }
  }

  return NextResponse.json({ created, emailed, autopaid, reminded, lateFees, digests });
}

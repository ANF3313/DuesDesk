import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/categories";

/**
 * CSV export for reports. Runs as the signed-in user, so Row Level Security
 * scopes every query to their own org — no org id is ever taken from input.
 */

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function csv(rows: Array<Array<string | number>>): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });

  const url = new URL(req.url);
  const yearRaw = url.searchParams.get("year") ?? "";
  const type = url.searchParams.get("type") ?? "summary";
  if (!/^\d{4}$/.test(yearRaw)) return new NextResponse("Bad year", { status: 400 });
  const year = Number(yearRaw);
  const yStart = `${year}-01-01`;
  const yEnd = `${year + 1}-01-01`;

  let body: string;
  let name: string;

  if (type === "expenses") {
    const { data } = await supabase
      .from("expenses")
      .select("spent_on, category, vendor, memo, amount_cents")
      .gte("spent_on", yStart)
      .lt("spent_on", yEnd)
      .order("spent_on");
    body = csv([
      ["Date", "Category", "Vendor", "Description", "Amount (USD)"],
      ...(data ?? []).map((e) => [
        e.spent_on as string,
        categoryLabel(e.category as string),
        (e.vendor as string | null) ?? "",
        e.memo as string,
        dollars(e.amount_cents as number),
      ]),
    ]);
    name = `duesdesk-expenses-${year}.csv`;
  } else if (type === "invoices") {
    const { data } = await supabase
      .from("invoices")
      .select("due_date, memo, status, amount_cents, paid_at, units(label, member_name)")
      .gte("due_date", yStart)
      .lt("due_date", yEnd)
      .order("due_date");
    type Row = {
      due_date: string;
      memo: string;
      status: string;
      amount_cents: number;
      paid_at: string | null;
      units: { label: string; member_name: string } | null;
    };
    body = csv([
      ["Due date", "Unit", "Member", "Description", "Amount (USD)", "Status", "Paid on"],
      ...((data ?? []) as unknown as Row[]).map((i) => [
        i.due_date,
        i.units?.label ?? "",
        i.units?.member_name ?? "",
        i.memo,
        dollars(i.amount_cents),
        i.status,
        i.paid_at ? i.paid_at.slice(0, 10) : "",
      ]),
    ]);
    name = `duesdesk-invoices-${year}.csv`;
  } else {
    const [{ data: invs }, { data: exps }] = await Promise.all([
      supabase.from("invoices").select("amount_cents, status, paid_at"),
      supabase
        .from("expenses")
        .select("amount_cents, spent_on")
        .gte("spent_on", yStart)
        .lt("spent_on", yEnd),
    ]);
    const collected = Array(12).fill(0) as number[];
    const spent = Array(12).fill(0) as number[];
    for (const i of invs ?? []) {
      const paidAt = i.paid_at as string | null;
      if (i.status === "paid" && paidAt && paidAt >= yStart && paidAt < yEnd) {
        collected[Number(paidAt.slice(5, 7)) - 1] += i.amount_cents as number;
      }
    }
    for (const e of exps ?? []) {
      spent[Number((e.spent_on as string).slice(5, 7)) - 1] += e.amount_cents as number;
    }
    const rows: Array<Array<string | number>> = [
      ["Month", "Collected (USD)", "Spent (USD)", "Net (USD)"],
    ];
    for (let m = 0; m < 12; m++) {
      rows.push([
        `${year}-${String(m + 1).padStart(2, "0")}`,
        dollars(collected[m]),
        dollars(spent[m]),
        dollars(collected[m] - spent[m]),
      ]);
    }
    const totalC = collected.reduce((a, b) => a + b, 0);
    const totalS = spent.reduce((a, b) => a + b, 0);
    rows.push(["Total", dollars(totalC), dollars(totalS), dollars(totalC - totalS)]);
    body = csv(rows);
    name = `duesdesk-summary-${year}.csv`;
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}

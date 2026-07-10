import type { Metadata } from "next";
import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { formatCents } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { categoryLabel } from "@/lib/categories";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { IconChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { ExportButtons } from "./reports-client";

export const metadata: Metadata = { title: "Reports" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Money({ cents, tone }: { cents: number; tone?: "danger" | "muted" }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        tone === "danger" && cents !== 0 && "text-overdue-fg",
        tone === "muted" && "text-neutral-500",
      )}
    >
      {formatCents(cents)}
    </span>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { supabase } = await requireOrg();
  const currentYear = Number(todayISO().slice(0, 4));
  const { year: yearParam } = await searchParams;
  const year = /^\d{4}$/.test(yearParam ?? "") ? Number(yearParam) : currentYear;
  const yStart = `${year}-01-01`;
  const yEnd = `${year + 1}-01-01`;

  const [invoicesRes, expensesRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("amount_cents, status, due_date, paid_at"),
    supabase
      .from("expenses")
      .select("amount_cents, category, spent_on")
      .gte("spent_on", yStart)
      .lt("spent_on", yEnd),
  ]);

  type Inv = { amount_cents: number; status: string; due_date: string; paid_at: string | null };
  type Exp = { amount_cents: number; category: string; spent_on: string };
  const invoices = (invoicesRes.data ?? []) as Inv[];
  const expenses = (expensesRes.data ?? []) as Exp[];

  const collectedByMonth = Array(12).fill(0) as number[];
  const spentByMonth = Array(12).fill(0) as number[];
  for (const inv of invoices) {
    if (inv.status === "paid" && inv.paid_at && inv.paid_at >= yStart && inv.paid_at < yEnd) {
      collectedByMonth[Number(inv.paid_at.slice(5, 7)) - 1] += inv.amount_cents;
    }
  }
  const byCategory = new Map<string, number>();
  for (const exp of expenses) {
    spentByMonth[Number(exp.spent_on.slice(5, 7)) - 1] += exp.amount_cents;
    byCategory.set(exp.category, (byCategory.get(exp.category) ?? 0) + exp.amount_cents);
  }

  const collected = collectedByMonth.reduce((a, b) => a + b, 0);
  const spent = spentByMonth.reduce((a, b) => a + b, 0);
  const net = collected - spent;
  const outstanding = invoices
    .filter((i) => i.status === "open" || i.status === "processing")
    .reduce((s, i) => s + i.amount_cents, 0);

  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const lastMonth = year === currentYear ? Number(todayISO().slice(5, 7)) : 12;

  return (
    <div>
      <PageHeader
        title="Reports"
        description="The money story you show your members — collected, spent, and what's left."
        action={<ExportButtons year={year} />}
      />

      <div className="mb-5 flex items-center gap-1 print:hidden">
        <Link
          href={`/reports?year=${year - 1}`}
          className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600"
          aria-label={`View ${year - 1}`}
        >
          <IconChevronRight width={16} height={16} className="rotate-180" />
        </Link>
        <span className="min-w-14 text-center text-sm font-semibold text-neutral-950">
          {year}
        </span>
        {year < currentYear ? (
          <Link
            href={`/reports?year=${year + 1}`}
            className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600"
            aria-label={`View ${year + 1}`}
          >
            <IconChevronRight width={16} height={16} />
          </Link>
        ) : (
          <span className="p-1.5 text-neutral-300" aria-hidden="true">
            <IconChevronRight width={16} height={16} />
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[
          ["Collected", collected, undefined],
          ["Spent", spent, undefined],
          ["Net", net, net < 0 ? "danger" : undefined],
          ["Outstanding now", outstanding, "muted"],
        ].map(([label, cents, tone]) => (
          <Card key={label as string} className="p-5">
            <p className="text-[13px] font-medium text-neutral-500">{label as string}</p>
            <p
              className={cn(
                "mt-1.5 text-2xl font-semibold tracking-tight tabular-nums",
                tone === "danger" ? "text-overdue-fg" : "text-neutral-950",
              )}
            >
              {formatCents(cents as number)}
            </p>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title={`Month by month, ${year}`} />
        <Table>
          <thead>
            <tr>
              <Th>Month</Th>
              <Th align="right">Collected</Th>
              <Th align="right">Spent</Th>
              <Th align="right">Net</Th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.slice(0, lastMonth).map((m, i) => (
              <tr key={m} className="transition-colors hover:bg-neutral-50">
                <Td className="font-medium text-neutral-950">{m}</Td>
                <Td align="right">
                  <Money cents={collectedByMonth[i]} tone={collectedByMonth[i] === 0 ? "muted" : undefined} />
                </Td>
                <Td align="right">
                  <Money cents={spentByMonth[i]} tone={spentByMonth[i] === 0 ? "muted" : undefined} />
                </Td>
                <Td align="right" className="font-medium">
                  <Money cents={collectedByMonth[i] - spentByMonth[i]} tone={collectedByMonth[i] - spentByMonth[i] < 0 ? "danger" : undefined} />
                </Td>
              </tr>
            ))}
            <tr className="bg-neutral-50">
              <Td className="font-semibold text-neutral-950">Total</Td>
              <Td align="right" className="font-semibold"><Money cents={collected} /></Td>
              <Td align="right" className="font-semibold"><Money cents={spent} /></Td>
              <Td align="right" className="font-semibold"><Money cents={net} tone={net < 0 ? "danger" : undefined} /></Td>
            </tr>
          </tbody>
        </Table>
      </Card>

      {categories.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Spending by category" />
          <Table>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th align="right">Amount</Th>
                <Th align="right">Share</Th>
              </tr>
            </thead>
            <tbody>
              {categories.map(([cat, cents]) => (
                <tr key={cat} className="transition-colors hover:bg-neutral-50">
                  <Td className="font-medium text-neutral-950">{categoryLabel(cat)}</Td>
                  <Td align="right"><Money cents={cents} /></Td>
                  <Td align="right" className="text-neutral-500">
                    {spent > 0 ? Math.round((cents / spent) * 100) : 0}%
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

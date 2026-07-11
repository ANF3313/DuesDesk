import type { Metadata } from "next";
import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { formatCents } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill, invoiceKind } from "@/components/ui/status-pill";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCheck, IconReceipt } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Org } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

type InvoiceRow = {
  id: string;
  amount_cents: number;
  status: string;
  due_date: string;
  memo: string;
  paid_at: string | null;
  created_at: string;
  units: { label: string } | null;
};

type PaymentRow = {
  amount_cents: number;
  status: string;
  created_at: string;
  invoices: { memo: string; units: { label: string } | null } | null;
};

function StatCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "danger" | "good";
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight tabular-nums",
          tone === "danger" ? "text-overdue-fg" : "text-neutral-950",
        )}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 truncate text-xs text-neutral-500">{note}</p>}
    </Card>
  );
}

function ChecklistItem({
  done,
  title,
  href,
  cta,
}: {
  done: boolean;
  title: string;
  href: string;
  cta: string;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          done ? "border-pine-600 bg-pine-600 text-white" : "border-neutral-300 bg-white",
        )}
      >
        {done && <IconCheck width={12} height={12} strokeWidth={2.6} />}
      </span>
      <p
        className={cn(
          "min-w-0 flex-1 text-sm font-medium",
          done ? "text-neutral-400 line-through" : "text-neutral-950",
        )}
      >
        {title}
      </p>
      {!done && (
        <Link href={href} className="shrink-0 text-[13px] font-medium text-pine-600 hover:text-pine-700">
          {cta}
        </Link>
      )}
    </li>
  );
}

export default async function DashboardPage() {
  const { supabase, orgId } = await requireOrg();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5, 1);
  const rangeStart = sixMonthsAgo.toISOString().slice(0, 10);

  const [orgRes, unitsRes, invoicesRes, paymentsRes, announcementsRes, expensesRes] =
    await Promise.all([
      supabase.from("orgs").select("*").eq("id", orgId).single<Org>(),
      supabase.from("units").select("id, autopay_enabled"),
      supabase
        .from("invoices")
        .select("id, amount_cents, status, due_date, memo, paid_at, created_at, units(label)")
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("amount_cents, status, created_at, invoices(memo, units(label))")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("announcements")
        .select("subject, recipient_count, created_at")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("expenses")
        .select("amount_cents, spent_on")
        .gte("spent_on", rangeStart),
    ]);

  const org = orgRes.data;
  const units = (unitsRes.data ?? []) as Array<{ id: string; autopay_enabled: boolean }>;
  const invoices = (invoicesRes.data ?? []) as unknown as InvoiceRow[];
  const payments = (paymentsRes.data ?? []) as unknown as PaymentRow[];
  const announcements = (announcementsRes.data ?? []) as Array<{
    subject: string;
    recipient_count: number;
    created_at: string;
  }>;
  const expenses = (expensesRes.data ?? []) as Array<{
    amount_cents: number;
    spent_on: string;
  }>;

  const today = todayISO();
  const monthKey = today.slice(0, 7);
  const monthStart = monthKey + "-01";

  const open = invoices.filter((i) => i.status === "open" || i.status === "processing");
  const overdue = invoices
    .filter((i) => i.status === "open" && i.due_date < today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const outstandingCents = open.reduce((s, i) => s + i.amount_cents, 0);
  const overdueCents = overdue.reduce((s, i) => s + i.amount_cents, 0);
  const collectedCents = invoices
    .filter((i) => i.status === "paid" && (i.paid_at ?? "") >= monthStart)
    .reduce((s, i) => s + i.amount_cents, 0);

  // Collection rate: of everything due this month, how much is already paid.
  const dueThisMonth = invoices.filter(
    (i) => i.due_date.slice(0, 7) === monthKey && i.status !== "void",
  );
  const dueTotal = dueThisMonth.reduce((s, i) => s + i.amount_cents, 0);
  const duePaid = dueThisMonth
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount_cents, 0);
  const collectionRate = dueTotal > 0 ? Math.round((duePaid / dueTotal) * 100) : null;

  const autopayCount = units.filter((u) => u.autopay_enabled).length;

  // 6-month chart data
  const months: Array<{ key: string; label: string }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    });
  }
  const collectedBy = new Map<string, number>();
  for (const i of invoices) {
    if (i.status === "paid" && i.paid_at) {
      const k = i.paid_at.slice(0, 7);
      collectedBy.set(k, (collectedBy.get(k) ?? 0) + i.amount_cents);
    }
  }
  const spentBy = new Map<string, number>();
  for (const e of expenses) {
    const k = e.spent_on.slice(0, 7);
    spentBy.set(k, (spentBy.get(k) ?? 0) + e.amount_cents);
  }
  const chartMax = Math.max(
    1,
    ...months.map((m) => Math.max(collectedBy.get(m.key) ?? 0, spentBy.get(m.key) ?? 0)),
  );

  // Activity feed: payments + announcements, newest first
  const activity: Array<{ when: string; text: string }> = [
    ...payments.map((p) => ({
      when: p.created_at,
      text:
        p.status === "processing"
          ? `${p.invoices?.units?.label ?? "A member"} started a bank payment — ${formatCents(p.amount_cents)}`
          : `${p.invoices?.units?.label ?? "A member"} paid ${formatCents(p.amount_cents)} — ${p.invoices?.memo ?? ""}`,
    })),
    ...announcements.map((a) => ({
      when: a.created_at,
      text: `Announcement sent to ${a.recipient_count}: “${a.subject}”`,
    })),
  ]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, 7);

  const needsSetup = !org?.charges_enabled || units.length === 0 || invoices.length === 0;
  const recent = invoices.slice(0, 10);

  const quickAction =
    "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Where ${org?.name ?? "your community"}'s money stands today.`}
        action={
          <span className="flex flex-wrap gap-2">
            <Link href="/invoices" className={quickAction}>New dues</Link>
            <Link href="/units" className={quickAction}>Add unit</Link>
            <Link href="/announcements" className={quickAction}>Announce</Link>
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Collected this month" value={formatCents(collectedCents)} />
        <StatCard
          label="Outstanding"
          value={formatCents(outstandingCents)}
          note={`${open.length} unpaid ${open.length === 1 ? "invoice" : "invoices"}`}
        />
        <StatCard
          label="Overdue"
          value={formatCents(overdueCents)}
          note={overdue.length === 0 ? "Nothing past due" : `${overdue.length} past due`}
          tone={overdueCents > 0 ? "danger" : undefined}
        />
        <StatCard
          label="Collection rate"
          value={collectionRate === null ? "—" : `${collectionRate}%`}
          note="of dues due this month"
        />
        <StatCard label="Units" value={String(units.length)} />
        <StatCard
          label="On autopay"
          value={units.length > 0 ? `${autopayCount}/${units.length}` : "—"}
          note={
            units.length > 0
              ? `${Math.round((autopayCount / units.length) * 100)}% of units`
              : undefined
          }
        />
      </div>

      {needsSetup && (
        <Card className="mt-5">
          <CardHeader
            title="Finish setting up"
            description="Three steps and your community can pay online."
          />
          <CardBody className="py-2">
            <ul className="divide-y divide-neutral-100">
              <ChecklistItem
                done={!!org?.charges_enabled}
                title="Connect your Stripe account"
                href="/settings"
                cta="Connect"
              />
              <ChecklistItem
                done={units.length > 0}
                title="Add your units and members"
                href="/units"
                cta="Add units"
              />
              <ChecklistItem
                done={invoices.length > 0}
                title="Create your first dues"
                href="/invoices"
                cta="Create dues"
              />
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Left: chart + recent payments */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader
              title="Collections, last 6 months"
              action={
                <span className="flex items-center gap-4 text-xs text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-pine-600" /> Collected
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-neutral-300" /> Spent
                  </span>
                </span>
              }
            />
            <CardBody>
              <div className="flex h-36 items-end gap-2 md:gap-4">
                {months.map((m) => {
                  const c = collectedBy.get(m.key) ?? 0;
                  const s = spentBy.get(m.key) ?? 0;
                  return (
                    <div key={m.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <div className="flex h-28 w-full items-end justify-center gap-1">
                        <div
                          title={`Collected ${formatCents(c)}`}
                          className="w-[55%] max-w-10 rounded-t bg-pine-600"
                          style={{ height: c > 0 ? `${Math.max(4, Math.round((c / chartMax) * 100))}%` : "2px" }}
                        />
                        <div
                          title={`Spent ${formatCents(s)}`}
                          className="w-[35%] max-w-7 rounded-t bg-neutral-300"
                          style={{ height: s > 0 ? `${Math.max(4, Math.round((s / chartMax) * 100))}%` : "2px" }}
                        />
                      </div>
                      <span className="text-[11px] text-neutral-500">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent invoices"
              action={
                invoices.length > 0 ? (
                  <Link href="/invoices" className="text-[13px] font-medium text-pine-600 hover:text-pine-700">
                    View all
                  </Link>
                ) : undefined
              }
            />
            {recent.length === 0 ? (
              <CardBody>
                <EmptyState
                  icon={<IconReceipt />}
                  title="No invoices yet"
                  body="When you create dues, they'll show up here with their payment status at a glance."
                />
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Unit</Th>
                    <Th>For</Th>
                    <Th>Due</Th>
                    <Th align="right">Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((inv) => (
                    <tr key={inv.id} className="transition-colors hover:bg-neutral-50">
                      <Td className="font-medium text-neutral-950">{inv.units?.label ?? "—"}</Td>
                      <Td className="text-neutral-600">{inv.memo}</Td>
                      <Td className="whitespace-nowrap text-neutral-600">{formatDate(inv.due_date)}</Td>
                      <Td align="right" className="font-medium tabular-nums text-neutral-950">
                        {formatCents(inv.amount_cents)}
                      </Td>
                      <Td>
                        <StatusPill kind={invoiceKind(inv.status, inv.due_date)} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        {/* Right: needs attention + activity */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Needs attention" />
            <CardBody className="p-0">
              {overdue.length === 0 ? (
                <p className="px-5 py-6 text-sm text-neutral-500">
                  Nothing overdue. Enjoy the quiet.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {overdue.slice(0, 6).map((inv) => {
                    const daysLate = Math.max(
                      1,
                      Math.floor((Date.parse(today) - Date.parse(inv.due_date)) / 86400000),
                    );
                    return (
                      <li key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-950">
                            {inv.units?.label ?? "—"}
                          </p>
                          <p className="truncate text-xs text-overdue-fg">
                            {daysLate} {daysLate === 1 ? "day" : "days"} late · {inv.memo}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950">
                          {formatCents(inv.amount_cents)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {overdue.length > 0 && (
                <div className="border-t border-neutral-100 px-5 py-3">
                  <Link href="/invoices" className="text-[13px] font-medium text-pine-600 hover:text-pine-700">
                    Send reminders from Invoices →
                  </Link>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent activity" />
            <CardBody className="p-0">
              {activity.length === 0 ? (
                <p className="px-5 py-6 text-sm text-neutral-500">
                  Payments and announcements will show up here as they happen.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {activity.map((a, i) => (
                    <li key={i} className="px-5 py-3">
                      <p className="text-[13px] leading-snug text-neutral-700">{a.text}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {formatDate(a.when.slice(0, 10))}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

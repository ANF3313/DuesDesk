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

function StatCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "danger";
}) {
  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-neutral-500">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "danger" ? "text-overdue-fg" : "text-neutral-950",
        )}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-neutral-500">{note}</p>}
    </Card>
  );
}

function ChecklistItem({
  done,
  title,
  body,
  href,
  cta,
}: {
  done: boolean;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-pine-600 bg-pine-600 text-white"
            : "border-neutral-300 bg-white",
        )}
      >
        {done && <IconCheck width={12} height={12} strokeWidth={2.6} />}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            done ? "text-neutral-400 line-through" : "text-neutral-950",
          )}
        >
          {title}
        </p>
        {!done && <p className="mt-0.5 text-[13px] text-neutral-500">{body}</p>}
      </div>
      {!done && (
        <Link
          href={href}
          className="shrink-0 text-[13px] font-medium text-pine-600 hover:text-pine-700"
        >
          {cta}
        </Link>
      )}
    </li>
  );
}

export default async function DashboardPage() {
  const { supabase, orgId } = await requireOrg();

  const [orgRes, unitsRes, invoicesRes] = await Promise.all([
    supabase.from("orgs").select("*").eq("id", orgId).single<Org>(),
    supabase.from("units").select("id", { count: "exact", head: true }),
    supabase
      .from("invoices")
      .select("id, amount_cents, status, due_date, memo, paid_at, created_at, units(label)")
      .order("created_at", { ascending: false }),
  ]);

  const org = orgRes.data;
  const unitCount = unitsRes.count ?? 0;
  const invoices = (invoicesRes.data ?? []) as unknown as InvoiceRow[];

  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";

  const open = invoices.filter((i) => i.status === "open" || i.status === "processing");
  const overdue = invoices.filter((i) => i.status === "open" && i.due_date < today);
  const outstandingCents = open.reduce((s, i) => s + i.amount_cents, 0);
  const overdueCents = overdue.reduce((s, i) => s + i.amount_cents, 0);
  const collectedCents = invoices
    .filter((i) => i.status === "paid" && (i.paid_at ?? "") >= monthStart)
    .reduce((s, i) => s + i.amount_cents, 0);

  const needsSetup = !org?.charges_enabled || unitCount === 0 || invoices.length === 0;
  const recent = invoices.slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Where your community's dues stand today."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Outstanding"
          value={formatCents(outstandingCents)}
          note={`${open.length} unpaid ${open.length === 1 ? "invoice" : "invoices"}`}
        />
        <StatCard
          label="Overdue"
          value={formatCents(overdueCents)}
          note={
            overdue.length === 0
              ? "Nothing past due"
              : `${overdue.length} past due`
          }
          tone={overdueCents > 0 ? "danger" : undefined}
        />
        <StatCard
          label="Collected this month"
          value={formatCents(collectedCents)}
        />
        <StatCard
          label="Units"
          value={String(unitCount)}
          note={unitCount === 0 ? "Add your first unit" : undefined}
        />
      </div>

      {needsSetup && (
        <Card className="mt-6">
          <CardHeader
            title="Finish setting up"
            description="Three steps and your community can pay online."
          />
          <CardBody>
            <ul className="divide-y divide-neutral-100">
              <ChecklistItem
                done={!!org?.charges_enabled}
                title="Connect your Stripe account"
                body="Dues go straight to your organization's bank account — DuesDesk never holds the money."
                href="/settings"
                cta="Connect"
              />
              <ChecklistItem
                done={unitCount > 0}
                title="Add your units and members"
                body="Each unit gets its owner or tenant, their email, and the standard dues amount."
                href="/units"
                cta="Add units"
              />
              <ChecklistItem
                done={invoices.length > 0}
                title="Create your first dues"
                body="Set up recurring dues or send a one-time invoice — members get a private pay link by email."
                href="/invoices"
                cta="Create dues"
              />
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Recent invoices"
            action={
              invoices.length > 0 ? (
                <Link
                  href="/invoices"
                  className="text-[13px] font-medium text-pine-600 hover:text-pine-700"
                >
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
                action={
                  <Link
                    href="/invoices"
                    className="text-[13px] font-medium text-pine-600 hover:text-pine-700"
                  >
                    Create your first invoice
                  </Link>
                }
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
                    <Td className="font-medium text-neutral-950">
                      {inv.units?.label ?? "—"}
                    </Td>
                    <Td className="text-neutral-600">{inv.memo}</Td>
                    <Td className="whitespace-nowrap text-neutral-600">
                      {formatDate(inv.due_date)}
                    </Td>
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
    </div>
  );
}

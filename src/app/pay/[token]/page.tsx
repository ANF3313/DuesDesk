import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { StatusPill, invoiceKind } from "@/components/ui/status-pill";
import { IconCheck } from "@/components/ui/icons";
import type { Invoice } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Your balance",
  robots: { index: false, follow: false },
};

type PortalUnit = {
  id: string;
  label: string;
  member_name: string;
  autopay_enabled: boolean;
  autopay_label: string | null;
  orgs: { name: string; charges_enabled: boolean } | null;
};

function Banner({ status }: { status?: string }) {
  if (status === "success") {
    return (
      <div className="mb-5 rounded-lg border border-paid-border bg-paid-bg px-4 py-3 text-sm text-paid-fg">
        <strong className="font-semibold">Payment submitted — thank you.</strong>{" "}
        Card payments post right away; bank transfers take a few business days
        and show as “Processing” until they clear.
      </div>
    );
  }
  if (status === "cancelled") {
    return (
      <div className="mb-5 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Payment canceled — nothing was charged. Your balance is unchanged.
      </div>
    );
  }
  if (status === "autopay-on") {
    return (
      <div className="mb-5 rounded-lg border border-paid-border bg-paid-bg px-4 py-3 text-sm text-paid-fg">
        <strong className="font-semibold">Autopay is on.</strong> Your recurring
        dues will charge automatically on their due date — no more reminders.
      </div>
    );
  }
  if (status === "autopay-off") {
    return (
      <div className="mb-5 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Autopay is off. You&apos;ll get an email with a pay link when dues are due.
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mb-5 rounded-lg border border-overdue-border bg-overdue-bg px-4 py-3 text-sm text-overdue-fg">
        We couldn&apos;t start that payment. Nothing was charged — give it
        another try in a moment.
      </div>
    );
  }
  return null;
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ token }, { status }] = await Promise.all([params, searchParams]);

  // Tokens are 64 hex chars; reject junk before touching the database.
  if (!/^[a-f0-9]{32,128}$/i.test(token)) notFound();

  const admin = createAdminClient();
  const { data: unit } = await admin
    .from("units")
    .select("id, label, member_name, autopay_enabled, autopay_label, orgs(name, charges_enabled)")
    .eq("portal_token", token)
    .maybeSingle<PortalUnit>();
  if (!unit || !unit.orgs) notFound();

  const { data: invoiceRows } = await admin
    .from("invoices")
    .select("*")
    .eq("unit_id", unit.id)
    .order("due_date");
  const invoices = (invoiceRows ?? []) as Invoice[];

  const openInvoices = invoices.filter(
    (i) => i.status === "open" || i.status === "processing",
  );
  const paidInvoices = invoices
    .filter((i) => i.status === "paid")
    .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))
    .slice(0, 12);

  const today = todayISO();
  const dueNowCents = openInvoices
    .filter((i) => i.status === "open")
    .reduce((s, i) => s + i.amount_cents, 0);
  const hasOverdue = openInvoices.some(
    (i) => i.status === "open" && i.due_date < today,
  );
  const paymentsLive = unit.orgs.charges_enabled;

  return (
    <div className="min-h-dvh bg-neutral-50">
      <div className="mx-auto w-full max-w-xl px-4 py-10 md:py-14">
        <header className="mb-6">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-pine-600">
            {unit.orgs.name}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-950">
            {unit.label} — {unit.member_name}
          </h1>
        </header>

        <Banner status={status} />

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-card">
          <p className="text-[13px] font-medium text-neutral-500">Due now</p>
          <p
            className={cn(
              "mt-1 text-3xl font-semibold tracking-tight tabular-nums",
              hasOverdue ? "text-overdue-fg" : "text-neutral-950",
            )}
          >
            {formatCents(dueNowCents)}
          </p>
          {dueNowCents === 0 && (
            <p className="mt-1.5 text-sm text-neutral-500">
              Nothing due right now — you&apos;re all caught up.
            </p>
          )}

          {openInvoices.length > 0 && (
            <ul className="mt-5 divide-y divide-neutral-100 border-t border-neutral-100">
              {openInvoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-950">{inv.memo}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[13px] text-neutral-500">
                      Due {formatDate(inv.due_date)}
                      <StatusPill kind={invoiceKind(inv.status, inv.due_date)} />
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold tabular-nums text-neutral-950">
                      {formatCents(inv.amount_cents)}
                    </span>
                    {inv.status === "open" && paymentsLive && (
                      <form method="POST" action="/api/checkout">
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <button
                          type="submit"
                          className="rounded-md bg-pine-600 px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-pine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2"
                        >
                          Pay now
                        </button>
                      </form>
                    )}
                    {inv.status === "processing" && (
                      <span className="text-[13px] text-neutral-500">
                        Bank payment in progress
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {paymentsLive && openInvoices.some((i) => i.status === "open") && (
            <p className="mt-4 text-xs text-neutral-400">
              Online payments include a $1.95 convenience fee, shown at
              checkout before you confirm.
            </p>
          )}

          {!paymentsLive && openInvoices.some((i) => i.status === "open") && (
            <p className="mt-4 rounded-md bg-neutral-50 px-3 py-2.5 text-[13px] text-neutral-600">
              Online payment isn&apos;t set up yet. Contact {unit.orgs.name} about
              other ways to pay.
            </p>
          )}
        </div>

        {paymentsLive && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-950">
                {unit.autopay_enabled ? "Autopay is on" : "Never miss a due date"}
              </p>
              <p className="mt-0.5 text-[13px] text-neutral-500">
                {unit.autopay_enabled
                  ? `Recurring dues charge ${unit.autopay_label ?? "your saved card"} automatically.`
                  : "Save a card once and recurring dues pay themselves on the due date."}
              </p>
            </div>
            <form method="POST" action="/api/autopay">
              <input type="hidden" name="token" value={token} />
              <input
                type="hidden"
                name="action"
                value={unit.autopay_enabled ? "stop" : "start"}
              />
              <button
                type="submit"
                className={cn(
                  "rounded-md px-4 py-2 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2",
                  unit.autopay_enabled
                    ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                    : "bg-pine-600 text-white hover:bg-pine-700",
                )}
              >
                {unit.autopay_enabled ? "Turn off autopay" : "Set up autopay"}
              </button>
            </form>
          </div>
        )}

        {paidInvoices.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2.5 text-sm font-semibold text-neutral-950">
              Payment history
            </h2>
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white shadow-card">
              {paidInvoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-paid-bg text-paid-fg"
                    >
                      <IconCheck width={11} height={11} strokeWidth={2.6} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-950">{inv.memo}</p>
                      {inv.paid_at && (
                        <p className="text-xs text-neutral-500">
                          Paid {formatDate(inv.paid_at.slice(0, 10))}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-neutral-700">
                    {formatCents(inv.amount_cents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-neutral-400">
          Powered by DuesDesk · Payments secured by Stripe
        </footer>
      </div>
    </div>
  );
}

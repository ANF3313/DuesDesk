"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { formatCents } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { OK, type ActionState } from "@/lib/validation";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, MoneyInput, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatusPill, invoiceKind } from "@/components/ui/status-pill";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  IconBanknote,
  IconClock,
  IconMail,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconX,
} from "@/components/ui/icons";
import {
  createDues,
  deleteInvoice,
  deleteSchedule,
  markPaidOffline,
  sendReminder,
  setScheduleActive,
  voidInvoice,
} from "./actions";
import type { InvoiceWithUnit, ScheduleWithUnit, UnitOption } from "./page";

const CADENCE_SHORT = { monthly: "/mo", quarterly: "/qtr", annually: "/yr" } as const;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unpaid", label: "Unpaid" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const iconButton =
  "rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 disabled:pointer-events-none disabled:opacity-40";

function NewDuesModal({
  units,
  onClose,
}: {
  units: UnitOption[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(createDues, OK);
  const [mode, setMode] = useState<"one-time" | "recurring">("one-time");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (state.success) {
      toast({ title: state.success });
      onClose();
    }
  }, [state, toast, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      title="New dues"
      description="One-time for special assessments, recurring for regular dues."
    >
      <div
        role="group"
        aria-label="Invoice type"
        className="mb-4 grid grid-cols-2 gap-0.5 rounded-lg bg-neutral-100 p-0.5"
      >
        {(["one-time", "recurring"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600",
              mode === m
                ? "bg-white text-neutral-950 shadow-card"
                : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {m === "one-time" ? "One-time" : "Recurring"}
          </button>
        ))}
      </div>

      <form action={formAction} noValidate className="space-y-4">
        <input type="hidden" name="mode" value={mode} />
        <Select
          label="Unit"
          name="unitId"
          error={state.fieldErrors?.unitId}
          defaultValue=""
          onChange={(e) => {
            const u = units.find((x) => x.id === e.target.value);
            if (u) setAmount((u.dues_amount_cents / 100).toFixed(2));
          }}
          required
        >
          <option value="" disabled>
            Pick a unit…
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label} — {u.member_name}
            </option>
          ))}
        </Select>
        <MoneyInput
          label="Amount"
          name="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={state.fieldErrors?.amountCents}
          required
        />
        <Input
          label="What's it for?"
          name="memo"
          placeholder={mode === "one-time" ? "Roof assessment" : "Monthly dues"}
          error={state.fieldErrors?.memo}
          required
        />

        {mode === "one-time" ? (
          <>
            <Input
              label="Due date"
              name="dueDate"
              type="date"
              defaultValue={todayISO()}
              error={state.fieldErrors?.dueDate}
              required
            />
            <label className="flex items-start gap-2.5 text-[13px] text-neutral-700">
              <input
                type="checkbox"
                name="emailNow"
                defaultChecked
                className="mt-0.5 size-4 accent-pine-600"
              />
              Email the member their pay link now
            </label>
          </>
        ) : (
          <>
            <Select
              label="Repeats"
              name="cadence"
              defaultValue="monthly"
              error={state.fieldErrors?.cadence}
              required
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </Select>
            <Input
              label="First invoice date"
              name="firstInvoiceDate"
              type="date"
              defaultValue={todayISO()}
              hint="The invoice is created and emailed on this date, then on every cycle after."
              error={state.fieldErrors?.firstInvoiceDate}
              required
            />
          </>
        )}

        {state.formError && (
          <p role="alert" className="rounded-md bg-overdue-bg px-3 py-2 text-[13px] text-overdue-fg">
            {state.formError}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {mode === "one-time" ? "Create invoice" : "Start recurring dues"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function InvoicesClient({
  invoices,
  schedules,
  units,
}: {
  invoices: InvoiceWithUnit[];
  schedules: ScheduleWithUnit[];
  units: UnitOption[];
}) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterId>("all");
  const [showNew, setShowNew] = useState(false);
  const [markPaid, setMarkPaid] = useState<InvoiceWithUnit | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const today = todayISO();
  const filtered = useMemo(() => {
    switch (filter) {
      case "unpaid":
        return invoices.filter((i) => i.status === "open" || i.status === "processing");
      case "overdue":
        return invoices.filter((i) => i.status === "open" && i.due_date < today);
      case "paid":
        return invoices.filter((i) => i.status === "paid");
      default:
        return invoices;
    }
  }, [invoices, filter, today]);

  function run(id: string, fn: () => Promise<ActionState>) {
    setBusyId(id);
    startTransition(async () => {
      const res = await fn();
      toast({
        title: res.success ?? res.formError ?? "Something went wrong",
        kind: res.success ? "success" : "error",
      });
      setBusyId(null);
    });
  }

  const newButton = (
    <Button onClick={() => setShowNew(true)} disabled={units.length === 0}>
      <IconPlus width={16} height={16} />
      New dues
    </Button>
  );

  function rowActions(inv: InvoiceWithUnit) {
    if (inv.status === "paid" || inv.status === "void") return null;
    const busy = busyId === inv.id;
    return (
      <span className="inline-flex">
        <button
          type="button"
          title="Mark paid — check, cash, or other offline payment"
          aria-label={`Mark ${inv.memo} as paid offline`}
          disabled={busy}
          className={iconButton}
          onClick={() => setMarkPaid(inv)}
        >
          <IconBanknote width={16} height={16} />
        </button>
        <button
          type="button"
          title="Email pay link"
          aria-label={`Email pay link for ${inv.memo}`}
          disabled={busy}
          className={iconButton}
          onClick={() => run(inv.id, () => sendReminder(inv.id))}
        >
          <IconMail width={16} height={16} />
        </button>
        <button
          type="button"
          title="Void invoice"
          aria-label={`Void ${inv.memo}`}
          disabled={busy}
          className={iconButton}
          onClick={() => run(inv.id, () => voidInvoice(inv.id))}
        >
          <IconX width={16} height={16} />
        </button>
        <button
          type="button"
          title="Delete invoice"
          aria-label={`Delete ${inv.memo}`}
          disabled={busy}
          className={`${iconButton} hover:text-danger-600`}
          onClick={() => run(inv.id, () => deleteInvoice(inv.id))}
        >
          <IconTrash width={16} height={16} />
        </button>
      </span>
    );
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Every bill you've sent and where it stands."
        action={invoices.length > 0 ? newButton : undefined}
      />

      {units.length === 0 ? (
        <EmptyState
          icon={<IconReceipt />}
          title="Add a unit first"
          body="Invoices are billed to a unit's member. Add your first unit and you can start creating dues."
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<IconReceipt />}
          title="No dues yet"
          body="Create recurring dues for regular collections, or a one-time invoice for a special assessment. Members get a private link to pay online."
          action={newButton}
        />
      ) : (
        <>
          <div
            role="group"
            aria-label="Filter invoices"
            className="mb-4 inline-flex gap-0.5 rounded-lg bg-neutral-100 p-0.5"
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600",
                  filter === f.id
                    ? "bg-white text-neutral-950 shadow-card"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-sm text-neutral-500">
                {filter === "overdue"
                  ? "Nothing overdue. Enjoy the quiet."
                  : "No invoices match this filter."}
              </p>
            </Card>
          ) : (
            <>
              {/* Desktop */}
              <Card className="hidden md:block">
                <Table>
                  <thead>
                    <tr>
                      <Th>Unit</Th>
                      <Th>For</Th>
                      <Th>Due</Th>
                      <Th align="right">Amount</Th>
                      <Th>Status</Th>
                      <Th>
                        <span className="sr-only">Actions</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv) => (
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
                        <Td align="right" className="whitespace-nowrap">
                          {rowActions(inv)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>

              {/* Mobile */}
              <ul className="space-y-3 md:hidden">
                {filtered.map((inv) => (
                  <li key={inv.id}>
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-950">
                            {inv.units?.label ?? "—"}
                          </p>
                          <p className="mt-0.5 text-[13px] text-neutral-500">
                            {inv.memo} · due {formatDate(inv.due_date)}
                          </p>
                        </div>
                        <StatusPill kind={invoiceKind(inv.status, inv.due_date)} />
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                        <span className="font-medium tabular-nums text-neutral-950">
                          {formatCents(inv.amount_cents)}
                        </span>
                        {rowActions(inv)}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {schedules.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="Recurring dues"
            description="These create and email an invoice automatically on each cycle."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-neutral-100">
              {schedules.map((s) => {
                const busy = busyId === s.id;
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-950">
                        {s.units?.label ?? "—"}
                        <span className="ml-2 font-normal text-neutral-500">{s.memo}</span>
                      </p>
                      <p className="mt-0.5 text-[13px] text-neutral-500">
                        <span className="font-medium tabular-nums text-neutral-700">
                          {formatCents(s.amount_cents)}
                          {CADENCE_SHORT[s.cadence]}
                        </span>
                        {s.active
                          ? ` · next invoice ${formatDate(s.next_invoice_date)}`
                          : " · paused"}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        title={s.active ? "Pause" : "Resume"}
                        aria-label={`${s.active ? "Pause" : "Resume"} recurring dues for ${s.units?.label ?? "unit"}`}
                        disabled={busy}
                        className={iconButton}
                        onClick={() => run(s.id, () => setScheduleActive(s.id, !s.active))}
                      >
                        <IconClock width={16} height={16} />
                      </button>
                      <button
                        type="button"
                        title="Delete schedule"
                        aria-label={`Delete recurring dues for ${s.units?.label ?? "unit"}`}
                        disabled={busy}
                        className={`${iconButton} hover:text-danger-600`}
                        onClick={() => run(s.id, () => deleteSchedule(s.id))}
                      >
                        <IconTrash width={16} height={16} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      {showNew && <NewDuesModal units={units} onClose={() => setShowNew(false)} />}

      {markPaid && (
        <Modal
          open
          onClose={() => setMarkPaid(null)}
          title={`Mark “${markPaid.memo}” as paid?`}
          description={`Records that ${markPaid.units?.label ?? "this unit"} settled ${formatCents(markPaid.amount_cents)} outside DuesDesk — by check, cash, or bank transfer. Paid invoices can't be undone or deleted.`}
        >
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setMarkPaid(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const inv = markPaid;
                setMarkPaid(null);
                run(inv.id, () => markPaidOffline(inv.id));
              }}
            >
              Record payment
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

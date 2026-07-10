"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { Expense } from "@/lib/types";
import { formatCents } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { EXPENSE_CATEGORIES, categoryLabel } from "@/lib/categories";
import { OK } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, MoneyInput, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { IconPencil, IconPlus, IconTrash, IconWallet } from "@/components/ui/icons";
import { createExpense, deleteExpense, updateExpense } from "./actions";

const iconButton =
  "rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600";

function ExpenseModal({
  expense,
  onClose,
}: {
  expense: Expense | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const action = expense ? updateExpense.bind(null, expense.id) : createExpense;
  const [state, formAction, pending] = useActionState(action, OK);

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
      title={expense ? "Edit expense" : "Record an expense"}
      description={expense ? undefined : "Anything the organization spent money on."}
    >
      <form action={formAction} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput
            label="Amount"
            name="amount"
            defaultValue={expense ? (expense.amount_cents / 100).toFixed(2) : ""}
            error={state.fieldErrors?.amountCents}
            required
          />
          <Input
            label="Date"
            name="spentOn"
            type="date"
            defaultValue={expense?.spent_on ?? todayISO()}
            error={state.fieldErrors?.spentOn}
            required
          />
        </div>
        <Select
          label="Category"
          name="category"
          defaultValue={expense?.category ?? "maintenance"}
          error={state.fieldErrors?.category}
          required
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Input
          label="What was it for?"
          name="memo"
          placeholder="Pool pump repair"
          defaultValue={expense?.memo}
          error={state.fieldErrors?.memo}
          required
        />
        <Input
          label="Vendor"
          name="vendor"
          placeholder="Apex Plumbing (optional)"
          defaultValue={expense?.vendor ?? ""}
          error={state.fieldErrors?.vendor}
        />
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
            {expense ? "Save changes" : "Record expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ExpensesClient({
  expenses,
  thisMonthCents,
  ytdCents,
}: {
  expenses: Expense[];
  thisMonthCents: number;
  ytdCents: number;
}) {
  const { toast } = useToast();
  const [modal, setModal] = useState<
    { kind: "create" } | { kind: "edit"; expense: Expense } | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(exp: Expense) {
    setBusyId(exp.id);
    startTransition(async () => {
      const res = await deleteExpense(exp.id);
      toast({
        title: res.success ?? res.formError ?? "Something went wrong",
        kind: res.success ? "success" : "error",
      });
      setBusyId(null);
    });
  }

  const addButton = (
    <Button onClick={() => setModal({ kind: "create" })}>
      <IconPlus width={16} height={16} />
      Record expense
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Where the money went — every report pulls from here."
        action={expenses.length > 0 ? addButton : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:w-1/2 lg:gap-4">
        <Card className="p-5">
          <p className="text-[13px] font-medium text-neutral-500">Spent this month</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-neutral-950">
            {formatCents(thisMonthCents)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-medium text-neutral-500">Spent this year</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-neutral-950">
            {formatCents(ytdCents)}
          </p>
        </Card>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={<IconWallet />}
          title="No expenses yet"
          body="Record what the organization spends — repairs, insurance, landscaping — and your reports will show members exactly where their dues go."
          action={addButton}
        />
      ) : (
        <>
          <Card className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>For</Th>
                  <Th>Category</Th>
                  <Th>Vendor</Th>
                  <Th align="right">Amount</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} className="transition-colors hover:bg-neutral-50">
                    <Td className="whitespace-nowrap text-neutral-600">
                      {formatDate(exp.spent_on)}
                    </Td>
                    <Td className="font-medium text-neutral-950">{exp.memo}</Td>
                    <Td>
                      <span className="inline-flex whitespace-nowrap rounded-full border border-void-border bg-void-bg px-2.5 py-0.5 text-xs font-medium text-void-fg">
                        {categoryLabel(exp.category)}
                      </span>
                    </Td>
                    <Td className="text-neutral-600">{exp.vendor ?? "—"}</Td>
                    <Td align="right" className="font-medium tabular-nums text-neutral-950">
                      {formatCents(exp.amount_cents)}
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      <button
                        type="button"
                        title="Edit"
                        aria-label={`Edit ${exp.memo}`}
                        disabled={busyId === exp.id}
                        className={iconButton}
                        onClick={() => setModal({ kind: "edit", expense: exp })}
                      >
                        <IconPencil width={16} height={16} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        aria-label={`Delete ${exp.memo}`}
                        disabled={busyId === exp.id}
                        className={`${iconButton} hover:text-danger-600`}
                        onClick={() => remove(exp)}
                      >
                        <IconTrash width={16} height={16} />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <ul className="space-y-3 md:hidden">
            {expenses.map((exp) => (
              <li key={exp.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-950">{exp.memo}</p>
                      <p className="mt-0.5 text-[13px] text-neutral-500">
                        {formatDate(exp.spent_on)} · {categoryLabel(exp.category)}
                        {exp.vendor ? ` · ${exp.vendor}` : ""}
                      </p>
                    </div>
                    <span className="font-medium tabular-nums text-neutral-950">
                      {formatCents(exp.amount_cents)}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end gap-1 border-t border-neutral-100 pt-2">
                    <button
                      type="button"
                      aria-label={`Edit ${exp.memo}`}
                      className={iconButton}
                      onClick={() => setModal({ kind: "edit", expense: exp })}
                    >
                      <IconPencil width={16} height={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${exp.memo}`}
                      className={`${iconButton} hover:text-danger-600`}
                      onClick={() => remove(exp)}
                    >
                      <IconTrash width={16} height={16} />
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {modal && (
        <ExpenseModal
          key={modal.kind === "edit" ? modal.expense.id : "new"}
          expense={modal.kind === "edit" ? modal.expense : null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

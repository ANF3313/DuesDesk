"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { Unit } from "@/lib/types";
import { formatCents } from "@/lib/money";
import { OK } from "@/lib/validation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, MoneyInput, TextArea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  IconBuilding,
  IconLink,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@/components/ui/icons";
import {
  createUnit,
  deleteUnit,
  importUnits,
  resetPayLink,
  updateUnit,
  type ImportRow,
} from "./actions";

function parseSpreadsheetText(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: ImportRow[] = [];
  for (const line of lines) {
    const delim = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const cells = line
      .split(delim)
      .map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());
    if (cells.length < 4) continue;
    // Skip a header row (its email column won't contain @).
    if (!cells[2].includes("@")) continue;
    rows.push({ label: cells[0], name: cells[1], email: cells[2], dues: cells[3] });
  }
  return rows;
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const rows = parseSpreadsheetText(text);

  return (
    <Modal
      open
      onClose={onClose}
      title="Import units"
      description="Paste rows from your spreadsheet — one unit per line: unit, member name, email, dues."
    >
      <div className="space-y-4">
        <TextArea
          label="Rows"
          name="rows"
          rows={7}
          placeholder={"Unit 1A, Maya Rodriguez, maya@example.com, 350\nUnit 1B, Sam Alvarez, sam@example.com, 350"}
          hint={
            rows.length > 0
              ? `${rows.length} ${rows.length === 1 ? "unit" : "units"} ready to import.`
              : "Commas, semicolons, or tabs all work. A header row is skipped automatically."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-[13px]"
        />
        <label className="block text-[13px] text-neutral-600">
          Or pick a .csv file:{" "}
          <input
            type="file"
            accept=".csv,.txt,.tsv"
            className="mt-1 block text-[13px] file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-neutral-700 hover:file:bg-neutral-50"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => setText(String(reader.result ?? ""));
              reader.readAsText(f);
            }}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-md bg-overdue-bg px-3 py-2 text-[13px] text-overdue-fg">
            {error}
          </p>
        )}
        {skipped.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-md bg-pending-bg px-3 py-2 text-[13px] text-pending-fg">
            <p className="font-medium">Skipped:</p>
            {skipped.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={rows.length === 0}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await importUnits(rows);
                if (res.formError) {
                  setError(res.formError);
                  return;
                }
                setSkipped(res.skipped ?? []);
                toast({ title: res.success ?? "Import finished" });
                if (!res.skipped || res.skipped.length === 0) onClose();
                else setText("");
              })
            }
          >
            Import {rows.length > 0 ? rows.length : ""} units
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export type UnitBalance = { cents: number; overdue: boolean };

function BalanceCell({ balance }: { balance?: UnitBalance }) {
  if (!balance || balance.cents === 0) {
    return <StatusPill kind="paid" label="Paid up" />;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-medium tabular-nums text-neutral-950">
        {formatCents(balance.cents)}
      </span>
      <StatusPill kind={balance.overdue ? "overdue" : "due"} />
    </span>
  );
}

function RowActions({
  unit,
  onCopy,
  onEdit,
  onDelete,
}: {
  unit: Unit;
  onCopy: (u: Unit) => void;
  onEdit: (u: Unit) => void;
  onDelete: (u: Unit) => void;
}) {
  const iconButton =
    "rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600";
  return (
    <span className="inline-flex">
      <button type="button" title="Copy pay link" aria-label={`Copy pay link for ${unit.label}`} className={iconButton} onClick={() => onCopy(unit)}>
        <IconLink width={16} height={16} />
      </button>
      <button type="button" title="Edit" aria-label={`Edit ${unit.label}`} className={iconButton} onClick={() => onEdit(unit)}>
        <IconPencil width={16} height={16} />
      </button>
      <button type="button" title="Remove" aria-label={`Remove ${unit.label}`} className={`${iconButton} hover:text-danger-600`} onClick={() => onDelete(unit)}>
        <IconTrash width={16} height={16} />
      </button>
    </span>
  );
}

function UnitFormModal({
  unit,
  onClose,
}: {
  unit: Unit | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const action = unit ? updateUnit.bind(null, unit.id) : createUnit;
  const [state, formAction, pending] = useActionState(action, OK);
  const [resetPending, startReset] = useTransition();

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
      title={unit ? `Edit ${unit.label}` : "Add a unit"}
      description={
        unit
          ? undefined
          : "A unit is one property or home and the person responsible for its dues."
      }
    >
      <form action={formAction} noValidate className="space-y-4">
        <Input
          label="Unit name"
          name="label"
          placeholder="Unit 4B or 12 Elm St"
          defaultValue={unit?.label}
          error={state.fieldErrors?.label}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Member name"
            name="memberName"
            placeholder="Maya Rodriguez"
            defaultValue={unit?.member_name}
            error={state.fieldErrors?.memberName}
            required
          />
          <Input
            label="Member email"
            name="memberEmail"
            type="email"
            placeholder="maya@example.com"
            defaultValue={unit?.member_email}
            error={state.fieldErrors?.memberEmail}
            required
          />
        </div>
        <MoneyInput
          label="Standard dues"
          name="dues"
          defaultValue={unit ? (unit.dues_amount_cents / 100).toFixed(2) : ""}
          hint="Used to prefill this unit's invoices — you can change it per invoice."
          error={state.fieldErrors?.duesAmountCents}
          required
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
            {unit ? "Save changes" : "Add unit"}
          </Button>
        </div>
      </form>

      {unit && (
        <div className="mt-5 border-t border-neutral-100 pt-4">
          <p className="text-[13px] text-neutral-500">
            If this unit&apos;s pay link was shared with the wrong person, reset it.
            Every link sent before the reset stops working.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2.5"
            loading={resetPending}
            onClick={() =>
              startReset(async () => {
                const res = await resetPayLink(unit.id);
                toast({
                  title: res.success ?? res.formError ?? "Something went wrong",
                  kind: res.success ? "success" : "error",
                });
              })
            }
          >
            Reset pay link
          </Button>
        </div>
      )}
    </Modal>
  );
}

function DeleteUnitModal({
  unit,
  onClose,
}: {
  unit: Unit;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open
      onClose={onClose}
      title={`Remove ${unit.label}?`}
      description="This permanently deletes the unit along with its invoices and payment history. This can't be undone."
    >
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Keep unit
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await deleteUnit(unit.id);
              toast({
                title: res.success ?? res.formError ?? "Something went wrong",
                kind: res.success ? "success" : "error",
              });
              onClose();
            })
          }
        >
          Remove unit
        </Button>
      </div>
    </Modal>
  );
}

export function UnitsClient({
  units,
  balances,
  baseUrl,
}: {
  units: Unit[];
  balances: Record<string, UnitBalance>;
  baseUrl: string;
}) {
  const { toast } = useToast();
  const [modal, setModal] = useState<
    | { kind: "create" }
    | { kind: "edit"; unit: Unit }
    | { kind: "delete"; unit: Unit }
    | { kind: "import" }
    | null
  >(null);

  async function copyLink(unit: Unit) {
    try {
      await navigator.clipboard.writeText(`${baseUrl}/pay/${unit.portal_token}`);
      toast({
        title: "Pay link copied",
        description: `Send it to ${unit.member_name} — it shows their balance and takes payment.`,
      });
    } catch {
      toast({ title: "Couldn't copy the link", kind: "error" });
    }
  }

  const addButton = (
    <span className="flex gap-2">
      <Button variant="secondary" onClick={() => setModal({ kind: "import" })}>
        Import CSV
      </Button>
      <Button onClick={() => setModal({ kind: "create" })}>
        <IconPlus width={16} height={16} />
        Add unit
      </Button>
    </span>
  );

  return (
    <div>
      <PageHeader
        title="Units"
        description="Your properties and the members responsible for their dues."
        action={units.length > 0 ? addButton : undefined}
      />

      {units.length === 0 ? (
        <EmptyState
          icon={<IconBuilding />}
          title="Add your first unit"
          body="Start with one home or property — its owner or tenant, their email, and what they pay. You can always edit later."
          action={addButton}
        />
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Unit</Th>
                  <Th>Member</Th>
                  <Th align="right">Standard dues</Th>
                  <Th>Balance</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id} className="transition-colors hover:bg-neutral-50">
                    <Td className="font-medium text-neutral-950">
                      {unit.label}
                      {unit.autopay_enabled && (
                        <StatusPill kind="processing" label="Autopay" className="ml-2" />
                      )}
                    </Td>
                    <Td>
                      <span className="block text-neutral-950">{unit.member_name}</span>
                      <span className="block text-[13px] text-neutral-500">
                        {unit.member_email}
                      </span>
                    </Td>
                    <Td align="right" className="tabular-nums text-neutral-700">
                      {formatCents(unit.dues_amount_cents)}
                    </Td>
                    <Td>
                      <BalanceCell balance={balances[unit.id]} />
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      <RowActions
                        unit={unit}
                        onCopy={copyLink}
                        onEdit={(u) => setModal({ kind: "edit", unit: u })}
                        onDelete={(u) => setModal({ kind: "delete", unit: u })}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {/* Mobile */}
          <ul className="space-y-3 md:hidden">
            {units.map((unit) => (
              <li key={unit.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-950">
                        {unit.label}
                        {unit.autopay_enabled && (
                          <StatusPill kind="processing" label="Autopay" className="ml-2" />
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-neutral-500">
                        {unit.member_name} · {unit.member_email}
                      </p>
                    </div>
                    <RowActions
                      unit={unit}
                      onCopy={copyLink}
                      onEdit={(u) => setModal({ kind: "edit", unit: u })}
                      onDelete={(u) => setModal({ kind: "delete", unit: u })}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                    <span className="text-[13px] text-neutral-500">
                      Dues {formatCents(unit.dues_amount_cents)}
                    </span>
                    <BalanceCell balance={balances[unit.id]} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {(modal?.kind === "create" || modal?.kind === "edit") && (
        <UnitFormModal
          key={modal.kind === "edit" ? modal.unit.id : "new"}
          unit={modal.kind === "edit" ? modal.unit : null}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "delete" && (
        <DeleteUnitModal unit={modal.unit} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "import" && <ImportModal onClose={() => setModal(null)} />}
    </div>
  );
}

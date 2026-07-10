"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/org";
import { parseMoneyInput } from "@/lib/money";
import { fieldErrorsOf, unitSchema, type ActionState } from "@/lib/validation";

function refresh() {
  revalidatePath("/units");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

function parseUnitForm(formData: FormData) {
  return unitSchema.safeParse({
    label: formData.get("label") ?? "",
    memberName: formData.get("memberName") ?? "",
    memberEmail: formData.get("memberEmail") ?? "",
    duesAmountCents: parseMoneyInput(String(formData.get("dues") ?? "")),
  });
}

export async function createUnit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseUnitForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { supabase, orgId } = await requireOrg();
  const { error } = await supabase.from("units").insert({
    org_id: orgId,
    label: parsed.data.label,
    member_name: parsed.data.memberName,
    member_email: parsed.data.memberEmail,
    dues_amount_cents: parsed.data.duesAmountCents,
  });

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { label: "You already have a unit with this name." } };
    }
    return { formError: "The unit couldn't be saved. Give it another try." };
  }

  refresh();
  return { success: "Unit added" };
}

export async function updateUnit(
  unitId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseUnitForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { supabase } = await requireOrg();
  const { error } = await supabase
    .from("units")
    .update({
      label: parsed.data.label,
      member_name: parsed.data.memberName,
      member_email: parsed.data.memberEmail,
      dues_amount_cents: parsed.data.duesAmountCents,
    })
    .eq("id", unitId);

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { label: "You already have a unit with this name." } };
    }
    return { formError: "The changes couldn't be saved. Give it another try." };
  }

  refresh();
  return { success: "Unit updated" };
}

export type ImportRow = {
  label: string;
  name: string;
  email: string;
  dues: string;
};

export type ImportResult = ActionState & { skipped?: string[] };

/** Bulk import from a pasted spreadsheet. Every row re-validated server-side. */
export async function importUnits(rows: ImportRow[]): Promise<ImportResult> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { formError: "Nothing to import — paste at least one row." };
  }
  if (rows.length > 200) {
    return { formError: "That's over 200 rows — import in smaller batches." };
  }

  const { supabase, orgId } = await requireOrg();
  const { data: existing } = await supabase.from("units").select("label");
  const taken = new Set(
    (existing ?? []).map((u) => (u.label as string).toLowerCase()),
  );

  const skipped: string[] = [];
  const valid: Array<{
    org_id: string;
    label: string;
    member_name: string;
    member_email: string;
    dues_amount_cents: number;
  }> = [];

  rows.forEach((row, i) => {
    const where = row.label?.trim() || row.email?.trim() || `row ${i + 1}`;
    const parsed = unitSchema.safeParse({
      label: row.label ?? "",
      memberName: row.name ?? "",
      memberEmail: row.email ?? "",
      duesAmountCents: parseMoneyInput(String(row.dues ?? "")),
    });
    if (!parsed.success) {
      skipped.push(`${where}: ${Object.values(fieldErrorsOf(parsed.error))[0]}`);
      return;
    }
    const key = parsed.data.label.toLowerCase();
    if (taken.has(key)) {
      skipped.push(`${where}: a unit with this name already exists`);
      return;
    }
    taken.add(key);
    valid.push({
      org_id: orgId,
      label: parsed.data.label,
      member_name: parsed.data.memberName,
      member_email: parsed.data.memberEmail,
      dues_amount_cents: parsed.data.duesAmountCents,
    });
  });

  if (valid.length > 0) {
    const { error } = await supabase.from("units").insert(valid);
    if (error) {
      return { formError: "The import failed partway — nothing was saved. Give it another try." };
    }
    refresh();
  }

  return {
    success: `${valid.length} ${valid.length === 1 ? "unit" : "units"} imported${skipped.length ? `, ${skipped.length} skipped` : ""}`,
    skipped,
  };
}

export async function deleteUnit(unitId: string): Promise<ActionState> {
  const { supabase } = await requireOrg();
  const { error } = await supabase.from("units").delete().eq("id", unitId);
  if (error) {
    return { formError: "The unit couldn't be removed. Give it another try." };
  }
  refresh();
  return { success: "Unit removed" };
}

export async function resetPayLink(unitId: string): Promise<ActionState> {
  const token =
    crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "");

  const { supabase } = await requireOrg();
  const { error } = await supabase
    .from("units")
    .update({ portal_token: token })
    .eq("id", unitId);

  if (error) {
    return { formError: "The link couldn't be reset. Give it another try." };
  }
  refresh();
  return { success: "Pay link reset — previously shared links no longer work" };
}

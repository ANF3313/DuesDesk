"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/org";
import { parseMoneyInput } from "@/lib/money";
import { expenseSchema, fieldErrorsOf, type ActionState } from "@/lib/validation";

function refresh() {
  revalidatePath("/expenses");
  revalidatePath("/reports");
}

function parseExpenseForm(formData: FormData) {
  return expenseSchema.safeParse({
    amountCents: parseMoneyInput(String(formData.get("amount") ?? "")),
    category: formData.get("category") ?? "",
    memo: formData.get("memo") ?? "",
    vendor: formData.get("vendor") ?? "",
    spentOn: formData.get("spentOn") ?? "",
  });
}

export async function createExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseExpenseForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { supabase, user, orgId } = await requireOrg();
  const { error } = await supabase.from("expenses").insert({
    org_id: orgId,
    amount_cents: parsed.data.amountCents,
    category: parsed.data.category,
    memo: parsed.data.memo,
    vendor: parsed.data.vendor || null,
    spent_on: parsed.data.spentOn,
    created_by: user.id,
  });
  if (error) return { formError: "The expense couldn't be saved. Give it another try." };

  refresh();
  return { success: "Expense recorded" };
}

export async function updateExpense(
  expenseId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseExpenseForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { supabase } = await requireOrg();
  const { error } = await supabase
    .from("expenses")
    .update({
      amount_cents: parsed.data.amountCents,
      category: parsed.data.category,
      memo: parsed.data.memo,
      vendor: parsed.data.vendor || null,
      spent_on: parsed.data.spentOn,
    })
    .eq("id", expenseId);
  if (error) return { formError: "The changes couldn't be saved. Give it another try." };

  refresh();
  return { success: "Expense updated" };
}

export async function deleteExpense(expenseId: string): Promise<ActionState> {
  const { supabase } = await requireOrg();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) return { formError: "The expense couldn't be deleted. Give it another try." };
  refresh();
  return { success: "Expense deleted" };
}

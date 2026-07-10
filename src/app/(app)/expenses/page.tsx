import type { Metadata } from "next";
import { requireOrg } from "@/lib/org";
import { todayISO } from "@/lib/dates";
import type { Expense } from "@/lib/types";
import { ExpensesClient } from "./expenses-client";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const { supabase } = await requireOrg();
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .order("spent_on", { ascending: false })
    .limit(500);

  const expenses = (data ?? []) as Expense[];
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";
  const yearStart = today.slice(0, 5) + "01-01";

  const thisMonthCents = expenses
    .filter((e) => e.spent_on >= monthStart)
    .reduce((s, e) => s + e.amount_cents, 0);
  const ytdCents = expenses
    .filter((e) => e.spent_on >= yearStart)
    .reduce((s, e) => s + e.amount_cents, 0);

  return (
    <ExpensesClient
      expenses={expenses}
      thisMonthCents={thisMonthCents}
      ytdCents={ytdCents}
    />
  );
}

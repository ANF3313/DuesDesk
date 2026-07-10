import type { Metadata } from "next";
import { requireOrg, appUrl } from "@/lib/org";
import { todayISO } from "@/lib/dates";
import type { Unit } from "@/lib/types";
import { UnitsClient, type UnitBalance } from "./units-client";

export const metadata: Metadata = { title: "Units" };

export default async function UnitsPage() {
  const { supabase } = await requireOrg();

  const [unitsRes, openRes] = await Promise.all([
    supabase.from("units").select("*").order("label"),
    supabase
      .from("invoices")
      .select("unit_id, amount_cents, status, due_date")
      .in("status", ["open", "processing"]),
  ]);

  const units = (unitsRes.data ?? []) as Unit[];
  const openInvoices = (openRes.data ?? []) as Array<{
    unit_id: string;
    amount_cents: number;
    status: string;
    due_date: string;
  }>;

  const today = todayISO();
  const balances: Record<string, UnitBalance> = {};
  for (const inv of openInvoices) {
    const b = (balances[inv.unit_id] ??= { cents: 0, overdue: false });
    b.cents += inv.amount_cents;
    if (inv.status === "open" && inv.due_date < today) b.overdue = true;
  }

  return <UnitsClient units={units} balances={balances} baseUrl={appUrl()} />;
}

import type { Metadata } from "next";
import { requireOrg } from "@/lib/org";
import type { DuesSchedule, Invoice, Unit } from "@/lib/types";
import { InvoicesClient } from "./invoices-client";

export const metadata: Metadata = { title: "Invoices" };

export type InvoiceWithUnit = Invoice & { units: { label: string } | null };
export type ScheduleWithUnit = DuesSchedule & { units: { label: string } | null };
export type UnitOption = Pick<Unit, "id" | "label" | "member_name" | "dues_amount_cents">;

export default async function InvoicesPage() {
  const { supabase } = await requireOrg();

  const [invoicesRes, schedulesRes, unitsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, units(label)")
      .order("created_at", { ascending: false }),
    supabase
      .from("dues_schedules")
      .select("*, units(label)")
      .order("next_invoice_date"),
    supabase
      .from("units")
      .select("id, label, member_name, dues_amount_cents")
      .order("label"),
  ]);

  return (
    <InvoicesClient
      invoices={(invoicesRes.data ?? []) as unknown as InvoiceWithUnit[]}
      schedules={(schedulesRes.data ?? []) as unknown as ScheduleWithUnit[]}
      units={(unitsRes.data ?? []) as UnitOption[]}
    />
  );
}

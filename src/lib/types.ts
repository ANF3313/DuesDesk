/** Row shapes matching supabase/schema.sql. */

export type Org = {
  id: string;
  name: string;
  currency: string;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  late_fee_cents: number;
  late_fee_grace_days: number;
  last_digest_on: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  org_id: string;
  full_name: string | null;
  role: "owner" | "admin";
  created_at: string;
};

export type Unit = {
  id: string;
  org_id: string;
  label: string;
  member_name: string;
  member_email: string;
  dues_amount_cents: number;
  portal_token: string;
  created_at: string;
};

export type DuesSchedule = {
  id: string;
  org_id: string;
  unit_id: string;
  amount_cents: number;
  currency: string;
  cadence: "monthly" | "quarterly" | "annually";
  memo: string;
  next_invoice_date: string;
  active: boolean;
  created_at: string;
};

export type InvoiceStatus = "open" | "processing" | "paid" | "void";

export type Invoice = {
  id: string;
  org_id: string;
  unit_id: string;
  schedule_id: string | null;
  amount_cents: number;
  currency: string;
  memo: string;
  due_date: string;
  period: string | null;
  status: InvoiceStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  org_id: string;
  invoice_id: string;
  amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string;
  payment_method: "card" | "us_bank_account" | "other";
  status: "processing" | "succeeded" | "failed";
  failure_reason: string | null;
  created_at: string;
  settled_at: string | null;
};

export type Announcement = {
  id: string;
  org_id: string;
  subject: string;
  body: string;
  recipient_count: number;
  created_by: string | null;
  created_at: string;
};

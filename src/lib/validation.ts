import { z } from "zod";

/**
 * Shared server-side validation. Client forms give fast feedback, but every
 * server action re-validates with these schemas — the client is never trusted.
 */

export type ActionState = {
  fieldErrors?: Record<string, string>;
  formError?: string;
  success?: string;
};

export const OK: ActionState = {};

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const signUpSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(2, "Give your HOA or portfolio a name (at least 2 characters)")
    .max(120, "Keep the name under 120 characters"),
  fullName: z.string().trim().max(120, "Keep your name under 120 characters"),
  email: z.string().trim().toLowerCase().email("That doesn't look like an email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("That doesn't look like an email address"),
  password: z.string().min(1, "Enter your password"),
});

export const orgNameSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(2, "Give your HOA or portfolio a name (at least 2 characters)")
    .max(120, "Keep the name under 120 characters"),
});

export const unitSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Give the unit a name, like “Unit 4B” or “12 Elm St”")
    .max(80, "Keep the unit name under 80 characters"),
  memberName: z
    .string()
    .trim()
    .min(1, "Who lives here or owns it?")
    .max(120, "Keep the name under 120 characters"),
  memberEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("That doesn't look like an email address"),
  duesAmountCents: z
    .number({ message: "Enter an amount like 350 or 350.50" })
    .int()
    .positive("Dues must be more than $0")
    .max(10_000_000, "That's above the $100,000 limit — double-check the amount"),
});

export const oneOffInvoiceSchema = z.object({
  unitId: z.string().uuid("Pick a unit"),
  amountCents: z
    .number({ message: "Enter an amount like 350 or 350.50" })
    .int()
    .positive("The amount must be more than $0")
    .max(10_000_000, "That's above the $100,000 limit — double-check the amount"),
  memo: z
    .string()
    .trim()
    .min(1, "Add a short description, like “July dues”")
    .max(140, "Keep the description under 140 characters"),
  dueDate: isoDate,
});

export const scheduleSchema = z.object({
  unitId: z.string().uuid("Pick a unit"),
  amountCents: z
    .number({ message: "Enter an amount like 350 or 350.50" })
    .int()
    .positive("The amount must be more than $0")
    .max(10_000_000, "That's above the $100,000 limit — double-check the amount"),
  memo: z
    .string()
    .trim()
    .min(1, "Add a short description, like “Monthly dues”")
    .max(140, "Keep the description under 140 characters"),
  cadence: z.enum(["monthly", "quarterly", "annually"], {
    message: "Pick how often this repeats",
  }),
  firstInvoiceDate: isoDate,
});

export const announcementSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Give your announcement a subject")
    .max(150, "Keep the subject under 150 characters"),
  body: z
    .string()
    .trim()
    .min(1, "Write your announcement")
    .max(5000, "Keep it under 5,000 characters"),
});

/** Turn a Zod error into a { field: message } map for form display. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

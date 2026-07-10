export const EXPENSE_CATEGORIES = [
  { id: "maintenance", label: "Maintenance & repairs" },
  { id: "utilities", label: "Utilities" },
  { id: "insurance", label: "Insurance" },
  { id: "landscaping", label: "Landscaping" },
  { id: "legal", label: "Legal & accounting" },
  { id: "management", label: "Management & admin" },
  { id: "reserves", label: "Reserve fund" },
  { id: "other", label: "Other" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["id"];

export function categoryLabel(id: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
}
